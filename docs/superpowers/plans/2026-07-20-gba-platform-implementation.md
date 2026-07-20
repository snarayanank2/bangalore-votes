# GBA Elections Citizen Platform — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the production GBA Elections Citizen Platform (`bangalore-votes.opencity.in`) exactly as specified by `docs/prd.md`, `docs/information-architecture.md`, `docs/architecture.md`, `docs/design-system.md`, `docs/gtm-plan.md`, and `docs/messages.md`.

**Architecture:** One Astro SSR monolith (TypeScript, Node adapter) serving all public, account, curator, and admin routes plus `/api/*`; Postgres via Drizzle (audit log append-only); nginx in front doing TLS, static files, per-IP rate limiting, and a ~60 s micro-cache on anonymous page GETs; a `jobs` container sharing the codebase for campaign sends, translation retries, sitemaps, backups. English at root URLs, Kannada under `/kn/`. Zero client JS by default; islands only for the three modals, maps, and the two lookup forms.

**Tech Stack:** Node 22 LTS · TypeScript (strict) · Astro 5 + `@astrojs/node` (standalone) · Postgres 16 · Drizzle ORM + drizzle-kit SQL migrations · `postgres` (porsager) driver · Zod · Vitest · Playwright · k6 · MapLibre GL JS + `@turf/boolean-point-in-polygon` · `@anthropic-ai/sdk` · SendGrid + Twilio · pino · Docker Compose · GitHub Actions → GHCR.

## Global Constraints

Copied from the docs; every task implicitly includes these.

- **This plan ignores `prototype/` entirely.** The app lives at the repo root. Nothing imports from or modifies `prototype/`.
- **URLs:** every public path exists twice — EN at root (`/ward/57`), KN under `/kn/` (`/kn/ward/57`) — hreflang-linked; the app-bar toggle navigates between them (PRD §8).
- **Cache invariant:** public page HTML never varies by session; nginx strips `Cookie` on public routes; no `Set-Cookie` on public GETs; the cache key ignores the query string; personalization is client-side from one `GET /api/me` (architecture §5).
- **Pages vs modals:** one URL → one screen; Register/Login (fallback `/login`), Flag, and Cast-issue-vote are modals that never change the URL (IA §1, §7).
- **Curator publish:** live immediately, no approval gate; every published change writes an `audit_log` row **in the same transaction**; audit-write failure aborts the publish (PRD §6, architecture §11).
- **Auth:** single email/WhatsApp OTP for all roles; no passwords, no 2FA. Hashed 6-digit code, 10-minute expiry, 5 verify attempts per code; per-destination cooldowns 1/minute, 5/hour, daily cap; cooldown never invalidates an already-sent code (architecture §7, §13).
- **Sessions:** signed cookie `HttpOnly; Secure; SameSite=Lax`, sliding 1-hour idle timeout, all roles (PRD §10).
- **CSRF:** middleware `Origin`/`Sec-Fetch-Site` same-origin check on all unsafe methods + synchronizer tokens on server-rendered forms (architecture §13).
- **Media:** photos ≤ 2 MB (JPEG/PNG/WebP — **no SVG**), affidavit PDFs ≤ 20 MB; magic-byte validation; stored as `bytea`; served at `/media/{id}/{hash}` with validated stored `Content-Type`, `nosniff`, long TTL (architecture §5–§7, §13).
- **EC-link fetch is an SSRF vector:** `https` only, EC/CEO-Karnataka host allowlist, private/loopback/link-local/metadata IPs rejected after each redirect, redirect cap, same magic-byte + size validation as uploads (architecture §7).
- **Bilingual content:** three layers — UI strings (repo JSON), editorial Markdown (repo, per-locale), curator data (Postgres `value_en`/`value_kn`) — no request-time translation; unconditional dev-time regeneration with translation hints + shared glossary; `npm run translate -- --check` fails CI on staleness (architecture §9).
- **Design system:** semantic tokens only, from `docs/design-system.md` §2; no orange/saffron anywhere; party identity is text + ECI symbol only; identical visual weight for all candidates; issue bars one hue (`--oc-forest`); self-hosted subset woff2 fonts, no Google Fonts CDN; sentence case everywhere, no uppercase styling; body ≥16px; touch targets ≥44px.
- **Migrations:** Drizzle SQL files, forward-only, backward-compatible (expand → backfill → contract); run as an explicit deploy step before restart (architecture §14.7).
- **Logs carry IDs, not identities:** never log lookup addresses, OTP destinations, or recipients; Sentry server-side only with contact/address scrubbing (architecture §13).
- **Geocoding:** server-side Google; return a ward, never coordinates; cache normalized-address → ward-ID only; daily budget degrades to pincode lookup (architecture §7, §13; dependency register §6.4).
- **Out of scope for this plan:** everything in `docs/project-dependencies.md` that cannot be closed by a PR (legal text, WhatsApp onboarding, curator recruitment, real data acquisition). Where code touches those (e.g. `/privacy` copy), the plan ships structure + placeholder-marked content behind review.

## Environment variables (single `.env`, mode 600, outside the repo)

```
DATABASE_URL=postgres://…
SITE_ORIGIN=https://bangalore-votes.opencity.in   # Astro `site`; all absolute URLs derive from this
SESSION_SECRET=…                                   # 32+ bytes, HMAC key
SENDGRID_API_KEY=…  SENDGRID_WEBHOOK_PUBLIC_KEY=…
TWILIO_ACCOUNT_SID=…  TWILIO_AUTH_TOKEN=…  TWILIO_WHATSAPP_FROM=…
GOOGLE_GEOCODING_API_KEY=…  GEOCODE_DAILY_BUDGET=2000
ANTHROPIC_API_KEY=…
GOOGLE_CSE_ID=…  GOOGLE_CSE_API_KEY=…  NEWS_QUERY_DAILY_BUDGET=500
RECAPTCHA_SITE_KEY=…  RECAPTCHA_SECRET_KEY=…
GA_MEASUREMENT_ID=…
SENTRY_DSN=…
OTP_DAILY_SEND_BUDGET=5000
SENDS_DISABLED=true                                # staging jobs guard (architecture §14.2)
OPS_ALERT_EMAIL=…
```

## Repository file structure (locked here)

```
bangalore-votes/
├─ package.json  tsconfig.json  astro.config.mjs  drizzle.config.ts
├─ vitest.config.ts  playwright.config.ts  .env.example
├─ Dockerfile                       # one image; `app` and `jobs` differ by command
├─ deploy/
│  ├─ compose.production.yml  compose.staging.yml
│  ├─ nginx/nginx.conf  nginx/conf.d/site.conf  nginx/snippets/*.conf
│  ├─ crontab                       # supercronic schedule for the jobs container
│  └─ runbook.md                    # provisioning runbook (architecture §14.6, copied + kept current)
├─ .github/workflows/ci.yml  deploy-staging.yml  deploy-production.yml
├─ data/
│  ├─ gba.geojson                   # exists — 369 ward polygons
│  ├─ pincode-wards.json            # build artifact, committed (architecture §6)
│  └─ news-domains.json             # repo-committed news allowlist (architecture §7)
├─ scripts/
│  ├─ translate.ts                  # npm run translate [-- --check]
│  ├─ build-pincode-table.ts  seed-wards.ts  seed-admin.ts  seed-dev.ts
│  └─ backup.sh                     # pg_dump + restic + dead-man ping
├─ content/pages/en/*.md  content/pages/kn/*.md    # editorial layer (guides, about, legal…)
├─ src/
│  ├─ styles/tokens.css  styles/global.css
│  ├─ i18n/en.json  i18n/kn.json  i18n/glossary.json  i18n/index.ts
│  ├─ db/schema.ts  db/client.ts  db/migrate.ts
│  ├─ lib/
│  │  ├─ session.ts  otp.ts  csrf.ts  authz.ts
│  │  ├─ geo.ts  geocode.ts  pincode.ts
│  │  ├─ publish.ts  audit.ts  readiness.ts  flags.ts  votes.ts  erasure.ts
│  │  ├─ media.ts  affidavit-fetch.ts  extract.ts  translate-runtime.ts
│  │  ├─ budgets.ts  rate-limit.ts  suppressions.ts
│  │  ├─ send/sendgrid.ts  send/twilio.ts  send/render.ts  send/calendar.ts
│  │  └─ seo.ts  urls.ts  logger.ts
│  ├─ middleware.ts
│  ├─ layouts/Base.astro  layouts/Prose.astro
│  ├─ components/          # AppBar, Footer, Button, Banner, Badge, FieldRow, CandidateRow,
│  │                       # IssueBars, DeadlineBanner, SourceLine, EmptyState, Toast, …
│  ├─ islands/             # RegisterLoginModal, FlagModal, VoteModal, WardMap, WardLookup,
│  │                       # BoothLookup, MeSlot  (the only hydrated components)
│  ├─ features/pages/      # one .astro component per screen, takes `lang` prop
│  └─ pages/               # thin EN route files + /kn/** twins + /api/** + /media/**
├─ jobs/
│  ├─ run-campaign.ts  translate-retry.ts  regen-sitemaps.ts
│  ├─ news-suggest.ts  reconcile-suppressions.ts  retention.ts
└─ tests/
   ├─ unit/** (also co-located *.test.ts)  routes/**  e2e/**  load/k6-election-day.js
```

**Route-twin pattern (used everywhere):** each screen is implemented once in `src/features/pages/<Name>.astro` accepting `lang: 'en' | 'kn'`; `src/pages/<path>.astro` renders it with `lang="en"` and `src/pages/kn/<path>.astro` with `lang="kn"`. API routes and `/media` are not localized.

## Milestone map (build order)

| # | Milestone | Produces | Launch phase served |
|---|---|---|---|
| M0 | Scaffold, CI, healthcheck | Running SSR app + green CI | — |
| M1 | Database schema, migrations, audit | Full schema + append-only audit | — |
| M2 | i18n framework + translate script | Bilingual routing, CI staleness gate | — |
| M3 | Design system implementation | tokens.css, layout, core components | — |
| M4 | Geo + ward lookup | Ward finder API + data pipeline | 1 |
| M5 | Public teaser pages | `/`, `/ward/*`, guides, legal, about | 0–1 |
| M6 | Auth, sessions, accounts | OTP login, modal, `/account/*` | 0–1 |
| M7 | Contributions | Flags + issue votes end to end | 1 |
| M8 | Curator suite | Publish pipeline, affidavits, readiness | 0 |
| M9 | Candidate public pages | Report card, list, compare | 2 |
| M10 | Admin suite | Roles, users, partners, audit+rollback | 0 |
| M11 | Partner / press / data / EOI | `/partner/*`, `/partner-with-us`, `/press`, `/data` | 1–2 |
| M12 | Messaging & jobs | Campaign runner, webhooks, backups | 1 |
| M13 | SEO/AEO + cache correctness | JSON-LD, sitemaps, invariant tests | 1 |
| M14 | Deployment | Docker, nginx, Compose, deploy workflows | 0 |
| M15 | E2E + load | Playwright smoke, k6 | pre-launch |

Milestones are sequential except: M8/M9/M10/M11 may proceed in parallel after M7; M14 can start any time after M0.

---

# M0 — Scaffold & CI

### Task 1: Astro SSR scaffold at repo root

**Files:**
- Create: `package.json`, `tsconfig.json`, `astro.config.mjs`, `.env.example`, `src/pages/healthz.ts`, `vitest.config.ts`
- Modify: `.gitignore` (add `node_modules/`, `dist/`, `.env`)

**Interfaces:**
- Produces: `npm run dev|build|preview|test|typecheck`; `GET /healthz` → `200 {"ok":true}` (uncached, used by Compose healthcheck and DO Uptime).

- [ ] **Step 1:** `npm create astro@latest . -- --template minimal --typescript strict --no-git` (accept adding to non-empty dir; do not touch `prototype/`). Add `@astrojs/node`:

```js
// astro.config.mjs
import { defineConfig } from 'astro/config';
import node from '@astrojs/node';
export default defineConfig({
  output: 'server',
  adapter: node({ mode: 'standalone' }),
  site: process.env.SITE_ORIGIN ?? 'https://bangalore-votes.opencity.in',
  i18n: { locales: ['en', 'kn'], defaultLocale: 'en', routing: { prefixDefaultLocale: false } },
});
```

