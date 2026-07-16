# GBA Elections Citizen Platform — Prototype Design

**Status:** Approved · **Date:** 2026-07-16 · **Type:** Clickable prototype (static, GitHub Pages)

## Purpose

A client-side-only React prototype of the GBA Elections Citizen Platform, built from
`docs/overview.md`, `docs/prd.md`, and `docs/information-architecture.md`. It demonstrates
all four roles and every page/modal in the IA using mock data, deployed to GitHub Pages.
It is a prototype for stakeholder demos, not the production build — the real product will be
developed separately at the repo root.

## Constraints & decisions

- **Static hosting only.** GitHub Pages has no backend. All server behavior — OTP auth,
  curator publishing, issue votes, flags, notifications, audit log — is **simulated in the
  browser**.
- **Scope:** all four roles (anonymous, registered citizen, curator, admin).
- **Stack:** Vite + React + TypeScript + Tailwind CSS.
- **Language:** English only. The language toggle (EN | ಕನ್ನಡ) is present in the UI but
  stubbed (no Kannada strings yet).
- **Mock data:** a small, hand-crafted but realistic sample.
- **Location:** the entire prototype lives in `prototype/` so it never clashes with the real
  product developed at the repo root. Nothing except the CI workflow and this spec touches the
  rest of the repo.
- **Deploy:** GitHub Actions → GitHub Pages at `https://snarayanank2.github.io/bangalore-votes/`.

## Fidelity model

State is persisted to `localStorage` so contributions feel live within a session. The end-to-end
loop works: a citizen flags a field → it appears in the correctly-scoped curator's queue →
the curator accepts with an edit + source → the public candidate page updates → an immutable
audit entry is written → the submitter's `/account/submissions` shows "accepted". A visible
**"Reset demo data"** control restores the seed state.

## Architecture

```
prototype/
  index.html
  404.html                 copy of index.html — SPA fallback for deep links on GitHub Pages
  package.json
  vite.config.ts           base: '/bangalore-votes/'
  tailwind.config.ts, postcss.config.js
  tsconfig.json
  vitest.config.ts
  README.md
  src/
    data/       seed data as TS modules: wards, candidates, issues, users, submissions, auditLog
    store/       in-memory store seeded from data/ + localStorage; the "fake API" + persistence
    context/     AuthContext, DataContext, I18nContext providers
    components/  AppBar, Footer, CandidateCard, SourceBadge, WardSearch, DevRoleSwitcher,
                 modals/ (RegisterLogin, FlagMisinformation, CastIssueVote)
    pages/       public/, account/, curator/, admin/  (one component per IA page)
    routes.tsx   route table mirroring the IA site map
    main.tsx, App.tsx
```

### Routing

`BrowserRouter` with `basename="/bangalore-votes"` so URLs match the IA exactly
(`/ward/{id}`, `/candidate/{slug}`, etc.). Deep-linkable and shareable — a core principle
of the spec. The `404.html` SPA-fallback (a copy of `index.html`) makes deep links and page
refreshes resolve correctly on GitHub Pages.

### State (React Context)

- **AuthContext** — current mock user and role; login/logout; the gated-action "resume in place"
  mechanism (an intended action is stashed, the Register/Login modal opens, and on success the
  action resumes).
- **DataContext** — the in-memory store: read selectors and write actions (submit flag, cast
  issue vote, curator accept/reject, curator edit, admin role/user changes). Every write appends
  to the audit log and persists to `localStorage`.
- **I18nContext** — active language and toggle. English strings only; toggle wired to context but
  Kannada catalogue is empty (stub).

## Pages (mirrors the IA site map)

**Public (13):** `/`, `/ward/{id}`, `/ward/{id}/candidates`, `/candidate/{slug}`,
`/ward/{id}/compare`, `/ward/{id}/issues`, `/check-registration`, `/about-election`,
`/voting-guide`, `/voting-guide/voter-id`, `/voting-guide/how-to-vote`,
`/voting-guide/find-booth`, `/about`.

**Registered citizen (3):** `/account`, `/account/notifications`, `/account/submissions`.

**Curator (6):** `/curator`, `/curator/queue`, `/curator/queue/{id}`,
`/curator/candidate/{id}`, `/curator/ward/{id}`, `/curator/ward/{id}/issues`.
All curator pages are scoped to the curator's assigned wards.

**Admin (4):** `/admin`, `/admin/roles`, `/admin/users`, `/admin/audit`.

**Modals (3):** Register/Login (fallback page `/login`), Flag misinformation, Cast issue vote.
Modals overlay the current page without changing the URL.

## Simulated auth & demo-role switcher

The Register/Login modal takes an email or WhatsApp number, shows a fake OTP step (any code is
accepted, and the "sent" code is displayed on screen for convenience), then confirms ward +
language and logs the user in. A single OTP mechanism serves all roles, per the spec.

Because curator and admin surfaces are hard to reach through the normal citizen flow, a small
**DevRoleSwitcher** in the app bar — clearly labelled "Prototype" — jumps between a seeded
citizen, curator, and admin account. Curator edit/review rights are enforced against that
curator's assigned wards.

## Contribution behavior (per PRD §6 and IA §7)

- **Flag / vote buttons are visible to everyone.** For an anonymous user, tapping opens the
  Register/Login modal first, then the original action resumes in place.
- **Flagging works across any ward**; the flag routes to the curator whose scope covers that
  ward. Duplicate flags on the same field collapse into one queue item with a count.
- **Issue voting is restricted to the user's registered home ward**, top 3 issues, one changeable
  vote-set per user. Aggregated results are public (anonymous users see ranked results).
- **Curator accept publishes immediately** (no second approval); reject carries a reason back to
  the submitter. Every published change writes an immutable audit-log entry.

## Mock data

Hand-crafted, realistic, small:

- **~4 wards** across different corporations (N/S/E/W/Central), each with name, number, corporation,
  old→new mapping note, and a curator-defined issue list.
- **2–4 candidates per ward** with full report-card fields: name, photo (placeholder), party or
  independent, ward track record, criminal record / pending cases, declared assets, education,
  approachability, and news-article links. Every field tagged with a source type (EC affidavit vs
  curator-compiled) so the provenance distinction renders.
- **Seeded issue-vote tallies** so public ranked results are non-empty.
- **A few submissions** already in the curator queue (pending / accepted / rejected examples).
- **Seeded users:** one citizen (with a home ward), one ward-scoped curator, one admin.
- **An initial audit log** with a couple of entries.

## Deployment

- **GitHub Actions** workflow at `.github/workflows/deploy-prototype.yml`: on push to `main`,
  run `npm ci`, `npm run build` (with `working-directory: prototype`), upload `prototype/dist`,
  and deploy to Pages. One-time manual step: repo Settings → Pages → Source = "GitHub Actions".
- Served at `https://snarayanank2.github.io/bangalore-votes/` (base path `/bangalore-votes/`,
  independent of the `prototype/` source location).

## Testing

- **CI gate:** `tsc --noEmit` typecheck and `vite build` must pass.
- **Vitest smoke tests** for the logic most likely to break:
  - issue-vote top-3 limit and change-vote behavior,
  - home-ward-only voting restriction,
  - flags routing to the correctly-scoped curator,
  - curator accept publishing the edit and appending an audit entry.

## Out of scope for the prototype

- Real authentication, real OTP delivery, real notifications (email / WhatsApp).
- Kannada translations (toggle is a stub).
- Real ward-boundary maps and address→ward geocoding (shown as static placeholders).
- Server persistence, real EC data integration, and anything in the docs' "future phases" list.
