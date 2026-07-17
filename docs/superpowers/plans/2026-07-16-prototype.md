# GBA Elections Prototype Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a static, client-side React prototype of the GBA Elections Citizen Platform covering all four roles with mock data, deployed to GitHub Pages from `prototype/`.

**Architecture:** A Vite + React + TypeScript SPA. A typed in-memory store (seeded from static data modules, persisted to `localStorage`) simulates the backend. Three React contexts — Auth, Data, I18n — expose the store and session to pages. Routes mirror the IA site map exactly under basename `/bangalore-votes`. Contributions (flag, vote, curator edits) mutate the store, append audit entries, and persist, so end-to-end flows feel live within a session.

**Tech Stack:** Vite, React 18, TypeScript, Tailwind CSS, React Router v6, Vitest + React Testing Library, GitHub Actions.

## Global Constraints

- All prototype source lives under `prototype/`. Do not create app files at the repo root. The only repo-root file this plan adds is `.github/workflows/deploy-prototype.yml`.
- Vite `base` MUST be `/bangalore-votes/`. Router basename MUST be `/bangalore-votes`.
- English strings only. The EN | ಕನ್ನಡ toggle renders but does not translate.
- No real network calls, no real auth. Everything simulated in-browser.
- Routes MUST match the IA (`docs/information-architecture.md`) site map paths exactly.
- Every persisting write MUST append an audit-log entry via the store (never mutate state directly in a component).
- Use TypeScript strict mode. No `any` in store or data modules.
- Commit after each task with the message shown in its final step.

---

## File Structure

```
.github/workflows/deploy-prototype.yml     CI: build prototype/ → GitHub Pages
prototype/
  index.html                    #root div + module script
  404.html                      copy of index.html (SPA fallback)
  package.json, tsconfig.json, vite.config.ts
  tailwind.config.ts, postcss.config.js, src/index.css
  vitest.config.ts, src/test/setup.ts
  README.md
  src/
    types.ts                    all domain model types
    data/                       seed modules (wards, candidates, issues, users, submissions, audit) + index
    store/store.ts              in-memory store: selectors + actions + persistence
    store/store.test.ts
    context/I18nContext.tsx
    context/AuthContext.tsx
    context/DataContext.tsx
    components/                  AppBar, Footer, DevRoleSwitcher, SourceBadge, CandidateCard,
                                 WardSearch, Modal, GatedButton, RoleGuard
    components/modals/          RegisterLogin, FlagMisinformation, CastIssueVote
    pages/public/               13 page components
    pages/account/              3 page components
    pages/curator/              6 page components
    pages/admin/                4 page components
    routes.tsx, App.tsx, main.tsx
```

---

### Task 1: Project scaffold

**Files:**
- Create: `prototype/package.json`, `prototype/tsconfig.json`, `prototype/tsconfig.node.json`, `prototype/vite.config.ts`, `prototype/index.html`, `prototype/src/main.tsx`, `prototype/src/App.tsx`, `prototype/src/index.css`, `prototype/tailwind.config.ts`, `prototype/postcss.config.js`, `prototype/vitest.config.ts`, `prototype/src/test/setup.ts`, `prototype/.gitignore`
- Test: `prototype/src/App.test.tsx`

**Interfaces:**
- Produces: `App` (default export React component) rendering a placeholder; the full toolchain (`npm run dev`, `npm run build`, `npm run test`, `npm run typecheck`).

- [ ] **Step 1: Create `prototype/package.json`**

```json
{
  "name": "bangalore-votes-prototype",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build && cp dist/index.html dist/404.html",
    "preview": "vite preview",
    "typecheck": "tsc --noEmit",
    "test": "vitest run"
  },
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "react-router-dom": "^6.26.0"
  },
  "devDependencies": {
    "@testing-library/jest-dom": "^6.4.8",
    "@testing-library/react": "^16.0.0",
    "@testing-library/user-event": "^14.5.2",
    "@types/react": "^18.3.3",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.3.1",
    "autoprefixer": "^10.4.19",
    "jsdom": "^24.1.1",
    "postcss": "^8.4.40",
    "tailwindcss": "^3.4.7",
    "typescript": "^5.5.4",
    "vite": "^5.4.0",
    "vitest": "^2.0.5"
  }
}
```

- [ ] **Step 2: Create config files**

`prototype/vite.config.ts`:
```ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: '/bangalore-votes/',
  plugins: [react()],
})
```

`prototype/vitest.config.ts`:
```ts
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: { environment: 'jsdom', globals: true, setupFiles: ['./src/test/setup.ts'] },
})
```

`prototype/src/test/setup.ts`:
```ts
import '@testing-library/jest-dom/vitest'
import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'
afterEach(() => { cleanup(); localStorage.clear() })
```

`prototype/tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2020", "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"], "module": "ESNext",
    "skipLibCheck": true, "moduleResolution": "bundler",
    "resolveJsonModule": true, "isolatedModules": true, "noEmit": true,
    "jsx": "react-jsx", "strict": true,
    "noUnusedLocals": true, "noUnusedParameters": true, "noFallthroughCasesInSwitch": true,
    "types": ["vitest/globals", "@testing-library/jest-dom"]
  },
  "include": ["src"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

`prototype/tsconfig.node.json`:
```json
{
  "compilerOptions": {
    "composite": true, "skipLibCheck": true, "module": "ESNext",
    "moduleResolution": "bundler", "allowSyntheticDefaultImports": true, "strict": true
  },
  "include": ["vite.config.ts", "vitest.config.ts"]
}
```

`prototype/tailwind.config.ts`:
```ts
import type { Config } from 'tailwindcss'
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#1a2233', brand: '#0b5c8a', accent: '#c2410c',
        official: '#0b5c8a', curated: '#6b7280',
      },
    },
  },
  plugins: [],
} satisfies Config
```

`prototype/postcss.config.js`:
```js
export default { plugins: { tailwindcss: {}, autoprefixer: {} } }
```

`prototype/src/index.css`:
```css
@tailwind base;
@tailwind components;
@tailwind utilities;
body { @apply bg-slate-50 text-ink; }
```

`prototype/.gitignore`:
```
node_modules
dist
```

- [ ] **Step 3: Create `prototype/index.html`, `main.tsx`, `App.tsx`**

`prototype/index.html`:
```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Bangalore Votes — GBA Elections</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

`prototype/src/main.tsx`:
```tsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode><App /></React.StrictMode>,
)
```