- [ ] **Step 2:** Write failing test `tests/routes/healthz.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { GET } from '../../src/pages/healthz';
describe('healthz', () => {
  it('returns ok json, no-store', async () => {
    const res = await GET({} as any);
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect(await res.json()).toEqual({ ok: true });
  });
});
```

- [ ] **Step 3:** Run `npx vitest run tests/routes/healthz.test.ts` — expect FAIL (module not found).
- [ ] **Step 4:** Implement `src/pages/healthz.ts`:

```ts
import type { APIRoute } from 'astro';
export const GET: APIRoute = () =>
  new Response(JSON.stringify({ ok: true }), {
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  });
```

- [ ] **Step 5:** Run the test — expect PASS. Run `npm run build` — expect success.
- [ ] **Step 6:** Commit: `feat: scaffold Astro SSR app with healthcheck`

### Task 2: CI workflow

**Files:**
- Create: `.github/workflows/ci.yml`

**Interfaces:**
- Produces: CI job `ci` running on every PR and push to `main`: install → typecheck → vitest → build. (Translate `--check` is appended in Task 10; image build/push added in Task 64.)

- [ ] **Step 1:** Write `.github/workflows/ci.yml`:

```yaml
name: ci
on: { push: { branches: [main] }, pull_request: {} }
jobs:
  ci:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16
        env: { POSTGRES_PASSWORD: test, POSTGRES_DB: bv_test }
        ports: ['5432:5432']
        options: >-
          --health-cmd pg_isready --health-interval 5s --health-timeout 5s --health-retries 10
    env:
      DATABASE_URL: postgres://postgres:test@localhost:5432/bv_test
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: npm }
      - run: npm ci
      - run: npm run typecheck
      - run: npm run migrate     # no-op until M1; script exists from Task 5
      - run: npm test
      - run: npm run build
```

- [ ] **Step 2:** Add `"typecheck": "astro check && tsc --noEmit"`, `"test": "vitest run"`, and a temporary `"migrate": "node -e ''"` to `package.json`.
- [ ] **Step 3:** Push a branch; verify the workflow passes on GitHub.
- [ ] **Step 4:** Commit: `ci: typecheck, test, build on every push`

---

# M1 — Database schema, migrations, audit

### Task 3: Drizzle client + full schema

**Files:**
- Create: `src/db/schema.ts`, `src/db/client.ts`, `drizzle.config.ts`
- Test: `tests/unit/schema.test.ts`

**Interfaces:**
- Produces: `db` (Drizzle instance) from `src/db/client.ts`; every table below, exported by name. All later tasks import from `src/db/schema.ts`.

- [ ] **Step 1:** `npm i drizzle-orm postgres zod && npm i -D drizzle-kit`
- [ ] **Step 2:** Write `src/db/schema.ts` — complete schema (architecture §6):

```ts
import {
  pgTable, pgEnum, serial, bigserial, integer, text, boolean, timestamp,
  jsonb, uniqueIndex, index, primaryKey, customType, date,
} from 'drizzle-orm/pg-core';

export const bytea = customType<{ data: Buffer }>({ dataType: () => 'bytea' });

export const corporationEnum = pgEnum('corporation', ['north', 'south', 'east', 'west', 'central']);
export const langEnum = pgEnum('lang', ['en', 'kn']);
export const roleEnum = pgEnum('role', ['citizen', 'curator', 'admin']);
export const userStatusEnum = pgEnum('user_status', ['active', 'banned', 'erased']);
export const candidateStatusEnum = pgEnum('candidate_status', ['filed', 'contesting', 'rejected', 'withdrawn']);
export const sourceTypeEnum = pgEnum('source_type', ['official', 'curator']);
export const translationStatusEnum = pgEnum('translation_status', ['pending', 'done', 'manual']);
export const extractionStatusEnum = pgEnum('extraction_status', ['pending', 'done', 'failed']);
export const newsOriginEnum = pgEnum('news_origin', ['auto', 'curator']);
export const newsStatusEnum = pgEnum('news_status', ['suggested', 'approved']);
export const channelEnum = pgEnum('channel', ['email', 'whatsapp']);
export const otpPurposeEnum = pgEnum('otp_purpose', ['auth', 'add_contact']);
export const suppressionReasonEnum = pgEnum('suppression_reason', ['bounce', 'complaint', 'stop']);
export const flagStatusEnum = pgEnum('flag_status', ['pending', 'accepted', 'rejected']);
export const flagTargetEnum = pgEnum('flag_target', ['candidate_field', 'ward_field', 'ward_issue']);
export const eoiPathEnum = pgEnum('eoi_path', ['awareness', 'curation']);
export const eoiStatusEnum = pgEnum('eoi_status', ['new', 'accepted', 'declined']);
export const sendCodeEnum = pgEnum('send_code', ['W1', 'R1', 'L1', 'C1', 'C2', 'C3', 'F1']);
export const sendStatusEnum = pgEnum('send_status', ['sent', 'failed', 'suppressed', 'held']);
export const budgetKindEnum = pgEnum('budget_kind', ['geocode', 'otp_send', 'news_query']);

export const wards = pgTable('wards', {
  id: integer('id').primaryKey(),                      // official ward number
  nameEn: text('name_en').notNull(),
  nameKn: text('name_kn').notNull(),                   // official bilingual data — never MT (arch §9)
  corporation: corporationEnum('corporation').notNull(),
  zone: text('zone').notNull(),
  boundaryRef: text('boundary_ref').notNull(),         // feature id in data/gba.geojson
});

export const media = pgTable('media', {
  id: serial('id').primaryKey(),
  bytes: bytea('bytes').notNull(),
  contentType: text('content_type').notNull(),         // validated stored type (arch §13)
  sha256: text('sha256').notNull(),
  size: integer('size').notNull(),
  createdBy: integer('created_by'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const candidates = pgTable('candidates', {
  id: serial('id').primaryKey(),
  slug: text('slug').notNull().unique(),               // ward is part of the slug (IA §3.4)
  wardId: integer('ward_id').notNull().references(() => wards.id),
  nameEn: text('name_en').notNull(),
  nameKn: text('name_kn'),
  partyEn: text('party_en').notNull(),                 // 'Independent' allowed
  partyKn: text('party_kn'),
  photoMediaId: integer('photo_media_id').references(() => media.id),
  status: candidateStatusEnum('status').notNull().default('filed'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (t) => [index('candidates_ward_idx').on(t.wardId)]);

// Report-card fields: track_record | cases | assets | education | approachability
export const candidateFields = pgTable('candidate_fields', {
  id: serial('id').primaryKey(),
  candidateId: integer('candidate_id').notNull().references(() => candidates.id),
  fieldKey: text('field_key').notNull(),
  valueEn: text('value_en'),
  valueKn: text('value_kn'),
  notDeclared: boolean('not_declared').notNull().default(false),  // valid, complete answer (PRD §9.1)
  authoredLang: langEnum('authored_lang').notNull().default('en'),
  translationStatus: translationStatusEnum('translation_status').notNull().default('pending'),
  sourceUrl: text('source_url'),
  sourceType: sourceTypeEnum('source_type').notNull().default('curator'),
  aiExtracted: boolean('ai_extracted').notNull().default(false),  // cleared on curator confirm (PRD §5.2)
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (t) => [uniqueIndex('candidate_field_uq').on(t.candidateId, t.fieldKey)]);

export const candidateAffidavits = pgTable('candidate_affidavits', {
  id: serial('id').primaryKey(),
  candidateId: integer('candidate_id').notNull().references(() => candidates.id),
  mediaId: integer('media_id').notNull().references(() => media.id),
  originUrl: text('origin_url'),                        // EC URL when fetched, null when uploaded
  extractionStatus: extractionStatusEnum('extraction_status').notNull().default('pending'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const candidateNewsLinks = pgTable('candidate_news_links', {
  id: serial('id').primaryKey(),
  candidateId: integer('candidate_id').notNull().references(() => candidates.id),
  url: text('url').notNull(),
  title: text('title').notNull(),
  domain: text('domain').notNull(),
  origin: newsOriginEnum('origin').notNull(),
  status: newsStatusEnum('status').notNull().default('suggested'),
  approvedBy: integer('approved_by'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (t) => [uniqueIndex('news_link_uq').on(t.candidateId, t.url)]);

export const wardIssues = pgTable('ward_issues', {
  id: serial('id').primaryKey(),
  wardId: integer('ward_id').notNull().references(() => wards.id),
  titleEn: text('title_en'),
  titleKn: text('title_kn'),
  authoredLang: langEnum('authored_lang').notNull().default('en'),
  translationStatus: translationStatusEnum('translation_status').notNull().default('pending'),
  position: integer('position').notNull().default(0),
}, (t) => [index('ward_issues_ward_idx').on(t.wardId)]);

export const candidateStances = pgTable('candidate_stances', {
  id: serial('id').primaryKey(),
  wardIssueId: integer('ward_issue_id').notNull().references(() => wardIssues.id, { onDelete: 'cascade' }),
  candidateId: integer('candidate_id').notNull().references(() => candidates.id),
  valueEn: text('value_en'),
  valueKn: text('value_kn'),
  authoredLang: langEnum('authored_lang').notNull().default('en'),
  translationStatus: translationStatusEnum('translation_status').notNull().default('pending'),
  sourceUrl: text('source_url'),
  sourceType: sourceTypeEnum('source_type').notNull().default('curator'),
}, (t) => [uniqueIndex('stance_uq').on(t.wardIssueId, t.candidateId)]);

export const booths = pgTable('booths', {
  id: serial('id').primaryKey(),
  wardId: integer('ward_id').notNull().references(() => wards.id),
  nameEn: text('name_en').notNull(),
  nameKn: text('name_kn'),
  address: text('address').notNull(),
  lat: text('lat').notNull(),
  lng: text('lng').notNull(),
});

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  email: text('email').unique(),                        // one account per contact (PRD §10)
  phone: text('phone').unique(),
  homeWardId: integer('home_ward_id').references(() => wards.id),
  language: langEnum('language').notNull().default('en'),
  role: roleEnum('role').notNull().default('citizen'),
  status: userStatusEnum('status').notNull().default('active'),
  srcAttribution: text('src_attribution'),
  consentAt: timestamp('consent_at'),
  consentVersion: text('consent_version'),
  futureToolsOptIn: boolean('future_tools_opt_in').notNull().default(false),
  emailEnabled: boolean('email_enabled').notNull().default(true),   // /account/notifications toggles
  whatsappEnabled: boolean('whatsapp_enabled').notNull().default(true),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const curatorScopes = pgTable('curator_scopes', {
  userId: integer('user_id').notNull().references(() => users.id),
  wardId: integer('ward_id').notNull().references(() => wards.id),
}, (t) => [primaryKey({ columns: [t.userId, t.wardId] })]);

export const otpCodes = pgTable('otp_codes', {
  id: serial('id').primaryKey(),
  destination: text('destination').notNull(),           // email address or +91… number
  channel: channelEnum('channel').notNull(),
  purpose: otpPurposeEnum('purpose').notNull().default('auth'),
  userId: integer('user_id'),                           // set for add_contact
  codeHash: text('code_hash').notNull(),                // sha256(code + SESSION_SECRET)
  attempts: integer('attempts').notNull().default(0),   // invalidated at 5 (arch §7)
  expiresAt: timestamp('expires_at').notNull(),
  consumedAt: timestamp('consumed_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (t) => [index('otp_destination_idx').on(t.destination, t.createdAt)]);

export const sessions = pgTable('sessions', {
  id: text('id').primaryKey(),                          // random 32-byte hex
  userId: integer('user_id').notNull().references(() => users.id),
  expiresAt: timestamp('expires_at').notNull(),         // sliding 1h idle
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const suppressions = pgTable('suppressions', {
  id: serial('id').primaryKey(),
  contact: text('contact').notNull(),
  channel: channelEnum('channel').notNull(),
  reason: suppressionReasonEnum('reason').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (t) => [uniqueIndex('suppression_uq').on(t.contact, t.channel)]);

export const flagItems = pgTable('flag_items', {          // deduped queue item (PRD §6.3)
  id: serial('id').primaryKey(),
  wardId: integer('ward_id').notNull().references(() => wards.id),
  targetType: flagTargetEnum('target_type').notNull(),
  targetRef: text('target_ref').notNull(),                // e.g. 'candidate:12:cases' | 'ward:57:name'
  status: flagStatusEnum('status').notNull().default('pending'),
  resolutionReason: text('resolution_reason'),
  resolvedBy: integer('resolved_by'),
  resolvedAt: timestamp('resolved_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (t) => [uniqueIndex('flag_dedupe_uq').on(t.targetRef, t.status)]);

export const flagSubmissions = pgTable('flag_submissions', {
  id: serial('id').primaryKey(),
  flagItemId: integer('flag_item_id').notNull().references(() => flagItems.id),
  userId: integer('user_id').notNull().references(() => users.id),
  detail: text('detail').notNull(),
  suggestedValue: text('suggested_value'),
  sourceUrl: text('source_url'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const issueVoteSets = pgTable('issue_vote_sets', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => users.id),
  wardId: integer('ward_id').notNull().references(() => wards.id),
  active: boolean('active').notNull().default(true),      // retired on home-ward change / re-cast
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (t) => [uniqueIndex('active_set_uq').on(t.userId).where(sql`active`)]);

export const issueVoteSelections = pgTable('issue_vote_selections', {
  setId: integer('set_id').notNull().references(() => issueVoteSets.id, { onDelete: 'cascade' }),
  wardIssueId: integer('ward_issue_id').notNull().references(() => wardIssues.id, { onDelete: 'cascade' }),
}, (t) => [primaryKey({ columns: [t.setId, t.wardIssueId] })]);

export const partners = pgTable('partners', {
  id: serial('id').primaryKey(),
  slug: text('slug').notNull().unique(),
  name: text('name').notNull(),
  contact: text('contact'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});
export const partnerWards = pgTable('partner_wards', {
  partnerId: integer('partner_id').notNull().references(() => partners.id),
  wardId: integer('ward_id').notNull().references(() => wards.id),
}, (t) => [primaryKey({ columns: [t.partnerId, t.wardId] })]);

export const eoiSubmissions = pgTable('eoi_submissions', {
  id: serial('id').primaryKey(),
  path: eoiPathEnum('path').notNull(),
  name: text('name').notNull(),
  organisation: text('organisation'),
  contact: text('contact').notNull(),
  wardsText: text('wards_text'),
  message: text('message'),
  status: eoiStatusEnum('status').notNull().default('new'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const wardReadiness = pgTable('ward_readiness', {
  wardId: integer('ward_id').primaryKey().references(() => wards.id),
  completenessSnapshot: jsonb('completeness_snapshot'),   // {complete, gaps[]} at sign-off time
  signedOffBy: integer('signed_off_by'),
  signedOffAt: timestamp('signed_off_at'),                // null = not signed off (or cleared)
  clearedAt: timestamp('cleared_at'),                     // set when candidate-set change clears it
  commsHoldOverride: boolean('comms_hold_override').notNull().default(false),  // admin release
});

export const auditLog = pgTable('audit_log', {            // append-only (enforced in Task 5)
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  actorUserId: integer('actor_user_id'),                  // null = system (MT, extraction, jobs)
  actorRole: text('actor_role').notNull(),                // 'curator' | 'admin' | 'system' | 'citizen'
  action: text('action').notNull(),                       // 'publish' | 'flag' | 'sign_off' | 'restore' | …
  entityType: text('entity_type').notNull(),
  entityId: text('entity_id').notNull(),
  wardId: integer('ward_id'),
  fieldKey: text('field_key'),
  oldValue: jsonb('old_value'),
  newValue: jsonb('new_value'),
  sourceUrl: text('source_url'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (t) => [index('audit_entity_idx').on(t.entityType, t.entityId), index('audit_created_idx').on(t.createdAt)]);

export const campaignSends = pgTable('campaign_sends', {  // send-once ledger per user × code
  id: serial('id').primaryKey(),
  code: sendCodeEnum('code').notNull(),
  userId: integer('user_id').notNull().references(() => users.id),
  wardId: integer('ward_id').notNull(),
  channel: channelEnum('channel').notNull(),
  language: langEnum('language').notNull(),
  status: sendStatusEnum('status').notNull(),
  sentAt: timestamp('sent_at').notNull().defaultNow(),
}, (t) => [uniqueIndex('send_once_uq').on(t.code, t.userId, t.channel)]);

export const appSettings = pgTable('app_settings', {      // election anchors, wording versions
  key: text('key').primaryKey(),                          // 'notification_date' | 'election_date' |
  value: text('value').notNull(),                         // 'roll_deadline' | 'consent_wording_version' | …
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const geocodeCache = pgTable('geocode_cache', {    // derived conclusion only (arch §13)
  normalizedAddress: text('normalized_address').primaryKey(),
  wardId: integer('ward_id'),                             // null = out of coverage
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const budgetCounters = pgTable('budget_counters', {
  day: date('day').notNull(),
  kind: budgetKindEnum('kind').notNull(),
  count: integer('count').notNull().default(0),
}, (t) => [primaryKey({ columns: [t.day, t.kind] })]);
```

