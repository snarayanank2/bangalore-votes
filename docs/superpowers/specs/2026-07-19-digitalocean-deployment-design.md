# DigitalOcean Deployment — Design

**Date:** 2026-07-19 · **Status:** approved in brainstorming; to be folded into `docs/architecture.md`

Specifies exactly how the platform deploys to DigitalOcean. Amends `docs/architecture.md`, which locks the hosting shape (single VM, Docker Compose, four services) but names no cloud, no environments, and no release mechanics. Nothing here changes the application architecture; it fills the deployment gap.

## Decisions

| Decision | Choice |
|---|---|
| Cloud | DigitalOcean, region **BLR1** (Bengaluru) |
| Compute | One Premium AMD Droplet, **2 vCPU / 4 GB** (~$28/mo), with a **Reserved IP** |
| Environments | Production **and staging on the same Droplet** as two Compose projects |
| Registry | **GHCR, public images**, in the project's GitHub org |
| Deploy trigger | Push to `main` → staging; **GitHub Release published** → production |
| Last mile | GitHub Actions **SSHes into the Droplet** and runs `docker compose pull && up -d` |
| Versioning | **Date-based tags**: `vYYYY.MM.DD`, `.2` suffix for a second same-day release |
| Backups | restic → **DO Spaces bucket in BLR1** (India-resident) + weekly Droplet snapshots |
| TLS | Let's Encrypt via a **certbot container** sharing a volume with nginx |
| Provisioning | Manual, from a **documented runbook**; no Terraform |

## 1. Region and compute

One Droplet in BLR1 — the audience is in Bengaluru. Premium AMD 2 vCPU / 4 GB runs both environments comfortably; the k6 load test (`architecture.md` §12) validates the size against election-day read volume. If it falls short, resize the Droplet before election week — a minutes-long operation — rather than paying for spike capacity year-round.

