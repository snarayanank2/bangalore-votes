# syntax=docker/dockerfile:1
#
# GBA Elections Citizen Platform — single production image for BOTH the
# Astro app and the cron jobs container (Task 59; architecture.md §14).
# The `app` service runs this image as `node ./dist/server/entry.mjs`; the
# `jobs` service runs the SAME image as `supercronic /app/deploy/crontab`.
# Everything both entrypoints read from disk at runtime — the built Astro
# server, `data/`, `content/`, `drizzle/` migrations, `jobs/` + `src/`
# TypeScript (jobs run via `tsx`, not compiled), `deploy/crontab`, and
# `scripts/backup.sh` — must be present in the final stage. See the Task 59
# report (.superpowers/sdd/task-59-report.md) for how the runtime read paths
# were empirically verified against the actual `astro build` output.

########################################################################
# Stage 1: build — full (dev+prod) deps, `astro build` -> dist/
########################################################################
FROM node:22-slim AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

# Full source needed for the build: astro.config.mjs, src/, content/
# (content collections are synced at build time from content/pages/),
# public/, tsconfig.json, drizzle.config.ts, etc.
COPY . .

RUN npm run build

########################################################################
# Stage 2: deps-prod — production-only node_modules for the runtime image.
#
# tsx was moved from devDependencies to dependencies in package.json
# (package-lock.json regenerated to match) specifically so it survives
# `npm ci --omit=dev` here — the jobs service invokes `tsx jobs/*.ts`
# directly against this same pruned install, and without this move
# `npm ci --omit=dev` would strip tsx and every cron job would fail.
########################################################################
FROM node:22-slim AS deps-prod
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

########################################################################
# Stage 3: runtime
########################################################################
FROM node:22-slim AS runtime
LABEL org.opencontainers.image.source="https://github.com/snarayanank2/bangalore-votes"

WORKDIR /app