(Add `import { sql } from 'drizzle-orm';` for the partial unique index.)

- [ ] **Step 3:** `src/db/client.ts`:

```ts
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';
const client = postgres(process.env.DATABASE_URL!, { max: 10 });
export const db = drizzle(client, { schema });
export type Db = typeof db;
```

- [ ] **Step 4:** `drizzle.config.ts` pointing at `src/db/schema.ts`, out dir `drizzle/`. Run `npx drizzle-kit generate` — commit the generated SQL.
- [ ] **Step 5:** Write `tests/unit/schema.test.ts` asserting a migration + round-trip insert/select on `wards` against the CI Postgres. Run — FAIL, then wire Task 4's migrate, PASS.
- [ ] **Step 6:** Commit: `feat: full Drizzle schema and initial migration`

### Task 4: Migration runner

**Files:**
- Create: `src/db/migrate.ts`
- Modify: `package.json` (`"migrate": "tsx src/db/migrate.ts"`), `.github/workflows/ci.yml` (already calls it)

**Interfaces:**
- Produces: `npm run migrate` — applies `drizzle/*.sql` idempotently; exits non-zero on failure (deploy aborts before restart, architecture §14.7).

- [ ] **Step 1:** Implement with drizzle-orm's `migrate()` (postgres-js migrator), folder `drizzle/`.
- [ ] **Step 2:** Run `npm run migrate` twice against a fresh DB — second run is a no-op, exit 0.
- [ ] **Step 3:** Commit: `feat: migration runner as explicit deploy step`

### Task 5: Append-only audit log + publish helper

**Files:**
- Create: `src/lib/audit.ts`, `src/lib/publish.ts`, migration `drizzle/XXXX_audit_append_only.sql`
- Test: `tests/unit/audit.test.ts`

**Interfaces:**
- Produces:
  - `writeAudit(tx, entry: NewAuditEntry): Promise<void>` — must be called inside a transaction.
  - `publishCandidateField(actor: Actor, input: {candidateId, fieldKey, valueEn?, valueKn?, notDeclared?, sourceUrl, sourceType, authoredLang}): Promise<void>` — one transaction: upsert `candidate_fields` (sets `translationStatus:'pending'`, clears `aiExtracted` when actor is a curator), write audit; after commit fire `translateFieldSoon()` (Task 40; a no-op stub until then).
  - `Actor = { userId: number | null, role: 'curator' | 'admin' | 'system' }`

- [ ] **Step 1:** Migration adds a DB-level guard (application-level append-only, architecture §13 — this is cheap and catches bugs):

```sql
CREATE RULE audit_log_no_update AS ON UPDATE TO audit_log DO INSTEAD NOTHING;
CREATE RULE audit_log_no_delete AS ON DELETE TO audit_log DO INSTEAD NOTHING;
```

- [ ] **Step 2:** Failing tests: (a) `publishCandidateField` writes the field row and an audit row atomically; (b) forcing the audit insert to fail (e.g. oversize `action`) rolls back the field write; (c) `UPDATE audit_log` affects 0 rows.
- [ ] **Step 3:** Implement; run tests — PASS.
- [ ] **Step 4:** Commit: `feat: append-only audit log and transactional publish helper`

### Task 6: Seed scripts

**Files:**
- Create: `scripts/seed-wards.ts` (reads `data/gba.geojson` properties → `wards` rows), `scripts/seed-admin.ts` (architecture §14.6), `scripts/seed-dev.ts` (a few fake candidates/issues for local dev only; refuses to run when `NODE_ENV=production`)
- Modify: `package.json` (`"seed:wards"`, `"seed:admin"`, `"seed:dev"`)

**Interfaces:**
- Produces: `npm run seed:admin -- <email>` inserts/updates a `users` row with `role='admin'` — the root of the authorization chain; role is never inferred from the address elsewhere.

- [ ] **Step 1:** Inspect `data/gba.geojson` properties (`node -e` dump of first feature) and map its actual property names to `wards` columns; document the mapping in a comment.
- [ ] **Step 2:** Failing test: seeding inserts 369 wards with non-empty `name_kn`. Implement. PASS.
- [ ] **Step 3:** Implement `seed-admin.ts` (email arg → upsert admin, print id). Test: run twice, one row.
- [ ] **Step 4:** Commit: `feat: ward, admin, and dev seed scripts`

---

# M2 — i18n framework & translation tooling

### Task 7: UI-string i18n module

**Files:**
- Create: `src/i18n/index.ts`, `src/i18n/en.json`, `src/i18n/kn.json`, `src/i18n/glossary.json`
- Test: `tests/unit/i18n.test.ts`

**Interfaces:**
- Produces:
  - `t(lang: Lang, key: string, vars?: Record<string,string|number>): string` — throws in dev/test on a missing key (CI catches), falls back to EN in production.
  - `localePath(lang: Lang, path: string): string` — `('kn','/ward/57')` → `/kn/ward/57`; `('en', x)` → `x`.
  - `otherLang(lang: Lang): Lang`
  - JSON shape: `{ "nav.signIn": {"en-source-hash": "…", "value": "…"} }` — **no**: keep it simple — `en.json` is flat `{key: string}`; `kn.json` is flat `{key: string}` plus a top-level `"__hashes": {key: sha256(en value)}` block maintained by the translate script (staleness detection, architecture §9). Optional per-key hints live in `en.json` under `"__hints": {key: instruction}`.

- [ ] **Step 1:** Failing tests: `t` interpolation (`{ward}` vars), missing-key throw, `localePath` both directions, `otherLang`.
- [ ] **Step 2:** Implement; seed `en.json` with the initial global keys (`nav.signIn`, `nav.account`, `footer.about`, `footer.votingGuide`, `footer.data`, `footer.partnerWithUs`, `footer.press`, `footer.terms`, `footer.privacy`, `common.registerForUpdates`, `common.receivingUpdates`, `common.flagError`, `common.voteTop3`, `common.notDeclared`, `common.source.affidavit`, `common.source.curator`, `common.source.aiExtracted`). Run tests — PASS.
- [ ] **Step 3:** Seed `glossary.json` with the canonical Kannada renderings named in architecture §9 (party names, corporation names, "corporator", "ward", "affidavit", "report card" → ವರದಿ ಪತ್ರ etc. — mark entries needing native-speaker review with `"review": true`).
- [ ] **Step 4:** Commit: `feat: i18n module with EN/KN string tables and glossary`

### Task 8: Editorial content collections

**Files:**
- Create: `src/content.config.ts`; `content/pages/en/{about,about-election,check-registration,voting-guide,voter-id,how-to-vote,find-booth,terms,privacy,partner-with-us,press,home-intro}.md` and the `content/pages/kn/` twins (generated in Task 9)

**Interfaces:**
- Produces: Astro content collection `pages`; frontmatter schema `{ title: string, description: string, sourceHash?: string, hints?: string[] }` (`sourceHash` only in `kn/` files); `getPageContent(lang, slug)` helper in `src/i18n/index.ts` returning the rendered entry.