A Reserved IP fronts the Droplet. DNS (`bangalore-votes.opencity.in` and `staging.bangalore-votes.opencity.in`, both under Oorvani's `opencity.in`) points at the Reserved IP, so the box can be rebuilt or replaced without a DNS change.

## 2. Two environments, one Droplet

Production and staging run as two Compose projects side by side:

- **One shared nginx container** terminates TLS for both hostnames and proxies to the per-environment `app` containers. It belongs to the production stack; the staging stack joins its network.
- **Staging has its own `app`, `postgres`, and `jobs` containers.** Nothing is shared below nginx.
- **Staging `jobs` cannot message real people.** The staging `.env` carries no production Twilio/SendGrid keys, and a `SENDS_DISABLED` flag makes the campaign runner log instead of send. Both guards, not one: a mis-scheduled campaign on staging must not text citizens.
- **Staging is invisible to the public.** Its nginx server block sends `X-Robots-Tag: noindex` and requires basic auth.
- Staging Postgres is disposable: not backed up, safe to reset.

Accepted trade (chosen over a second Droplet): staging builds and bugs share CPU and disk with production. Mitigation: images are built in CI, never on the Droplet, so the heaviest work never lands on the box.

## 3. Images and registry

CI builds the `app` and `jobs` images; the Droplet only ever pulls. Images live on GHCR as public packages next to the repo — free for public images, no separate push credentials (Actions uses its built-in `GITHUB_TOKEN`), and anyone can pull the exact image a release ran, which suits an open-source civic project. The Droplet pulls anonymously.

Tags: every build gets `:sha-<short-sha>`; `main` builds also get `:edge`; release builds also get the release tag (`:v2026.07.19`) and `:latest`.

## 4. Release flow

**Staging — every merge.** Push to `main` → Actions runs tests, builds and pushes images, then SSHes to the Droplet and runs `docker compose pull && docker compose up -d` on the staging stack. Every merge is live on staging within minutes.

**Production — on release.** Publishing a GitHub Release triggers the production workflow: build the images fresh from the release tag's commit, push with the release tag, SSH in, pull and restart the production stack. (Retagging an existing `:sha-*` image is a possible later optimization; a fresh build is simpler and always correct.)

Publishing a release, concretely: repo → Releases → *Draft a new release* → type the new tag (`v2026.07.19`; the tag is created on publish) → target `main`, or a specific commit if `main` has moved past what should ship → *Generate release notes* (GitHub compiles merged PRs since the last release; edit as needed) → *Publish*. From the terminal: `gh release create v2026.07.19 --generate-notes`.

**Versioning.** Date-based tags, `vYYYY.MM.DD`, with `.2` appended for a second release the same day. Semver encodes API-compatibility promises this deployed site doesn't make; a date tag states the one fact operators ask for — how old is what's live. GitHub Releases carries the changelog.

**Rollback.** Re-run the production deploy workflow (`workflow_dispatch`) with the previous release tag. Images are immutable in GHCR, so rollback is a pull and restart, not a rebuild.

**SSH from CI.** A dedicated `deploy` user on the Droplet, in the `docker` group, key-only. Its private key lives in GitHub Environment secrets — `staging` and `production` environments, separate keys. The `production` environment can require a reviewer's approval before the deploy job runs; start without the gate, enable it if wanted.

## 5. Network and TLS

- **DO Cloud Firewall** allows inbound 22, 80, 443 only.
- **SSH:** keys only, passwords and root login disabled.
- **TLS:** a certbot container obtains and renews Let's Encrypt certificates for both hostnames via HTTP-01, sharing a webroot and certificate volume with nginx; nginx reloads on renewal. "nginx terminates TLS" (`architecture.md` §3) is unchanged.

## 6. Backups

The restic target in `architecture.md` §10 becomes a **DO Spaces bucket in BLR1** (S3-compatible, ~$5/mo). India-resident storage was chosen deliberately: the dump holds DPDP-regulated personal data, and Oorvani prefers it stay in-country.

**Accepted limitation (recorded):** backups share a region with the Droplet, so a region-wide DigitalOcean failure loses both. Weekly Droplet snapshots are the second layer, but they live in the same region too. The prior design (bucket in SGP1) traded residency for disaster isolation; residency won.

## 7. Provisioning runbook

No Terraform — one Droplet doesn't justify it. Provisioning is a numbered runbook in `docs/architecture.md`:

1. Create the BLR1 Droplet (Premium AMD 2 vCPU / 4 GB), attach the Cloud Firewall and Reserved IP.
2. Point DNS for both hostnames at the Reserved IP.
3. Install Docker Engine + Compose; create the `deploy` user (key-only, `docker` group).
4. Clone the repo; write the two `.env` files (mode 600, outside the repo — `architecture.md` §13).
5. Run certbot once for both hostnames; start the production stack, then staging.
6. Initialize the restic repository against the Spaces bucket; rehearse a restore (dependency register §6.9).

## 8. Running cost

Droplet ~$28 + Spaces ~$5 + snapshots ~$1–2 + GHCR $0 ≈ **$34–35/mo** before messaging, geocoding, and Anthropic spend. This is a concrete input to the open total-budget question (dependency register §6.11).

## 9. Document changes

- `docs/architecture.md`: add a **Deployment (DigitalOcean)** section carrying §§1–8 above; replace the `git pull && docker compose up -d --build` line in §3 with the GHCR pull flow; update §10 to name the Spaces bucket; add the same-region-backup limitation to §13's accepted-limitations list.
- `docs/project-dependencies.md`: annotate rows 6.1 (DigitalOcean Droplet, BLR1), 6.7 (CDN still optional/post-launch — unchanged), 6.9 (Spaces bucket, BLR1, restic).
- `CLAUDE.md`: one line noting deployment is DigitalOcean per `docs/architecture.md`.

## Out of scope

CDN selection (post-launch, unchanged), CI test-suite contents (defined by `architecture.md` §12), messaging-vendor setup, and any application code.