`prototype/src/App.tsx`:
```tsx
export default function App() {
  return <div className="p-8 text-2xl font-bold">Bangalore Votes</div>
}
```

- [ ] **Step 4: Write smoke test** `prototype/src/App.test.tsx`

```tsx
import { render, screen } from '@testing-library/react'
import App from './App'

test('renders app title', () => {
  render(<App />)
  expect(screen.getByText('Bangalore Votes')).toBeInTheDocument()
})
```

- [ ] **Step 5: Install and verify**

Run (from `prototype/`): `npm install && npm run typecheck && npm run test && npm run build`
Expected: install succeeds; typecheck clean; test PASS; build emits `dist/index.html` and `dist/404.html`.

- [ ] **Step 6: Commit**

```bash
git add prototype/ && git commit -m "chore: scaffold prototype Vite+React+TS+Tailwind"
```

---

### Task 2: Domain types

**Files:**
- Create: `prototype/src/types.ts`

**Interfaces:**
- Produces: `Corporation`, `SourceType`, `Source`, `Sourced<T>`, `Ward`, `Candidate`, `Issue`, `IssueVote`, `Role`, `User`, `SubmissionStatus`, `Submission`, `AuditEntry`.

- [ ] **Step 1: Write `prototype/src/types.ts`**

```ts
export type Corporation = 'North' | 'South' | 'East' | 'West' | 'Central'
export type SourceType = 'affidavit' | 'curator'

export interface Source { type: SourceType; label: string; url?: string }
/** A value paired with its provenance. */
export interface Sourced<T> { value: T; source: Source }

export interface Ward {
  id: string            // slug, e.g. "koramangala"
  number: number
  name: string
  corporation: Corporation
  oldWardsNote: string  // human description of old→new mapping
  issueIds: string[]    // curator-defined votable issues for this ward
}

export interface NewsLink { title: string; url: string; publisher: string }

export interface Candidate {
  id: string
  slug: string
  wardId: string
  name: string
  photoUrl: string      // placeholder avatar URL
  party: string         // "Independent" if none
  trackRecord: Sourced<string>
  pendingCases: Sourced<string>
  assets: Sourced<string>
  education: Sourced<string>
  approachability: Sourced<string>
  news: NewsLink[]      // curator-compiled
}

export interface Issue { id: string; wardId: string; title: string; description: string }
export interface IssueVote { userId: string; wardId: string; issueIds: string[] } // up to 3

export type Role = 'anonymous' | 'citizen' | 'curator' | 'admin'
export interface User {
  id: string
  name: string
  contact: string       // email or WhatsApp
  role: Role
  homeWardId?: string
  language: 'en' | 'kn'
  curatorWardIds?: string[] // scope for curators
  active: boolean
}

export type SubmissionStatus = 'pending' | 'accepted' | 'rejected'
export interface Submission {
  id: string
  kind: 'flag'
  wardId: string
  candidateId?: string
  field: string          // which claim/field is flagged
  detail: string
  sourceUrl?: string
  submittedByUserId: string
  status: SubmissionStatus
  reason?: string        // rejection reason
  count: number          // deduped flag count on same field
  createdAt: string      // ISO string (seed-fixed; new ones use a monotonic stamp)
}

export interface AuditEntry {
  id: string
  at: string
  actorUserId: string
  action: string         // e.g. "candidate.trackRecord.updated"
  wardId?: string
  detail: string
}
```

- [ ] **Step 2: Verify typecheck** — Run: `npm run typecheck` · Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add prototype/src/types.ts && git commit -m "feat: domain model types"
```

---

### Task 3: Seed data

**Files:**
- Create: `prototype/src/data/wards.ts`, `candidates.ts`, `issues.ts`, `users.ts`, `submissions.ts`, `audit.ts`, `index.ts`
- Test: `prototype/src/data/data.test.ts`

**Interfaces:**
- Consumes: all types from `../types`.
- Produces: `seedWards: Ward[]`, `seedCandidates: Candidate[]`, `seedIssues: Issue[]`, `seedUsers: User[]`, `seedSubmissions: Submission[]`, `seedAudit: AuditEntry[]`, `seedIssueVotes: IssueVote[]`, and a bundled `seed` object from `index.ts`.

- [ ] **Step 1: Write the data-integrity test** `prototype/src/data/data.test.ts`

```ts
import { seed } from './index'

test('every candidate references an existing ward', () => {
  const wardIds = new Set(seed.wards.map(w => w.id))
  for (const c of seed.candidates) expect(wardIds.has(c.wardId)).toBe(true)
})

test('every ward issueId maps to an issue in that ward', () => {
  const byId = new Map(seed.issues.map(i => [i.id, i]))
  for (const w of seed.wards)
    for (const id of w.issueIds) expect(byId.get(id)?.wardId).toBe(w.id)
})

test('there is at least one citizen, curator, and admin', () => {
  const roles = new Set(seed.users.map(u => u.role))
  expect(roles.has('citizen')).toBe(true)
  expect(roles.has('curator')).toBe(true)
  expect(roles.has('admin')).toBe(true)
})

test('the curator has a non-empty ward scope', () => {
  const cur = seed.users.find(u => u.role === 'curator')!
  expect(cur.curatorWardIds && cur.curatorWardIds.length).toBeTruthy()
})
```

- [ ] **Step 2: Run test to verify it fails** — Run: `npm run test -- data.test` · Expected: FAIL (module not found).

- [ ] **Step 3: Write the seed modules**

`wards.ts` — export `seedWards` with 4 wards across corporations. Use these exact ids so later tasks line up: `koramangala` (South, #151), `indiranagar` (East, #80), `malleshwaram` (West, #45), `shivajinagar` (Central, #92). Each includes `number`, `name` (title-case of id), `corporation`, an `oldWardsNote` string (e.g. `"Formed from parts of old wards 151 & 152"`), and `issueIds` referencing the issues below (3 per ward).

```ts
import type { Ward } from '../types'
export const seedWards: Ward[] = [
  { id: 'koramangala', number: 151, name: 'Koramangala', corporation: 'South',
    oldWardsNote: 'Formed from parts of old wards 151 and 174.',
    issueIds: ['kor-roads', 'kor-water', 'kor-waste'] },
  { id: 'indiranagar', number: 80, name: 'Indiranagar', corporation: 'East',
    oldWardsNote: 'Largely retains old ward 80 with minor boundary changes.',
    issueIds: ['ind-traffic', 'ind-trees', 'ind-parking'] },
  { id: 'malleshwaram', number: 45, name: 'Malleshwaram', corporation: 'West',
    oldWardsNote: 'Merged from old wards 45 and 46.',
    issueIds: ['mal-water', 'mal-heritage', 'mal-waste'] },
  { id: 'shivajinagar', number: 92, name: 'Shivajinagar', corporation: 'Central',
    oldWardsNote: 'Redrawn from old wards 92 and 93.',
    issueIds: ['shi-drainage', 'shi-safety', 'shi-vendors'] },
]
```

`issues.ts` — export `seedIssues: Issue[]` with the 12 issues referenced above (id, wardId, title, one-line description). Example row: `{ id: 'kor-roads', wardId: 'koramangala', title: 'Road quality & potholes', description: 'Condition and repair of internal roads.' }`. Provide all 12.

`candidates.ts` — export `seedCandidates: Candidate[]` with 2–4 candidates per ward (aim for ~10 total). Each has a unique `slug` (e.g. `koramangala-r-menon`), `wardId`, `name`, `photoUrl` set to `https://api.dicebear.com/9.x/initials/svg?seed=<name>`, `party` (mix of parties and `'Independent'`), and every `Sourced<string>` field populated. Set `source.type` to `'affidavit'` for `pendingCases`, `assets`, `education` (label `'EC affidavit'`) and `'curator'` for `trackRecord`, `approachability` (label `'Curator-compiled'`). Give 1–2 `news` links each with plausible publisher/title and `url: '#'`.

