# PRD Catch-up (First-Time Voter + AI Affidavit Ingestion) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring the React prototype up to date with the PRD changes committed after last night's reconcile (5b747cb): first-time-voter support (§5.6–§5.9, §5.12, §5.17), the shared roll-deadline element, Google Analytics disclosure (§5.16), and AI-assisted affidavit ingestion with AI-extracted markers (§5.2, §11, §14). Per-language `/kn/` URLs (§8) are **explicitly skipped** per the controller's instruction.

**Architecture:** All work stays inside `prototype/` (Vite + React 18 + react-router 6 + Tailwind, localStorage-backed store). Copy-level tasks (1–7) touch public pages and add one shared `RollDeadlineNotice` component. The affidavit feature (tasks 8–10) adds an `aiExtracted` flag to `Sourced<T>`, an `affidavit` record on `Candidate`, one store mutation `ingestAffidavit` (simulated extraction — no real PDF or API call), a curator UI in `EditCandidate`, and an `AiExtractedBadge` rendered wherever sourced fields appear.

**Tech Stack:** TypeScript, React 18, react-router-dom 6, Tailwind, Vitest + @testing-library/react + user-event.

## Global Constraints

- `Date.now()`, `Math.random()`, `new Date()` are **banned project-wide** — ids/timestamps come from the store's persisted `nextSeq()` counter (`t${n}` stamps); fixed dates are hard-coded string constants.
- All external/official links are inert `href="#"` placeholders labelled "(placeholder link in this prototype)" — never imply a real EC integration.
- Honesty convention: anything simulated (AI extraction, demo data) says so in visible copy; the AppBar already carries the fictional-data banner.
- One URL → one screen (PRD §14). **No new routes** in this plan; `routes.tsx` is untouched.
- The store (`store.ts`) is the data-integrity boundary: every mutation guards (`requireScope` etc.) **before** any write, audits published changes via `appendAudit`, and calls `persist()` exactly once at the end.
- Existing tests that must not break:
  - `trustPages.test.tsx` asserts `/privacy` contains **no** text matching `/\b\d+\s*(day|month|year)s?\b/i` — new privacy copy must avoid "26 months"-style phrases.
  - `staticPages.test.tsx` asserts `/check-registration` has **no textbox** inside `<main>`.
  - `staticPages.test.tsx` "voting guide hub links to all three sub-guides" expects link accessible names matching `/voter.id/i`, `/how to vote/i`, `/find.*(booth|polling)/i` with their current hrefs — keep those phrases inside the checklist step link texts.
  - `CandidateReportCard.test.tsx` expects exactly 3 × `'Official (affidavit)'` badge labels on `koramangala-r-menon` **before** any ingestion.
- Seed fixtures used by tests: candidate `c-kor-1` / slug `koramangala-r-menon` (ward `koramangala`); out-of-scope candidate `c-mal-1` / slug `malleshwaram-k-iyer`; users `u-curator` (scope: koramangala + indiranagar), `u-admin`, `u-citizen` (home ward koramangala); partner slug `demo-rwa-one`. Tests log in by `localStorage.setItem('bv-auth', '<userId>')` **before** mounting.
- Commands (always from `prototype/`): single file `npx vitest run src/path/to/file.test.tsx`; full suite `npm test`; types `npm run typecheck`.
- Commit after every task; message style follows repo history (`feat:`/`fix:`/`docs:` + one-line why). End commit messages with `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.

---

### Task 1: `RollDeadlineNotice` shared component, mounted on Home, Check-registration, Voter-ID

PRD §5.6/§5.7/§5.8: the roll deadline is "the one date in the funnel that cannot be recovered"; the same element appears on `/`, `/check-registration`, `/voting-guide/voter-id` (and later the checklist hub, Task 5), "shown until the roll closes".

**Files:**
- Create: `prototype/src/components/RollDeadlineNotice.tsx`
- Create: `prototype/src/components/RollDeadlineNotice.test.tsx`
- Modify: `prototype/src/pages/public/Home.tsx`
- Modify: `prototype/src/pages/public/CheckRegistration.tsx`
- Modify: `prototype/src/pages/public/VoterId.tsx`

**Interfaces:**
- Produces: `RollDeadlineNotice({ closed?: boolean })` React component; exported consts `ROLL_DEADLINE_LABEL: string`, `ROLL_CLOSED: boolean`. Task 5 imports `RollDeadlineNotice` again.

- [ ] **Step 1: Write the failing test**

Create `prototype/src/components/RollDeadlineNotice.test.tsx`:

```tsx
import { render, screen, within } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { routeObjects } from '../routes'
import { AppProviders } from '../App'
import { RollDeadlineNotice, ROLL_DEADLINE_LABEL } from './RollDeadlineNotice'

function renderAt(path: string) {
  const router = createMemoryRouter(routeObjects, { initialEntries: [path] })
  render(
    <AppProviders>
      <RouterProvider router={router} />
    </AppProviders>,
  )
  return within(screen.getByRole('main'))
}

test('shows the roll deadline with an honest placeholder-date caveat', () => {
  render(<RollDeadlineNotice />)
  expect(screen.getByText(new RegExp(ROLL_DEADLINE_LABEL))).toBeInTheDocument()
  expect(screen.getAllByText(/cannot vote in this election/i).length).toBeGreaterThan(0)
  expect(screen.getAllByText(/placeholder/i).length).toBeGreaterThan(0)
})

test('renders nothing once the roll has closed (PRD: "shown until the roll closes")', () => {
  const { container } = render(<RollDeadlineNotice closed />)
  expect(container).toBeEmptyDOMElement()
})

test.each(['/', '/check-registration', '/voting-guide/voter-id'])(
  '%s carries the roll-deadline element (PRD §5.6/§5.7/§5.8)',
  (path) => {
    const main = renderAt(path)
    expect(main.getAllByText(new RegExp(ROLL_DEADLINE_LABEL)).length).toBeGreaterThan(0)
  },
)
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/components/RollDeadlineNotice.test.tsx`
Expected: FAIL — cannot resolve `./RollDeadlineNotice`.

- [ ] **Step 3: Implement the component**

Create `prototype/src/components/RollDeadlineNotice.tsx`:

```tsx
/**
 * The shared electoral-roll-deadline element (PRD §5.6/§5.7/§5.8, and the checklist's expiring
 * steps in §5.17) — the R1 alert reaches only registered users, so these pages are where
 * everyone else learns the one date in the funnel that cannot be recovered. Identical wherever
 * it appears, so it lives here once.
 *
 * A live countdown is impossible (Date.now() is banned project-wide) — the date is a hard-coded
 * placeholder updated by hand, mirroring Home's ELECTION_NOTICE_TARGET. "Shown until the roll
 * closes" is modelled by the ROLL_CLOSED flag (also flipped by hand); the `closed` prop exists so
 * tests can exercise the closed branch without editing the constant.
 */
export const ROLL_DEADLINE_LABEL = 'August 2026 (expected)'
export const ROLL_CLOSED = false

export function RollDeadlineNotice({ closed = ROLL_CLOSED }: { closed?: boolean }) {
  if (closed) return null
  return (
    <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-left text-sm text-amber-900">
      <p>
        <strong>Electoral roll deadline: {ROLL_DEADLINE_LABEL}.</strong> Enrol or transfer before
        the roll closes — this is the one date in the process that cannot be recovered. If you are
        not on the roll when it closes, you cannot vote in this election.
      </p>
      <p className="mt-1 text-xs">
        Placeholder date in this prototype — always confirm the real deadline on the official EC
        site.
      </p>
    </div>
  )
}
```

- [ ] **Step 4: Mount it on the three pages**

In `Home.tsx`, add the import and render it as the last child of the hero banner `<section>` (after the "Official notification expected" `<p>`):

```tsx
import { RollDeadlineNotice } from '../../components/RollDeadlineNotice'
```
```tsx
        <p className="text-sm text-ink/80">
          Official notification expected: <strong>{ELECTION_NOTICE_TARGET}</strong>. Candidate
          data will be added ward by ward as it becomes available after the notification.
        </p>
        <RollDeadlineNotice />
