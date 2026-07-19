# Production Architecture

This document records the production architecture for the platform defined in `docs/prd.md` and `docs/information-architecture.md`. It answers: what runs where, what is cached, what is dynamic, and how the site stays fast, bilingual, indexable, and secure on a single VM with no CDN. Decided 2026-07-17.

---

## 1. Context & constraints

- **Hosting shape is decided:** a single VM running Docker Compose (`docs/project-dependencies.md` §6.1) — a DigitalOcean Droplet in BLR1; the full deployment design is §14. No CDN at launch; one may be added later.
- **Traffic shape:** overwhelmingly anonymous, read-only, spiking near election day. Content changes only when a curator publishes — not per request. Anonymous reads must stay fast with no login wall (PRD §12).
- **Team:** TypeScript/Node.
- **SEO/AEO is a requirement:** ward, candidate, and guide pages must be indexable by search engines and quotable by answer engines, in both English and Kannada.
- **Decided vendors** (dependency register §3, §6): Twilio/SendGrid for messaging, Google Geocoding server-side, MapLibre rendering, Anthropic API for Kannada machine translation and affidavit field extraction (PRD §5.2), Google Analytics for visitor/event measurement (client-side snippet on public pages; static markup, so it does not break the one-cached-variant-per-URL invariant in §5).

## 2. Decision summary

| Decision | Choice |
|---|---|
| Application | One **Astro SSR monolith** (Node adapter, TypeScript): public pages, API endpoints, curator/admin screens |
| Database | **Postgres**, accessed via Drizzle; audit log as append-only table |
| Edge | **nginx**: TLS, static files, per-IP rate limiting, **micro-cache** for anonymous page GETs |
| Jobs | A **cron container** sharing the app codebase: send calendar, translation retries, backups |
| Language URLs | English at root, **Kannada under `/kn/`**, hreflang-linked; the toggle navigates between them |
| Spike strategy | nginx micro-cache (~60 s TTL on pages) — no purge machinery; CDN slots in front later unchanged |
| Geo | Ward polygons as static GeoJSON (MapLibre reads them directly) + in-memory point-in-polygon (Turf.js); **no PostGIS** |
| Client JS | Zero by default; islands only for modals, maps, and lookup forms |
| Deployment | **DigitalOcean Droplet (BLR1)**; staging + production on one box; CI-built public GHCR images; push-to-main → staging, GitHub Release → production (§14) |

Alternatives considered: a Next.js monolith with ISR (heavier runtime, React hydration on every page, more framework than 19 mostly-read routes need) and a fully static build plus separate API service (spike-proof reads, but "publish immediately" becomes a rebuild pipeline and one deployable becomes two). Both were rejected in favour of the lighter shape above.

## 3. System overview

Four Compose services on the single VM:

| Service | Role |
|---|---|
| `nginx` | TLS termination; serves static assets (built JS/CSS, ward GeoJSON, images, posters); micro-cache for anonymous HTML; `limit_req` rate limiting; compression; security headers (§13) |
| `app` | Astro SSR (Node). All routes: public pages, `/api/*`, `/account/*`, `/curator/*`, `/admin/*` |
| `postgres` | Single database |
| `jobs` | Cron-driven Node scripts: campaign sends, translation retries, sitemap regeneration, nightly `pg_dump` shipped off-box |

No Redis, no queue, no separate API service. Deploys pull CI-built images from GHCR and restart — nothing builds on the VM (§14).

## 4. Routing & rendering

- Public pages are server-rendered to complete HTML with **zero client JavaScript by default**. Hydrated islands only for: the Register/Login, Flag, and Cast-vote modals; MapLibre maps; the address/pincode lookup; the booth lookup.
- **Language:** every public path exists twice — `/ward/57` (EN) and `/kn/ward/57` (KN) — via Astro i18n routing. The app-bar toggle links to the same page in the other language. Every page emits `hreflang` alternates and `x-default`. A cookie remembers the last choice so `/` can offer Kannada on entry; a registered user's saved preference governs notification language only (PRD §8).
- Curator, admin, and account screens are server-rendered forms with standard POSTs in the same app — no SPA.
- Modals are progressive enhancements over real routes, so the `/login` no-JS fallback comes free.