`users.ts` — export `seedUsers: User[]`:
```ts
import type { User } from '../types'
export const seedUsers: User[] = [
  { id: 'u-citizen', name: 'Asha Rao', contact: 'asha@example.com', role: 'citizen',
    homeWardId: 'koramangala', language: 'en', active: true },
  { id: 'u-curator', name: 'Vikram Shet', contact: 'vikram@example.com', role: 'curator',
    language: 'en', curatorWardIds: ['koramangala', 'indiranagar'], active: true },
  { id: 'u-admin', name: 'Admin', contact: 'admin@example.com', role: 'admin',
    language: 'en', active: true },
]
```

`submissions.ts` — export `seedSubmissions: Submission[]` with 3 examples in Koramangala/Indiranagar (one `pending`, one `accepted`, one `rejected` with a `reason`), `submittedByUserId: 'u-citizen'`, realistic `field`/`detail`, fixed `createdAt` ISO strings, `count` 1–3.

`audit.ts` — export `seedAudit: AuditEntry[]` with 2 entries (fixed `at`, `actorUserId: 'u-curator'`, e.g. `action: 'candidate.assets.updated'`).

Also export `seedIssueVotes: IssueVote[]` (put it in `issues.ts`) with a handful of votes across Koramangala issues so public tallies are non-empty, e.g. 3 anonymous-seed userIds voting overlapping `issueIds`.

`index.ts`:
```ts
import { seedWards } from './wards'
import { seedCandidates } from './candidates'
import { seedIssues, seedIssueVotes } from './issues'
import { seedUsers } from './users'
import { seedSubmissions } from './submissions'
import { seedAudit } from './audit'
export const seed = {
  wards: seedWards, candidates: seedCandidates, issues: seedIssues,
  issueVotes: seedIssueVotes, users: seedUsers,
  submissions: seedSubmissions, audit: seedAudit,
}
```

- [ ] **Step 4: Run test to verify it passes** — Run: `npm run test -- data.test` · Expected: PASS. Then `npm run typecheck` clean.

- [ ] **Step 5: Commit**

```bash
git add prototype/src/data && git commit -m "feat: seed mock data"
```

---

### Task 4: Store — state, persistence, selectors

**Files:**
- Create: `prototype/src/store/store.ts`
- Test: `prototype/src/store/store.test.ts`

**Interfaces:**
- Consumes: `seed` from `../data`, all types.
- Produces: class/factory `createStore()` returning an object with immutable snapshot `getState(): StoreState` and read selectors: `getWard(id)`, `listWards()`, `getCandidate(slug)`, `listCandidatesByWard(wardId)`, `listIssues(wardId)`, `issueTally(wardId): {issueId,count}[]` (ranked desc), `listQueueForCurator(user)`, `getSubmission(id)`, `listSubmissionsByUser(userId)`, `listAudit()`, `listUsers()`. Plus `subscribe(fn)`, `reset()`, and a monotonic `stamp()` for ids/timestamps. `StoreState = { wards, candidates, issues, issueVotes, users, submissions, audit }`.

- [ ] **Step 1: Write failing tests** `prototype/src/store/store.test.ts`

```ts
import { createStore } from './store'

test('seeds from mock data and persists to localStorage', () => {
  const s = createStore()
  expect(s.listWards().length).toBeGreaterThanOrEqual(4)
  expect(localStorage.getItem('bv-store')).toBeTruthy()
})

test('rehydrates from localStorage on second construction', () => {
  const s1 = createStore()
  const id = s1.stamp()
  const s2 = createStore()
  expect(s2.stamp()).not.toBe(id) // monotonic across reload
})

test('issueTally returns issues ranked by vote count desc', () => {
  const s = createStore()
  const tally = s.issueTally('koramangala')
  for (let i = 1; i < tally.length; i++)
    expect(tally[i - 1].count).toBeGreaterThanOrEqual(tally[i].count)
})

test('getCandidate resolves by slug', () => {
  const s = createStore()
  const first = s.listWards()[0]
  const cands = s.listCandidatesByWard(first.id)
  expect(s.getCandidate(cands[0].slug)?.id).toBe(cands[0].id)
})

test('reset restores seed state', () => {
  const s = createStore()
  s.reset()
  expect(s.listWards().length).toBeGreaterThanOrEqual(4)
})
```

- [ ] **Step 2: Run to verify fail** — Run: `npm run test -- store.test` · Expected: FAIL (module not found).

- [ ] **Step 3: Implement `store.ts`**

