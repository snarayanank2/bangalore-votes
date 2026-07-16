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

test('getIssueVote returns the seeded vote-set, then reflects a later replacement', () => {
  const s = createStore()
  // Seed: u-citizen already voted {kor-roads, kor-water} in koramangala (src/data/issues.ts).
  expect(s.getIssueVote('u-citizen', 'koramangala')?.issueIds).toEqual(['kor-roads', 'kor-water'])

  s.castIssueVote(citizen(), 'koramangala', ['kor-waste'])
  expect(s.getIssueVote('u-citizen', 'koramangala')?.issueIds).toEqual(['kor-waste'])
})

test('getIssueVote returns undefined when the user has not voted in that ward', () => {
  const s = createStore()
  expect(s.getIssueVote('u-citizen', 'indiranagar')).toBeUndefined()
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

// --- Controller decisions (override Task 4's first-cut behavior) ---------

test('castIssueVote does not write an audit entry (individual votes stay off the audit trail)', () => {
  const s = createStore()
  const before = s.listAudit().length
  s.castIssueVote(citizen(), 'koramangala', ['kor-roads'])
  expect(s.listAudit().length).toBe(before)
})

test('listQueueForCurator returns pending submissions only, scoped to the curator wards', () => {
  const s = createStore()
  const q = s.listQueueForCurator(curator())
  // Seed has sub-2 (accepted, koramangala) and sub-3 (rejected, indiranagar) — both in the
  // curator's ward scope but must not appear in the review queue because they are not pending.
  expect(q.every(i => i.status === 'pending')).toBe(true)
  expect(q.find(i => i.id === 'sub-2')).toBeUndefined()
  expect(q.find(i => i.id === 'sub-3')).toBeUndefined()

  const admin = s.listUsers().find(u => u.role === 'admin')!
  const adminQ = s.listQueueForCurator(admin)
  expect(adminQ.every(i => i.status === 'pending')).toBe(true)
  expect(adminQ.find(i => i.id === 'sub-2')).toBeUndefined()
  expect(adminQ.find(i => i.id === 'sub-3')).toBeUndefined()
})

// --- Fix 5: pin setUserRole's curatorWardIds-clearing behavior (see comment in store.ts) -----

test('setUserRole clears curatorWardIds when the new role is not curator (intentional, pinned)', () => {
  const s = createStore()
  const admin = s.listUsers().find(u => u.role === 'admin')!
  const c = curator()
  expect(c.curatorWardIds?.length).toBeGreaterThan(0) // sanity: seed curator has ward scope

  s.setUserRole(c.id, 'citizen', undefined, admin)
  const demoted = s.listUsers().find(u => u.id === c.id)!
  expect(demoted.role).toBe('citizen')
  expect(demoted.curatorWardIds).toBeUndefined()
})

test('setUserRole sets curatorWardIds when promoting to curator', () => {
  const s = createStore()
  const admin = s.listUsers().find(u => u.role === 'admin')!
  const citizenUser = citizen()

  s.setUserRole(citizenUser.id, 'curator', ['malleshwaram'], admin)
  const promoted = s.listUsers().find(u => u.id === citizenUser.id)!
  expect(promoted.role).toBe('curator')
  expect(promoted.curatorWardIds).toEqual(['malleshwaram'])
})

// --- Task 14: setHomeWard, backing WardResult's "Set as my ward" action -----------------------

test('setHomeWard updates the user home ward and writes an audit entry', () => {
  const s = createStore()
  const c = citizen()
  expect(c.homeWardId).toBe('koramangala') // sanity: seed citizen starts in koramangala

  const before = s.listAudit().length
  s.setHomeWard(c.id, 'indiranagar')

  const updated = s.listUsers().find(u => u.id === c.id)!
  expect(updated.homeWardId).toBe('indiranagar')
  const audit = s.listAudit()
  expect(audit.length).toBe(before + 1)
  expect(audit[audit.length - 1]?.action).toMatch(/homeWard/i)
})

test('setHomeWard rejects an unknown ward id', () => {
  const s = createStore()
  const c = citizen()
  expect(() => s.setHomeWard(c.id, 'not-a-real-ward')).toThrow(/unknown ward/i)
})

// --- Task 19: setLanguagePref, setNotificationPrefs (account pages) ---------------------------

test('setLanguagePref updates the user language and persists, without writing an audit entry', () => {
  const s = createStore()
  const c = citizen()
  expect(c.language).toBe('en') // sanity: seed citizen starts in English

  const before = s.listAudit().length
  s.setLanguagePref(c.id, 'kn')

  expect(s.listUsers().find((u) => u.id === c.id)?.language).toBe('kn')
  expect(s.listAudit().length).toBe(before) // personal setting — not audited (privacy)
})

test('setLanguagePref persists across a fresh createStore() (reload)', () => {
  const s1 = createStore()
  s1.setLanguagePref(citizen().id, 'kn')
  const s2 = createStore()
  expect(s2.listUsers().find((u) => u.id === 'u-citizen')?.language).toBe('kn')
})

test('setNotificationPrefs updates the user prefs and persists, without writing an audit entry', () => {
  const s = createStore()
  const c = citizen()
  const before = s.listAudit().length

  s.setNotificationPrefs(c.id, {
    emailEnabled: true,
    whatsappEnabled: false,
    subscriptions: { electionNotice: true, rollDeadlines: false, candidateChanges: true },
  })

  const updated = s.listUsers().find((u) => u.id === c.id)
  expect(updated?.notificationPrefs).toEqual({
    emailEnabled: true,
    whatsappEnabled: false,
    subscriptions: { electionNotice: true, rollDeadlines: false, candidateChanges: true },
  })
  expect(s.listAudit().length).toBe(before) // personal setting — not audited (privacy)
})

test('setNotificationPrefs persists across a fresh createStore() (reload)', () => {
  const s1 = createStore()
  s1.setNotificationPrefs(citizen().id, {
    emailEnabled: true,
    whatsappEnabled: true,
    subscriptions: { electionNotice: false, rollDeadlines: true, candidateChanges: false },
  })
  const s2 = createStore()
  expect(s2.listUsers().find((u) => u.id === 'u-citizen')?.notificationPrefs?.whatsappEnabled).toBe(
    true,
  )
})
