# Prototype GTM/Trust Gap — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** Bring the deployed prototype up to the PRD/overview as revised on 2026-07-16 (commits `9e57a21`, `0801b4f`, `0585211`), which added the trust, legal, partner, and ward-readiness surface.

**Context:** The prototype (`prototype/`, 204 tests, live at https://snarayanank2.github.io/bangalore-votes/) was built against the docs as they stood at ~12:00. It implements none of the later additions. This plan closes that gap only — it does not revisit anything already shipped.

**Spec:** `docs/prd.md` is authoritative (§5.11–§5.16, §7, §9.1, §13, §13.1, §14). `docs/information-architecture.md` is the canonical route map. `docs/overview.md` §7/§11 carry the locked decisions.

## Global Constraints

- All work under `prototype/`. TypeScript strict, no `any`. `Date.now()`/`Math.random()` BANNED (use the store's persisted `nextSeq()`/`stamp()`).
- Every persisting write goes through the store; guards run BEFORE any mutation; selectors deep-clone; exactly one persist+notify per mutation.
- Audit records published-data + moderation/admin actions only. `castIssueVote` writes NO audit entry. Personal preference contents stay out of the audit log.
- English strings only. Mobile-first, semantic HTML, keyboard accessible.
- The shell's "Prototype — sample data is fictional" banner stays intact and unduplicated.
- Routes must match `docs/information-architecture.md` EXACTLY.
- Do not weaken or delete existing tests (204 green). Do not touch `CLAUDE.md`, `docs/`, `.superpowers/`, `.github/`.
- Read `src/data/` before writing test assertions — seed data collides with naive fixtures.

## Controller decisions (binding)

1. **No invented legal text.** PRD §5.16 states `/terms` and `/privacy` content "is outside a product spec's competence" and needs a lawyer; `/privacy` is additionally blocked on an undecided retention period (§17). These pages render the **required section structure** with a clear, prominent notice that the text is pending legal review — never authoritative-looking policy prose a reader could act on. Where the PRD names required contents (DPDP notice, grievance officer, retention, data-principal rights), list them as the sections that will exist.
2. **All invented people/orgs stay unmistakably fictional.** Partner names, spokespeople, and quotes on `/press` and `/partner/{slug}` are demo data and must read as such, consistent with the existing banner and seed conventions. Do NOT invent quotes attributed to real Oorvani staff.
3. **Oorvani Foundation is named as operator** on `/about` and `/privacy` — this is a locked decision (PRD §14, overview §7), and is a real organisation, so state only what the docs state: it operates the platform in production and is the trust behind `opencity.in`. Invent nothing else about it.
4. **Funding disclosure detail is an open question** (§17: names vs categories). Render the section and state plainly that the disclosure is pending that decision. Do not invent funders.
5. **`/data` figures are computed from the store**, never hardcoded — it is the "publish our own numbers" page; fake numbers there would be self-defeating. Each figure carries an "as of" marker; since `Date.now()` is banned, use the store's stamp convention.

---

### Task 1: Legal + press pages, About rewrite, footer

**Files:**
- Create: `src/pages/public/Privacy.tsx`, `Terms.tsx`, `Press.tsx`, `src/pages/public/trustPages.test.tsx`
- Modify: `src/pages/public/About.tsx`, `src/components/Footer.tsx`, `src/routes.tsx`

**Requirements:** PRD §5.11 (about/funding/operator/commitments), §5.15 (press kit), §5.16 (legal pages), §13 (footer carries the trust/legal pages).

- [ ] **Step 1: Write failing tests** covering: `/privacy`, `/terms`, `/press` render and are routed; `/privacy` and `/terms` show the pending-legal-review notice and do NOT read as live policy; `/about` names the Oorvani Foundation, has a funding section marked pending, and states the two data commitments (no selling/sharing; contacts used for ward election updates + critical service notices only); the footer links all six trust/legal pages.
- [ ] **Step 2: Run tests, verify they fail.** `npm run test -- trustPages`
- [ ] **Step 3: Implement.**
  - `/privacy`: sections per §5.16 — operator (Oorvani Foundation), data collected (email, phone, address→ward, language, `src` attribution), consent/withdrawal, DPDP Act 2023 notice + data-principal rights + grievance officer, retention (**mark as blocked on the undecided retention period, §17**), and that issue votes are published in aggregate. Prominent "pending legal review — not the final policy" notice.
  - `/terms`: sections per §5.16 — acceptable use, contribution licensing (flags, issue votes), accuracy/liability disclaimers, account termination grounds. Same pending-review notice.
  - `/press`: boilerplate at 50/100/200 words, key stats (link to `/data`), logos/screenshots (placeholders), spokesperson bios/quotes (**clearly fictional demo**), contact with stated response time, neutrality statement, link to sourcing methodology.
  - `/about`: add operator (Oorvani Foundation, the trust behind opencity.in), funding disclosure section (pending §17 decision), and the data commitments in citizen-readable terms.
  - Footer: link `/about`, `/data`, `/partner-with-us`, `/press`, `/terms`, `/privacy` — per §13 these live in the footer, not the app bar.
- [ ] **Step 4: Run tests, verify pass.** Full suite + `npm run typecheck` + `npm run build`.
- [ ] **Step 5: Commit** — `feat: add legal and press pages, name the operator, link trust pages from the footer`

---

### Task 2: `/data` public metrics

**Files:**
- Create: `src/pages/public/Data.tsx`, `src/pages/public/data.test.tsx`
- Modify: `src/store/store.ts`, `src/store/store.test.ts`, `src/routes.tsx`

**Requirements:** PRD §5.14.

**Interfaces:** Produces a store selector `platformMetrics()` returning coverage (wards with published candidate data, against 369; report cards complete; active curators; sources cited), integrity (flags raised; flags resolved; median time to resolve), and citizen signal (city-wide issue roll-up; total issue votes; registered citizens). Deep-cloned, aggregate-only.

- [ ] **Step 1: Write failing tests** — `platformMetrics()` computes from seed (assert against real seed counts, not invented ones); the city-wide roll-up aggregates across wards; **no per-user vote data is exposed** in the returned shape; `/data` renders the figures with an "as of" marker.
- [ ] **Step 2: Run tests, verify they fail.**
- [ ] **Step 3: Implement.** Figures computed from the store — never hardcoded. Note §5.14 says `/data` is Phase 2; the prototype shows it regardless (phasing is a rollout decision, not a code branch) — but do not fake Phase-2-scale numbers. Median time-to-resolve uses the store's stamp convention; if stamps are not comparable to real durations, render it honestly as unavailable rather than computing a fake duration (`Date.now()` is banned).
- [ ] **Step 4: Run tests, verify pass.** Full suite + typecheck + build.
- [ ] **Step 5: Commit** — `feat: add /data public metrics computed from the store`

---

### Task 3: Partner model, kit page, `?src=` attribution

**Files:**
- Create: `src/pages/public/PartnerKit.tsx`, `src/data/partners.ts`, tests
- Modify: `src/types.ts`, `src/data/index.ts`, `src/store/store.ts`, `src/context/AuthContext.tsx`, `src/components/modals/RegisterLogin.tsx`, `src/routes.tsx`

**Requirements:** PRD §5.12.

**Interfaces:** `Partner = { slug, name, kind, wardIds }`. Store: `getPartner(slug)`, `listPartners()`, `partnerWardCoverage()`. `createUser` accepts an optional `src` persisted onto the user record.

- [ ] **Step 1: Write failing tests** — `?src=slug` survives the visit and lands on the user record at registration; attribution grants NO permissions and changes nothing the citizen sees; `/partner/{slug}` renders anonymously (unlisted ≠ access-controlled); unknown slug degrades gracefully.
- [ ] **Step 2: Run tests, verify they fail.**
- [ ] **Step 3: Implement.** `/partner/{slug}`: tagged link, ready-to-paste WhatsApp forward text (EN + KN — the KN forward text is an asset, distinct from the stubbed UI catalogue; if no Kannada copy is available, render the EN text and say the KN asset is pending rather than machine-inventing it), poster placeholder, neutrality statement. Partners are NOT a role (§5.12) — do not add one. Seed 2-3 clearly-fictional partners.
- [ ] **Step 4: Run tests, verify pass.** Full suite + typecheck + build.
- [ ] **Step 5: Commit** — `feat: add partner kit pages and ?src= registration attribution`

---

### Task 4: `/partner-with-us` recruitment funnel

**Files:**
- Create: `src/pages/public/PartnerWithUs.tsx`, tests
- Modify: `src/types.ts`, `src/store/store.ts`, `src/routes.tsx`

**Requirements:** PRD §5.13.

**Interfaces:** `Interest = { id, path: 'awareness'|'curation', name, contact, wardId?, note, status: 'pending'|'accepted'|'rejected', createdAt }`. Store: `submitInterest(input)` (ANONYMOUS — no user), `listInterests()`, `reviewInterest(id, decision, admin)`.

- [ ] **Step 1: Write failing tests** — the form submits with NO account (anonymous write path); both paths captured; submission lands in the admin queue as `pending`; **nobody self-activates** (accepting is an admin action, §5.13); rate-limit guard present (§6.3).
- [ ] **Step 2: Run tests, verify they fail.**
- [ ] **Step 3: Implement.** Two paths (spread awareness / curate data), each stating time commitment + vetting/neutrality expectation. One EOI form covering both. `submitInterest` is anonymous — do NOT require auth or reuse `requireAuth`. Audit the admin's review decision (a moderation action); do NOT audit the anonymous submission's personal contents beyond what the moderation trail needs.
- [ ] **Step 4: Run tests, verify pass.** Full suite + typecheck + build.
- [ ] **Step 5: Commit** — `feat: add /partner-with-us anonymous expression-of-interest funnel`

---

### Task 5: Ward data-readiness gating

**Files:**
- Modify: `src/types.ts`, `src/store/store.ts`, `src/pages/curator/WardIssuesEditor.tsx` or `EditWard.tsx`, `src/pages/curator/Dashboard.tsx`, tests

**Requirements:** PRD §9.1, §7 (new matrix rows: "Mark a ward ready for candidate comms" = curator/Scope; "Override ward comms hold" = admin).

**Interfaces:** Store: `wardCompleteness(wardId)` (mechanical check), `signOffWard(wardId, curator)`, `wardReadiness(wardId)` → `{ complete, signedOff, ready }`, `overrideHold(wardId, admin)`.

- [ ] **Step 1: Write failing tests** — completeness requires every candidate to have a report-card record with name + party, cases/assets/education either populated **or explicitly marked "not declared"** (a valid complete answer, §9.1), and every field sourced; a ward is ready only when complete AND signed off; **sign-off is CLEARED automatically when the candidate set materially changes** (a nomination added or withdrawn) — test this specifically, it is the subtle requirement; sign-off and override are both audited; curator sign-off is ward-scoped; override is admin-only.
- [ ] **Step 2: Run tests, verify they fail.**
- [ ] **Step 3: Implement.** Guards before mutation. Note the store has no "not declared" concept today — check `Sourced<string>` handling and represent "not declared" explicitly rather than treating an empty string as complete.
- [ ] **Step 4: Run tests, verify pass.** Full suite + typecheck + build.
- [ ] **Step 5: Commit** — `feat: add ward data-readiness gating with curator sign-off and admin override`

---

### Task 6: `/admin/partners`

**Files:**
- Create: `src/pages/admin/Partners.tsx`, tests
- Modify: `src/routes.tsx`

**Requirements:** PRD §5.12 (coverage view), §5.13 (review EOIs), §9.1 (held wards visible; admin override), §7.

- [ ] **Step 1: Write failing tests** — admin-only (RoleGuard); shows partner→ward coverage against 369 with the **uncovered set** surfaced as a work queue; lists EOIs for review with accept/reject; shows **held wards** (not ready) with an override action; accepting an awareness EOI provisions a partner slug, a curation EOI hands to the curator vetting path.
- [ ] **Step 2: Run tests, verify they fail.**
- [ ] **Step 3: Implement.** `useStoreVersion()` — this page renders mutable store data.
- [ ] **Step 4: Run tests, verify pass.** Full suite + typecheck + build.
- [ ] **Step 5: Commit** — `feat: add /admin/partners coverage, EOI review, and held-ward overrides`

---

## Explicitly OUT of scope

- §9.2 election-silence, §9.3 send cadence, the five-phase launch calendar, legal review, press assets, WhatsApp template lead times — ops/comms/legal with no UI in a static prototype whose notifications are already simulated.
- §13.1 phasing as code branches — the prototype shows all pages; phasing is a rollout decision. (The pre-notification empty state it requires already works — the `jayanagar` seed ward exercises it.)
- Open questions that would change built code and are **undecided** (§17): the optional "future civic tools" consent checkbox at registration, and the retention period. Do not guess these.

## Verification

- `cd prototype && npm run typecheck && npm run test && npm run build`, both `dist/index.html` and `dist/404.html` present.
- Every new route matches `docs/information-architecture.md`.
- Manual: footer reaches all six trust/legal pages from any page; `/privacy` and `/terms` cannot be mistaken for live policy.
