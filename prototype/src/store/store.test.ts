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

// --- Fix (crossward-fix): narrow, aggregate-only vote-count selector for WardIssuesEditor -----

test('issueVoteCounts returns aggregate per-issue counts for a ward, including for a currently-unchecked issue', () => {
  const s = createStore()
  // Seed (src/data/issues.ts): kor-roads and kor-water each appear in all 3 seeded koramangala
  // votes, kor-waste in 1, kor-lighting in none.
  const before = new Map(s.issueVoteCounts('koramangala').map((r) => [r.issueId, r.count]))
  expect(before.get('kor-roads')).toBe(3)
  expect(before.get('kor-water')).toBe(3)
  expect(before.get('kor-waste')).toBe(1)
  expect(before.get('kor-lighting')).toBeUndefined()

  // Unlike issueTally, this selector is NOT scoped to currently-votable issues: unchecking
  // kor-roads from ward.issueIds must not change its aggregate vote count.
  const curator = s.listUsers().find((u) => u.role === 'curator')!
  s.setWardIssues('koramangala', ['kor-water', 'kor-waste', 'kor-lighting'], curator)
  const after = new Map(s.issueVoteCounts('koramangala').map((r) => [r.issueId, r.count]))
  expect(after.get('kor-roads')).toBe(3)
})

test('issueVoteCounts returns [] for a ward with no votes', () => {
  const s = createStore()
  expect(s.issueVoteCounts('shivajinagar')).toEqual([])
})

test('issueVoteCounts rows only ever expose {issueId, count} — no per-user vote choices', () => {
  const s = createStore()
  const rows = s.issueVoteCounts('koramangala')
  expect(rows.length).toBeGreaterThan(0)
  for (const row of rows) expect(Object.keys(row).sort()).toEqual(['count', 'issueId'])
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

// --- Fix 1: read selectors must return deep clones, not live internal refs ----------------

test('mutating a getCandidate result does not corrupt subsequent reads', () => {
  const s = createStore()
  const slug = s.listCandidatesByWard(s.listWards()[0].id)[0].slug
  const c = s.getCandidate(slug)!
  c.assets.value = 'HACKED'
  expect(s.getCandidate(slug)!.assets.value).not.toBe('HACKED')
})

test('mutating a listWards element does not corrupt subsequent reads', () => {
  const s = createStore()
  const ward = s.listWards()[0]
  ward.name = 'HACKED'
  expect(s.listWards()[0].name).not.toBe('HACKED')
})

test('mutating a listAudit element does not corrupt subsequent reads', () => {
  const s = createStore()
  const audit = s.listAudit()
  if (audit.length > 0) {
    audit[0].detail = 'HACKED'
    expect(s.listAudit()[0].detail).not.toBe('HACKED')
  }
})

// --- Fix 3: corrupt localStorage must not crash construction -----------------------------

test('recovers from corrupt localStorage JSON by falling back to seed', () => {
  localStorage.setItem('bv-store', '{not json')
  const s = createStore()
  expect(s.listWards().length).toBeGreaterThanOrEqual(4)
  // The bad value must have been overwritten with valid seed JSON.
  expect(() => JSON.parse(localStorage.getItem('bv-store')!)).not.toThrow()
})

test('recovers from a validly-parsed but wrong-shaped localStorage value', () => {
  localStorage.setItem('bv-store', JSON.stringify({ notAStore: true }))
  const s = createStore()
  expect(s.listWards().length).toBeGreaterThanOrEqual(4)
})

// --- Fix 2: each public mutation persists (and notifies subscribers) exactly once --------

test('a single mutation notifies subscribers exactly once', () => {
  const s = createStore()
  let notifications = 0
  s.subscribe(() => { notifications += 1 })
  const citizen = s.listUsers().find((u) => u.role === 'citizen')!
  s.castIssueVote(citizen, citizen.homeWardId!, [])
  expect(notifications).toBe(1)
})

// --- Fix 4: createUser persists across a fresh createStore() -----------------------------

test('createUser persists across a fresh createStore()', () => {
  const s1 = createStore()
  const user = s1.createUser({ contact: 'new.citizen@example.com', homeWardId: 'koramangala' })
  expect(user.role).toBe('citizen')
  expect(user.active).toBe(true)

  const s2 = createStore()
  const found = s2.listUsers().find((u) => u.id === user.id)
  expect(found).toBeDefined()
  expect(found?.contact).toBe('new.citizen@example.com')
  expect(found?.homeWardId).toBe('koramangala')
})

// --- getCandidateById selector (perf: id lookup without a full getState() clone) ---------

test('getCandidateById resolves by id and deep-clones its result', () => {
  const s = createStore()
  const seeded = s.listCandidatesByWard('koramangala')[0]
  const byId = s.getCandidateById(seeded.id)
  expect(byId?.slug).toBe(seeded.slug)

  byId!.name = 'HACKED'
  expect(s.getCandidateById(seeded.id)!.name).not.toBe('HACKED')
})

test('getCandidateById returns undefined for an unknown id', () => {
  const s = createStore()
  expect(s.getCandidateById('no-such-id')).toBeUndefined()
})

test('createUser writes an audit entry', () => {
  const s = createStore()
  const before = s.listAudit().length
  const user = s.createUser({ contact: 'audited@example.com' })
  const audit = s.listAudit()
  expect(audit.length).toBe(before + 1)
  expect(audit[audit.length - 1].action).toBe('user.created')
  expect(audit[audit.length - 1].actorUserId).toBe(user.id)
})