- [ ] **Step 1:** Define the collection with a Zod schema; failing test: `getPageContent('en','about')` returns a title.
- [ ] **Step 2:** Write the EN editorial drafts from the PRD content requirements — each file covers exactly its PRD section: `check-registration` (PRD §5.6 incl. eligibility basics), `voter-id` (§5.8 incl. the "registered in another city" path), `how-to-vote` (§5.9 incl. first-timer FAQ, EVM walkthrough marked `<!-- CONFIRM: SEC EVM vs ballot (PRD §17) -->`), `about-election` (§5.7), `about` (§5.11 with `<!-- INPUT NEEDED: funder names, team -->`), `terms`/`privacy` (§5.16 structure with `<!-- LEGAL REVIEW REQUIRED -->` markers and the full processor inventory from the PRD text), `partner-with-us` copy (§5.13), `press` boilerplate scaffold (§5.15), `voting-guide` checklist copy (§5.17).
- [ ] **Step 3:** Run tests + `npm run build` — PASS.
- [ ] **Step 4:** Commit: `feat: editorial content layer with EN drafts for all guide/legal pages`

### Task 9: `npm run translate` (dev-time Kannada generation)

**Files:**
- Create: `scripts/translate.ts`
- Modify: `package.json` (`"translate": "tsx scripts/translate.ts"`)
- Test: `tests/unit/translate.test.ts` (pure functions only — no API calls in tests)

**Interfaces:**
- Produces: `npm run translate` — finds missing/stale KN files and keys (staleness = stored sha256 of EN source ≠ current), regenerates **unconditionally** via Anthropic API with glossary + hints in the prompt, writes ordinary committable files; `npm run translate -- --check` compares hashes only, no API calls, exit 1 on staleness (architecture §9).
- Exported pure helpers (tested): `staleKeys(en, kn): string[]`, `staleContentFiles(enDir, knDir): string[]`, `buildPrompt(source, hints, glossary): string`.

- [ ] **Step 1:** Failing tests for the three helpers (missing key, stale hash, fresh hash; hint + glossary text present in prompt).
- [ ] **Step 2:** Implement. Model: `claude-sonnet-5`; prompt instructs: translate EN→KN for a civic election platform, use glossary renderings verbatim, apply the per-key/per-file hints, return only the translation. KN outputs get `sourceHash` (frontmatter) or `__hashes` entries.
- [ ] **Step 3:** Run `npm run translate` once with a real key to generate `content/pages/kn/*` and `kn.json`; commit the generated files. Run `npm run translate -- --check` — exit 0.
- [ ] **Step 4:** Commit: `feat: unconditional KN regeneration with hints, glossary, and staleness hashes`

### Task 10: CI staleness gate + route twins scaffold

**Files:**
- Modify: `.github/workflows/ci.yml` (add `- run: npm run translate -- --check` before tests)
- Create: `src/features/pages/README.md` (route-twin pattern doc), example twin pair for `/healthz`-adjacent smoke page if none exists yet (defer real pages to M5)

- [ ] **Step 1:** Add the CI step; push a branch with a deliberately edited EN string and no KN regen — CI must fail; regenerate; CI passes.
- [ ] **Step 2:** Commit: `ci: fail on stale or missing Kannada`

---

# M3 — Design system implementation

### Task 11: Tokens, global styles, fonts

**Files:**
- Create: `src/styles/tokens.css`, `src/styles/global.css`, `public/fonts/` (Manrope, PT Sans, Noto Sans Kannada subset woff2)
- Test: `tests/unit/tokens.test.ts` (parses tokens.css; asserts every §2.2 semantic token exists and no hex outside tokens.css in `src/`)

- [ ] **Step 1:** Write `tokens.css` with the exact primitives and semantic tokens from design-system §2.1–2.2, spacing/breakpoint/radius/shadow tokens (§6), type scale (§5.2), and the `:lang(kn)` overrides (§5.3: line-height +1 step, `letter-spacing: normal`, +2px vertical padding on buttons/chips/app bar).
- [ ] **Step 2:** Subset fonts with `pyftsubset`/`glyphhanger` (Latin for Manrope/PT Sans; full Kannada conjunct set for Noto — test with real ward names from `data/gba.geojson`, not lorem ipsum); `@font-face` with `font-display: swap`; total payload budget < 120 KB asserted in the test by file size.
- [ ] **Step 3:** `global.css`: reset, `--font-heading`/`--font-body` stacks exactly as §5.1, body 16px/1.5, focus-visible outline rule (§10), `prefers-reduced-motion` rule (§9), no-uppercase (verify no `text-transform: uppercase` anywhere — asserted in the token test).
- [ ] **Step 4:** Run token test — PASS. Commit: `feat: design tokens, global styles, self-hosted subset fonts`

### Task 12: Base layout, app bar, footer

**Files:**
- Create: `src/layouts/Base.astro`, `src/layouts/Prose.astro`, `src/components/AppBar.astro`, `src/components/Footer.astro`, `src/components/SkipLink.astro`
- Test: `tests/routes/layout.test.ts` (render a page via Astro container API; assert `<html lang>`, hreflang links, toggle URLs, footer links)

**Interfaces:**
- Produces: `<Base lang={lang} title description path ogImage? noindex?>` — emits `<html lang>`, `<title>`, meta description, canonical from `SITE_ORIGIN` + path (never request Host — architecture §5), `hreflang` alternates (en/kn/x-default), OG tags in the page's language, app bar, footer, GA snippet placeholder slot (Task 62), skip link.
- App bar (design-system §7.1): logo → `/` (or `/kn/`), two-segment `EN | ಕನ್ನಡ` toggle linking to `localePath(otherLang(lang), path)`, and a **`MeSlot` island mount point** — server renders the anonymous "Sign in" control; client swap comes in Task 29.
- Footer (§7.2): forest background; links About, Voting guide, Data, Partner with us, Press, Terms, Privacy; Oorvani attribution.

- [ ] **Step 1:** Failing tests (container render of a dummy page in both langs): `lang="kn"` set; toggle href correct both ways; canonical uses `SITE_ORIGIN`; all seven footer links present.
- [ ] **Step 2:** Implement. PASS. Commit: `feat: base layout with app bar, footer, hreflang, canonical`

### Task 13: Core component library

**Files:**
- Create: `src/components/{Button,Banner,DeadlineBanner,Badge,SourceLine,FieldRow,CandidateRow,IssueBars,EmptyState,Toast,FormField,Card}.astro`, `src/islands/ModalShell.ts` (shared `<dialog>` behavior: focus trap, scrim/Escape close, top-sheet under `md`)
- Test: `tests/unit/components.test.ts` (container renders; assert provenance badge classes, "Not declared" italic rendering, issue-bar single hue class, button variants)

**Interfaces:**
- Produces (consumed by every page task):
  - `<FieldRow label value sourceType={'official'|'curator'} sourceUrl aiExtracted notDeclared lang>` — the §3 field-row anatomy; renders the reserved badge (Affidavit / Curator-compiled / AI-extracted), "Not declared" in muted italic with source line intact.
  - `<CandidateRow candidate lang>` — 56px photo circle, name `--text-xl`, party + symbol beneath (identical in lists and compare headers).
  - `<IssueBars results lang showCounts={false}>` where `results: {issueTitle, rank, sharePct}[]` — all-forest bars, rank + share in tabular figures, never truncates titles.
  - `<DeadlineBanner deadline lang>` — ink on `--oc-sun`, tabular countdown; reserved for statutory deadlines.
  - `<Button variant={'primary'|'secondary'|'tertiary'|'destructive'}>`, `<Banner kind={'notice'|'error'}>`, `<EmptyState fact nextStep>`, `<FormField label error helper>`.
- [ ] **Step 1:** Failing component tests per the list above.
- [ ] **Step 2:** Implement per design-system §7; run tests — PASS.
- [ ] **Step 3:** Commit: `feat: core component library (provenance rows, candidate row, issue bars, modals shell)`

---

# M4 — Geo & ward lookup

### Task 14: Boundary loading + point-in-polygon

**Files:**
- Create: `src/lib/geo.ts`
- Test: `tests/unit/geo.test.ts`

**Interfaces:**
- Produces: `loadWardPolygons(): Promise<void>` (reads `data/gba.geojson` once at boot; nginx serves the same file statically for MapLibre); `wardForPoint(lat: number, lng: number): number | null` (null = outside every GBA polygon → explicit out-of-coverage, PRD §5.1); `wardBoundaryUrl(wardId): string` (static URL + feature ref).

- [ ] **Step 1:** Failing tests using real coordinates: a known point inside a ward → its id; a point in the Arabian Sea → null.
- [ ] **Step 2:** Implement with `@turf/boolean-point-in-polygon`; pre-index features by bbox for speed. PASS.
- [ ] **Step 3:** Commit: `feat: in-memory ward point-in-polygon over static GeoJSON`

### Task 15: Pincode shortlist table

**Files:**
- Create: `scripts/build-pincode-table.ts`, `data/pincode-wards.json` (committed artifact), `src/lib/pincode.ts`
- Test: `tests/unit/pincode.test.ts`

**Interfaces:**
- Produces: `wardsForPincode(pin: string): number[]` (possibly empty = out of coverage). The build script derives pincode→wards by sampling postal-boundary data against ward polygons; **the committed JSON is the runtime source** — regeneration is a PR (architecture §6). Until official postal boundaries are obtained (dependency §4), the script accepts a CSV input path so the data team can supply mappings; the JSON schema is `{ "560001": [1, 2, 110] }`.

- [ ] **Step 1:** Failing tests with a fixture JSON. Implement `pincode.ts` (load once, validate 6-digit input). PASS.
- [ ] **Step 2:** Implement the build script; generate from whatever source is available now (or a clearly-marked partial fixture); commit.
- [ ] **Step 3:** Commit: `feat: pincode → ward shortlist as committed static table`

### Task 16: Geocoding client with cache + budget

**Files:**
- Create: `src/lib/geocode.ts`, `src/lib/budgets.ts`
- Test: `tests/unit/geocode.test.ts` (Google API mocked with `vi.fn` fetch)