Implement `createStore()`:
- Key `const KEY = 'bv-store'`. On construct: read `localStorage[KEY]`; if present `JSON.parse` into state, else deep-clone `seed` (via `structuredClone`) and persist.
- Hold `state: StoreState` and `listeners: Set<() => void>`.
- `persist()` writes `JSON.stringify(state)` to `localStorage`; call after every mutation, then notify listeners.
- `subscribe(fn)` adds to `listeners`, returns an unsubscribe fn.
- `stamp()` returns a string counter persisted in `state` (`state.seq = (state.seq ?? baseFromLength) + 1`) so ids/timestamps are unique and monotonic without `Date.now()`; format timestamps as `` `t${seq}` `` — a synthetic ordered clock (fine for a prototype; avoids the banned `Date.now()`).
- Selectors read from `state`; `issueTally` counts `issueVotes` whose `issueIds` include each issue of the ward, returns `{issueId,count}` sorted desc.
- `listQueueForCurator(user)` returns submissions whose `wardId` ∈ `user.curatorWardIds` (admins see all).
- `reset()` sets `state = structuredClone(seed)`, persists, notifies.
- Export the mutation actions as stubs here returning void — they are fully implemented in Task 5 (implement them now to keep one file; Task 5 adds their tests). Keep `getState()` returning a `structuredClone(state)` so consumers can't mutate internals.

- [ ] **Step 4: Run to verify pass** — Run: `npm run test -- store.test` · Expected: PASS. `npm run typecheck` clean.

- [ ] **Step 5: Commit**

```bash
git add prototype/src/store && git commit -m "feat: store state, persistence, selectors"
```

---

### Task 5: Store — contribution actions

**Files:**
- Modify: `prototype/src/store/store.ts`
- Test: `prototype/src/store/actions.test.ts`

**Interfaces:**
- Produces on the store object: `submitFlag(input, user): Submission`, `castIssueVote(user, wardId, issueIds): IssueVote`, `acceptSubmission(id, curator, edit): void`, `rejectSubmission(id, curator, reason): void`, `updateCandidate(slug, patch, curator): void`, `updateWard(id, patch, curator): void`, `setWardIssues(wardId, issues, curator): void`, `setUserActive(userId, active, admin): void`, `setUserRole(userId, role, wardIds, admin): void`. `edit` for accept = `{ candidateSlug?, field?, value?, source? }`.

- [ ] **Step 1: Write failing tests** `prototype/src/store/actions.test.ts`

```ts
import { createStore } from './store'

const curator = () => createStore().listUsers().find(u => u.role === 'curator')!
const citizen = () => createStore().listUsers().find(u => u.role === 'citizen')!

test('castIssueVote rejects more than 3 issues', () => {
  const s = createStore()
  expect(() => s.castIssueVote(citizen(), 'koramangala',
    ['kor-roads', 'kor-water', 'kor-waste', 'kor-roads'])).toThrow(/top 3/i)
})

test('castIssueVote only allows the home ward', () => {
  const s = createStore()
  expect(() => s.castIssueVote(citizen(), 'indiranagar', ['ind-traffic'])).toThrow(/home ward/i)
})

test('castIssueVote replaces the user prior vote-set (dedup)', () => {
  const s = createStore()
  s.castIssueVote(citizen(), 'koramangala', ['kor-roads'])
  s.castIssueVote(citizen(), 'koramangala', ['kor-water'])
  const mine = s.getState().issueVotes.filter(v => v.userId === 'u-citizen' && v.wardId === 'koramangala')
  expect(mine).toHaveLength(1)
  expect(mine[0].issueIds).toEqual(['kor-water'])
})

test('submitFlag routes to the scoped curator queue and dedups by field', () => {
  const s = createStore()
  s.submitFlag({ wardId: 'koramangala', candidateId: 'c1', field: 'assets', detail: 'wrong' }, citizen())
  s.submitFlag({ wardId: 'koramangala', candidateId: 'c1', field: 'assets', detail: 'also wrong' }, citizen())
  const q = s.listQueueForCurator(curator())
  const item = q.find(i => i.field === 'assets' && i.candidateId === 'c1')!
  expect(item.count).toBe(2)
})

test('acceptSubmission publishes the edit and writes an audit entry', () => {
  const s = createStore()
  const sub = s.submitFlag({ wardId: 'koramangala', candidateId: s.listCandidatesByWard('koramangala')[0].id,
    field: 'assets', detail: 'x' }, citizen())
  const slug = s.listCandidatesByWard('koramangala')[0].slug
  const before = s.listAudit().length
  s.acceptSubmission(sub.id, curator(),
    { candidateSlug: slug, field: 'assets', value: '₹9,99,99,999',
      source: { type: 'affidavit', label: 'EC affidavit' } })
  expect(s.getSubmission(sub.id)?.status).toBe('accepted')
  expect(s.getCandidate(slug)?.assets.value).toBe('₹9,99,99,999')
  expect(s.listAudit().length).toBe(before + 1)
})

test('rejectSubmission records a reason', () => {
  const s = createStore()
  const sub = s.submitFlag({ wardId: 'koramangala', field: 'name', detail: 'x' }, citizen())
  s.rejectSubmission(sub.id, curator(), 'Not supported by source')
  expect(s.getSubmission(sub.id)?.status).toBe('rejected')
  expect(s.getSubmission(sub.id)?.reason).toMatch(/source/i)
})

test('curator cannot act outside their ward scope', () => {
  const s = createStore()
  const sub = s.submitFlag({ wardId: 'malleshwaram', field: 'name', detail: 'x' }, citizen())
  expect(() => s.rejectSubmission(sub.id, curator(), 'no')).toThrow(/scope/i)
})
```

- [ ] **Step 2: Run to verify fail** — Run: `npm run test -- actions.test` · Expected: FAIL.

- [ ] **Step 3: Implement the actions in `store.ts`**

- `submitFlag(input, user)`: if an existing pending submission matches `wardId+candidateId+field`, increment its `count` and return it; else push a new `Submission` (`id = 'sub-'+stamp()`, `status:'pending'`, `count:1`, `createdAt: 't'+stamp()`). Persist, audit (`action:'flag.submitted'`).
- `castIssueVote(user, wardId, issueIds)`: throw `Error('You can vote your top 3 issues')` if `issueIds.length > 3` or duplicates; throw `Error('You can only vote in your home ward')` if `wardId !== user.homeWardId`; remove any existing vote-set for `(userId,wardId)`, push new one. Persist, audit.
- `acceptSubmission(id, curator, edit)`: guard `submission.wardId ∈ curator.curatorWardIds || curator.role==='admin'` else throw `Error('Outside your ward scope')`; if `edit.candidateSlug` set, apply `edit.value`+`edit.source` to that candidate `field`; set status `accepted`; persist; audit (`action: 'candidate.'+field+'.updated'`).
- `rejectSubmission(id, curator, reason)`: same scope guard; set status `rejected`, `reason`; persist; audit.
- `updateCandidate/updateWard/setWardIssues`: scope-guarded patches used by curator edit pages; each persists + audits.
- `setUserActive/setUserRole`: require `admin.role==='admin'`; persist + audit.
- Reuse a private `requireScope(user, wardId)` helper.