## 5. Caching & the election-day spike

nginx `proxy_cache` on anonymous-shaped GET HTML:

- Public pages: **~60 s TTL**. Issue-vote results and `/data`: ~5 min. `/api/*`, `/account/*`, `/curator/*`, `/admin/*`: `no-store`, never cached.
- **Invariant: public page HTML never varies by session.** Logged-in users receive the same cached anonymous markup; the three personalized elements (Sign-in vs Account control, register-for-updates slot, already-voted state) are swapped client-side from one `GET /api/me` call. The invariant is enforced, not assumed: **nginx strips the `Cookie` header** before proxying public-page routes, so the app cannot see a session on a cached path, and a route test asserts no `Set-Cookie` on public GETs (§12). Each URL has exactly one cached variant per language.
- **The cache key ignores the query string entirely** on public pages — unknown params can neither fragment the cache nor cache-bust it into a DoS on the origin. `?src={partner}` attribution still works: a small inline script reads `location.search` client-side and stores the slug in a cookie, which the registration endpoint reads (PRD §5.12).
- Worst-case origin load is every public URL rendered once per TTL — about 4,000 renders/minute at the absolute ceiling (369 wards × ~5 pages × 2 languages), well within one Node process. The spike lands on nginx, which serves cached responses at static-file speed.
- The 60 s window satisfies "curator edits go live immediately"; curators previewing edits use uncached curator routes.
- A CDN added later sits in front of nginx with the same cache headers; the one required change is trust: nginx then takes client IPs for rate limiting from `X-Forwarded-For` via `real_ip`, restricted to the CDN's published ranges, so per-IP limits stay unspoofable.

## 6. Data model (sketch)

