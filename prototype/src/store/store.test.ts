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

test('createUser writes an audit entry', () => {
  const s = createStore()
  const before = s.listAudit().length
  const user = s.createUser({ contact: 'audited@example.com' })
  const audit = s.listAudit()
  expect(audit.length).toBe(before + 1)
  expect(audit[audit.length - 1].action).toBe('user.created')
  expect(audit[audit.length - 1].actorUserId).toBe(user.id)
})