```

In `CheckRegistration.tsx`, add the same import and render `<RollDeadlineNotice />` directly after the intro `<div>` (before the "How to check" card).

In `VoterId.tsx`, add the same import and render `<RollDeadlineNotice />` directly after the intro `<div>` (before the "new enrolment" section).

- [ ] **Step 5: Run the tests**

Run: `npx vitest run src/components/RollDeadlineNotice.test.tsx src/pages/public/Home.test.tsx src/pages/public/staticPages.test.tsx`
Expected: PASS (Home/staticPages suites unaffected; the notice adds no textbox and no link).

- [ ] **Step 6: Commit**

```bash
git add prototype/src/components/RollDeadlineNotice.tsx prototype/src/components/RollDeadlineNotice.test.tsx prototype/src/pages/public/Home.tsx prototype/src/pages/public/CheckRegistration.tsx prototype/src/pages/public/VoterId.tsx
git commit -m "feat: shared roll-deadline notice on home, check-registration, voter-id (PRD 5.6-5.8)"
```

---

### Task 2: Eligibility basics on `/check-registration`

PRD §5.6: "State the eligibility basics **before** the link-out: 18 or older on the qualifying date (qualifying dates now fall quarterly — many first-time voters assume they must wait a full year), enrolment in one place only, and the documents enrolment requires."

**Files:**
- Modify: `prototype/src/pages/public/CheckRegistration.tsx`
- Modify: `prototype/src/pages/public/staticPages.test.tsx` (append tests)

**Interfaces:** none (copy only; adds no inputs — the "no textbox" invariant must hold).

- [ ] **Step 1: Write the failing tests**

Append to `staticPages.test.tsx`:

```tsx
// --- PRD §5.6: eligibility basics stated BEFORE the official link-out --------------------------

