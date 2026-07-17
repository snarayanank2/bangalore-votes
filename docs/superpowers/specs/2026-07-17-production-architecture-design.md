# Production Architecture — Design

**Date:** 2026-07-17 · **Status:** Approved · **Scope:** Technology stack and runtime architecture for the pre-election MVP

This document records the production architecture for the platform defined in `docs/prd.md` and `docs/information-architecture.md`. It answers: what runs where, what is cached, what is dynamic, and how the site stays fast, bilingual, and indexable on a single VM with no CDN.

---

## 1. Context & constraints

- **Hosting shape is decided:** a single VM running Docker Compose (`docs/project-dependencies.md` §6.1). No CDN at launch; one may be added later.
- **Traffic shape:** overwhelmingly anonymous, read-only, spiking near election day. Content changes only when a curator publishes — not per request. Anonymous reads must stay fast with no login wall (PRD §12).
- **Team:** TypeScript/Node.
- **SEO/AEO is a requirement:** ward, candidate, and guide pages must be indexable by search engines and quotable by answer engines, in both English and Kannada.
- **Decided vendors** (dependency register §3, §6): Twilio/SendGrid for messaging, Google Geocoding server-side, MapLibre rendering, Anthropic API for Kannada machine translation, Google Analytics for visitor/event measurement (client-side snippet on public pages; static markup, so it does not break the one-cached-variant-per-URL invariant in §5).

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

Alternatives considered: a Next.js monolith with ISR (heavier runtime, React hydration on every page, more framework than 19 mostly-read routes need) and a fully static build plus separate API service (spike-proof reads, but "publish immediately" becomes a rebuild pipeline and one deployable becomes two). Both were rejected in favour of the lighter shape above.

## 3. System overview

Four Compose services on the single VM:

| Service | Role |
|---|---|
| `nginx` | TLS termination; serves static assets (built JS/CSS, ward GeoJSON, images, posters); micro-cache for anonymous HTML; `limit_req` rate limiting; compression |
| `app` | Astro SSR (Node). All routes: public pages, `/api/*`, `/account/*`, `/curator/*`, `/admin/*` |
| `postgres` | Single database |
| `jobs` | Cron-driven Node scripts: campaign sends, translation retries, sitemap regeneration, nightly `pg_dump` shipped off-box |

No Redis, no queue, no separate API service. Deploys are `git pull && docker compose up -d --build`.

## 4. Routing & rendering

- Public pages are server-rendered to complete HTML with **zero client JavaScript by default**. Hydrated islands only for: the Register/Login, Flag, and Cast-vote modals; MapLibre maps; the address/pincode lookup; the booth lookup.
- **Language:** every public path exists twice — `/ward/57` (EN) and `/kn/ward/57` (KN) — via Astro i18n routing. The app-bar toggle links to the same page in the other language. Every page emits `hreflang` alternates and `x-default`. A cookie remembers the last choice so `/` can offer Kannada on entry; a registered user's saved preference governs notification language only (PRD §8).
- Curator, admin, and account screens are server-rendered forms with standard POSTs in the same app — no SPA.
- Modals are progressive enhancements over real routes, so the `/login` no-JS fallback comes free.

## 5. Caching & the election-day spike

nginx `proxy_cache` on anonymous-shaped GET HTML:

- Public pages: **~60 s TTL**. Issue-vote results and `/data`: ~5 min. `/api/*`, `/account/*`, `/curator/*`, `/admin/*`: `no-store`, never cached.
- **Invariant: public page HTML never varies by session.** Logged-in users receive the same cached anonymous markup; the three personalized elements (Sign-in vs Account control, register-for-updates slot, already-voted state) are swapped client-side from one `GET /api/me` call. nginx therefore ignores cookies on public pages, and each URL has exactly one cached variant per language.
- `?src={partner}` is stripped from the cache key; a small inline script stores the slug in a cookie, which the registration endpoint reads (PRD §5.12). No cache fragmentation per partner.
- Worst-case origin load is every public URL rendered once per TTL — about 4,000 renders/minute at the absolute ceiling (369 wards × ~5 pages × 2 languages), well within one Node process. The spike lands on nginx, which serves cached responses at static-file speed.
- The 60 s window satisfies "curator edits go live immediately"; curators previewing edits use uncached curator routes.
- A CDN added later sits in front of nginx with the same cache headers; nothing else changes.

## 6. Data model (sketch)

`wards` (id, name_en, name_kn, corporation, boundary ref) · `candidates` (slug, ward, party, photo) · `candidate_fields` (candidate, field key, value_en, value_kn, authored_lang, translation_status, source_url, source_type `official|curator`) · `ward_issues` + per-candidate stances · `issue_votes` (user, ward, up to 3 issues; one active set per user, retired on home-ward change) · `users` (contact, home ward, language, role, `src` attribution, consent record: timestamp + wording version) · `otp_codes`, `sessions` · `flags` (dedupe key → count) · `partners` · `eoi_submissions` · `ward_readiness` (completeness snapshot, sign-off, cleared on candidate-set change) · `audit_log` (append-only; written in the same transaction as the change it records).

Sources are per-field (PRD §11). Ward boundaries are static GeoJSON files served by nginx and loaded into app memory at boot for point-in-polygon lookups.

## 7. API surface & auth

Public endpoints:

| Endpoint | Purpose |
|---|---|
| `POST /api/ward-lookup` | Address → server-side Google geocode → point-in-polygon → ward. Returns a ward, never coordinates (Maps ToS constraint, dependency register §6.4) |
| `POST /api/booth-lookup` | Same shape, booth data |
| `POST /api/otp/request`, `POST /api/otp/verify` | Email OTP (SendGrid); WhatsApp OTP when templates approve. Hashed 6-digit code, 10-minute expiry |
| `GET /api/me` | Session state for client-side personalization |
| `POST /api/flags` | Gated write; dedupe; audit |
| `PUT /api/issue-votes` | Home-ward check; one active vote-set |
| `POST /api/eoi` | The one anonymous write; CAPTCHA-protected (PRD §6.3) |

Pincode → ward shortlist is a static JSON lookup table — no API call.

Sessions are signed HttpOnly cookies. One middleware enforces roles and curator ward scope (PRD §7). Rate limiting is layered: nginx `limit_req` per IP on `/api/*`, plus per-account app limits on OTP requests, flags, and votes.

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
- Nightly `pg_dump` shipped off-box (restic or rclone), with a rehearsed restore (dependency register §6.9).

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

## 13. Spec/doc changes made with this design

- `docs/prd.md` §8: language toggle now navigates between per-language URLs (`/kn/` prefix); §12: SEO/AEO added to NFRs; §14: stack and language-URL rows added to locked decisions.
- `docs/information-architecture.md` §1: the `/kn/` convention — each language variant is its own URL and screen.
- `docs/project-dependencies.md`: §6.7 CDN reframed as a post-launch addition (nginx micro-cache carries launch); the retired-stack note corrected — Kannada MT has **no** human review (it contradicted PRD §8) — and now points here.
- `docs/overview.md` §6: language highlight now notes the per-language URLs.
- `CLAUDE.md`: repository-status and fixed-decisions sections updated — the stack is now decided and recorded here.