- [ ] **Step 4: Run to verify pass** — Run: `npm run test -- actions.test` · Expected: PASS. `npm run typecheck` clean.

- [ ] **Step 5: Commit**

```bash
git add prototype/src/store && git commit -m "feat: store contribution actions with scope + vote rules"
```

---

### Task 6: I18n context (stub)

**Files:**
- Create: `prototype/src/context/I18nContext.tsx`
- Test: `prototype/src/context/I18nContext.test.tsx`

**Interfaces:**
- Produces: `I18nProvider`, `useI18n(): { lang: 'en'|'kn'; setLang(l): void; t(key: string): string }`. `t` returns the English catalogue value or the key itself if missing (Kannada catalogue empty).

- [ ] **Step 1: Write failing test**

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { I18nProvider, useI18n } from './I18nContext'

function Probe() {
  const { lang, setLang } = useI18n()
  return <button onClick={() => setLang(lang === 'en' ? 'kn' : 'en')}>{lang}</button>
}
test('toggles language state', async () => {
  render(<I18nProvider><Probe /></I18nProvider>)
  expect(screen.getByRole('button')).toHaveTextContent('en')
  await userEvent.click(screen.getByRole('button'))
  expect(screen.getByRole('button')).toHaveTextContent('kn')
})
```

- [ ] **Step 2: Run to verify fail** · Run: `npm run test -- I18nContext` · Expected: FAIL.

- [ ] **Step 3: Implement** — Context holding `lang` (default `'en'`) with `useState`; `t(key)` looks up a small `en` record and falls back to `key`. `useI18n` throws if used outside provider.

- [ ] **Step 4: Run to verify pass** · Expected: PASS.

- [ ] **Step 5: Commit** — `git add prototype/src/context && git commit -m "feat: i18n context stub"`

---

### Task 7: Auth context with resume-in-place

**Files:**
- Create: `prototype/src/context/AuthContext.tsx`
- Test: `prototype/src/context/AuthContext.test.tsx`

**Interfaces:**
- Consumes: store (via a passed instance or DataContext — for this task accept a `store` prop on the provider to keep it testable).
- Produces: `AuthProvider`, `useAuth(): { user: User; role: Role; isAuthed: boolean; loginAs(userId): void; loginNew(contact, homeWardId): void; logout(): void; pendingAction: (() => void) | null; requireAuth(action: () => void): void; resolvePending(): void }`. Anonymous is represented by a synthetic user `{ id:'anon', role:'anonymous', ... }`. `requireAuth(action)`: if authed run `action()` immediately; else stash it in `pendingAction` (the modal calls `resolvePending()` after login).

- [ ] **Step 1: Write failing test**

```tsx
import { render, screen, act } from '@testing-library/react'
import { AuthProvider, useAuth } from './AuthContext'
import { createStore } from '../store/store'

let captured: ReturnType<typeof useAuth>
function Probe() { captured = useAuth(); return <div>{captured.role}</div> }

test('requireAuth stashes action when anonymous, runs after login', () => {
  const store = createStore()
  render(<AuthProvider store={store}><Probe /></AuthProvider>)
  expect(screen.getByText('anonymous')).toBeInTheDocument()
  let ran = false
  act(() => captured.requireAuth(() => { ran = true }))
  expect(ran).toBe(false)          // gated
  act(() => captured.loginAs('u-citizen'))
  act(() => captured.resolvePending())
  expect(ran).toBe(true)           // resumed in place
  expect(captured.role).toBe('citizen')
})
```

- [ ] **Step 2: Run to verify fail** · Expected: FAIL.

- [ ] **Step 3: Implement** — persist the current userId in `localStorage['bv-auth']`; `loginAs` looks up a seed user; `loginNew(contact, homeWardId)` creates a transient citizen user via `store` and logs in; `requireAuth`/`resolvePending` manage `pendingAction`. Default to anonymous when no stored id.

- [ ] **Step 4: Run to verify pass** · Expected: PASS.

- [ ] **Step 5: Commit** — `git commit -am "feat: auth context with gated resume-in-place"`

---

### Task 8: Data context + app providers wiring

**Files:**
- Create: `prototype/src/context/DataContext.tsx`
- Modify: `prototype/src/App.tsx`
- Test: `prototype/src/context/DataContext.test.tsx`

**Interfaces:**
- Produces: `DataProvider` (creates a single `createStore()` instance, subscribes, forces re-render on change), `useData(): Store` (the store object), `useStoreVersion()` (a counter that bumps on store change to trigger re-renders). `App` wraps `DataProvider > AuthProvider > I18nProvider > RouterProvider` (routes added in Task 9).

- [ ] **Step 1: Write failing test** — render a probe under `DataProvider`, call `useData().castIssueVote(...)`, assert `useData().issueTally` reflects it after `act`.

```tsx
import { render, screen, act } from '@testing-library/react'
import { DataProvider, useData } from './DataContext'

let store: ReturnType<typeof useData>
function Probe() { store = useData(); return <div>{store.listWards().length}</div> }
test('provides a live store', () => {
  render(<DataProvider><Probe /></DataProvider>)
  expect(screen.getByText(/[0-9]/)).toBeInTheDocument()
  act(() => { store.reset() })
  expect(store.listWards().length).toBeGreaterThanOrEqual(4)
})
```

- [ ] **Step 2: Run to verify fail** · Expected: FAIL.

- [ ] **Step 3: Implement DataContext**; update `App.tsx` to nest providers (leave a placeholder `<div>` where routes will mount).

- [ ] **Step 4: Run to verify pass**; `npm run typecheck` clean.

- [ ] **Step 5: Commit** — `git commit -am "feat: data context and provider wiring"`

---

### Task 9: Shell, routing, shared components

**Files:**
- Create: `prototype/src/components/AppBar.tsx`, `Footer.tsx`, `DevRoleSwitcher.tsx`, `Modal.tsx`, `SourceBadge.tsx`, `RoleGuard.tsx`, `GatedButton.tsx`, `prototype/src/routes.tsx`
- Modify: `prototype/src/App.tsx`
- Test: `prototype/src/routes.test.tsx`

**Interfaces:**
- Produces: `AppBar` (logo link `/`, language toggle from `useI18n`, Sign in/Account control, and `DevRoleSwitcher`), `Footer` (About + voting-guide links), `Modal({open,onClose,title,children})` (overlay, no route change, closes on Esc/backdrop), `SourceBadge({source})` (colored `official`/`curated` pill with label + optional link), `RoleGuard({allow, children})` (redirects to `/` if `useAuth().role` not in `allow`), `GatedButton({onAct, children})` (calls `useAuth().requireAuth(onAct)` and opens the login modal when gated — exposes a render-prop or context hook for the modal). `router` built with `createBrowserRouter([...], { basename: '/bangalore-votes' })`, a root layout element = `<AppBar/><Outlet/><Footer/>`. Every IA path maps to its page component (import placeholders that Tasks 13–22 replace).

- [ ] **Step 1: Write failing test** `routes.test.tsx`

```tsx
import { render, screen } from '@testing-library/react'
import { RouterProvider, createMemoryRouter } from 'react-router-dom'
import { routeObjects } from './routes'
import { AppProviders } from './App'

