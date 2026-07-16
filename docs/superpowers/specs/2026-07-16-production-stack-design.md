# Production Stack Design

**Date:** 2026-07-16
**Status:** Approved
**Scope:** Technology choices and runtime architecture for the GBA Elections Citizen Platform. This document decides *what we build on*, not *what we build*. Feature behaviour remains governed by `docs/prd.md` and `docs/information-architecture.md`.

---

## 1. Goal

Choose and record the stack for the real application: a monorepo containing a FastAPI backend and a web frontend, backed by PostgreSQL, running entirely under Docker Compose.

The existing `prototype/` directory — a client-side React demo with mock data deployed to GitHub Pages — **stays as it is**. It remains the clickable stakeholder demo, keeps its own CI workflow, and is not migrated. The real application is built alongside it.

---

## 2. Decisions

| Area | Choice | Why |
|---|---|---|
| Repo | Plain directories, no monorepo tool | One JS app, one Python app. Turborepo/Nx exist to cache builds across many JS packages; there is nothing here for them to do. |
| Backend | FastAPI, Python 3.12, `uv` | Given. |
| Database | PostgreSQL 16 + PostGIS | PRD §5.1 requires address→ward lookup; §5.10 requires an address-accurate booth location. Both are point-in-polygon queries against ward boundaries. |
| Frontend | Next.js (App Router), TypeScript, Tailwind | Public pages are shareable links forwarded by RWAs (PRD §12, IA §2). Server rendering gives working WhatsApp/Twitter link previews and fast first paint on low-end phones; a client-rendered SPA gives neither. |
| Map rendering | MapLibre GL + ward boundary GeoJSON | Open-source, no per-map-view billing on an election-day traffic spike. Rendering is what scales with pageviews. |
| Geocoding | Google Geocoding API, server-side, cached to ward | Best Bengaluru address coverage by a wide margin; no open geocoder is close. Bills per request, and caching drives requests toward zero. See §6. |
| ORM / migrations | SQLAlchemy 2.0 (async) + Alembic | Conventional FastAPI pairing. |
| Schemas | Pydantic v2 | Conventional; already the FastAPI default. |
| Sessions | Signed HTTP-only cookie | The Next.js server must read the session to render authenticated pages. Cookies are also revocable, which PRD §7 requires (admins deactivate accounts). A JWT is not revocable without adding the same server-side lookup a session already is. |
| Jobs + cache | Redis 7 + ARQ worker | Earns its place four ways: job queue, rate limiting (PRD §12), OTP expiry via native TTL, and ward-page caching for the spike. |
| Translation | Claude (`claude-opus-4-8`) via the Anthropic SDK | See §5. |
| Deployment | Docker Compose on a VM, CDN in front | Given. Compose is production, with an override for development. |
| Testing | pytest (API), Vitest + Playwright (web) | Conventional for each language. |

### Decisions explicitly *not* revisited

The locked decisions in `docs/prd.md` §14 stand unchanged: OTP-only auth for all four roles, curator edits publishing without an approval gate, EN/Kannada throughout, and 369 wards as the scale target.

---

## 3. Repository layout

```
bangalore-votes/
├─ apps/
│  ├─ api/                FastAPI service
│  │  ├─ src/
│  │  ├─ migrations/      Alembic
│  │  ├─ tests/
│  │  └─ pyproject.toml
│  └─ web/                Next.js app
│     ├─ app/             App Router; routes mirror the IA site map exactly
│     ├─ lib/api/         generated OpenAPI client — do not hand-edit
│     └─ package.json
├─ prototype/             existing GitHub Pages demo — untouched, own CI
├─ ops/
│  ├─ api.Dockerfile
│  ├─ web.Dockerfile
│  ├─ Caddyfile
│  └─ seed/               ward boundary GeoJSON, seed fixtures
├─ docs/                  PRD, IA, overview, specs, plans
├─ compose.yaml           base — this is production
└─ compose.override.yaml  development additions
```

### The API contract

FastAPI already emits an OpenAPI schema. A codegen step turns it into TypeScript types under `apps/web/lib/api/`, committed to the repo and verified in CI. A backend field rename therefore fails the frontend typecheck rather than failing in a citizen's browser. `lib/api/` is generated output and is never edited by hand.

---

## 4. Runtime

Six containers. One `compose.yaml` runs in production; `compose.override.yaml` adds hot reload and exposed ports for development.

| Container | Image / build | Responsibility |
|---|---|---|
| `caddy` | `caddy:2` | Reverse proxy, automatic TLS, single entry point |
| `web` | `ops/web.Dockerfile` | Next.js server — renders public pages |
| `api` | `ops/api.Dockerfile` | FastAPI + uvicorn — JSON API, OpenAPI schema |
| `worker` | same image as `api` | ARQ — queued jobs and cron |
| `db` | `postgis/postgis:16` | Data and ward boundary polygons |
| `redis` | `redis:7` | Queue, rate limits, OTP TTL, page cache |