`wards` (id, name_en, name_kn, corporation, boundary ref) · `candidates` (slug, ward, party, photo) · `candidate_fields` (candidate, field key, value_en, value_kn, authored_lang, translation_status, source_url, source_type `official|curator`) · `candidate_affidavits` (candidate, stored PDF on the VM's disk — covered by the §6.9 backup — origin EC URL if fetched, extraction status; the stored copy is the public source link for affidavit fields, PRD §5.2) · `ward_issues` + per-candidate stances · `issue_votes` (user, ward, up to 3 issues; one active set per user, retired on home-ward change) · `users` (contact, home ward, language, role, `src` attribution, consent record: timestamp + wording version) · `otp_codes`, `sessions` · `flags` (dedupe key → count) · `partners` · `eoi_submissions` · `ward_readiness` (completeness snapshot, sign-off, cleared on candidate-set change) · `audit_log` (append-only; written in the same transaction as the change it records).

Sources are per-field (PRD §11). Ward boundaries are static GeoJSON files served by nginx and loaded into app memory at boot for point-in-polygon lookups.

## 7. API surface & auth

Public endpoints:

| Endpoint | Purpose |
|---|---|
| `POST /api/ward-lookup` | Address → server-side Google geocode → point-in-polygon → ward. Returns a ward, never coordinates (Maps ToS constraint, dependency register §6.4). Normalized-address → ward-ID results are cached (our derived conclusion, no Google content stored); a global daily geocode budget degrades the endpoint to pincode lookup when exhausted (§11) |
| `POST /api/booth-lookup` | Same shape, booth data |
| `POST /api/otp/request`, `POST /api/otp/verify` | Email OTP (SendGrid); WhatsApp OTP when templates approve. Hashed 6-digit code, 10-minute expiry, 5 verify attempts per code (then invalidated); per-destination request cooldowns and a global daily send budget with an alarm (§13) |
| `GET /api/me` | Session state for client-side personalization |
| `POST /api/flags` | Gated write; dedupe; audit |
| `PUT /api/issue-votes` | Home-ward check; one active vote-set |
| `POST /api/eoi` | The one anonymous write; CAPTCHA-protected (PRD §6.3) |

Pincode → ward shortlist is a static JSON lookup table — no API call.

Sessions are signed cookies with `HttpOnly; Secure; SameSite=Lax` and a sliding **1-hour idle timeout for all roles**; re-auth is the normal OTP flow. One middleware enforces roles and curator ward scope (PRD §7); the same middleware rejects unsafe methods that fail an `Origin`/`Sec-Fetch-Site` same-origin check, and server-rendered forms carry a synchronizer CSRF token for the no-JS paths (§13). Rate limiting is layered: nginx `limit_req` per IP on `/api/*`, plus per-account app limits on OTP requests, flags, and votes, plus the per-destination OTP cooldowns above.

## 8. SEO / AEO

- Complete HTML at first byte for all public content — no client-side rendering of content.
- **JSON-LD** per page type: `Person` (candidates, with `sameAs` news links), `Place`/`AdministrativeArea` (wards), `Event` (the election), `FAQPage` (voting guides, check-registration), `Organization` (Oorvani, on `/about`), `BreadcrumbList` throughout.
- Per-language **sitemaps** with `lastmod` from publish timestamps, regenerated by `jobs`; `robots.txt`; canonical URLs.
- `noindex` and sitemap exclusion: `/partner/{slug}` (unlisted, per IA §3.19), `/account/*`, `/curator/*`, `/admin/*`, `/login`.
- **Open Graph tags on every page** in that page's language — distribution is WhatsApp forwarding, so the link preview is the first impression.
- AEO: a concise factual summary block at the top of ward/candidate/guide pages; question-shaped headings on guides; an `llms.txt` index; facts in visible text, not behind interaction.
- Pre-notification candidate routes return **200 with the empty-state content** (PRD §13.1), so shared URLs accumulate authority before data lands.

## 9. Bilingual content: three text layers

| Layer | Lives in | Kannada generated | Reviewed by |
|---|---|---|---|
| UI strings | repo (`en.json` / `kn.json`) | dev-time script | PR review |
| Editorial pages (guides, about-election, home copy) | repo (Markdown per locale: `content/pages/en/…`, `content/pages/kn/…`) | dev-time script | PR review |
| Curator data (report cards, ward issues) | Postgres (`value_en` / `value_kn`) | at publish, runtime | nobody — citizen flags are the correction path (decided trade, PRD §8) |

No layer translates at request time; every render is from stored text.

**Dev-time script** (`npm run translate`): finds missing or stale Kannada files/keys (staleness = hash of the English source stored in the KN file's frontmatter), drafts them via the Anthropic API, writes ordinary files. Output is committed, diffable, and hand-fixable in a PR; hand-fixed files can be marked to skip regeneration.

**Runtime path (curator data), per field:**

1. Curator publishes a field. One transaction writes the authored value, `authored_lang`, `translation_status = pending`, and the audit entry. The authored-language page is live immediately — publish never blocks on translation.
2. In-request (≈5 s timeout), the app calls the Anthropic API to translate the changed field(s) only, with context: field name, candidate/ward, and a fixed glossary (party names, corporation names, "corporator"). Success writes the other language's value, `translation_status = done`, plus model + timestamp.
3. On failure the field stays `pending` — rendered in the authored language with the PRD §8 indicator — and `jobs` retries every few minutes.
4. A curator may edit the Kannada value directly (e.g. resolving a translation flag): that sets `translation_status = manual`, excluding the field from MT until the source value changes again, which regenerates it (the manual fix described the old source text). MT regeneration is audit-logged as a system entry.

Never machine-translated: official bilingual data (ward names arrive with Kannada names) and UI strings.

## 10. Jobs, ops, backups

- `jobs` runs the fixed campaign calendar (`docs/gtm-plan.md`) against SendGrid/Twilio, honouring ward readiness (PRD §9.1), the language preference, and channel toggles; plus translation retries and sitemap regeneration.
- Structured logs to stdout via Compose logging; a healthcheck endpoint.
- Nightly `pg_dump` shipped off-box with **restic** — chosen over rclone because it encrypts at rest by default; the dump contains DPDP-regulated personal data (contacts, home wards, consent records, identity-linked issue votes). The restic repository is a **DO Spaces bucket in BLR1** — India-resident by choice (§14); the same-region trade is recorded in §13. Repository key held off-box, admin-only. Rehearsed restore (dependency register §6.9).

## 11. Error handling

- Geocode failure or ambiguity degrades to pincode lookup with a clear message.
- OTP send failure surfaces immediately with a retry.
- Unknown ward or candidate returns a real 404 page; pre-notification candidate routes return the 200 empty state.
- Audit-log write failure aborts the publish — same transaction.
- Translation failure never blocks publish (see §9).

## 12. Testing

- Vitest for unit and route tests.
- Playwright smoke suite over the critical paths: lookup → ward page; OTP → vote; flag → curator accept → live; language toggle → `/kn/` equivalence.
- One k6 load test proving the nginx micro-cache holds election-day read volume on the actual VM size.
- A route test asserting public GETs set no cookies and contain no session-dependent bytes — the guard on the §5 cache invariant.

## 13. Security

Decided 2026-07-17 after a security review of this design. The per-mechanism details live in the sections above where they apply (§5 cache enforcement, §7 sessions/OTP/geocode, §10 backups, §12 tests); this section carries the cross-cutting rules and the limitations accepted deliberately.

- **CSRF:** `SameSite=Lax` cookies; middleware `Origin`/`Sec-Fetch-Site` check on all unsafe methods; synchronizer tokens on server-rendered forms (§7). Forged curator publishes are the worst outcome this design can produce, so this is not optional hardening.
- **OTP:** 5 verify attempts per code, then the code is invalidated. Per-destination request cooldowns — per email/phone: 1/minute, 5/hour, and a daily cap — because botnets defeat per-IP limits and per-destination limits are what stop SMS/WhatsApp pumping. A global daily send budget with an ops alarm bounds what an attack can cost.
- **Cost amplification:** the geocode cache stores normalized address → ward ID only — the platform's own derived conclusion, never Google's coordinates or response content (ToS stance: dependency register §6.4). A daily geocode budget degrades to pincode lookup when exhausted. The Anthropic API needs no equivalent guard: only authenticated curator publishes trigger it, never public traffic.
- **Headers:** nginx sets HSTS, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, and a CSP with `frame-ancestors 'none'` and per-request nonces for the two inline scripts (`?src` writer, GA). No `unsafe-inline`.
- **Content rules:** flag text renders as text, always (citizen flag text shown in curator screens is a citizen→curator escalation path otherwise); `source_url` validated to `http(s)` schemes at write time (kills `javascript:` links); JSON-LD serialized with `<` escaped so curator data cannot close the script tag; MT output stored and rendered as plain text through normal escaping.
- **Affidavit PDFs:** PDF magic-byte check at ingest; served as `application/pdf` with `Content-Disposition` and `nosniff`, so the affidavit store cannot host other content types.
- **Secrets:** one `.env` outside the repo, mode 600, referenced by Compose; holds the vendor keys, session-signing key, and restic key reference. Rotation is a runbook step (custody: dependency register §6.10).
- **Accepted limitations, recorded deliberately:**
  - The audit log is append-only at the application level only — database compromise defeats it; "immutable" (PRD §6) holds against application bugs and curator action, not against DB compromise. The nightly encrypted backups are the only historical copies. Hash chains and off-box audit streaming were considered and rejected as infrastructure the threat model doesn't yet justify.
  - Prompt injection into the MT/extraction calls (affidavit PDFs and curator text are adversarial inputs, and Kannada MT publishes unreviewed — locked decision, PRD §8) is mitigated by escaping, a fixed extraction schema, visible provenance markers, and the citizen-flag correction path. No further machinery.
  - Sessions have a uniform 1-hour idle timeout instead of per-role lifetimes; no session revocation on role change, no login notifications for privileged accounts — the short timeout carries the weight.
  - Backups share a region with the VM: the restic Spaces bucket sits in BLR1 alongside the Droplet, so a region-wide DigitalOcean failure loses the site and its backups together. India residency for the DPDP-regulated dump won over disaster isolation (decided 2026-07-19); weekly Droplet snapshots are the second layer, and they share the region too.

## 14. Deployment (DigitalOcean)

Decided 2026-07-19. The single VM of §3 is a **DigitalOcean Droplet**; this section records the exact deployment shape. Design history: `docs/superpowers/specs/2026-07-19-digitalocean-deployment-design.md`.

### 14.1 Region & compute

One Premium AMD Droplet, **2 vCPU / 4 GB** (~$28/mo), in **BLR1 (Bengaluru)** — the audience is Bengaluru. A **Reserved IP** fronts the Droplet; DNS for both hostnames (below) points at it, so the box can be rebuilt without a DNS change. The k6 test (§12) validates the size against election-day volume; if it falls short, the plan is a vertical resize before election week — minutes of work — not year-round spike capacity.

### 14.2 Two environments, one Droplet

Production and staging run as **two Compose projects** side by side:

- **One shared nginx container** (owned by the production stack; staging joins its network) terminates TLS for `bangalore-votes.opencity.in` and `staging.bangalore-votes.opencity.in` and proxies to the per-environment `app` containers.
- Staging has its **own `app`, `postgres`, and `jobs`** — nothing shared below nginx. Staging Postgres is disposable: not backed up, safe to reset.
- **Staging `jobs` cannot message real people.** Its `.env` carries no production Twilio/SendGrid keys, and a `SENDS_DISABLED` flag makes the campaign runner log instead of send. Both guards, deliberately.
- **Staging is invisible to the public:** its server block sends `X-Robots-Tag: noindex` and requires basic auth.
- Accepted trade (chosen over a second Droplet): staging shares CPU and disk with production. Mitigation: images build in CI, never on the Droplet, so the heaviest work never lands on the box.

### 14.3 Images & registry

CI builds the `app` and `jobs` images; the Droplet only ever pulls. Images are **public packages on GHCR** next to the repo — free for public images, pushed with the workflow's built-in `GITHUB_TOKEN`, and anyone can pull the exact image a release ran, which suits an open-source civic project. The Droplet pulls anonymously. Tags: every build gets `:sha-<short-sha>`; `main` builds add `:edge`; release builds add the release tag and `:latest`.

### 14.4 Release flow

- **Staging — every merge.** Push to `main` → Actions runs tests, builds and pushes images, then SSHes to the Droplet and runs `docker compose pull && docker compose up -d` on the staging stack.
- **Production — on release.** Publishing a **GitHub Release** triggers the production workflow: build the images fresh from the release tag's commit, push, SSH in, pull and restart the production stack. Release notes live on the Release page (`Generate release notes` compiles merged PRs); `gh release create v2026.07.19 --generate-notes` does the same from a terminal.
- **Versioning is date-based:** `vYYYY.MM.DD`, with `.2` appended for a second same-day release. Semver encodes API-compatibility promises this site doesn't make; a date tag states the fact operators actually ask for — how old is what's live.
- **Rollback:** re-run the production deploy workflow (`workflow_dispatch`) with the previous release tag. Images are immutable in GHCR, so rollback is a pull and restart, not a rebuild.
- **SSH from CI:** a dedicated `deploy` user (key-only, `docker` group). Keys live in GitHub **Environment** secrets — separate `staging` and `production` environments; the `production` environment can require reviewer approval before deploying (off at first, enable if wanted).

### 14.5 Network & TLS

A **DO Cloud Firewall** allows inbound 22, 80, 443 only. SSH is key-only; passwords and root login disabled. TLS is Let's Encrypt via a **certbot container** in the production stack: HTTP-01 for both hostnames, certificates on a volume shared with nginx, nginx reload on renewal. "nginx terminates TLS" (§3) is unchanged.

### 14.6 Provisioning runbook

No Terraform — one Droplet doesn't justify it. Provisioning is this runbook:

1. Create the BLR1 Droplet (Premium AMD 2 vCPU / 4 GB); attach the Cloud Firewall and Reserved IP.
2. Point DNS for both hostnames at the Reserved IP (under Oorvani's `opencity.in`, dependency register §6.8).
3. Install Docker Engine + Compose; create the `deploy` user (key-only, `docker` group).
4. Clone the repo; write the two `.env` files (mode 600, outside the repo — §13).
5. Run certbot once for both hostnames; start the production stack, then staging.
6. Initialize the restic repository against the Spaces bucket; rehearse a restore (dependency register §6.9).

### 14.7 Running cost

Droplet ~$28 + Spaces ~$5 + snapshots ~$1–2 + GHCR $0 ≈ **$34–35/mo** before messaging, geocoding, and Anthropic spend — a concrete input to the open total-budget question (dependency register §6.11).