test('renders the home route inside the shell', () => {
  const router = createMemoryRouter(routeObjects, { initialEntries: ['/'] })
  render(<AppProviders><RouterProvider router={router} /></AppProviders>)
  expect(screen.getByRole('banner')).toBeInTheDocument() // AppBar
})
```

Export `routeObjects` (array) separately from the `basename`-bound `router`, and an `AppProviders` wrapper (Data > Auth > I18n) from `App.tsx` so tests can use a memory router.

- [ ] **Step 2: Run to verify fail** · Expected: FAIL.

- [ ] **Step 3: Implement** the shell components and `routes.tsx`. Create thin placeholder page components returning `<h1>{title}</h1>` for all 26 pages now (Tasks 13–22 flesh them out) so routing compiles. `AppBar` uses `role="banner"`; `Footer` uses `role="contentinfo"`. `DevRoleSwitcher` renders a small labelled `⚙ Prototype` dropdown: Anonymous / Citizen (Asha) / Curator (Vikram) / Admin, calling `loginAs`/`logout`; include a "Reset demo data" item calling `useData().reset()`.

- [ ] **Step 4: Run to verify pass**; `npm run build` succeeds.

- [ ] **Step 5: Commit** — `git commit -am "feat: app shell, routing, shared components"`

---

### Task 10: Register/Login modal (+ /login fallback)

**Files:**
- Create: `prototype/src/components/modals/RegisterLogin.tsx`, `prototype/src/pages/public/Login.tsx`, a `ModalContext` in `prototype/src/context/ModalContext.tsx` to let any GatedButton open it.
- Modify: `routes.tsx` (add `/login`), `App.tsx` (mount `ModalProvider`)
- Test: `prototype/src/components/modals/RegisterLogin.test.tsx`

**Interfaces:**
- Produces: `ModalProvider`, `useModal(): { openLogin(): void; openFlag(ctx): void; openVote(ctx): void; close(): void }`. `RegisterLogin` shows: contact input → "Send OTP" → OTP step displaying the "sent" code (any 6-digit accepted) → confirm home ward (select from `listWards`) + language → on success calls `loginNew` then `resolvePending()` and closes.

- [ ] **Step 1: Write failing test** — render with an anonymous auth + a pending action; drive contact → OTP → ward; assert `useAuth().isAuthed` true and pending action ran.

- [ ] **Step 2: Run to verify fail** · Expected: FAIL.

- [ ] **Step 3: Implement** modal + `ModalContext`; `/login` page renders the same form full-page.

- [ ] **Step 4: Run to verify pass**.

- [ ] **Step 5: Commit** — `git commit -am "feat: register/login modal with OTP simulation"`

---

### Task 11: Flag misinformation modal

**Files:**
- Create: `prototype/src/components/modals/FlagMisinformation.tsx`
- Test: `prototype/src/components/modals/FlagMisinformation.test.tsx`

**Interfaces:**
- Consumes: `useModal` context (`openFlag({wardId, candidateId?, fields})`), `useData().submitFlag`, `useAuth`.
- Produces: a modal that lets the user pick a field from `fields`, enter detail + optional source URL, submit. If anonymous, `requireAuth` opens login first, then the flag modal reopens (resume-in-place).

- [ ] **Step 1: Write failing test** — as a logged-in citizen, open flag for a candidate field, submit, assert a submission with `count:1` exists in the store for that field.

- [ ] **Step 2: Run to verify fail** · Expected: FAIL.
- [ ] **Step 3: Implement**.
- [ ] **Step 4: Run to verify pass**.
- [ ] **Step 5: Commit** — `git commit -am "feat: flag misinformation modal"`

---

### Task 12: Cast issue vote modal

**Files:**
- Create: `prototype/src/components/modals/CastIssueVote.tsx`
- Test: `prototype/src/components/modals/CastIssueVote.test.tsx`

**Interfaces:**
- Consumes: `useModal` (`openVote({wardId})`), `useData().castIssueVote`, `useAuth`.
- Produces: a modal listing the ward's issues with checkboxes capped at 3 (4th disabled), submit; shows an inline error if `wardId !== user.homeWardId` ("You can vote only in your home ward, <name>").

- [ ] **Step 1: Write failing test** — logged-in citizen (home ward koramangala) selects 3 issues, submits, `issueTally` reflects them; selecting a 4th is prevented.
- [ ] **Step 2: Run to verify fail** · Expected: FAIL.
- [ ] **Step 3: Implement**.
- [ ] **Step 4: Run to verify pass**.
- [ ] **Step 5: Commit** — `git commit -am "feat: cast issue vote modal"`

---

### Task 13: Home + WardSearch

**Files:**
- Create: `prototype/src/components/WardSearch.tsx`, replace `prototype/src/pages/public/Home.tsx`
- Test: `prototype/src/pages/public/Home.test.tsx`

**Interfaces:**
- Produces: `WardSearch` — a text input + list filtered over `listWards()` by name; selecting navigates to `/ward/{id}`. `Home` renders: hero with election status + a static countdown banner (fixed target date string from a constant), `WardSearch`, and shortcut cards to Check registration and Voting guide.

- [ ] **Step 1: Write failing test** — render Home in a memory router, type "kora", click the result, assert navigation to `/ward/koramangala` (assert the ward page heading or `router.state.location.pathname`).
- [ ] **Step 2: Run to verify fail** · Expected: FAIL.
- [ ] **Step 3: Implement**.
- [ ] **Step 4: Run to verify pass**.
- [ ] **Step 5: Commit** — `git commit -am "feat: home page and ward search"`

---

### Task 14: Ward result + Candidates in ward

**Files:**
- Create: `prototype/src/components/CandidateCard.tsx`, replace `pages/public/WardResult.tsx`, `pages/public/WardCandidates.tsx`
- Test: `prototype/src/pages/public/WardResult.test.tsx`

**Interfaces:**
- Produces: `WardResult` (`/ward/:id`) — ward name/number/corporation, `oldWardsNote`, a static map placeholder box, a "Set as my ward" button (visible when authed citizen; calls a store `setHomeWard` or reuses profile update), links to Candidates, Issues, Voting guide. `WardCandidates` (`/ward/:id/candidates`) — list of `CandidateCard` (photo, name, party) + a Compare entry point; empty-state text when the ward has no candidates. `CandidateCard({candidate})` links to `/candidate/{slug}`.

- [ ] **Step 1: Write failing test** — render `/ward/koramangala`, assert ward name + corporation shown; render `/ward/koramangala/candidates`, assert candidate names shown and a Compare link exists.
- [ ] **Step 2: Run to verify fail** · Expected: FAIL.
- [ ] **Step 3: Implement**. (Add `setHomeWard(userId, wardId)` to the store if not present, audited.)
- [ ] **Step 4: Run to verify pass**.
- [ ] **Step 5: Commit** — `git commit -am "feat: ward result and candidates pages"`

---

### Task 15: Candidate report card

**Files:**
- Replace `pages/public/CandidateReport.tsx`
- Test: `pages/public/CandidateReport.test.tsx`

**Interfaces:**
- Consumes: `getCandidate(slug)`, `SourceBadge`, `useModal().openFlag`.
- Produces: `CandidateReport` (`/candidate/:slug`) rendering every field (name, photo, party, trackRecord, pendingCases, assets, education, approachability) each with its `SourceBadge`, a **News & coverage** list of links, and a **Flag an error** button per flaggable field (opens the flag modal with `{wardId, candidateId, fields}`). Affidavit vs curator sources render with distinct badge colors.

- [ ] **Step 1: Write failing test** — render a candidate, assert track record text, an "EC affidavit" badge and a "Curator-compiled" badge both present, and clicking "Flag an error" opens the flag modal (assert modal heading).
- [ ] **Step 2: Run to verify fail** · Expected: FAIL.
- [ ] **Step 3: Implement**.
- [ ] **Step 4: Run to verify pass**.
- [ ] **Step 5: Commit** — `git commit -am "feat: candidate report card with sources and flagging"`

---

### Task 16: Compare candidates

**Files:**
- Replace `pages/public/Compare.tsx`
- Test: `pages/public/Compare.test.tsx`

**Interfaces:**
- Produces: `Compare` (`/ward/:id/compare`) — a column-per-candidate table with one row per report-card field so rows line up; horizontal scroll on narrow screens (`overflow-x-auto`, min column width). Header row shows photo/name/party.

- [ ] **Step 1: Write failing test** — render `/ward/koramangala/compare`, assert each candidate name appears as a column header and a known field label ("Declared assets") appears once as a row label.
- [ ] **Step 2: Run to verify fail** · Expected: FAIL.
- [ ] **Step 3: Implement**.
- [ ] **Step 4: Run to verify pass**.
- [ ] **Step 5: Commit** — `git commit -am "feat: candidate comparison view"`

---

### Task 17: Ward issues & voting

**Files:**
- Replace `pages/public/WardIssues.tsx`
- Test: `pages/public/WardIssues.test.tsx`

**Interfaces:**
- Consumes: `listIssues(wardId)`, `issueTally(wardId)`, `useModal().openVote`, `useAuth`.
- Produces: `WardIssues` (`/ward/:id/issues`) — the curator-defined issue list, public **ranked results** from `issueTally` (bar or ordered list with counts), and a "Vote your top 3" button that opens the vote modal (login-gated for anonymous). Shows a note that voting is limited to the home ward.

- [ ] **Step 1: Write failing test** — render `/ward/koramangala/issues`, assert issue titles render and ranked results appear in non-increasing count order (assert first listed count ≥ second).
- [ ] **Step 2: Run to verify fail** · Expected: FAIL.
- [ ] **Step 3: Implement**.
- [ ] **Step 4: Run to verify pass**.
- [ ] **Step 5: Commit** — `git commit -am "feat: ward issues and public voting results"`

---

### Task 18: Remaining public pages (static)

**Files:**
- Replace `pages/public/CheckRegistration.tsx`, `AboutElection.tsx`, `VotingGuide.tsx`, `VoterId.tsx`, `HowToVote.tsx`, `FindBooth.tsx`, `About.tsx`
- Test: `pages/public/staticPages.test.tsx`

**Interfaces:**
- Produces: seven mostly-static informational pages matching the IA key-elements. `CheckRegistration` and `FindBooth` include a lookup input that returns a canned result card + an external EC link (`href="#"`). `VotingGuide` links to the three sub-guides. `VoterId`/`HowToVote` render numbered step lists. `AboutElection` shows the countdown banner + explainer. `About` explains sourcing/neutrality and links to the audit concept.

- [ ] **Step 1: Write failing test** — a parametrized test rendering each route and asserting its `<h1>` text is present (7 assertions).
- [ ] **Step 2: Run to verify fail** · Expected: FAIL.
- [ ] **Step 3: Implement** all seven with real copy (2–4 short paragraphs / step lists each; no lorem ipsum).
- [ ] **Step 4: Run to verify pass**.
- [ ] **Step 5: Commit** — `git commit -am "feat: static public info pages"`

---

### Task 19: Registered citizen pages

**Files:**
- Replace `pages/account/Account.tsx`, `Notifications.tsx`, `Submissions.tsx`
- Test: `pages/account/account.test.tsx`

**Interfaces:**
- Consumes: `useAuth().user`, `listSubmissionsByUser`, store profile updates (`setLanguagePref`, `setHomeWard`, `setNotificationPrefs` — add to store, audited).
- Produces: `Account` (`/account`) — saved language preference select, home ward display/select, basic profile; wrapped in `RoleGuard allow={['citizen','curator','admin']}`. `Notifications` (`/account/notifications`) — email/WhatsApp channel toggles + ward-update subscription toggles (persisted). `Submissions` (`/account/submissions`) — the user's flags with status pill (pending/accepted/rejected) + reason.

- [ ] **Step 1: Write failing test** — logged in as citizen, seed a flag by them, render `/account/submissions`, assert its field + status pill appear; render `/account`, change language select, assert `useData` user language updated.
- [ ] **Step 2: Run to verify fail** · Expected: FAIL.
- [ ] **Step 3: Implement** (add the store profile mutations).
- [ ] **Step 4: Run to verify pass**.
- [ ] **Step 5: Commit** — `git commit -am "feat: registered citizen account pages"`

---

### Task 20: Curator dashboard, queue, submission review

**Files:**
- Replace `pages/curator/Dashboard.tsx`, `Queue.tsx`, `SubmissionReview.tsx`
- Test: `pages/curator/queue.test.tsx`

**Interfaces:**
- Consumes: `listQueueForCurator`, `getSubmission`, `acceptSubmission`, `rejectSubmission`.
- Produces: `Dashboard` (`/curator`) — review-queue count + quick links, scoped to curator wards, `RoleGuard allow={['curator','admin']}`. `Queue` (`/curator/queue`) — deduped items with counts, link to review. `SubmissionReview` (`/curator/queue/:id`) — shows flag/current value/source; Accept form (edit value + attach source) publishes immediately; Reject form (reason). After action, redirect to queue.

- [ ] **Step 1: Write failing test** — as curator, seed a flag on a Koramangala candidate `assets` field, render `/curator/queue/:id`, fill the accept form, submit, assert the candidate's `assets` updated in store and status `accepted`.
- [ ] **Step 2: Run to verify fail** · Expected: FAIL.
- [ ] **Step 3: Implement**.
- [ ] **Step 4: Run to verify pass**.
- [ ] **Step 5: Commit** — `git commit -am "feat: curator queue and submission review"`

---

### Task 21: Curator edit candidate / ward / issues

**Files:**
- Replace `pages/curator/EditCandidate.tsx`, `EditWard.tsx`, `WardIssuesEdit.tsx`
- Test: `pages/curator/edit.test.tsx`

**Interfaces:**
- Consumes: `updateCandidate`, `updateWard`, `setWardIssues`.
- Produces: `EditCandidate` (`/curator/candidate/:id`) — form over report-card fields with a required source selector per field, manage news links (add/remove); saves publish immediately. `EditWard` (`/curator/ward/:id`) — ward metadata + note. `WardIssuesEdit` (`/curator/ward/:id/issues`) — add/edit/remove the votable issue list; all `RoleGuard allow={['curator','admin']}` and scope-checked.

- [ ] **Step 1: Write failing test** — as curator, render edit-issues for koramangala, add an issue, submit, assert `listIssues('koramangala')` grew and public `/ward/koramangala/issues` would show it (assert store state).
- [ ] **Step 2: Run to verify fail** · Expected: FAIL.
- [ ] **Step 3: Implement**.
- [ ] **Step 4: Run to verify pass**.
- [ ] **Step 5: Commit** — `git commit -am "feat: curator edit candidate/ward/issues"`

---

### Task 22: Admin pages

**Files:**
- Replace `pages/admin/Console.tsx`, `Roles.tsx`, `Users.tsx`, `Audit.tsx`
- Test: `pages/admin/admin.test.tsx`

**Interfaces:**
- Consumes: `listUsers`, `setUserRole`, `setUserActive`, `listAudit`.
- Produces: `Console` (`/admin`) — links, `RoleGuard allow={['admin']}`. `Roles` (`/admin/roles`) — grant/revoke curator role + assign ward scope (multi-select of wards). `Users` (`/admin/users`) — user list with deactivate/ban (active toggle). `Audit` (`/admin/audit`) — full audit log table (at, actor, action, ward, detail), newest first.

- [ ] **Step 1: Write failing test** — as admin, render `/admin/users`, toggle a user inactive, assert `listUsers()` reflects `active:false`; render `/admin/audit`, assert seed audit rows present.
- [ ] **Step 2: Run to verify fail** · Expected: FAIL.
- [ ] **Step 3: Implement**.
- [ ] **Step 4: Run to verify pass**.
- [ ] **Step 5: Commit** — `git commit -am "feat: admin console, roles, users, audit"`

---

### Task 23: Deployment workflow + README

**Files:**
- Create: `.github/workflows/deploy-prototype.yml`, `prototype/README.md`
- Test: manual (CI) + local build.

**Interfaces:**
- Produces: a Pages deployment on push to `main`.

- [ ] **Step 1: Write the workflow** `.github/workflows/deploy-prototype.yml`

```yaml
name: Deploy prototype to Pages
on:
  push:
    branches: [main]
    paths: ['prototype/**', '.github/workflows/deploy-prototype.yml']
  workflow_dispatch:
permissions:
  contents: read
  pages: write
  id-token: write
concurrency:
  group: pages
  cancel-in-progress: true
jobs:
  build:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: prototype
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: npm, cache-dependency-path: prototype/package-lock.json }
      - run: npm ci
      - run: npm run typecheck
      - run: npm run test
      - run: npm run build
      - uses: actions/upload-pages-artifact@v3
        with: { path: prototype/dist }
  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```

- [ ] **Step 2: Write `prototype/README.md`** — how to run (`cd prototype && npm install && npm run dev`), build, test, and a note that it's a mock-data prototype deployed to `https://snarayanank2.github.io/bangalore-votes/`; and the one-time repo setting (Settings → Pages → Source = GitHub Actions).

- [ ] **Step 3: Ensure `package-lock.json` is committed** — Run (from `prototype/`): `npm install` then verify `prototype/package-lock.json` exists.

- [ ] **Step 4: Full local verification** — Run (from `prototype/`): `npm run typecheck && npm run test && npm run build` · Expected: all pass; `dist/index.html` and `dist/404.html` present.

- [ ] **Step 5: Commit**

```bash
git add .github/workflows/deploy-prototype.yml prototype/README.md prototype/package-lock.json
git commit -m "ci: deploy prototype to GitHub Pages"
```

---

## Post-implementation (manual, by the user)

1. Merge the `prototype` branch to `main` (PR or fast-forward).
2. In GitHub → Settings → Pages, set **Source = GitHub Actions** (one time).
3. Watch the Actions run; visit `https://snarayanank2.github.io/bangalore-votes/`.

## Verification checklist (run before declaring done)

- `cd prototype && npm run typecheck && npm run test && npm run build` all green.
- Manual smoke in `npm run dev`: anonymous → tap Flag → login modal → resume flag → appears in curator queue → curator accepts → candidate page updates → audit log shows entry → citizen submissions shows "accepted".
- Deep-link refresh works in `npm run preview` (404.html fallback).