`worker` reuses the `api` image with a different entrypoint. There is one Python dependency set and one build.

### Traffic

The vast majority of traffic is anonymous reads of ward and candidate pages (PRD §4). Caddy terminates TLS; a CDN sits in front of Caddy and absorbs that read traffic on election day. Nothing in the application writes to local disk, so the containers stay replaceable and the VM stays disposable.

### Operational requirements

- **Postgres backups.** Compose-on-a-VM means backups are ours to run, not a managed service's. Scheduled `pg_dump` to off-box storage, with a restore rehearsal before launch. An unrehearsed backup is not a backup.
- **Secrets** via environment, never committed. The Anthropic API key, session signing key, and mail credentials all live outside the repo.

---

## 5. Bilingual content and auto-translation

PRD §14 locks EN/Kannada throughout. The decision recorded here is *how curator-authored content becomes bilingual*: **it is machine-translated, and curators may correct it.** Many curators do not read or write Kannada, so requiring them to author it would either stall content or produce bad Kannada.

### Field shape

Every curator-authored text field stores:

| Column | Meaning |
|---|---|
| `en` | The curator's English text. Authoritative. |
| `kn` | Kannada text — machine-generated or curator-corrected. Nullable. |
| `kn_status` | `machine` \| `reviewed` \| `stale` |

### Flow

1. Curator saves English. The API writes it and **publishes immediately** — PRD §14 forbids a gate — then enqueues a translation job.
2. The worker calls Claude with the field's civic context (that this is, say, a candidate's declared assets from an EC affidavit, not prose), writes `kn`, sets `kn_status = machine`.
3. A curator who reads Kannada may edit `kn` and set `kn_status = reviewed`.
4. Editing `en` sets `kn_status = stale` and re-enqueues, because the reviewed Kannada now describes text that no longer exists.

**The worker only ever writes to a field whose status is `stale`.** A `reviewed` translation is therefore never touched while its English is unchanged — the only thing that can supersede a curator's Kannada is the curator editing the English it was translated from, and that is a deliberate act, not a background job surprising them.

### Reader behaviour

Kannada renders when `kn` is present; otherwise English renders. **A translation outage degrades to English, never to a blank field.** The translation path is never in the request path of a page load.

### Audit

Translation writes are system-authored, not curator-authored. They append to the audit log (PRD §14 requires every published change to) with the worker as actor, so a machine translation is never mistaken for a curator's words.

---

## 6. Geospatial

- Ward boundaries load from the GBA delimitation GeoJSON into a PostGIS `geography(Polygon)` column, indexed with GiST.
- Ward lookup: geocode the address to a point, then one `ST_Contains` query returns the ward.
- Boundaries render client-side in MapLibre GL from a GeoJSON endpoint, cached in Redis — the polygons change roughly never.

### Split responsibility: Google geocodes, MapLibre renders

| Job | Provider | Billing exposure |
|---|---|---|
| Address → coordinates | Google Geocoding API | Per request — and a cached request is no request |
| Rendering boundaries and booth pins | MapLibre GL | None |

Google has by a wide margin the best Bengaluru address coverage; no open geocoder handles local layouts, cross-roads, and colloquial addresses well enough for PRD §5.1. But **per-map-view billing was the real election-day risk, and rendering is the thing that scales with pageviews.** Keeping MapLibre for rendering removes that exposure entirely. Geocoding scales with *distinct addresses typed*, which is a far smaller number and one caching drives toward zero.

**The Google key is server-side only.** The browser never calls Google and never sees the key. Geocoding happens inside the API.

### Caching: cache the ward, not the coordinates

Google's Maps Platform terms permit caching latitude/longitude for **at most 30 consecutive calendar days**, after which cached coordinates must be deleted. Only `place_id` is exempt and may be stored indefinitely.

**This does not constrain us, because we do not want the coordinates.** We want the ward. So:

1. Normalize the address (lowercase, collapse whitespace, strip punctuation) and hash it.
2. On a miss, call Google, get a point, run `ST_Contains` against our boundaries — **all within the one request**.
3. Store `address_hash → ward_id`. **Discard the lat/lng.**

The stored ward assignment is derived from our own PostGIS boundary data, not from Google Maps Content, so the durable cache is not subject to the 30-day rule. This keeps us clearly inside the terms rather than near their edge, and it is also just the better design — the ward is what every caller wanted, and coordinates were only ever an intermediate.

> **Note:** this is an engineering reading of the terms, not legal advice. Worth a lawyer's glance before launch given the platform is public and civic. If a conservative reading prevails, the fallback is a 30-day TTL on the cache — more Google calls, same behaviour, higher bill. Nothing else in the design moves.

**Two layers:**

| Layer | Store | Lifetime | Purpose |
|---|---|---|---|
| Hot | Redis | 30 days, refreshed on hit | Absorbs the spike |
| Durable | Postgres `address_ward_cache` | Permanent | Survives Redis restarts and cold starts |