**Interfaces:**
- Produces:
  - `consumeBudget(kind: 'geocode'|'otp_send'|'news_query', dailyLimit: number): Promise<boolean>` — atomic upsert-increment on `budget_counters`; false when exhausted (an ops alarm email fires at crossing, via Task 55's mailer).
  - `lookupWardByAddress(address: string): Promise<{kind:'ward', wardId:number} | {kind:'out_of_coverage'} | {kind:'ambiguous'} | {kind:'budget_exhausted'} | {kind:'failed'}>`
  - Constraint comment written into the module verbatim (dependency §6.4): geocoding returns **a ward, never coordinates**; the cache stores normalized-address → ward-ID only; do not return or store Google's coordinates or response content.

- [ ] **Step 1:** Failing tests: cache hit skips the API; out-of-polygon point → `out_of_coverage` and cached as null; budget exhausted → `budget_exhausted` without an API call; address normalization (trim/lowercase/collapse whitespace, append ", Bengaluru" when absent).
- [ ] **Step 2:** Implement (server-side Google Geocoding REST; bias to Bengaluru viewport; multiple results → `ambiguous`). PASS.
- [ ] **Step 3:** Commit: `feat: budget-guarded geocoding that returns wards, never coordinates`

### Task 17: `POST /api/ward-lookup` + `POST /api/booth-lookup`

**Files:**
- Create: `src/pages/api/ward-lookup.ts`, `src/pages/api/booth-lookup.ts`
- Test: `tests/routes/ward-lookup.test.ts`

**Interfaces:**
- Produces (JSON contracts consumed by the lookup islands):
  - `POST /api/ward-lookup {address?} | {pincode?}` → `200 {result:'ward', ward:{id,nameEn,nameKn,corporation}}` · `{result:'shortlist', wards:[…]}` · `{result:'out_of_coverage'}` · `{result:'use_pincode', reason:'ambiguous'|'budget'|'failed'}` (degradation, architecture §11). Always `cache-control: no-store`.
  - `POST /api/booth-lookup {address}` → same shape with `booth:{name,address,lat,lng, wardId}` or `{result:'no_booth_data'}` (guided link-out state, PRD §5.10).
- [ ] **Step 1:** Failing route tests for each result shape (geo/geocode mocked), plus: response sets no cookie; GA-funnel server event logged as an application event (a `logger.info({event:'ward_lookup', result})` — IDs, never the address).
- [ ] **Step 2:** Implement with Zod validation. PASS.
- [ ] **Step 3:** Commit: `feat: ward and booth lookup endpoints with explicit degradation states`

---

# M5 — Public teaser pages (Phase 0–1 surface)

Every page task in this milestone follows the same 5 steps; they are written out once here and referenced as **PAGE-STEPS**:

1. Write failing route tests (Astro container render, both langs): asserts the IA "key elements" listed in the task, `lang` attribute, hreflang pair, and **zero `<script>` tags except allowed islands + the two nonce'd inline scripts**.
2. Run tests — FAIL.
3. Implement `src/features/pages/<Name>.astro` + the two thin route twins, using only M3 components and `t()`/content collections (add any new keys to `en.json`, run `npm run translate`).
4. Run tests + `npm run translate -- --check` — PASS.
5. Commit.

### Task 18: Home (`/`)

**Files:** `src/features/pages/Home.astro`, `src/pages/index.astro`, `src/pages/kn/index.astro`, `src/islands/WardLookup.tsx` (or `.svelte`/vanilla — use an Astro island in vanilla TS to keep JS minimal: a progressively-enhanced `<form>`), test `tests/routes/home.test.ts`
**Key elements (IA §3.1):** ward search form (address input + pincode fallback; pincode result renders a shortlist to pick from; out-of-coverage renders the explicit answer); election status banner reading from `app_settings` (`notification_date` absent → "notification awaited" — one Home, no pre-N variant); `<DeadlineBanner>` while `roll_deadline` is set and future; shortcut cards to `/check-registration` and `/voting-guide`; Sign in in app bar.
**Island contract:** `WardLookup` posts to `/api/ward-lookup`, renders result states inline, links to `/ward/{id}`; **no-JS fallback**: the form POSTs to `/` and the page server-renders the same result block.

- [ ] **PAGE-STEPS** — commit: `feat: home page with ward finder, election status, roll deadline`

### Task 19: Ward result (`/ward/{id}`)

**Files:** `src/features/pages/Ward.astro`, `src/pages/ward/[id].astro`, `src/pages/kn/ward/[id].astro`, `src/islands/WardMap.ts` (MapLibre; desaturated basemap, forest 2px boundary, 30% tint fill — design-system §8), test `tests/routes/ward.test.ts`
**Key elements (IA §3.2):** ward name/number/corporation; boundary map island (reads static GeoJSON URL); **register-for-updates slot** — server renders the anonymous "Register for updates" control (full enabled style, §7.8); `MeSlot` swaps it client-side to "Receiving updates" (own home ward) or nothing (other ward) after Task 29; links to candidates/issues/voting-guide; unknown ward id → real 404.
**Test additions:** 404 on unknown ward; register-slot server markup is identical for all users (cache invariant).

- [ ] **PAGE-STEPS** — commit: `feat: ward result page with boundary map and register slot`

### Task 20: Ward issues page (`/ward/{id}/issues`) — read side

**Files:** `src/features/pages/WardIssues.astro`, route twins, `src/lib/votes.ts` (results query), test `tests/routes/ward-issues.test.ts`
**Interfaces:** `issueResults(wardId): Promise<{issueId, titleEn, titleKn, rank, sharePct}[]>` — computed over **active** vote-sets only, against the current issue list; percentages, never raw counts (PRD §5.5).
**Key elements (IA §3.6):** curator-defined issue list; stance rows where candidates exist (excluding withdrawn/rejected); `<IssueBars>` results; "Vote your top 3" action button (modal mounts in Task 33; until then it links to `/login`); register-for-updates slot; empty state when no issues defined.

- [ ] **PAGE-STEPS** (tests include: percentages sum ≈ 100, no raw counts in HTML, retired sets excluded) — commit: `feat: ward issues page with public ranked results`

### Task 21: Guide & explainer pages (six pages)

**Files:** `src/features/pages/{CheckRegistration,AboutElection,VotingGuide,VoterId,HowToVote,FindBooth}.astro` + 12 route twins, `src/islands/BoothLookup.ts`, test `tests/routes/guides.test.ts`
**Key elements:** each renders its Task 8 content entry inside `Prose.astro` plus its structural elements — `CheckRegistration`: eligibility basics block, primary-button external link-out with glyph, `<DeadlineBanner>`; `VotingGuide`: ordered checklist with deep links (PRD §5.17); `VoterId`: Form 6 / Form 8 paths, deadline banner; `HowToVote`: numbered steps + FAQ accordions (native `<details>`); `FindBooth`: `BoothLookup` island with the no-booth-data guided link-out state.
**Test additions:** external EC links carry the external glyph and `rel="noopener"`; question-shaped headings present (AEO, architecture §8).

- [ ] **PAGE-STEPS** — commit: `feat: registration, voter-id, how-to-vote, find-booth, election explainer, guide hub`

### Task 22: Trust & legal pages (`/about`, `/terms`, `/privacy`)

**Files:** `src/features/pages/{About,Terms,Privacy}.astro` + twins, test `tests/routes/legal.test.ts`
**Key elements:** rendered from content entries; `/privacy` carries the full §5.16 inventory structure; KN legal pages append the courtesy-translation note (`legal.courtesyNote` string); `/about` includes `Organization` JSON-LD (Task 60 helper, stub inline until then).
**Test additions:** the Kannada privacy page contains the courtesy note; the English one does not.

- [ ] **PAGE-STEPS** — commit: `feat: about, terms, privacy pages (legal copy behind review markers)`

### Task 23: 404 + error pages

**Files:** `src/pages/404.astro`, `src/pages/kn/404.astro` (via shared `src/features/pages/NotFound.astro`), `src/pages/500.astro`
- [ ] **PAGE-STEPS** (test: unknown URL renders 404 with app bar/footer, status 404) — commit: `feat: bilingual 404 and 500 pages`

---

# M6 — Auth, sessions, accounts

### Task 24: Session library

**Files:**
- Create: `src/lib/session.ts`
- Test: `tests/unit/session.test.ts`

**Interfaces:**
- Produces:
  - `createSession(userId: number): Promise<{cookie: string}>` — inserts `sessions` row (id = 32 random bytes hex, `expiresAt = now + 1h`), returns cookie value `id.hmacSha256(id, SESSION_SECRET)`.
  - `readSession(cookieValue: string): Promise<{userId: number, role: Role} | null>` — verifies HMAC (timing-safe), loads row, null if expired/banned user; **slides** `expiresAt` to now+1h (write-behind: only when >5 min consumed, to keep public paths read-only).
  - `destroySession(cookieValue): Promise<void>`
  - `SESSION_COOKIE = 'bv_session'`; attributes `HttpOnly; Secure; SameSite=Lax; Path=/`.
- [ ] **Step 1:** Failing tests: round trip; tampered HMAC → null; expiry → null; sliding refresh.
- [ ] **Step 2:** Implement. PASS. Commit: `feat: signed sliding sessions (1h idle, all roles)`

### Task 25: OTP library + endpoints

**Files:**
- Create: `src/lib/otp.ts`, `src/pages/api/otp/request.ts`, `src/pages/api/otp/verify.ts`, `src/lib/send/sendgrid.ts` (minimal `sendEmail(to, subject, html)`), `src/lib/send/twilio.ts` (stub `sendWhatsAppTemplate()` returning `not_configured` until templates approve — PRD §10)
- Test: `tests/unit/otp.test.ts`, `tests/routes/otp.test.ts`

**Interfaces:**
- Produces:
  - `requestOtp(destination, channel, purpose, userId?): Promise<'sent'|'already_sent'|'cooldown_daily'|'budget_exhausted'|'suppressed'>` — per-destination cooldowns **1/minute, 5/hour, daily cap** computed from `otp_codes` timestamps; during cooldown returns `'already_sent'` and the earlier code **stays valid** (targeted-DoS rule, architecture §13); global daily budget via `consumeBudget('otp_send', …)`.
  - `verifyOtp(destination, code): Promise<{ok:true, userId: number|null} | {ok:false, reason:'expired'|'invalid'|'locked'}>` — sha256(code+secret) compare; `attempts` increment; ≥5 → code invalidated (`locked`). `userId` null means new contact (registration path).
  - `POST /api/otp/request {destination, channel}` → `{status}` (never discloses whether the contact is known); `POST /api/otp/verify {destination, code, register?: {wardId, language, futureTools, srcCookie?}}` → sets session cookie; on new contact requires `register` payload, creates the user with consent evidence: `consentAt=now`, `consentVersion = app_settings['consent_wording_version']`, `futureToolsOptIn`, `srcAttribution` from the `bv_src` cookie (PRD §5.12, §10). Both endpoints `no-store`.
- [ ] **Step 1:** Failing unit tests for every cooldown/attempt rule above (fake timers) and route tests: register creates user with consent fields; verified known contact logs in; 6th verify attempt → `locked`; cooldown response does not invalidate the prior code.
- [ ] **Step 2:** Implement (email OTP live via SendGrid; WhatsApp path returns `not_configured` cleanly). PASS.
- [ ] **Step 3:** Commit: `feat: OTP auth with per-destination cooldowns, attempt caps, consent capture`

### Task 26: Middleware — session, CSRF, authorization, cache safety

**Files:**
- Create: `src/middleware.ts`, `src/lib/csrf.ts`, `src/lib/authz.ts`
- Test: `tests/routes/middleware.test.ts`

**Interfaces:**
- Produces `Astro.locals`: `{ lang, session: {userId, role} | null, user? , csrfToken: string, cspNonce: string }` and these guarantees:
  - **Unsafe methods** (POST/PUT/DELETE) on non-webhook routes: reject 403 unless `Origin` (or `Sec-Fetch-Site: same-origin/none`) matches `SITE_ORIGIN`; server-rendered forms additionally require a valid synchronizer token (`csrf.ts`: `issueToken(sessionId)` HMAC, `checkToken`); `/api/webhooks/*` are exempt (signature-verified instead).
  - **Route guards:** `/account/*` requires session (redirect `/login?next=…`); `/curator/*` requires role curator|admin; `/admin/*` requires admin; curator ward-scope enforcement via `authz.canEditWard(userId, wardId)` (admin always true; curator via `curator_scopes`).
  - `next` param validated as same-origin **relative path** — absolute URLs discarded for `/` (open-redirect close, architecture §7).
  - **Public GETs never set cookies.** Session cookie writes happen only on auth endpoints and authed routes.
  - Sets `X-Robots-Tag: noindex` on `/partner/*`, `/account/*`, `/curator/*`, `/admin/*`, `/login`.
- [ ] **Step 1:** Failing tests: cross-origin POST → 403; citizen hitting `/curator` → 403; curator editing out-of-scope ward → 403; `next=https://evil.example` → redirects to `/`; public page GET response has no `set-cookie`.
- [ ] **Step 2:** Implement. PASS. Commit: `feat: authz + CSRF middleware with cache-safe public routes`

### Task 27: Register/Login modal + `/login` fallback

**Files:**
- Create: `src/islands/RegisterLoginModal.ts`, `src/features/pages/Login.astro`, `src/pages/login.astro`, `src/pages/kn/login.astro`
- Test: `tests/routes/login.test.ts`, island logic unit tests `tests/unit/register-modal.test.ts`

**Interfaces:**
- Produces:
  - `openRegisterLogin(opts: { prefillWardId?: number, onSuccess: () => void }): void` — global (window-scoped) opener used by every gated action; modal steps: contact → OTP → confirm (ward picker or read-only pre-filled ward + language + consent sentence with links + optional future-tools checkbox, IA §7.1); WhatsApp-first users see the add-email nudge. On success calls `onSuccess` — **the action resumes in place** (core concept 2).
  - `/login` page: same flow as server-rendered forms (no-JS path — modals are progressive enhancements over this route, architecture §4); on success redirects to validated `next` or `/`.
- [ ] **Step 1:** Failing tests: `/login` full form flow against mocked OTP endpoints; ward pre-fill renders read-only; consent sentence + both legal links present; unit test that `onSuccess` fires after verify 200.
- [ ] **Step 2:** Implement (single 6-digit input, `inputmode="numeric" autocomplete="one-time-code"` — design-system §7.9). PASS.
- [ ] **Step 3:** Commit: `feat: register/login modal with resume-in-place and /login fallback`

### Task 28: `GET /api/me` + client personalization

**Files:**
- Create: `src/pages/api/me.ts`, `src/islands/MeSlot.ts`
- Test: `tests/routes/me.test.ts`

**Interfaces:**
- Produces: `GET /api/me` → `{anonymous:true}` or `{userId, role, homeWardId, language, alreadyVotedWardId}` (`no-store`). `MeSlot` (mounted in AppBar and the register-for-updates slots) makes **one** `/api/me` call per page and swaps the three personalized elements client-side: Sign-in ↔ Account control; register-slot → "Receiving updates"/hidden; already-voted state on the issues page (architecture §5).
- [ ] **Step 1:** Failing tests: anonymous and authed shapes; `no-store`; server HTML for a ward page is byte-identical with and without a session cookie (the invariant test that later guards nginx assumptions — reuse in Task 61).
- [ ] **Step 2:** Implement. PASS. Commit: `feat: /api/me and single-call client-side personalization`

### Task 29: Account pages

**Files:**
- Create: `src/features/pages/{Account,AccountNotifications,AccountSubmissions}.astro` + route twins under `/account/*`
- Test: `tests/routes/account.test.ts`

**Key elements (IA §4):** `/account` — language preference (server POST, updates `users.language`), home ward change (ward picker; **retires active vote-set** via `votes.retireActiveSet(userId)` in the same transaction, PRD §5.5), contact add/change (each new contact verified by OTP to that contact — reuses `purpose:'add_contact'`), sign out. `/account/notifications` — email/WhatsApp toggles only (PRD §9.3). `/account/submissions` — user's flags with pending/accepted/rejected + reason (from `flag_submissions` joined to `flag_items`).
- [ ] **Step 1:** Failing route tests: ward change retires votes; contact change requires OTP verify; toggles persist; submissions list shows the collapsed item's shared outcome (PRD §6.3).
- [ ] **Step 2:** Implement as server-rendered forms with CSRF tokens (no SPA — architecture §4). PASS.
- [ ] **Step 3:** Commit: `feat: account, notification settings, and submissions pages`

---

# M7 — Contributions (flags + issue votes)

### Task 30: Per-account rate limiting

**Files:**
- Create: `src/lib/rate-limit.ts`
- Test: `tests/unit/rate-limit.test.ts`

**Interfaces:**
- Produces: `checkAccountLimit(userId, action: 'flag'|'vote'|'upload'|'eoi', limit: {count, perHours}): Promise<boolean>` — Postgres-backed sliding window (count rows in the relevant table by user + window; no Redis, architecture §3). Limits: flags 10/day, vote re-casts 20/day, uploads 30/day.
- [ ] Failing tests → implement → PASS → commit: `feat: per-account contribution rate limits`

### Task 31: Flags API + queue collapse

**Files:**
- Create: `src/lib/flags.ts`, `src/pages/api/flags.ts`
- Test: `tests/unit/flags.test.ts`, `tests/routes/flags.test.ts`

**Interfaces:**
- Produces:
  - `submitFlag(userId, {wardId, targetType, targetRef, detail, suggestedValue?, sourceUrl?})` — finds-or-creates the **pending** `flag_items` row for `targetRef` (the dedupe key), appends a `flag_submissions` row, writes audit (`action:'flag'`, actorRole `'citizen'`).
  - `resolveFlag(actor, flagItemId, resolution: {accept: true, publish: PublishInput} | {accept: false, reason: string})` — accept path calls the Task 5 publish helper then marks the item `accepted`, all one transaction; reject stores the reason; **every collapsed submitter sees the same outcome** (status is on the item).
  - `POST /api/flags` — session-gated; Zod-validated; `sourceUrl` restricted to `http(s)` (architecture §13); rate-limited.
- [ ] **Step 1:** Failing tests: two users flagging the same field → one item, count 2; resolve marks both submissions' visible status; a new flag on a previously-rejected target opens a **new** item (partial unique index on status makes this work); non-http source rejected.
- [ ] **Step 2:** Implement. PASS. Commit: `feat: deduped flag queue with transactional resolution`

### Task 32: Flag modal

**Files:**
- Create: `src/islands/FlagModal.ts`; mount the Flag action on `Ward.astro`, `WardIssues.astro` (and `Candidate.astro` in M9)
- Test: `tests/unit/flag-modal.test.ts`, e2e later (Task 68)

**Interfaces:** `openFlagModal({wardId, targets: {targetType, targetRef, label}[]})` — field/claim picker + detail + optional source; anonymous → `openRegisterLogin` first, then **this modal reopens** with state preserved (IA §7.2); URL never changes.
- [ ] Failing unit tests (anonymous gating handoff; state survives auth) → implement → PASS → commit: `feat: flag misinformation modal with auth resume`

### Task 33: Issue votes API + modal

**Files:**
- Create: `src/pages/api/issue-votes.ts` (`PUT`), `src/lib/votes.ts` (extend), `src/islands/VoteModal.ts`
- Test: `tests/unit/votes.test.ts`, `tests/routes/issue-votes.test.ts`

**Interfaces:**
- Produces:
  - `castVoteSet(userId, wardId, issueIds: number[])` — validates 1–3 ids, all belonging to `wardId`, `wardId === user.homeWardId` (else 403 `wrong_ward`); retires any active set, inserts the new one (re-cast replaces the whole set, PRD §5.5); audit-logged.
  - `retireActiveSet(userId)` (already consumed by Task 29).
  - `PUT /api/issue-votes {wardId, issueIds}` → `{ok, results}` (fresh results so the page updates in place).
  - `VoteModal`: checkbox list capped at 3, submit label "Vote (2 of 3 selected)" (design-system §7.9), pre-checked with current selections from `/api/me` + a `GET` include; anonymous → register modal first, resume.
- [ ] **Step 1:** Failing tests: home-ward enforcement; 0 or 4 selections rejected; re-cast replaces; deleted issue disappears from results while remaining selections stand (FK cascade — assert).
- [ ] **Step 2:** Implement. PASS. Commit: `feat: top-3 issue voting with one active set per user`

---

# M8 — Curator suite

### Task 34: Curator dashboard + queue pages

**Files:**
- Create: `src/features/pages/curator/{Dashboard,Queue,QueueItem}.astro`, routes `/curator`, `/curator/queue`, `/curator/queue/[id]` (EN-only chrome is fine? **No** — curator pages are also bilingual UI strings, but no KN route twins: curator/admin routes are `noindex` and use the UI-string layer with the curator's session language; single route, `lang` from `users.language`)
- Test: `tests/routes/curator.test.ts`

**Key elements (IA §5.1–5.3):** dashboard — queue count, recent activity (audit tail for scoped wards), **awaiting-sign-off list with cleared-by-candidate-change wards first**; queue — deduped items with counts for scoped wards, filter/sort; item view — flag detail(s), current value, source, **accept** (inline edit + source → `resolveFlag` accept) or **reject** (reason required); confirmation dialog stating scope ("Publishes immediately to /ward/57", design-system §7.13).
- [ ] **Step 1:** Failing tests: out-of-scope items invisible; accept publishes + audits; reject requires reason.
- [ ] **Step 2:** Implement (server-rendered forms + CSRF). PASS. Commit: `feat: curator dashboard, queue, and submission review`

### Task 35: Media ingest

**Files:**
- Create: `src/lib/media.ts`, `src/pages/media/[id]/[hash].ts`
- Test: `tests/unit/media.test.ts`, `tests/routes/media.test.ts`

**Interfaces:**
- Produces:
  - `storeMedia(actor, file: {bytes: Buffer, declaredType: string}, kind: 'photo'|'affidavit'): Promise<{id, hash, url}>` — magic-byte sniff (JPEG/PNG/WebP for photo ≤2 MB; `%PDF` for affidavit ≤20 MB); declared type and extension ignored; sha256 stored; URL `/media/{id}/{sha256-prefix-16}`.
  - `GET /media/{id}/{hash}` — 404 on hash mismatch; headers: stored `Content-Type`, `X-Content-Type-Options: nosniff`, `Content-Disposition: inline; filename=…` for PDFs → actually `attachment`? — **`inline` with filename** (citizens read affidavits in-browser; nosniff + validated type carries the safety, architecture §13 requires Content-Disposition present), `Cache-Control: public, max-age=31536000, immutable`.
- [ ] **Step 1:** Failing tests: SVG masquerading as PNG rejected; oversize rejected; served headers exact; wrong hash 404.
- [ ] **Step 2:** Implement. PASS. Commit: `feat: magic-byte-validated media store with immutable content-hash URLs`

### Task 36: Candidate editor

**Files:**
- Create: `src/features/pages/curator/CandidateEdit.astro`, route `/curator/candidate/[id]` (+ `/curator/candidate/new?ward=`), extend `src/lib/publish.ts` with `publishCandidateCore` (name/party/photo/status) and `publishStance`
- Test: `tests/routes/curator-candidate.test.ts`

**Key elements (IA §5.4):** all report-card fields via FieldRow-shaped form groups, **source required per field**; photo upload; lifecycle status select — a status transition or new candidate **clears ward sign-off** (`wardReadiness.signedOffAt = null, clearedAt = now`, audit-logged — architecture §6); news-link list (Task 38); affidavit panel (Task 37); edits publish immediately.
- [ ] **Step 1:** Failing tests: publish without source rejected; status change clears sign-off; slug generated as `{ward-id}-{name-slug}` unique city-wide (IA §3.4).
- [ ] **Step 2:** Implement. PASS. Commit: `feat: candidate editor with per-field sources and lifecycle status`

### Task 37: Affidavit upload, EC-link fetch, AI extraction

**Files:**
- Create: `src/lib/affidavit-fetch.ts`, `src/lib/extract.ts`; wire into `CandidateEdit.astro`
- Test: `tests/unit/affidavit-fetch.test.ts`, `tests/unit/extract.test.ts`

**Interfaces:**
- Produces:
  - `fetchAffidavitFromEc(url: string): Promise<Buffer>` — the SSRF-hardened fetch: `https:` only; hostname must match allowlist `['eci.gov.in', 'ceo.karnataka.gov.in', 'affidavit.eci.gov.in']` (extendable in one const); DNS-resolved address re-checked against private/loopback/link-local/169.254.169.254 ranges **after each redirect**, redirects ≤ 3; result passes `storeMedia` validation (architecture §7).
  - `extractAffidavitFields(mediaId, candidateId, actor): Promise<void>` — sends the PDF to the Anthropic API (`claude-fable-5`? use `claude-sonnet-5` — extraction is structured, cost-sensitive) with a **fixed extraction schema** (tool/JSON output: `{cases: string|null, assets: string|null, education: string|null}` where `null` means the affidavit doesn't state it → publish as `notDeclared`); publishes each field via `publishCandidateField` with `aiExtracted: true`, `sourceType:'official'`, `sourceUrl` = the stored media URL, actor `system` (audit "system entry", PRD §5.2); failures set `extraction_status='failed'` and surface on the editor.
- [ ] **Step 1:** Failing tests: fetch rejects `http:`, off-allowlist host, redirect-to-metadata-IP; extraction publishes three fields marked AI-extracted with the stored-PDF source; curator confirming a field clears the marker without layout-affecting changes (covered by Task 5's clear-on-curator-publish).
- [ ] **Step 2:** Implement (mock Anthropic in tests). PASS. Commit: `feat: affidavit ingestion — SSRF-hardened EC fetch and schema-bound AI extraction`

### Task 38: News links (curator add + approve; suggestions render curator-only)

**Files:**
- Modify: `CandidateEdit.astro`; create `src/lib/news.ts`
- Test: `tests/routes/news-links.test.ts`

**Interfaces:** `approveNewsLink(actor, linkId)` (normal audit-logged publish); `addNewsLink(actor, candidateId, url, title)` (write-time `http(s)` validation); suggested links render **only** on the curator editor; the public report card renders approved only — the guard test lives here and re-runs in Task 42.
- [ ] Failing tests → implement → PASS → commit: `feat: news links with curator-only suggestions and audited approval`

### Task 39: Ward editor, issues editor, readiness panel

**Files:**
- Create: `src/features/pages/curator/{WardEdit,WardIssuesEdit}.astro`, routes `/curator/ward/[id]`, `/curator/ward/[id]/issues`, `src/lib/readiness.ts`
- Test: `tests/unit/readiness.test.ts`, `tests/routes/curator-ward.test.ts`

**Interfaces:**
- Produces: `computeReadiness(wardId): Promise<{complete: boolean, gaps: {candidateId, missing: string[]}[]}>` — per PRD §9.1: every filed/contesting candidate has name + party, and cases/assets/education each populated **or** `notDeclared`, and every field has a source; withdrawn/rejected excluded. `signOffWard(actor, wardId)` — allowed only when the actor's scope covers the ward; snapshots completeness; audit-logged. Issue editor: add/edit/remove — rename keeps votes (update in place), delete cascades selections (PRD §5.5), both audit-logged.
- [ ] **Step 1:** Failing tests for every completeness rule, the gap list content, sign-off scope check, and rename-vs-delete vote semantics.
- [ ] **Step 2:** Implement — readiness panel styled per design-system §7.13 (forest tint pass / sun tint + gap list held, never red). PASS.
- [ ] **Step 3:** Commit: `feat: ward editor with mechanical readiness check and curator sign-off`

### Task 40: Runtime machine translation of curator data

**Files:**
- Create: `src/lib/translate-runtime.ts`; wire `translateFieldSoon` into `publish.ts` (replacing the Task 5 stub)
- Test: `tests/unit/translate-runtime.test.ts`

**Interfaces:**
- Produces: `translateFieldSoon(target: {table:'candidate_fields'|'ward_issues'|'candidate_stances', id: number})` — post-commit, in-request with **5 s timeout**: Anthropic call with field name, candidate/ward context, and the shared glossary; success writes the other-language value + `translationStatus:'done'` + a system audit entry; failure leaves `pending` (renders in authored language with the PRD §8 indicator; `jobs` retries — Task 56). A curator editing the KN value directly sets `manual` (excluded from MT until the source changes, which flips it back to `pending`) (architecture §9).
- [ ] **Step 1:** Failing tests (mocked API + fake timers): success path, timeout → pending, manual exclusion, source-change regeneration.
- [ ] **Step 2:** Implement; public renderers (`FieldRow`) show the pending-translation indicator when displaying the authored language on the other locale. PASS.
- [ ] **Step 3:** Commit: `feat: publish-time Kannada MT with glossary, timeout, and manual override`

---

# M9 — Candidate public pages (Phase 2 surface)

### Task 41: Candidate report card (`/candidate/{slug}`)

**Files:** `src/features/pages/Candidate.astro` + twins, test `tests/routes/candidate.test.ts`
**Key elements (IA §3.4, PRD §5.2):** name/photo/party; withdrawn/rejected **status banner** with 200 status; provisional marker until withdrawals close (driven by `app_settings.withdrawals_closed`); the seven field rows via `FieldRow` (affidavit fields link to the stored PDF; AI-extracted badge until confirmed); approved news links only; Flag action; `Person` JSON-LD with `sameAs` news links; pre-notification unknown-but-plausible slugs → real 404, but **existing** candidate URLs always 200.
**Tests:** unapproved suggestion never in HTML (the Task 38 guard, asserted against this page); withdrawn candidate 200 + banner; affidavit source href is the `/media/...` URL.

- [ ] **PAGE-STEPS** — commit: `feat: candidate report card with provenance, status banners, JSON-LD`

### Task 42: Candidates-in-ward list (`/ward/{id}/candidates`)

**Files:** `src/features/pages/WardCandidates.astro` + twins, test
**Key elements (IA §3.3):** `CandidateRow` list with lifecycle status shown; alphabetical order (design-system §4.3); pre-notification **empty state with 200** ("Candidate nominations open on {date}…", design-system §7.12); register-for-updates slot.
- [ ] **PAGE-STEPS** — commit: `feat: ward candidate list with pre-notification empty state`

### Task 43: Compare (`/ward/{id}/compare`)

**Files:** `src/features/pages/Compare.astro` + twins, test
**Key elements (IA §3.5, PRD §5.3):** CSS-grid columns of the same field rows aligned; filed/contesting only; 2-up on mobile with horizontal scroll through **all** candidates, field-label column pinned via `position: sticky; left: 0` inside an `overflow-x` container; more columns ≥`lg`. Pure CSS — no island.
- [ ] **PAGE-STEPS** (test: withdrawn candidate absent; all contesting present) — commit: `feat: candidate comparison with pinned labels and unlimited columns`

---

# M10 — Admin suite

### Task 44: Admin console, roles & scopes

**Files:** `src/features/pages/admin/{Console,Roles}.astro`, routes `/admin`, `/admin/roles`, test `tests/routes/admin-roles.test.ts`
**Key elements (IA §6.2):** grant/revoke curator and admin roles; assign scope as ward multiselect with a **zone shortcut that expands to that zone's wards** at save time (stored per-ward only — PRD §10); every grant/revoke/scope change audit-logged.
- [ ] Failing tests (zone expansion stores ward rows; revoke removes scope; all audited) → implement → PASS → commit: `feat: admin roles and per-ward curator scoping with zone shortcut`

### Task 45: Manage users + erasure

**Files:** `src/features/pages/admin/Users.astro`, route `/admin/users`, `src/lib/erasure.ts`, test
**Interfaces:** `eraseUser(actor, userId)` — the architecture §7 routine: delete OTP rows, sessions, contact fields, consent record; `users` row → `status:'erased'`, email/phone null, `srcAttribution` null; votes/flags/audit keep the opaque id; audit-logged. Ban/deactivate sets `status:'banned'` (sessions killed).
- [ ] Failing tests (erasure severs identity but aggregates survive; banned user's session invalid) → implement → PASS → commit: `feat: user moderation and DPDP erasure routine`

### Task 46: Partners, coverage, EOI queue, held wards

**Files:** `src/features/pages/admin/Partners.astro`, route `/admin/partners`, test
**Key elements (IA §6.4):** partner CRUD with slug; per-partner attributed-registration count (`users.srcAttribution`); ward-coverage matrix vs 369 with the uncovered set as a work queue; **held wards** list (readiness false or unsigned) with per-ward, per-send admin **override** (`commsHoldOverride`, audit-logged); EOI queue split by path with accept (awareness → creates partner + kit page; curation → link to `/admin/roles`) / decline.
- [ ] Failing tests (coverage math; override audited; EOI accept provisions partner) → implement → PASS → commit: `feat: partner roster, ward coverage dashboard, EOI triage, comms-hold override`

### Task 47: Audit viewer + rollback

**Files:** `src/features/pages/admin/Audit.astro`, route `/admin/audit`, extend `src/lib/publish.ts` with `restoreAuditEntry(actor, auditId)`
**Interfaces:** viewer with entity/ward/actor filters + pagination; **restore-this-value** per entry — a **forward publish** of `oldValue` through the normal publish helper: same transaction, new audit entry (`action:'restore'`), MT re-trigger; history never edited (architecture §7).
- [ ] Failing tests (restore writes a new entry; restored value live; original entries untouched) → implement → PASS → commit: `feat: audit log viewer with forward-write rollback`

---

# M11 — Partner kit, recruitment, press, data

### Task 48: Partner kit page (`/partner/{slug}`)

**Files:** `src/features/pages/PartnerKit.astro` + twins, test
**Key elements (IA §3.19):** tagged link `/?src={slug}` with copy button (tiny inline island or `navigator.clipboard` via the nonce'd script — keep it a no-JS-safe `<input readonly>`); WhatsApp forward texts EN + KN (general + first-time-voter variant linking `/voting-guide`); poster image block with print styles (design-system §11); neutrality statement; `noindex` (middleware already covers `/partner/*`); unknown slug → 404.
- [ ] **PAGE-STEPS** — commit: `feat: unlisted bilingual partner kit pages`

### Task 49: `?src` attribution cookie writer

**Files:** `src/layouts/Base.astro` (inline nonce'd script), test `tests/routes/attribution.test.ts`
**Interfaces:** the first of the two allowed inline scripts (architecture §13): reads `location.search` client-side, stores `bv_src` cookie (30 days, `SameSite=Lax`); registration endpoint (Task 25) already reads it. Cache key ignores query strings, so this is the only attribution mechanism (architecture §5).
- [ ] Failing test (script tag present with nonce attr; no other inline script) → implement → PASS → commit: `feat: client-side ?src attribution surviving the query-blind cache`

### Task 50: `/partner-with-us` + EOI endpoint + reCAPTCHA

**Files:** `src/features/pages/PartnerWithUs.astro` + twins, `src/pages/api/eoi.ts`, test
**Interfaces:** `POST /api/eoi {path, name, organisation?, contact, wardsText?, message?, recaptchaToken}` — the one anonymous write: server-verifies the v3 token+score (≥0.5), inserts `eoi_submissions`, no session required; the reCAPTCHA script loads **only on this page** and its CSP additionally allows the Google hosts (Task 63 nginx per-location header).
- [ ] Failing tests (bad token 400; success lands in queue; no reCAPTCHA script on other pages) → implement → PASS → commit: `feat: anonymous expression-of-interest with reCAPTCHA v3`

### Task 51: `/press` and `/data`

**Files:** `src/features/pages/{Press,Data}.astro` + twins, `src/lib/metrics.ts`, test
**Interfaces:** `publicMetrics(): Promise<Metrics>` — coverage (wards with published candidate data vs 369; separate wards-signed-off figure; report cards complete; active curators; sources cited), integrity (flags raised/resolved, median hours to resolve), citizen signal (city-wide issue roll-up via `IssueBars`, total votes cast, registered citizens), each with "as of" timestamp; computed live with a 5-minute nginx TTL doing the caching (architecture §5). `/press`: boilerplate (three lengths), stats from the same helper, logo/screenshot download links, spokesperson blocks (`<!-- INPUT NEEDED -->`), contact + response time, neutrality statement.
- [ ] **PAGE-STEPS** — commit: `feat: public data metrics and press kit pages`

---

# M12 — Messaging, webhooks, jobs

### Task 52: Send rendering + suppression honor

**Files:**
- Create: `src/lib/send/render.ts`, `src/lib/suppressions.ts`
- Test: `tests/unit/send-render.test.ts`

**Interfaces:**
- Produces: `renderMessage(code: SendCode|'OTP', lang: Lang, channel: Channel, vars: Record<string,string>): {subject?, body, templateSid?}` — email bodies and WhatsApp template ids/variables exactly per `docs/messages.md` (template names `bv_w1_welcome_en` etc.); `isSuppressed(contact, channel): Promise<boolean>`; `sendToUser(user, code, vars)` — resolves channels from user toggles + verified contacts, honors suppressions **before every send** (architecture §7), writes `campaign_sends` (unique per code×user×channel — send-once), respects `SENDS_DISABLED` (log instead of send).
- [ ] Failing tests (suppressed contact skipped; SENDS_DISABLED logs; ledger uniqueness) → implement → PASS → commit: `feat: message rendering and suppression-honoring send path`

### Task 53: Vendor webhooks

**Files:**
- Create: `src/pages/api/webhooks/sendgrid.ts`, `src/pages/api/webhooks/twilio.ts`
- Test: `tests/routes/webhooks.test.ts`

**Interfaces:** SendGrid: verify signed-event signature (`SENDGRID_WEBHOOK_PUBLIC_KEY`, ECDSA); `bounce`/`spamreport` events upsert `suppressions`. Twilio: verify `X-Twilio-Signature`; inbound `STOP`/opt-out → permanent `whatsapp` suppression; delivery-status events logged. Both: `no-store`, no session, 403 on bad signature, exempt from CSRF middleware, own nginx `limit_req` zone (Task 63).
- [ ] Failing tests (invalid signature 403; bounce → suppression row; STOP → suppression) → implement → PASS → commit: `feat: signature-verified vendor webhooks writing suppressions`

### Task 54: Campaign calendar runner

**Files:**
- Create: `src/lib/send/calendar.ts`, `jobs/run-campaign.ts`
- Test: `tests/unit/calendar.test.ts`

**Interfaces:**
- Produces: `dueSends(now: Date, settings): SendCode[]` — pure function of the anchor dates in `app_settings` (`roll_deadline`, `notification_date`, `scrutiny_complete_date`, `election_date`): R1 at roll−7d, L1 at scrutiny-complete, C1 E−21d, C2 E−14d, C3 E−7d, F1 E−3d; **guardrail check**: any send scheduled inside poll-close−48h → refuse and alarm (PRD §9.2 — should never trigger given the calendar, but enforced). `runCampaign()` — for each due code: audience = registered users per ward at **send time** (PRD §9); L1/C2/C3 gated per ward on `computeReadiness` + sign-off (or admin override); held wards recorded as `status:'held'` rows so `/admin/partners` shows them; W1 fires from the registration flow, not the calendar.
- [ ] Failing tests (each trigger date; readiness hold; override releases; send-time audience resolution; the 48h guardrail) → implement → PASS → commit: `feat: ward-gated campaign runner over the seven-send calendar`

### Task 55: Remaining jobs + crontab

**Files:**
- Create: `jobs/translate-retry.ts` (pending fields → `translateFieldSoon`, every 5 min), `jobs/regen-sitemaps.ts` (hourly — Task 60 consumer), `jobs/news-suggest.ts` (2–3-day cadence N→E: Google Programmable Search per filed/contesting candidate over `data/news-domains.json`, store as `suggested`; `consumeBudget('news_query')`), `jobs/reconcile-suppressions.ts` (daily vs SendGrid suppression API), `jobs/retention.ts` (post-`results_declared_at + confirmed period`: bulk `eraseUser` — **ships disabled** until PRD §17 legal confirmation, with a loud startup log), `scripts/backup.sh` (pg_dump → restic to Spaces → verify `restic snapshots` gained one → curl healthchecks.io ping), `deploy/crontab`
- Test: `tests/unit/news-suggest.test.ts` (domain allowlist enforced; no page-content fetch; budget respected)

- [ ] Failing tests → implement all → PASS → commit: `feat: jobs container — retries, sitemaps, news suggestions, reconciliation, backup, retention`

---

# M13 — SEO/AEO & cache correctness

### Task 56: SEO helpers + JSON-LD

**Files:** `src/lib/seo.ts`; wire into `Base.astro` and page features
**Interfaces:** `jsonLd(obj): string` — serialized with `<` escaped (architecture §13); builders: `personLd(candidate)`, `placeLd(ward)`, `eventLd(settings)`, `faqLd(questions)`, `orgLd()`, `breadcrumbLd(trail)`; every absolute URL from `SITE_ORIGIN`.
- [ ] Failing tests (escaping; per-page-type presence on ward/candidate/guide/about) → implement → PASS → commit: `feat: JSON-LD structured data across page types`

### Task 57: Sitemaps, robots, llms.txt

**Files:** `jobs/regen-sitemaps.ts` (already stubbed), `src/pages/robots.txt.ts`, `src/pages/llms.txt.ts`
**Interfaces:** per-language sitemaps (`/sitemap-en.xml`, `/sitemap-kn.xml`, index) with `lastmod` from publish timestamps, written to a static dir nginx serves; excluded: `/partner/*`, `/account/*`, `/curator/*`, `/admin/*`, `/login` (architecture §8); `llms.txt` — concise index of wards, candidates, guides.
- [ ] Failing tests (exclusions; hreflang alternates in sitemap entries) → implement → PASS → commit: `feat: per-language sitemaps, robots, llms.txt`

### Task 58: GA snippet + cache-invariant guard tests

**Files:** `Base.astro` (GA inline snippet, nonce'd, public pages only), `tests/routes/cache-invariant.test.ts`
**Tests (the §12 guards, all in one suite):**
- every public GET: no `Set-Cookie`, HTML byte-identical with/without session cookie;
- `/api/*`, `/account/*`, `/curator/*`, `/admin/*` responses: `cache-control` containing `no-store`;
- unapproved news suggestions absent from candidate HTML;
- webhook endpoints reject unsigned posts;
- oversize/off-type media rejected.
- [ ] Write suite (some assertions re-exercise earlier tests — keep them here as the single named guard suite) → PASS → commit: `test: cache-invariant and security guard suite`

---

# M14 — Deployment

### Task 59: Dockerfile

**Files:** `Dockerfile`, `.dockerignore` (must exclude `prototype/`, `node_modules`, `docs`)
**Interfaces:** multi-stage: build (npm ci → `astro build` → prune dev deps) → runtime `node:22-slim`; `CMD ["node", "./dist/server/entry.mjs"]`; the jobs service uses the same image with `command: supercronic /app/deploy/crontab` (install supercronic in the image); image labels `org.opencontainers.image.source` for GHCR linkage.
- [ ] Build locally, run with a local Postgres, hit `/healthz` → 200. Commit: `feat: single app+jobs container image`

### Task 60: nginx configuration

**Files:** `deploy/nginx/nginx.conf`, `deploy/nginx/conf.d/site.conf`, `deploy/nginx/snippets/{cache,security-headers,rate-limits}.conf`
**The load-bearing excerpts (architecture §5, §7, §13, §14):**

```nginx
# rate-limits.conf
limit_req_zone $binary_remote_addr zone=api:10m    rate=30r/s;   # CGNAT-sized, coarse backstop
limit_req_zone $binary_remote_addr zone=otp:10m    rate=2r/s;
limit_req_zone $binary_remote_addr zone=webhook:10m rate=100r/s; # generous, own zone (arch §7)

# cache.conf
proxy_cache_path /var/cache/nginx/pages levels=1:2 keys_zone=pages:50m max_size=2g inactive=10m;

# site.conf (production server block essentials)
server {
  listen 443 ssl http2;
  server_name bangalore-votes.opencity.in;
  # … certs from the shared certbot volume …

  add_header Strict-Transport-Security "max-age=63072000" always;
  add_header X-Content-Type-Options nosniff always;
  add_header Referrer-Policy strict-origin-when-cross-origin always;
  # CSP set by the app per-request (nonces); nginx passes it through.

  location /media/   { proxy_pass http://app:4321; proxy_cache pages; proxy_cache_valid 200 30d; }
  location /api/     { limit_req zone=api burst=60 nodelay; proxy_pass http://app:4321; }
  location /api/otp/ { limit_req zone=otp burst=5;  proxy_pass http://app:4321; }
  location /api/webhooks/ { limit_req zone=webhook burst=200; proxy_pass http://app:4321; }
  location ~ ^/(account|curator|admin|login) { proxy_pass http://app:4321; }  # no cache, cookies pass

  location /data/gba.geojson { root /srv/static; expires 1d; }
  location /_astro/  { root /srv/static; expires 1y; add_header Cache-Control immutable; }

  location / {  # public pages: cached, cookie-stripped, query-blind
    proxy_set_header Cookie "";               # enforce the invariant (arch §5)
    proxy_ignore_headers Set-Cookie;
    proxy_cache pages;
    proxy_cache_key "$scheme$host$uri";       # query string ignored
    proxy_cache_valid 200 60s;
    proxy_cache_use_stale error timeout updating;
    proxy_cache_background_update on;
    proxy_set_header Host bangalore-votes.opencity.in;   # pinned Host (arch §5)
    proxy_pass http://app:4321;
  }
}
# /ward/*/issues and /data get their own location with proxy_cache_valid 200 5m.
server { listen 443 ssl default_server; ssl_reject_handshake on; }  # unmatched hosts rejected
# staging server block: basic_auth, X-Robots-Tag noindex, proxies to app-staging:4321
```

- [ ] **Step 1:** Write the full config; validate with `docker run --rm -v …:/etc/nginx nginx:stable nginx -t`.
- [ ] **Step 2:** Integration check with Compose (Task 61): cached page served with cookie sent → identical body, no set-cookie; `/account` bypasses cache.
- [ ] **Step 3:** Commit: `feat: nginx micro-cache, cookie stripping, rate zones, pinned Host`

### Task 61: Compose stacks

**Files:** `deploy/compose.production.yml`, `deploy/compose.staging.yml`
**Interfaces (architecture §14.2):** production: `nginx` (owns the front network, mounts certbot webroot + certs volumes, static assets volume populated from the image), `app`, `postgres` (volume, `logging` size caps), `jobs`, `certbot` (webroot renewal; nginx container runs a daily `nginx -s reload` cron). Staging: own `app`/`postgres`/`jobs`, joins nginx's front network only, **no route to production Postgres** (separate back networks), `.env` without production vendor keys, `SENDS_DISABLED=true`. All services `restart: unless-stopped`, healthchecks, `logging: {driver: json-file, options: {max-size: 10m, max-file: '5'}}`.
- [ ] Bring both stacks up locally (self-signed certs); verify staging cannot reach prod Postgres (`docker compose exec app-staging nc -z prod-postgres 5432` fails). Commit: `feat: production and staging Compose stacks with network isolation`

### Task 62: Deploy workflows

**Files:** `.github/workflows/deploy-staging.yml`, `.github/workflows/deploy-production.yml`; modify `ci.yml` to build+push GHCR images on `main` (`:sha-…`, `:edge`)
**Interfaces (architecture §14.3–14.4):** staging: on push to `main` → tests → build/push → SSH (environment `staging` secrets) → `docker compose pull && docker compose run --rm app npm run migrate && docker compose up -d` + prune old images. Production: on GitHub Release (tags `vYYYY.MM.DD[.n]`) → build fresh from the tag → push (`:latest`, `:vYYYY.MM.DD`) → same SSH sequence against the production stack; `workflow_dispatch` with a tag input = rollback (pull + restart, never a schema step).
- [ ] Write workflows; dry-run the SSH steps against a test VM or `act`; commit: `ci: staging on push-to-main, production on release, dispatch rollback`

### Task 63: Provisioning runbook + Sentry wiring

**Files:** `deploy/runbook.md` (the architecture §14.6 seven steps, kept operational: exact commands, DO firewall rules, certbot first-run, restic init, `seed:admin`, cooldown-clear admin step from §13), `src/lib/logger.ts` (pino; Sentry init server-side, PII scrub of contact/address keys)
- [ ] Implement logger + Sentry (env-gated); write runbook; commit: `feat: ops runbook, structured logging, scrubbed Sentry`

---

# M15 — E2E & load

### Task 64: Playwright smoke suite

**Files:** `tests/e2e/{lookup,vote,flag,language}.spec.ts`, `playwright.config.ts` (runs against the Compose stack with `seed-dev` data; OTP intercepted via a test-only mail sink env flag `OTP_TEST_SINK=true` writing codes to a table the test reads)
**Flows (architecture §12):** address lookup → ward page; register (OTP) → cast vote → results update; flag → curator accept → change live on the public page; EN page → toggle → `/kn/` equivalence (same content structure, `lang="kn"`).
- [ ] Write specs → run against local stack → PASS → commit: `test: Playwright smoke over the four critical paths`

### Task 65: k6 election-day load test

**Files:** `tests/load/k6-election-day.js`
**Asserts (architecture §12):** cached-page RPS at election-day volume on the real VM size with p95 < 500 ms; legitimate-shaped traffic through the CGNAT-sized limits sees **zero 429s**; origin renders bounded by URL-count × TTL.
- [ ] Write script; document the run procedure in `deploy/runbook.md`; execute against staging on the Droplet before election week. Commit: `test: k6 election-day load profile`

---

## Launch-phase mapping (what must be deployed when)

- **Phase 0:** M0–M3, M6 (auth), M8 (curator), M10 (admin), M14 (deploy) + `/privacy`, `/terms` from Task 22. Seed admin; admins vet curators; curators enter ward data.
- **Phase 1 (teaser):** + M4, M5, M7, M11, M12, M13, M15. `/data` stays unlinked (footer link may ship; page ships but is held per PRD §5.14 — gate with an `app_settings['data_page_live']` flag checked by the route: before Phase 2 it returns the 200 notice-banner "coming at notification" state).
- **Phase 2 (at N):** M9 pages already deployed — they show empty states until curators publish candidates; flip `notification_date`; `/data` flag on.

## Self-review notes (run after drafting — resolved inline)

- **Spec coverage:** every PRD §5 feature, §6 moderation, §7 matrix row, §9 sends/gating, §10 auth, §12 NFR, IA page, and architecture § has a named task. `/data` Phase-2 gating added to the launch mapping after the first pass. The register-for-updates slot's three states are split correctly between server markup (Task 19) and `MeSlot` (Task 28).
- **Type consistency:** `publishCandidateField` (Task 5) is the single publish path reused by flags-accept (31), extraction (37), restore (47); `computeReadiness` (39) is consumed by the campaign runner (54) and `/admin/partners` (46); `consumeBudget` (16) by geocode, OTP (25), news (55).
- **Known thin spots (deliberate):** page tasks specify elements + tests rather than full markup — the design system (M3) and IA key-element lists are the markup spec; legal/editorial copy ships behind `LEGAL REVIEW REQUIRED` / `INPUT NEEDED` markers because the content is externally owned (dependency register §2, §5).