test('check-registration states the eligibility basics: 18+, quarterly qualifying dates, one-place enrolment, documents', () => {
  const main = renderAt('/check-registration')
  expect(main.getByRole('heading', { name: /am i eligible/i })).toBeInTheDocument()
  expect(main.getAllByText(/18/).length).toBeGreaterThan(0)
  expect(main.getAllByText(/quarter/i).length).toBeGreaterThan(0)
  expect(main.getAllByText(/wait a full year/i).length).toBeGreaterThan(0)
  expect(main.getAllByText(/one place|only one/i).length).toBeGreaterThan(0)
  expect(main.getAllByText(/proof of age|address proof|proof of address/i).length).toBeGreaterThan(0)
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/pages/public/staticPages.test.tsx`
Expected: FAIL — no "Am I eligible" heading.

- [ ] **Step 3: Implement**

In `CheckRegistration.tsx`, insert this section between `<RollDeadlineNotice />` (Task 1) and the "How to check" card:

```tsx
      <div className="rounded-lg border border-slate-200 p-4">
        <h2 className="text-sm font-semibold text-ink">Am I eligible in the first place?</h2>
        <p className="mt-1 text-sm text-ink/70">
          The check below is useless if you don&apos;t yet know whether you qualify, so start
          here:
        </p>
        <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm text-ink/70">
          <li>
            You must be <strong>18 or older on the qualifying date</strong>. Qualifying dates now
            fall <strong>quarterly</strong> (four dates a year) — if you turn 18 soon, you do not
            have to wait a full year to enrol, which many first-time voters assume.
          </li>
          <li>
            You can be enrolled in <strong>one place only</strong> — a registration elsewhere
            (another city, or your home town) must be transferred, not duplicated.
          </li>
          <li>
            Enrolment needs a recent passport-size photo, <strong>proof of age</strong> and{' '}
            <strong>proof of address</strong> (e.g. Aadhaar, passport, utility bill) — see the{' '}
            <Link to="/voting-guide/voter-id" className="text-brand underline underline-offset-2">
              Voter ID guide
            </Link>{' '}
            for the step-by-step forms.
          </li>
        </ul>
      </div>
```

(`Link` is already imported in this file.)

- [ ] **Step 4: Run the tests**

Run: `npx vitest run src/pages/public/staticPages.test.tsx`
Expected: PASS — including the pre-existing "no textbox" and "guided link-out" tests.

- [ ] **Step 5: Commit**

```bash
git add prototype/src/pages/public/CheckRegistration.tsx prototype/src/pages/public/staticPages.test.tsx
git commit -m "feat: eligibility basics before the roll link-out on /check-registration (PRD 5.6)"
```

---

### Task 3: "I'm registered in another city" path on `/voting-guide/voter-id`

PRD §5.8: a **named** path answering the migrant/renter question plainly: a vote registered elsewhere does **not** count here — transfer (Form 8) before the roll closes, with proof-of-address guidance for renters and PG residents.

**Files:**
- Modify: `prototype/src/pages/public/VoterId.tsx`
- Modify: `prototype/src/pages/public/staticPages.test.tsx` (append tests)

- [ ] **Step 1: Write the failing tests**

Append to `staticPages.test.tsx`:

```tsx
// --- PRD §5.8: the named "registered in another city" path -------------------------------------

test('voter-id has a named "registered in another city" path that answers the count-here question plainly', () => {
  const main = renderAt('/voting-guide/voter-id')
  expect(
    main.getByRole('heading', { name: /registered in another city/i }),
  ).toBeInTheDocument()
  expect(main.getAllByText(/does not count here|will not count here/i).length).toBeGreaterThan(0)
  expect(main.getAllByText(/form 8/i).length).toBeGreaterThan(0)
  expect(main.getAllByText(/PG/).length).toBeGreaterThan(0)
  expect(main.getAllByText(/rent/i).length).toBeGreaterThan(0)
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/pages/public/staticPages.test.tsx`
Expected: FAIL — no such heading.

- [ ] **Step 3: Implement**

In `VoterId.tsx`, insert this section **between** the "new enrolment" section and the existing "I've moved" (Form 8) section:

```tsx
      <section
        aria-labelledby="elsewhere-heading"
        className="space-y-3 border-t border-slate-200 pt-6"
      >
        <h2 id="elsewhere-heading" className="text-lg font-semibold text-ink">
          I&apos;m registered in another city — does my vote count here?
        </h2>
        <p className="text-sm text-ink/90">
          <strong>No — a vote registered elsewhere does not count here.</strong> Many of
          Bengaluru&apos;s first-time local voters moved here from another city or state, and this
          is their first question. To vote in your GBA ward, transfer your registration to your
          Bengaluru address using <strong>Form 8</strong> (steps below) <strong>before the
          electoral roll closes</strong> — after that, you cannot vote in this election from
          either address.
        </p>
        <p className="text-sm text-ink/70">
          <strong>Renting, or living in a PG?</strong> You do not need to own property to enrol
          where you live. Commonly accepted proof of your current address includes a registered
          rent agreement, an Aadhaar card updated to this address, or a utility bill in your name;
          PG residents can ask the owner for a simple residence declaration. The official EC list
          of accepted documents is the final word — check it via the Form 8 link below.
        </p>
      </section>
```

- [ ] **Step 4: Run the tests**

Run: `npx vitest run src/pages/public/staticPages.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add prototype/src/pages/public/VoterId.tsx prototype/src/pages/public/staticPages.test.tsx
git commit -m "feat: named registered-in-another-city transfer path on the voter-id guide (PRD 5.8)"
```

---

### Task 4: How-to-vote first-timer FAQ, ward-election differences, and the EVM hedge

PRD §5.9 adds a first-timer FAQ (accepted documents when the EPIC card hasn't arrived, voter slip, NOTA, what the machine/ballot looks like, no phones inside) and a "what's different about a ward election" section. PRD §17 now records **EVM vs paper ballot as an open question** — the current page asserts EVM + VVPAT unconditionally, which must become a hedge.

**Files:**
- Modify: `prototype/src/pages/public/HowToVote.tsx`
- Modify: `prototype/src/pages/public/staticPages.test.tsx` (append tests)

- [ ] **Step 1: Write the failing tests**

Append to `staticPages.test.tsx`:

```tsx
// --- PRD §5.9: first-timer FAQ + ward-election differences; §17: EVM vs paper is OPEN ----------

test('how-to-vote hedges the EVM-vs-paper question instead of asserting EVMs (PRD §17 open question)', () => {
  const main = renderAt('/voting-guide/how-to-vote')
  expect(main.getAllByText(/not (yet )?been announced|not yet announced/i).length).toBeGreaterThan(0)
  expect(main.getAllByText(/paper ballot/i).length).toBeGreaterThan(0)
})

test('how-to-vote has a first-timer FAQ: EPIC alternatives, voter slip, NOTA, phones', () => {
  const main = renderAt('/voting-guide/how-to-vote')
  expect(main.getByRole('heading', { name: /first.time.*faq/i })).toBeInTheDocument()
  expect(main.getAllByText(/voter slip/i).length).toBeGreaterThan(0)
  expect(main.getAllByText(/NOTA/).length).toBeGreaterThan(0)
  expect(main.getAllByText(/phone/i).length).toBeGreaterThan(0)
  expect(main.getAllByText(/hasn.t arrived|hasn.t come|not arrived/i).length).toBeGreaterThan(0)
})

test('how-to-vote explains what is different about a ward election', () => {
  const main = renderAt('/voting-guide/how-to-vote')
  expect(main.getByRole('heading', { name: /different about a ward election/i })).toBeInTheDocument()
  expect(main.getAllByText(/one corporator per ward/i).length).toBeGreaterThan(0)
  expect(main.getAllByText(/five.corporation|five corporations/i).length).toBeGreaterThan(0)
  expect(main.getAllByText(/assembly constituency/i).length).toBeGreaterThan(0)
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/pages/public/staticPages.test.tsx`
Expected: FAIL on all three new tests.

- [ ] **Step 3: Implement**

In `HowToVote.tsx`:

**(a)** Replace steps 5 and 6 (`Cast your vote.` and `Check the VVPAT slip.`) with a single hedged step:

```tsx
          <li>
            <strong>Cast your vote.</strong> Whether GBA ward polls will use EVMs (electronic
            voting machines) or paper ballots has <strong>not yet been announced</strong> by the
            State Election Commission. If EVMs are used: press the button next to your preferred
            candidate&apos;s name, party symbol, and photo — a beep confirms your vote, and a
            VVPAT paper slip briefly displays behind a screen so you can check it matches your
            choice. If paper ballots are used: stamp your choice and fold the ballot as the
            polling official directs. This page will be updated as soon as the format is
            confirmed.
          </li>
```

**(b)** After the existing "A few things that trip people up" section, add:

```tsx
      <section aria-labelledby="faq-heading" className="space-y-3 border-t border-slate-200 pt-6">
        <h2 id="faq-heading" className="text-lg font-semibold text-ink">
          First-time voter FAQ
        </h2>
        <dl className="space-y-3 text-sm">
          <div>
            <dt className="font-semibold text-ink">My Voter ID (EPIC card) hasn&apos;t arrived — can I still vote?</dt>
            <dd className="mt-0.5 text-ink/80">
              Yes, if your name is on the electoral roll. The EC publishes a list of alternative
              photo documents accepted at the booth — Aadhaar, passport, driving licence, and
              others.{' '}
              <a href="#" className="text-brand underline underline-offset-2">
                Official EC alternative-document list (placeholder link in this prototype)
              </a>
            </dd>
          </div>
          <div>
            <dt className="font-semibold text-ink">What is a voter slip?</dt>
            <dd className="mt-0.5 text-ink/80">
              A slip distributed before polling day showing your name, roll entry, and booth. It
              helps officials find your entry quickly, but it is not an identity document on its
              own — carry a photo ID too.
            </dd>
          </div>
          <div>
            <dt className="font-semibold text-ink">What if I don&apos;t want to vote for anyone?</dt>
            <dd className="mt-0.5 text-ink/80">
              Every ballot includes <strong>NOTA</strong> (&quot;None of the Above&quot;) as the
              last option — choosing it records that you voted without supporting any candidate.
            </dd>
          </div>
          <div>
            <dt className="font-semibold text-ink">What can&apos;t I take inside?</dt>
            <dd className="mt-0.5 text-ink/80">
              <strong>Phones</strong> and cameras are not allowed inside the polling booth. Leave
              your phone at home or with a companion outside.
            </dd>
          </div>
        </dl>
      </section>

      <section
        aria-labelledby="ward-difference-heading"
        className="space-y-2 border-t border-slate-200 pt-6"
      >
        <h2 id="ward-difference-heading" className="text-lg font-semibold text-ink">
          What&apos;s different about a ward election
        </h2>
        <ul className="list-disc space-y-1.5 pl-5 text-sm text-ink/80">
          <li>
            You elect <strong>one corporator per ward</strong> — the most local elected
            representative you have, responsible for streets, drains, waste, and lighting in your
            neighbourhood.
          </li>
          <li>
            This is the first election under the new <strong>five-corporation GBA structure</strong>{' '}
            (Greater Bengaluru Authority) that replaced the single BBMP.
          </li>
          <li>
            Your ward may <strong>not match your assembly constituency</strong> — the boundaries
            are different, so check your ward with the ward finder even if you know your MLA seat.
          </li>
          <li>
            The last ward election was roughly a decade ago — for this format,{' '}
            <strong>every voter is a first-timer</strong>, whatever your experience of assembly or
            general elections.
          </li>
        </ul>
      </section>
```

- [ ] **Step 4: Run the tests**

Run: `npx vitest run src/pages/public/staticPages.test.tsx`
Expected: PASS (the pre-existing "numbered step list" test still passes — the list still has ≥ 3 items).

- [ ] **Step 5: Commit**

```bash
git add prototype/src/pages/public/HowToVote.tsx prototype/src/pages/public/staticPages.test.tsx
git commit -m "feat: first-timer FAQ, ward-election differences, EVM-vs-paper hedge on how-to-vote (PRD 5.9, 17)"
```

---

### Task 5: `/voting-guide` becomes the ordered first-time-voter checklist

PRD §5.17: the hub is an **ordered checklist**, not an index: check the roll → enrol/transfer before the deadline → find your ward → read the candidates → find your booth → vote. Each step deep-links to the page that does the work; expiring steps carry the roll deadline; the hub URL is the forwardable first-time-voter link (Task 6 uses it).

**Files:**
- Modify (full rewrite): `prototype/src/pages/public/VotingGuideHub.tsx`
- Modify: `prototype/src/pages/public/staticPages.test.tsx` (replace the "three sub-guides" test; append checklist tests)

**Interfaces:**
- Consumes: `RollDeadlineNotice` from Task 1; `useAuth` from `../../context/AuthContext` (same import path style as `RegisterForUpdatesSlot.tsx`).

- [ ] **Step 1: Update/write the tests**

In `staticPages.test.tsx`, **replace** the test `'voting guide hub links to all three sub-guides'` with:

```tsx
// --- PRD §5.17: the hub is an ORDERED first-time-voter checklist, not an index ------------------

test('voting guide hub is an ordered six-step checklist deep-linking each step', () => {
  const main = renderAt('/voting-guide')

  const list = main.getByRole('list', { name: /checklist/i })
  expect(within(list).getAllByRole('listitem')).toHaveLength(6)

  expect(main.getByRole('link', { name: /check you.re on the roll/i })).toHaveAttribute(
    'href',
    '/check-registration',
  )
  expect(main.getByRole('link', { name: /voter.id/i })).toHaveAttribute(
    'href',
    '/voting-guide/voter-id',
  )
  expect(main.getByRole('link', { name: /find your ward/i })).toHaveAttribute('href', '/')
  expect(main.getByRole('link', { name: /read the candidates/i })).toHaveAttribute('href', '/')
  expect(main.getByRole('link', { name: /find.*(booth|polling)/i })).toHaveAttribute(
    'href',
    '/voting-guide/find-booth',
  )
  expect(main.getByRole('link', { name: /how to vote/i })).toHaveAttribute(
    'href',
    '/voting-guide/how-to-vote',
  )
})

test('the expiring enrol/transfer step carries the roll deadline (PRD §5.17)', () => {
  const main = renderAt('/voting-guide')
  expect(main.getAllByText(/electoral roll deadline/i).length).toBeGreaterThan(0)
})

test('a registered user with a home ward gets a direct deep-link to their ward candidates', () => {
  localStorage.setItem('bv-auth', 'u-citizen') // u-citizen's home ward is koramangala
  const main = renderAt('/voting-guide')
  expect(main.getByRole('link', { name: /read the candidates/i })).toHaveAttribute(
    'href',
    '/ward/koramangala/candidates',
  )
})
```

- [ ] **Step 2: Run to verify the new tests fail**

Run: `npx vitest run src/pages/public/staticPages.test.tsx`
Expected: FAIL — no list named "checklist".

- [ ] **Step 3: Rewrite the hub**

Replace the full contents of `VotingGuideHub.tsx` with:

```tsx
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { RollDeadlineNotice } from '../../components/RollDeadlineNotice'

/**
 * First-time voter checklist (PRD §5.17, IA §3.9, `/voting-guide`). Anonymous. An ORDERED
 * checklist, not an index: the logistics pages each answer one question; a first-time voter
 * needs them in order. Each step deep-links to the page that does the work — no content is
 * duplicated here. This URL is also the forwardable "first-time voter link" carried in partner
 * kits (PRD §5.12).
 *
 * Step 4 (read the candidates) needs a ward for its URL: a registered visitor with a home ward
 * deep-links straight to that ward's candidate list; everyone else is sent to the ward finder
 * first (the same page step 3 already points at — knowing your ward IS the prerequisite).
 */
export default function VotingGuideHub() {
  const { isAuthed, user } = useAuth()
  const candidatesHref =
    isAuthed && user.homeWardId ? `/ward/${user.homeWardId}/candidates` : '/'

  const stepLink = 'font-semibold text-brand underline underline-offset-2 hover:no-underline'

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-8">
      <div>
        <h1 className="text-2xl font-bold text-ink sm:text-3xl">
          Voting guide — your first-time voter checklist
        </h1>
        <p className="mt-2 text-sm text-ink/80">
          Voting in your first Bengaluru ward election? Do these six things, in this order. Each
          step links to the page that does the work — nearly everyone is a first-timer for this
          format, so nothing here assumes you&apos;ve done it before.
        </p>
      </div>

      <ol aria-label="First-time voter checklist" className="space-y-4">
        <li className="rounded-lg border border-slate-200 p-4">
          <h2 className="font-semibold text-ink">
            1.{' '}
            <Link to="/check-registration" className={stepLink}>
              Check you&apos;re on the roll
            </Link>
          </h2>
          <p className="mt-1 text-sm text-ink/70">
            Confirm you&apos;re on the GBA electoral roll — months in advance, so there&apos;s
            time to fix a problem.
          </p>
        </li>
        <li className="space-y-2 rounded-lg border border-slate-200 p-4">
          <h2 className="font-semibold text-ink">
            2.{' '}
            <Link to="/voting-guide/voter-id" className={stepLink}>
              Enrol or transfer your Voter ID before the deadline
            </Link>
          </h2>
          <p className="mt-1 text-sm text-ink/70">
            New enrolment (Form 6), or transfer a registration from another city or address
            (Form 8). This step expires:
          </p>
          <RollDeadlineNotice />
        </li>
        <li className="rounded-lg border border-slate-200 p-4">
          <h2 className="font-semibold text-ink">
            3.{' '}
            <Link to="/" className={stepLink}>
              Find your ward
            </Link>
          </h2>
          <p className="mt-1 text-sm text-ink/70">
            Ward boundaries changed in the delimitation — find your new ward by name or area.
          </p>
        </li>
        <li className="rounded-lg border border-slate-200 p-4">
          <h2 className="font-semibold text-ink">
            4.{' '}
            <Link to={candidatesHref} className={stepLink}>
              Read the candidates
            </Link>
          </h2>
          <p className="mt-1 text-sm text-ink/70">
            Neutral, sourced report cards for every candidate in your ward — open your ward page
            to see them.
          </p>
        </li>
        <li className="rounded-lg border border-slate-200 p-4">
          <h2 className="font-semibold text-ink">
            5.{' '}
            <Link to="/voting-guide/find-booth" className={stepLink}>
              Find your polling booth
            </Link>
          </h2>
          <p className="mt-1 text-sm text-ink/70">
            Booths change between elections — look up the exact location you&apos;re assigned to.
          </p>
        </li>
        <li className="rounded-lg border border-slate-200 p-4">
          <h2 className="font-semibold text-ink">
            6.{' '}
            <Link to="/voting-guide/how-to-vote" className={stepLink}>
              Vote — how to vote on the day
            </Link>
          </h2>
          <p className="mt-1 text-sm text-ink/70">
            The step-by-step walk-through of polling day, plus a first-timer FAQ and what&apos;s
            different about a ward election.
          </p>
        </li>
      </ol>
    </div>
  )
}
```

- [ ] **Step 4: Run the tests**

Run: `npx vitest run src/pages/public/staticPages.test.tsx src/components/RollDeadlineNotice.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add prototype/src/pages/public/VotingGuideHub.tsx prototype/src/pages/public/staticPages.test.tsx
git commit -m "feat: voting-guide hub becomes the ordered first-time-voter checklist (PRD 5.17)"
```

---

### Task 6: Partner kit first-time-voter WhatsApp variant

PRD §5.12: the kit's ready-to-paste WhatsApp text now includes "a general message and a **first-time voter variant** linking the `/voting-guide` checklist (§5.17)".

**Files:**
- Modify: `prototype/src/pages/public/PartnerKit.tsx`
- Modify: `prototype/src/pages/public/PartnerKit.test.tsx` (append tests — it has a `renderAt(path)` helper returning a `within(main)` scope, same convention as staticPages)

- [ ] **Step 1: Write the failing test**

Append to `PartnerKit.test.tsx` (uses its existing `renderAt` helper and the seeded partner slug `demo-rwa-one`):

```tsx
// --- PRD §5.12: first-time voter forward-text variant linking the /voting-guide checklist ------

test('kit carries a first-time voter WhatsApp variant whose tagged link points at the checklist', () => {
  const main = renderAt('/partner/demo-rwa-one')

  expect(main.getByRole('heading', { name: /first.time voter/i })).toBeInTheDocument()
  const ftv = main.getByText(/first Bengaluru ward election/i)
  expect(ftv.textContent).toContain(
    'https://bangalore-votes.opencity.in/voting-guide?src=demo-rwa-one',
  )
  // The general message is still there too, tagged to the home page.
  expect(main.getByText(/new GBA ward boundaries/i).textContent).toContain(
    'https://bangalore-votes.opencity.in/?src=demo-rwa-one',
  )
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/pages/public/PartnerKit.test.tsx`
Expected: the new test FAILS (no first-time voter heading); all pre-existing tests still PASS.

- [ ] **Step 3: Implement**

In `PartnerKit.tsx`:

**(a)** Below the `enForwardText` const, add:

```tsx
  // PRD §5.12/§5.17: the second ready-to-paste variant — aimed at first-time voters, tagged to
  // the /voting-guide checklist hub rather than the home page.
  const firstTimeVoterLink = `${SITE_ORIGIN}/voting-guide?src=${partner.slug}`
  const enFirstTimeVoterText = `Voting in your first Bengaluru ward election? This checklist walks you through it step by step — check you're on the roll, get or transfer your Voter ID before the deadline, find your new ward, and know exactly what happens at the booth: ${firstTimeVoterLink}`
```

**(b)** In the "Ready-to-paste WhatsApp message" section, retitle the existing English block heading from `English` to `English — general message`, and insert a new block after it (before the Kannada block):

```tsx
        <div>
          <h3 className="text-sm font-semibold text-ink">English — first-time voter message</h3>
          <p className="mt-1 whitespace-pre-wrap rounded border border-slate-200 bg-slate-50 p-3 text-sm text-ink/90">
            {enFirstTimeVoterText}
          </p>
        </div>
```

**(c)** In the Kannada block's honesty note, change "of this message is" → "of these messages is", and "use the English text above" → "use the English texts above".

- [ ] **Step 4: Run the tests**

Run: `npx vitest run src/pages/public/PartnerKit.test.tsx src/partnerAttribution.test.tsx`
Expected: PASS. If a pre-existing single-match query in `PartnerKit.test.tsx` now matches both messages (e.g. a bare `getByText(/English/)`), scope it with `getAllByText` and assert `.length` — do not weaken the new assertions.

- [ ] **Step 5: Commit**

```bash
git add prototype/src/pages/public/PartnerKit.tsx prototype/src/pages/public/PartnerKit.test.tsx
git commit -m "feat: first-time voter WhatsApp variant in the partner kit (PRD 5.12)"
```

---

### Task 7: `/privacy` discloses Google Analytics

PRD §5.16 (changed by cf86e22): the collected-data list now includes "**Google Analytics** usage data and cookies", measurement "uses **Google Analytics**, alongside server-side application events". Also add the "standard server logs" item the PRD has always listed. **Copy constraint:** no phrase matching `/\b\d+\s*(day|month|year)s?\b/i` (pinned by an existing test).

**Files:**
- Modify: `prototype/src/pages/public/Privacy.tsx`
- Modify: `prototype/src/pages/public/trustPages.test.tsx` (append test)

- [ ] **Step 1: Write the failing test**

Append inside the `describe('/privacy and /terms do not read as live, actionable policy', ...)` block in `trustPages.test.tsx`:

```tsx
  test('/privacy discloses Google Analytics usage data and cookies, and server logs (PRD §5.16)', () => {
    const main = renderAt('/privacy')
    expect(main.getAllByText(/Google Analytics/i).length).toBeGreaterThan(0)
    expect(main.getAllByText(/cookies/i).length).toBeGreaterThan(0)
    expect(main.getAllByText(/server logs/i).length).toBeGreaterThan(0)
  })
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/pages/public/trustPages.test.tsx`
Expected: FAIL — no Google Analytics text.

- [ ] **Step 3: Implement**

In `Privacy.tsx`, append two `<li>` items to the "What we collect, and why" list (after the partner-attribution item):

```tsx
          <li>
            <strong>Standard server logs</strong> — basic request logs kept for security and
            reliability of the service.
          </li>
          <li>
            <strong>Google Analytics usage data and cookies</strong> — visitor and event
            measurement (page views, ward-finder usage, registration funnel steps, language
            toggles) uses Google Analytics across public pages, alongside the platform&apos;s own
            server-side application events — which remain the source of truth for registration
            and contribution counts.
          </li>
```

- [ ] **Step 4: Run the tests**

Run: `npx vitest run src/pages/public/trustPages.test.tsx`
Expected: PASS — including the pre-existing "no concrete retention period" regex test (the new copy contains no `<digits> day/month/year` phrase).

- [ ] **Step 5: Commit**

```bash
git add prototype/src/pages/public/Privacy.tsx prototype/src/pages/public/trustPages.test.tsx
git commit -m "feat: disclose Google Analytics and server logs on /privacy (PRD 5.16)"
```

---

### Task 8: Store + types — `ingestAffidavit` with `aiExtracted` markers

PRD §5.2: curator uploads the affidavit PDF **or** pastes its EC link; AI extraction populates cases, assets, education (including "not declared"); extracted fields **publish immediately** with a visible AI-extracted marker until curator-confirmed; extraction is **audit-logged as a system entry**; the **stored PDF is the public source link**. In this prototype the extraction is **simulated** (deterministic canned values, honestly labelled) — no PDF is read, no API is called.

**Files:**
- Modify: `prototype/src/types.ts`
- Modify: `prototype/src/store/store.ts`
- Modify: `prototype/src/store/actions.test.ts` (append tests)

**Interfaces:**
- Produces (consumed by Tasks 9–10):
  - `Sourced<T>` gains optional `aiExtracted?: boolean`.
  - `Candidate` gains optional `affidavit?: CandidateAffidavit` where `interface CandidateAffidavit { providedFileName?: string; providedEcUrl?: string; storedUrl: string; ingestedAt: string }`.
  - Store method `ingestAffidavit(slug: string, input: IngestAffidavitInput, curator: User): Candidate` with `interface IngestAffidavitInput { fileName?: string; ecUrl?: string }` (exported from store.ts). Throws if both are blank; ward-scoped; audits as actor `'system'`, action `'candidate.affidavit.extracted'`.
  - `storedUrl` format: `` `#stored-affidavit-${candidate.id}` `` (inert placeholder for the platform's hosted PDF copy).
  - Confirm-by-edit: any later `updateCandidate` that writes a field **without** `aiExtracted` replaces the whole `Sourced` object, clearing the marker — no separate confirm mutation.

- [ ] **Step 1: Write the failing tests**

Append to `actions.test.ts`:

```ts
// --- PRD §5.2: AI-assisted affidavit ingestion (simulated extraction) ---------------------------

test('ingestAffidavit publishes AI-extracted affidavit fields immediately, sourced to the stored copy', () => {
  const s = createStore()
  const c = s.ingestAffidavit('koramangala-r-menon', { fileName: 'menon-form26.pdf' }, curator())

  expect(c.affidavit?.providedFileName).toBe('menon-form26.pdf')
  expect(c.affidavit?.storedUrl).toBe('#stored-affidavit-c-kor-1')
  for (const field of [c.pendingCases, c.assets, c.education]) {
    expect(field.aiExtracted).toBe(true)
    expect(field.source.type).toBe('affidavit')
    expect(field.source.url).toBe('#stored-affidavit-c-kor-1')
    expect(field.source.label.trim()).not.toBe('')
  }
  // The canned extraction demonstrates §9.1's "not declared is a complete answer" on education.
  expect(c.education.notDeclared).toBe(true)
  // Curator-compiled fields are never touched by extraction.
  expect(c.trackRecord.aiExtracted).toBeUndefined()
  expect(c.approachability.aiExtracted).toBeUndefined()
})

test('ingestAffidavit accepts an EC link instead of a file', () => {
  const s = createStore()
  const c = s.ingestAffidavit(
    'koramangala-r-menon',
    { ecUrl: 'https://affidavits.eci.gov.in/menon-form26' },
    curator(),
  )
  expect(c.affidavit?.providedEcUrl).toBe('https://affidavits.eci.gov.in/menon-form26')
  expect(c.affidavit?.providedFileName).toBeUndefined()
})

test('ingestAffidavit requires a file name or an EC link, and writes nothing when refused', () => {
  const s = createStore()
  const auditBefore = s.listAudit().length
  expect(() => s.ingestAffidavit('koramangala-r-menon', {}, curator())).toThrow(/file|link/i)
  expect(s.getCandidate('koramangala-r-menon')?.affidavit).toBeUndefined()
  expect(s.listAudit().length).toBe(auditBefore)
})

test('ingestAffidavit is ward-scoped like every other curator write', () => {
  const s = createStore()
  expect(() =>
    s.ingestAffidavit('malleshwaram-k-iyer', { fileName: 'iyer.pdf' }, curator()),
  ).toThrow(/scope/i)
})

test('ingestAffidavit audit-logs the extraction as a SYSTEM entry naming the triggering curator', () => {
  const s = createStore()
  s.ingestAffidavit('koramangala-r-menon', { fileName: 'menon-form26.pdf' }, curator())
  const last = s.listAudit().at(-1)!
  expect(last.action).toBe('candidate.affidavit.extracted')
  expect(last.actorUserId).toBe('system')
  expect(last.detail).toMatch(/triggered by u-curator/i)
  expect(last.wardId).toBe('koramangala')
})

test('a later curator save clears the aiExtracted marker (confirm-by-edit, PRD §5.2)', () => {
  const s = createStore()
  s.ingestAffidavit('koramangala-r-menon', { fileName: 'menon-form26.pdf' }, curator())
  const c = s.getCandidate('koramangala-r-menon')!
  expect(c.assets.aiExtracted).toBe(true)

  s.updateCandidate(
    'koramangala-r-menon',
    { assets: { value: c.assets.value, source: c.assets.source } },
    curator(),
  )
  expect(s.getCandidate('koramangala-r-menon')!.assets.aiExtracted).toBeUndefined()
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/store/actions.test.ts`
Expected: FAIL — `s.ingestAffidavit is not a function` (TypeScript will also flag it; that's fine for vitest, which runs via esbuild).

- [ ] **Step 3: Extend `types.ts`**

In `types.ts`:

**(a)** Replace the `Sourced<T>` interface line with:

```ts
export interface Sourced<T> { value: T; source: Source; notDeclared?: boolean; aiExtracted?: boolean }
```

and append to its doc comment:

```ts
/*  `aiExtracted` (PRD §5.2): set by the store's `ingestAffidavit` on the affidavit fields it
 *  populates — the field is PUBLISHED (visible to citizens) but carries a visible "AI-extracted"
 *  marker until a curator confirms or edits it. Cleared implicitly: any later curator save
 *  (`updateCandidate`) replaces the whole Sourced object without the flag. Mirrors the
 *  machine-translation trade (§8): publish immediately, flag flow is the correction net. */
```

**(b)** After `NewsLink`, add:

```ts
/** The affidavit a candidate's official fields were AI-extracted from (PRD §5.2). The platform's
 *  stored copy (`storedUrl`) — not the EC's own URL, which can move or rot — is the public
 *  source link on affidavit-sourced fields. In this prototype `storedUrl` is an inert `#…`
 *  placeholder: no real file is stored, matching the project's placeholder-link convention. */
export interface CandidateAffidavit {
  providedFileName?: string
  providedEcUrl?: string
  storedUrl: string
  ingestedAt: string
}
```

**(c)** Add to `Candidate` (after `news: NewsLink[]`):

```ts
  affidavit?: CandidateAffidavit
```

- [ ] **Step 4: Extend `store.ts`**

**(a)** Add `CandidateAffidavit` to the type import list from `../types`.

**(b)** In `isValidSourcedPatchValue`, after the `notDeclared` check, add:

```ts
  // PRD §5.2: aiExtracted is optional; if present it must be a real boolean. Callers outside
  // ingestAffidavit (curator form saves) simply omit it — which is what clears the marker.
  if (v.aiExtracted !== undefined && typeof v.aiExtracted !== 'boolean') return false
```

**(c)** Near `SubmitFlagInput`, add the exported input type:

```ts
/** Input to `ingestAffidavit` (PRD §5.2) — the curator either "uploads" the affidavit PDF (in
 *  this prototype: provides its file name; no real file is read) or pastes its EC link (which
 *  production would fetch and store; here it is recorded verbatim). At least one is required. */
export interface IngestAffidavitInput {
  fileName?: string
  ecUrl?: string
}
```

**(d)** Inside `createStore()`, after `updateCandidate`, add the mutation:

```ts
  /**
   * AI-assisted affidavit ingestion (PRD §5.2/§14). The curator uploads the EC affidavit (Form
   * 26) PDF or pastes its EC link; extraction populates the three affidavit-derived fields —
   * pendingCases, assets, education — which PUBLISH IMMEDIATELY, each marked `aiExtracted: true`
   * until a curator confirms or edits it (any later `updateCandidate` save replaces the field
   * without the flag, clearing it). The platform's stored copy of the PDF is the public source
   * link on every extracted field (`storedUrl` — an inert `#…` placeholder here, per the
   * project's placeholder-link convention; no real file is stored).
   *
   * SIMULATED, HONESTLY: this prototype has no backend, reads no PDF, and calls no AI API — the
   * "extraction" below returns deterministic canned values that say so in their own text. The
   * education field comes back `notDeclared` to demonstrate §5.2's "including marking a field
   * not declared where the affidavit says so" (§9.1: a valid, complete answer).
   *
   * AUDITED AS A SYSTEM ENTRY (PRD §5.2 says so explicitly): actor is the literal 'system' (not
   * a User id — Audit.tsx's actorName() falls back to rendering the raw id), with the triggering
   * curator named in the detail string, so the trail records both that a machine wrote the
   * fields and who set it in motion. Ward-scoped like every curator write, checked before any
   * mutation.
   */
  function ingestAffidavit(slug: string, input: IngestAffidavitInput, curator: User): Candidate {
    const candidate = requireCandidateBySlug(slug)
    requireScope(curator, candidate.wardId)
    const fileName = input.fileName?.trim() || undefined
    const ecUrl = input.ecUrl?.trim() || undefined
    if (!fileName && !ecUrl) {
      throw new Error("Provide the affidavit PDF file, or paste the affidavit's EC link.")
    }

    const n = nextSeq()
    const storedUrl = `#stored-affidavit-${candidate.id}`
    candidate.affidavit = {
      providedFileName: fileName,
      providedEcUrl: ecUrl,
      storedUrl,
      ingestedAt: `t${n}`,
    }

    const extractedSource = (): Source => ({
      type: 'affidavit',
      label: 'EC affidavit (Form 26)',
      url: storedUrl,
    })
    candidate.pendingCases = {
      value:
        'Two pending cases relating to municipal permit disputes, both at pre-trial stage (simulated AI extraction — this prototype reads no real PDF).',
      source: extractedSource(),
      aiExtracted: true,
    }
    candidate.assets = {
      value:
        'Declared movable and immovable assets totalling approximately Rs 1.2 crore (simulated AI extraction — this prototype reads no real PDF).',
      source: extractedSource(),
      aiExtracted: true,
    }
    candidate.education = {
      value: '',
      source: extractedSource(),
      notDeclared: true,
      aiExtracted: true,
    }

    appendAudit({
      actorUserId: 'system',
      action: 'candidate.affidavit.extracted',
      wardId: candidate.wardId,
      detail: `AI-extracted affidavit fields (pendingCases, assets, education) for ${candidate.name} (${candidate.id}) from ${fileName ?? ecUrl}; ingestion triggered by ${curator.id}.`,
    })
    persist()
    return structuredClone(candidate)
  }
```

**(e)** Add `ingestAffidavit,` to the returned API object (next to `updateCandidate`).

- [ ] **Step 5: Run the tests**

Run: `npx vitest run src/store/actions.test.ts src/store/store.test.ts src/context/DataContext.test.tsx`
Expected: PASS, including all pre-existing store tests.

- [ ] **Step 6: Typecheck**

Run: `npm run typecheck`
Expected: clean.

- [ ] **Step 7: Commit**

```bash
git add prototype/src/types.ts prototype/src/store/store.ts prototype/src/store/actions.test.ts
git commit -m "feat: AI-assisted affidavit ingestion in the store, with aiExtracted markers and a system audit entry (PRD 5.2)"
```

---

### Task 9: `AiExtractedBadge` + affidavit ingestion UI in `EditCandidate`

The curator-facing half: an affidavit section on `/curator/candidate/:candidateId` that triggers `ingestAffidavit`, refreshes the form drafts from the extraction, and shows per-field markers. Saving the form is the confirm action (it writes fields without `aiExtracted`).

**Files:**
- Create: `prototype/src/components/AiExtractedBadge.tsx`
- Modify: `prototype/src/pages/curator/EditCandidate.tsx`
- Modify: `prototype/src/pages/curator/edit.test.tsx` (append tests)

**Interfaces:**
- Consumes: `ingestAffidavit`, `Sourced.aiExtracted`, `Candidate.affidavit` (Task 8).
- Produces: `AiExtractedBadge()` component with exact visible text `AI-extracted — not yet curator-confirmed` (Tasks 9–10 assert this exact string; helper copy elsewhere must not duplicate it).

- [ ] **Step 1: Write the failing tests**

Append to `edit.test.tsx`:

```tsx
// --- PRD §5.2: AI-assisted affidavit ingestion from the curator editor --------------------------

test('curator ingests an affidavit — extracted fields publish immediately, marked, audited as a system entry', async () => {
  const user = userEvent.setup()
  renderAt('/curator/candidate/c-kor-1', 'u-curator')
  const auditBefore = store.listAudit().length

  await user.type(screen.getByLabelText(/affidavit pdf file name/i), 'menon-form26.pdf')
  await user.click(screen.getByRole('button', { name: /ingest affidavit/i }))

  const candidate = store.getCandidate('koramangala-r-menon')!
  expect(candidate.affidavit?.providedFileName).toBe('menon-form26.pdf')
  expect(candidate.assets.aiExtracted).toBe(true)
  expect(candidate.education.notDeclared).toBe(true)

  // Per-field markers appear on the three extracted fields.
  expect(screen.getAllByText('AI-extracted — not yet curator-confirmed')).toHaveLength(3)
  // The form drafts were refreshed from the extraction.
  expect(screen.getByLabelText(/declared assets value/i)).toHaveValue(candidate.assets.value)

  const last = store.listAudit().at(-1)!
  expect(last.action).toBe('candidate.affidavit.extracted')
  expect(last.actorUserId).toBe('system')
  expect(store.listAudit().length).toBe(auditBefore + 1)
})

test('ingest with neither a file nor a link surfaces an inline error, no crash, nothing written', async () => {
  const user = userEvent.setup()
  renderAt('/curator/candidate/c-kor-1', 'u-curator')

  await user.click(screen.getByRole('button', { name: /ingest affidavit/i }))

  expect(screen.getByRole('alert')).toHaveTextContent(/file|link/i)
  expect(store.getCandidate('koramangala-r-menon')?.affidavit).toBeUndefined()
})

test('saving the form after ingestion confirms the fields and clears every AI-extracted marker', async () => {
  const user = userEvent.setup()
  renderAt('/curator/candidate/c-kor-1', 'u-curator')

  await user.type(screen.getByLabelText(/affidavit pdf file name/i), 'menon-form26.pdf')
  await user.click(screen.getByRole('button', { name: /ingest affidavit/i }))
  await user.click(screen.getByRole('button', { name: /save changes/i }))

  const candidate = store.getCandidate('koramangala-r-menon')!
  expect(candidate.pendingCases.aiExtracted).toBeUndefined()
  expect(candidate.assets.aiExtracted).toBeUndefined()
  expect(candidate.education.aiExtracted).toBeUndefined()
  // "Not declared" itself survives the confirm — only the AI marker clears.
  expect(candidate.education.notDeclared).toBe(true)
  expect(screen.queryByText('AI-extracted — not yet curator-confirmed')).not.toBeInTheDocument()
})

test('out-of-scope ingest surfaces the store scope error inline, no crash', async () => {
  const user = userEvent.setup()
  renderAt('/curator/candidate/c-mal-1', 'u-curator')

  await user.type(screen.getByLabelText(/affidavit pdf file name/i), 'iyer.pdf')
  await user.click(screen.getByRole('button', { name: /ingest affidavit/i }))

  expect(screen.getByRole('alert')).toHaveTextContent(/scope/i)
  expect(store.getCandidate('malleshwaram-k-iyer')?.affidavit).toBeUndefined()
})
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run src/pages/curator/edit.test.tsx`
Expected: the four new tests FAIL (no affidavit inputs); pre-existing tests PASS.

- [ ] **Step 3: Create the badge component**

Create `prototype/src/components/AiExtractedBadge.tsx`:

```tsx
/** Visible marker for an affidavit field populated by AI extraction (PRD §5.2) — shown wherever
 * the field appears (report card, compare table, curator editor) until a curator confirms or
 * edits it, which clears `Sourced.aiExtracted`. Rendered NEXT TO the SourceBadge, never instead
 * of it — provenance and confirmation status are different facts. The exact text below is pinned
 * by tests; keep helper copy elsewhere from duplicating it verbatim. */
export function AiExtractedBadge() {
  return (
    <span className="inline-flex items-center rounded-full border border-amber-400 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-900">
      AI-extracted — not yet curator-confirmed
    </span>
  )
}
```

- [ ] **Step 4: Wire the editor**

In `EditCandidate.tsx`:

**(a)** Add imports:

```tsx
import { AiExtractedBadge } from '../../components/AiExtractedBadge'
```

**(b)** Add a module-level helper above the component (it mirrors the existing draft initializer so the two can't drift):

```tsx
/** Builds a form draft from a stored Sourced field — used both by the initial useState and to
 *  refresh the three extracted fields after ingestAffidavit returns. Deliberately drops
 *  `aiExtracted`: drafts never carry the flag, so a subsequent Save publishes the field WITHOUT
 *  it — Save IS the §5.2 confirm action. */
function draftFrom(sourced: Sourced<string> | undefined): FieldDraft {
  return {
    value: sourced?.value ?? '',
    sourceType: sourced?.source.type ?? 'curator',
    sourceLabel: sourced?.source.label ?? '',
    sourceUrl: sourced?.source.url ?? '',
    notDeclared: sourced?.notDeclared ?? false,
  }
}
```

and simplify the `useState` drafts initializer to use it:

```tsx
  const [drafts, setDrafts] = useState<Record<CandidateSourcedField, FieldDraft>>(() => {
    const initial = {} as Record<CandidateSourcedField, FieldDraft>
    for (const field of SOURCED_FIELDS) initial[field] = draftFrom(candidate?.[field])
    return initial
  })
```

**(c)** Add state + handler (after the existing state declarations / after `activeCandidate` is bound):

```tsx
  const [affidavitFile, setAffidavitFile] = useState('')
  const [affidavitEcUrl, setAffidavitEcUrl] = useState('')
  const [ingestError, setIngestError] = useState<string | null>(null)
  const [ingested, setIngested] = useState(false)
```

```tsx
  function handleIngest(): void {
    setIngested(false)
    try {
      const updated = data.ingestAffidavit(
        activeCandidate.slug,
        { fileName: affidavitFile, ecUrl: affidavitEcUrl },
        user,
      )
      setDrafts((prev) => ({
        ...prev,
        pendingCases: draftFrom(updated.pendingCases),
        assets: draftFrom(updated.assets),
        education: draftFrom(updated.education),
      }))
      setIngestError(null)
      setIngested(true)
      setSaved(false)
    } catch (err) {
      setIngestError(err instanceof Error ? err.message : 'Could not ingest this affidavit.')
    }
  }
```

**(d)** Render the affidavit section inside the `<form>`, between the "Basics" section and the "Report-card fields" section:

```tsx
        <section aria-labelledby="affidavit-heading" className="space-y-3 rounded-lg border border-slate-200 p-4">
          <h2 id="affidavit-heading" className="text-sm font-semibold text-ink">
            Affidavit (Form 26) — AI-assisted ingestion
          </h2>
          {activeCandidate.affidavit && (
            <p className="text-sm text-ink/80">
              Affidavit on file:{' '}
              <strong>
                {activeCandidate.affidavit.providedFileName ?? activeCandidate.affidavit.providedEcUrl}
              </strong>{' '}
              —{' '}
              <a
                href={activeCandidate.affidavit.storedUrl}
                className="text-brand underline underline-offset-2"
              >
                stored copy (placeholder link in this prototype)
              </a>{' '}
              is the public source link on the extracted fields.
            </p>
          )}
          <p className="text-xs text-ink/60">
            Upload the candidate&apos;s EC affidavit PDF (type its file name to simulate the
            upload — no real file is read in this prototype) or paste its EC link. Extraction
            (simulated AI) fills cases, assets and education and publishes them immediately with
            a visible marker; <strong>saving this form confirms the fields and clears the
            marker</strong>.
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            <div>
              <label htmlFor="affidavit-file" className="mb-1 block text-xs font-medium text-ink/70">
                Affidavit PDF file name
              </label>
              <input
                id="affidavit-file"
                type="text"
                value={affidavitFile}
                onChange={(e) => setAffidavitFile(e.target.value)}
                placeholder="e.g. candidate-form26.pdf"
                className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
              />
            </div>
            <div>
              <label htmlFor="affidavit-ec-url" className="mb-1 block text-xs font-medium text-ink/70">
                …or EC link to the affidavit
              </label>
              <input
                id="affidavit-ec-url"
                type="text"
                value={affidavitEcUrl}
                onChange={(e) => setAffidavitEcUrl(e.target.value)}
                placeholder="https://…"
                className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
              />
            </div>
          </div>
          {ingestError && (
            <p role="alert" className="rounded bg-red-50 px-3 py-2 text-sm text-red-800">
              {ingestError}
            </p>
          )}
          {ingested && !ingestError && (
            <p className="rounded bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
              Extraction published — cases, assets and education below now carry AI-extracted
              markers until you confirm or edit them.
            </p>
          )}
          <button
            type="button"
            onClick={handleIngest}
            className="rounded border border-brand px-3 py-1.5 text-sm font-semibold text-brand hover:bg-brand/10 focus:outline-none focus:ring-2 focus:ring-brand"
          >
            Ingest affidavit &amp; extract (simulated AI)
          </button>
        </section>
```

**(e)** In the per-field `fieldset` render, add the marker right after the `<legend>` (keyed off the **store's** current candidate, which re-renders via `useStoreVersion`):

```tsx
                {activeCandidate[field].aiExtracted && <AiExtractedBadge />}
```

- [ ] **Step 5: Run the tests**

Run: `npx vitest run src/pages/curator/edit.test.tsx`
Expected: PASS — all pre-existing editor tests too (the new section adds a `type="button"` control, so form submit behaviour is unchanged).

- [ ] **Step 6: Commit**

```bash
git add prototype/src/components/AiExtractedBadge.tsx prototype/src/pages/curator/EditCandidate.tsx prototype/src/pages/curator/edit.test.tsx
git commit -m "feat: curator affidavit ingestion UI with AI-extracted markers, save-as-confirm (PRD 5.2)"
```

---

### Task 10: AI-extracted markers + stored-PDF source links on the public pages

PRD §5.2/§11: citizens must SEE the AI-extracted marker on the report card and compare table, and affidavit-sourced fields must link to the stored PDF (the `SourceBadge` already renders `source.url` — extraction set it in Task 8; this task renders the marker).

**Files:**
- Modify: `prototype/src/pages/public/CandidateReportCard.tsx`
- Modify: `prototype/src/pages/public/CompareCandidates.tsx`
- Modify: `prototype/src/pages/public/CandidateReportCard.test.tsx` (extend Probe + append tests)
- Modify: `prototype/src/pages/public/CompareCandidates.test.tsx` (append test)

**Interfaces:**
- Consumes: `AiExtractedBadge` (Task 9), `ingestAffidavit` + `aiExtracted` (Task 8).

- [ ] **Step 1: Write the failing tests**

In `CandidateReportCard.test.tsx`, extend the Probe to expose the store (it currently exposes only `auth`):

```tsx
import { useData } from '../../context/DataContext'
```
```tsx
let auth: ReturnType<typeof useAuth>
let store: ReturnType<typeof useData>
function Probe() {
  auth = useAuth()
  store = useData()
  return null
}
```

Then append:

```tsx
// --- PRD §5.2/§11: AI-extracted markers + the stored affidavit copy as the public source link ---

test('after ingestion, extracted fields carry the AI-extracted marker and link to the stored copy', () => {
  renderAt('/candidate/koramangala-r-menon')
  const curatorUser = store.listUsers().find((u) => u.id === 'u-curator')!
  act(() => {
    store.ingestAffidavit('koramangala-r-menon', { fileName: 'menon-form26.pdf' }, curatorUser)
  })

  expect(screen.getAllByText('AI-extracted — not yet curator-confirmed')).toHaveLength(3)
  const storedLinks = screen
    .getAllByRole('link', { name: 'source' })
    .filter((l) => l.getAttribute('href') === '#stored-affidavit-c-kor-1')
  expect(storedLinks).toHaveLength(3)
})

test('before any ingestion, no AI-extracted marker renders anywhere on the report card', () => {
  renderAt('/candidate/koramangala-r-menon')
  expect(screen.queryByText('AI-extracted — not yet curator-confirmed')).not.toBeInTheDocument()
})
```

In `CompareCandidates.test.tsx` (its `renderAt` returns the full render result; queries go through `screen`), append:

```tsx
// --- PRD §5.2: the AI-extracted marker also shows in the compare table --------------------------

import { act } from '@testing-library/react'
import { useData } from '../../context/DataContext'

let store: ReturnType<typeof useData>
function StoreProbe() {
  store = useData()
  return null
}

test('AI-extracted fields carry their marker in the compare table too', () => {
  const router = createMemoryRouter(routeObjects, { initialEntries: ['/ward/koramangala/compare'] })
  render(
    <AppProviders>
      <StoreProbe />
      <RouterProvider router={router} />
    </AppProviders>,
  )
  const curatorUser = store.listUsers().find((u) => u.id === 'u-curator')!
  act(() => {
    store.ingestAffidavit('koramangala-r-menon', { fileName: 'menon-form26.pdf' }, curatorUser)
  })

  // One candidate ingested × three extracted fields.
  expect(screen.getAllByText('AI-extracted — not yet curator-confirmed')).toHaveLength(3)
})
```

(Put the two imports at the top of the file with the existing imports, and `StoreProbe` below the `renderAt` helper.)

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run src/pages/public/CandidateReportCard.test.tsx src/pages/public/CompareCandidates.test.tsx`
Expected: the new tests FAIL (marker never renders); all pre-existing tests PASS.

- [ ] **Step 3: Render the marker on both pages**

In `CandidateReportCard.tsx`:

```tsx
import { AiExtractedBadge } from '../../components/AiExtractedBadge'
```

and in `ReportField`, change the badge line to render the marker alongside the source badge:

```tsx
        <div className="flex flex-wrap items-center gap-1.5">
          <SourceBadge source={sourced.source} />
          {sourced.aiExtracted && <AiExtractedBadge />}
        </div>
```

In `CompareCandidates.tsx`:

```tsx
import { AiExtractedBadge } from '../../components/AiExtractedBadge'
```

and change the cell's badge container to:

```tsx
                        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                          <SourceBadge source={sourced.source} />
                          {sourced.aiExtracted && <AiExtractedBadge />}
                        </div>
```

- [ ] **Step 4: Run the tests**

Run: `npx vitest run src/pages/public/CandidateReportCard.test.tsx src/pages/public/CompareCandidates.test.tsx`
Expected: PASS — including the pre-existing `'Official (affidavit)'` count test (the marker is a separate element with different text).

- [ ] **Step 5: Full suite + typecheck**

Run: `npm test && npm run typecheck`
Expected: entire suite green, types clean.

- [ ] **Step 6: Commit**

```bash
git add prototype/src/pages/public/CandidateReportCard.tsx prototype/src/pages/public/CompareCandidates.tsx prototype/src/pages/public/CandidateReportCard.test.tsx prototype/src/pages/public/CompareCandidates.test.tsx
git commit -m "feat: AI-extracted markers and stored-affidavit source links on report card and compare (PRD 5.2, 11)"
```

---

## Self-Review (done at planning time)

- **Spec coverage:** §5.6 eligibility → Task 2; §5.6/§5.7/§5.8 roll deadline → Tasks 1 & 5; §5.8 registered-elsewhere → Task 3; §5.9 FAQ/differences + §17 EVM hedge → Task 4; §5.17 checklist → Task 5; §5.12 FTV variant → Task 6; §5.16 GA → Task 7; §5.2/§11/§14 affidavit ingestion, markers, stored-PDF source, system audit entry → Tasks 8–10. §8 `/kn/` URLs deliberately excluded (controller decision). Curator-scope-uncapped (a752d65) needs no prototype change — nothing caps assignment today.
- **Type consistency:** `Sourced.aiExtracted` (Task 8) is the field read by Tasks 9–10; `ingestAffidavit(slug, {fileName?, ecUrl?}, curator)` signature is identical in store, editor, and all tests; badge text `AI-extracted — not yet curator-confirmed` is pinned identically in Tasks 9 and 10; `#stored-affidavit-c-kor-1` derives from `c-kor-1` and matches all assertions.
- **Known test-interaction risks called out inline:** privacy digit-regex (Task 7), no-textbox invariant (Task 2), hub link-name regexes (Task 5), affidavit badge count (Task 10).