# pg_dump           -> scripts/backup.sh. Debian bookworm's own repo only
#                       ships postgresql-client-15, but this platform's
#                       Postgres is v16 (docker-compose/CI both use
#                       postgres:16) — a v15 pg_dump REFUSES to dump a v16
#                       server ("aborting because of server version
#                       mismatch", confirmed empirically while verifying
#                       this image). So: add the PGDG apt repo and install
#                       postgresql-client-16 explicitly, not the bookworm
#                       default `postgresql-client` meta-package.
# restic             -> scripts/backup.sh's backup/verify step
# curl               -> scripts/backup.sh's healthchecks.io ping, and
#                       supercronic's own download below
# jq                 -> scripts/backup.sh's restic-snapshot-count check
# ca-certificates    -> TLS for pg_dump/restic/curl/the app's own outbound
#                       calls (geocode, SendGrid, Twilio, Anthropic, ...)
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
       ca-certificates \
       curl \
       gnupg \
    && install -d /usr/share/postgresql-common/pgdg \
    && curl -fsSL https://www.postgresql.org/media/keys/ACCC4CF8.asc \
       -o /usr/share/postgresql-common/pgdg/apt.postgresql.org.asc \
    && . /etc/os-release \
    && echo "deb [signed-by=/usr/share/postgresql-common/pgdg/apt.postgresql.org.asc] https://apt.postgresql.org/pub/repos/apt ${VERSION_CODENAME}-pgdg main" \
       > /etc/apt/sources.list.d/pgdg.list \
    && apt-get update \
    && apt-get install -y --no-install-recommends \
       postgresql-client-16 \
       restic \
       jq \
    && apt-get purge -y gnupg \
    && apt-get autoremove -y \
    && rm -rf /var/lib/apt/lists/*

# supercronic (jobs container's cron scheduler; deploy/crontab is invoked as
# `supercronic /app/deploy/crontab`). Pinned version + published sha1sum,
# picked by target arch — see
# https://github.com/aptible/supercronic/releases/tag/v0.2.47's own
# "Installation Instructions" for the per-arch checksums used below.
ARG TARGETARCH
ARG SUPERCRONIC_VERSION=v0.2.47
ARG SUPERCRONIC_SHA1SUM_AMD64=712d2ece75da6f6e530192a151488578153e4e96
ARG SUPERCRONIC_SHA1SUM_ARM64=93323899ddca3f1198f1796a4bf4418ed1e7982e
RUN set -eu; \
    case "${TARGETARCH}" in \
      amd64) SUPERCRONIC_BIN="supercronic-linux-amd64"; SUPERCRONIC_SHA1SUM="${SUPERCRONIC_SHA1SUM_AMD64}" ;; \
      arm64) SUPERCRONIC_BIN="supercronic-linux-arm64"; SUPERCRONIC_SHA1SUM="${SUPERCRONIC_SHA1SUM_ARM64}" ;; \
      *) echo "unsupported TARGETARCH: ${TARGETARCH}" >&2; exit 1 ;; \
    esac; \
    SUPERCRONIC_URL="https://github.com/aptible/supercronic/releases/download/${SUPERCRONIC_VERSION}/${SUPERCRONIC_BIN}"; \
    curl -fsSLO "$SUPERCRONIC_URL"; \
    echo "${SUPERCRONIC_SHA1SUM}  ${SUPERCRONIC_BIN}" | sha1sum -c -; \
    chmod +x "$SUPERCRONIC_BIN"; \
    mv "$SUPERCRONIC_BIN" /usr/local/bin/supercronic

# Production node_modules (tsx included — see Stage 2's comment).
COPY --from=deps-prod /app/node_modules ./node_modules

# Built Astro server + client assets.
COPY --from=build /app/dist ./dist

# Runtime file dependencies read straight off disk (NOT bundled into
# dist/server by esbuild) — empirically verified against this project's
# actual `astro build` output (see the Task 59 report):
#
#   - src/lib/geo.ts / src/lib/pincode.ts resolve
#     `path.join(__dirname, '..', '..', 'data', ...)` from wherever esbuild
#     places their compiled chunk. Both land under dist/server/chunks/, so
#     '..' '..' resolves to dist/ — i.e. dist/data/gba.geojson and
#     dist/data/pincode-wards.json, NOT /app/data. Copied to BOTH locations
#     below so the image is correct regardless of future chunk-layout
#     changes from an Astro/esbuild upgrade.
#   - src/i18n/content.ts resolves `new URL('../../content/pages/',
#     import.meta.url)` the same way: its compiled chunk also lands under
#     dist/server/chunks/, so this resolves to dist/content/pages/, not
#     /app/content. Copied to both locations for the same reason.
#   - src/db/migrate.ts reads `./drizzle` relative to CWD (WORKDIR /app),
#     so drizzle/ only needs to exist at /app/drizzle.
#   - The jobs service runs `tsx jobs/*.ts`, importing `src/lib/*`
#     TypeScript directly (no build step for jobs) — both jobs/ and src/
#     must ship as source.
COPY data ./data
COPY data ./dist/data
COPY content ./content
COPY content ./dist/content
COPY drizzle ./drizzle
COPY jobs ./jobs
COPY src ./src
COPY deploy ./deploy
COPY scripts ./scripts
COPY package.json ./package.json

ENV HOST=0.0.0.0 \
    PORT=4321 \
    NODE_ENV=production \
    PATH="/app/node_modules/.bin:${PATH}"

# deploy/crontab invokes jobs as bare `cd /app && tsx jobs/X.ts` (no `npm
# run`/`npx` wrapper to put node_modules/.bin on PATH for it) — confirmed by
# running a job that way and hitting "tsx: not found" until this PATH
# prepend was added. `npm run migrate`/`npm run seed:*` don't need this
# (npm already puts node_modules/.bin on PATH for scripts it runs), but the
# jobs container's raw supercronic-invoked commands do.

EXPOSE 4321

CMD ["node", "./dist/server/entry.mjs"]