Invalidated wholesale only when ward boundaries are redrawn — a rare, deliberate, admin-triggered event.

### Cost containment

Caching handles the ordinary case; these handle the adversarial one, since an uncached-address flood is the failure mode that produces a surprise invoice:

- **Rate limit geocoding per session**, on the same Redis the PRD already requires it for (§12).
- **A daily spend cap.** On breach, address lookup degrades to ward-name and pincode search — which need no geocoder — with a notice, rather than failing or billing without limit.
- **A circuit breaker** on Google errors and timeouts, degrading the same way. A Google outage must not take down ward lookup.

### Remaining risk

Geocoding quality is now a solved problem; **the delimitation boundary data is not.** Ward-name and pincode lookup ship first regardless — they are exact matches, need no geocoder, and give a working path while the GeoJSON (PRD §15) is still being sourced. Address lookup layers on top once boundaries are loaded.

---

## 7. Authentication

One OTP mechanism for all four roles (PRD §14).

**The delivery layer is pluggable.** A single `OtpSender` interface with three implementations:

| Implementation | Use |
|---|---|
| `ConsoleSender` | Development — prints the code |
| `EmailSender` | Launch baseline |
| `WhatsAppSender` | Meta Cloud API, enabled by config when approved |

WhatsApp Business API requires a verified business and pre-approved message templates — weeks of process, and PRD §15 already flags it as a fast-follow behind email. The interface means that arrives as a config change, not a rewrite.

Codes live in Redis with a native TTL; expiry needs no cleanup job.

---

## 8. Notifications — deliberate carve-out

**Notifications are curator/admin-driven: a human composes and sends. Nothing fans out automatically on a data edit.**

This subsystem is **not designed in this document.** It gets its own spec → plan → build cycle, because it touches the permissions matrix (PRD §7) and adds pages the IA does not yet have. Designing it inside a stack document would produce a worse version of both.

### What the stack reserves for it

Nothing new. The containers above already cover it:

- **Fan-out** — one job per recipient on the existing ARQ worker. A send to a 4,000-subscriber ward returns immediately and drains in the background; one dead mailbox retries alone rather than taking down the batch.
- **Delivery** — the same `OtpSender` interface from §7. One integration, two callers.
- **Scheduling** — ARQ's built-in cron. Unused at launch; present when an admin wants to queue the roll-deadline notice for a fixed time.

Because a human decides what goes out and when, **the curator is the rate limiter.** There is no digest accumulator, flush window, or automatic per-edit send to design.

### What this document does anyway, so the deferral costs nothing later

- Notification bodies use the same `{en, kn}` shape as §5 — PRD §14 makes a user's language preference govern their notification language.
- `Subscription` and `Notification` tables are stubbed in the initial schema, so the later feature does not force a migration through live data.

### Left to the notifications spec

Who may send to which wards (curator scoped to assigned wards vs admin city-wide); what a message is composed of; whether an irreversible send needs a preview or second pair of eyes; how subscribers opt out.

---

## 9. Consequences and trade-offs

**Accepted:**

- **Compose on a VM does not autoscale.** The election-day spike is absorbed by a CDN in front and a large enough VM. If read traffic overruns that, the fix is CDN configuration, not an architecture change — the app is stateless and could move to a container platform, but we are not building for that now.
- **Next.js adds a second runtime to operate.** Paid for by working link previews and fast first paint, both of which the PRD treats as core.
- **A machine translation may be wrong until a curator reviews it.** Accepted: the alternative is either no Kannada or stalled content. Mitigated by `kn_status` and curator correction.
- **Backups are ours.** See §4.
- **A dependency on Google for geocoding.** Accepted for address quality, and bounded: it is one server-side call behind a cache, a spend cap, and a circuit breaker, and every failure mode degrades to pincode search rather than to an outage. Replacing the provider means reimplementing one function.

**Rejected:**

- **Google Maps for rendering** — per-map-view billing on a spike day and a key in the client. Rejected for rendering only; Google is used for geocoding (§6), where the billing scales with distinct addresses rather than pageviews.
- **An open geocoder (Nominatim/Photon)** — no billing and no vendor, but coverage of Bengaluru layouts, cross-roads, and colloquial addresses is too patchy to meet PRD §5.1.
- **Vite SPA** — same stack as the prototype, but no link previews and weak SEO across 369 ward pages.
- **Twilio Verify** — least code for WhatsApp OTP, but per-verification pricing and vendor lock-in, and its India WhatsApp onboarding still needs Meta business verification, so it does not remove the blocker it exists to remove.
- **FastAPI `BackgroundTasks` instead of a queue** — no new containers, but jobs die with the process, with no retry and no visibility.

---

## 10. Next step

Write the implementation plan for the scaffold: repo layout, six-container compose, the initial schema including the `{en, kn}` field shape, the `address_ward_cache` table, and stubbed notification tables, plus a CI pipeline.

**Notifications remain carved out** (§8) and are not part of that plan.
