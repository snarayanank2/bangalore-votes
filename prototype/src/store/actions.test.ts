import { createStore, type NewCandidateInput } from './store'
import type { Sourced } from '../types'

const curator = () => createStore().listUsers().find(u => u.role === 'curator')!
const citizen = () => createStore().listUsers().find(u => u.role === 'citizen')!

// --- Task 5 fixtures: ward data-readiness gating (PRD §9.1) ------------------------------------

function validSourced(value: string): Sourced<string> {
  return { value, source: { type: 'affidavit', label: 'EC affidavit' } }
}

/** A field explicitly marked "not declared" — PRD §9.1: a valid, complete answer, not a gap.
 *  Still carries a real source, since it's a fact about the affidavit. */
function notDeclaredSourced(): Sourced<string> {
  return { value: '', source: { type: 'affidavit', label: 'EC affidavit — Form 26' }, notDeclared: true }
}

/** A field with no value and no `notDeclared` marker — a genuine gap, not yet transcribed from
 *  the affidavit (still carries a source, since addCandidate's own guard requires one). */
function gapSourced(): Sourced<string> {
  return { value: '', source: { type: 'affidavit', label: 'EC affidavit' } }
}

function fullCandidateInput(overrides: Partial<NewCandidateInput> = {}): NewCandidateInput {
  return {
    name: 'New Nominee',
    party: 'Independent',
    trackRecord: validSourced('First-time contestant.'),
    pendingCases: validSourced('No pending cases.'),
    assets: validSourced('Rs 10 lakh.'),
    education: validSourced('B.A.'),
    approachability: validSourced('Contactable via phone.'),
    ...overrides,
  }
}

test('castIssueVote rejects more than 3 issues', () => {
  const s = createStore()
  expect(() => s.castIssueVote(citizen(), 'koramangala',
    ['kor-roads', 'kor-water', 'kor-waste', 'kor-roads'])).toThrow(/top 3/i)
})

test('castIssueVote only allows the home ward', () => {
  const s = createStore()
  expect(() => s.castIssueVote(citizen(), 'indiranagar', ['ind-traffic'])).toThrow(/home ward/i)
})

test('castIssueVote throws when a supplied issue id belongs to a different ward, leaving issueVotes + audit unchanged', () => {
  const s = createStore()
  const before = s.getState().issueVotes
  const beforeAuditLen = s.listAudit().length
  // kor-roads is a real koramangala issue, ind-traffic is real but belongs to indiranagar.
  expect(() =>
    s.castIssueVote(citizen(), 'koramangala', ['kor-roads', 'ind-traffic']),
  ).toThrow(/not votable/i)
  expect(s.getState().issueVotes).toEqual(before)
  expect(s.listAudit().length).toBe(beforeAuditLen)
})

test('castIssueVote throws when a supplied issue id is unknown, leaving issueVotes + audit unchanged', () => {
  const s = createStore()
  const before = s.getState().issueVotes
  const beforeAuditLen = s.listAudit().length
  expect(() =>
    s.castIssueVote(citizen(), 'koramangala', ['issue-does-not-exist']),
  ).toThrow(/unknown issue/i)
  expect(s.getState().issueVotes).toEqual(before)
  expect(s.listAudit().length).toBe(beforeAuditLen)
})

test('castIssueVote still accepts a valid, in-ward vote end-to-end', () => {
  const s = createStore()
  const vote = s.castIssueVote(citizen(), 'koramangala', ['kor-lighting', 'kor-waste'])
  expect(vote.issueIds).toEqual(['kor-lighting', 'kor-waste'])
  expect(s.getIssueVote('u-citizen', 'koramangala')?.issueIds).toEqual([
    'kor-lighting',
    'kor-waste',
  ])
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

// --- Fix 2: acceptSubmission must not write a false "accepted" audit trail ------------------

test('acceptSubmission throws when the edit is missing a source for a flag targeting a candidate field', () => {
  const s = createStore()
  const candidateId = s.listCandidatesByWard('koramangala')[0].id
  const slug = s.listCandidatesByWard('koramangala')[0].slug
  const sub = s.submitFlag(
    { wardId: 'koramangala', candidateId, field: 'assets', detail: 'wrong figure' },
    citizen(),
  )
  const before = s.listAudit().length

  expect(() =>
    s.acceptSubmission(sub.id, curator(), { candidateSlug: slug, field: 'assets', value: '₹1' }),
  ).toThrow(/source/i)

  // Nothing was published, status unchanged, no audit entry appended.
  expect(s.getSubmission(sub.id)?.status).toBe('pending')
  expect(s.getCandidate(slug)?.assets.value).not.toBe('₹1')
  expect(s.listAudit().length).toBe(before)
})

test('acceptSubmission throws when the edit is missing entirely for a flag targeting a candidate field', () => {
  const s = createStore()
  const candidateId = s.listCandidatesByWard('koramangala')[0].id
  const sub = s.submitFlag(
    { wardId: 'koramangala', candidateId, field: 'assets', detail: 'wrong figure' },
    citizen(),
  )
  const before = s.listAudit().length

  expect(() => s.acceptSubmission(sub.id, curator(), {})).toThrow(/source/i)
  expect(s.getSubmission(sub.id)?.status).toBe('pending')
  expect(s.listAudit().length).toBe(before)
})

test('acceptSubmission with a complete sourced edit still works end-to-end', () => {
  const s = createStore()
  const candidateId = s.listCandidatesByWard('koramangala')[0].id
  const slug = s.listCandidatesByWard('koramangala')[0].slug
  const sub = s.submitFlag(
    { wardId: 'koramangala', candidateId, field: 'assets', detail: 'wrong figure' },
    citizen(),
  )
  const before = s.listAudit().length

  s.acceptSubmission(sub.id, curator(), {
    candidateSlug: slug,
    field: 'assets',
    value: '₹5,00,000',
    source: { type: 'affidavit', label: 'EC affidavit' },
  })

  expect(s.getSubmission(sub.id)?.status).toBe('accepted')
  expect(s.getCandidate(slug)?.assets.value).toBe('₹5,00,000')
  expect(s.listAudit().length).toBe(before + 1)
})

test('acceptSubmission accepts a flag with no candidate field to publish (documented branch, no source required)', () => {
  const s = createStore()
  // No candidateId at all — a legitimate SubmitFlagInput shape (e.g. a ward-level flag). Uses
  // koramangala (in u-curator's scope) so this pins the "no candidate field" branch specifically,
  // not a scope failure.
  const sub = s.submitFlag({ wardId: 'koramangala', field: 'name', detail: 'ward name typo' }, citizen())
  const before = s.listAudit().length

  expect(() => s.acceptSubmission(sub.id, curator(), {})).not.toThrow()
  expect(s.getSubmission(sub.id)?.status).toBe('accepted')
  expect(s.listAudit().length).toBe(before + 1)
})

test('acceptSubmission accepts a flag with a candidateId but a field that is not a known Sourced field (documented branch)', () => {
  const s = createStore()
  const candidateId = s.listCandidatesByWard('koramangala')[0].id
  // 'party' is a real Candidate field but not one of the five Sourced fields curators can publish.
  const sub = s.submitFlag(
    { wardId: 'koramangala', candidateId, field: 'party', detail: 'wrong party listed' },
    citizen(),
  )
  const before = s.listAudit().length

  expect(() => s.acceptSubmission(sub.id, curator(), {})).not.toThrow()
  expect(s.getSubmission(sub.id)?.status).toBe('accepted')
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
  s.setHomeWard(c.id, 'indiranagar', c)

  const updated = s.listUsers().find(u => u.id === c.id)!
  expect(updated.homeWardId).toBe('indiranagar')
  const audit = s.listAudit()
  expect(audit.length).toBe(before + 1)
  expect(audit[audit.length - 1]?.action).toMatch(/homeWard/i)
})

test('setHomeWard rejects an unknown ward id', () => {
  const s = createStore()
  const c = citizen()
  expect(() => s.setHomeWard(c.id, 'not-a-real-ward', c)).toThrow(/unknown ward/i)
})

// --- Fix 3: setHomeWard requires a self-only (or admin) actor -------------------------------

test('setHomeWard throws when a non-admin actor tries to set another user home ward', () => {
  const s = createStore()
  const c = citizen()
  const other = s.createUser({ contact: 'someone.else@example.com', homeWardId: 'malleshwaram' })

  expect(() => s.setHomeWard(other.id, 'indiranagar', c)).toThrow(/admin/i)
  // Unchanged.
  expect(s.listUsers().find(u => u.id === other.id)?.homeWardId).toBe('malleshwaram')
})

test('setHomeWard allows an admin to set another user home ward', () => {
  const s = createStore()
  const admin = s.listUsers().find(u => u.role === 'admin')!
  const other = s.createUser({ contact: 'someone.else@example.com', homeWardId: 'malleshwaram' })

  s.setHomeWard(other.id, 'indiranagar', admin)

  expect(s.listUsers().find(u => u.id === other.id)?.homeWardId).toBe('indiranagar')
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

// --- Fix 1: ward.issueIds is the single source of truth for the public issues page ----------

test('curator removes an issue: listIssues no longer returns it and issueTally no longer counts it', () => {
  const s = createStore()
  expect(s.listIssues('koramangala').map((i) => i.id)).toContain('kor-roads')
  expect(s.issueTally('koramangala').map((r) => r.issueId)).toContain('kor-roads')

  s.setWardIssues('koramangala', ['kor-water', 'kor-waste', 'kor-lighting'], curator())

  expect(s.listIssues('koramangala').map((i) => i.id)).not.toContain('kor-roads')
  expect(s.issueTally('koramangala').map((r) => r.issueId)).not.toContain('kor-roads')
  // The raw vote records referencing kor-roads are untouched.
  expect(s.getState().issueVotes.some((v) => v.issueIds.includes('kor-roads'))).toBe(true)
})

test('listIssues returns issues in the order given by ward.issueIds', () => {
  const s = createStore()
  s.setWardIssues('koramangala', ['kor-lighting', 'kor-roads', 'kor-water'], curator())
  expect(s.listIssues('koramangala').map((i) => i.id)).toEqual(['kor-lighting', 'kor-roads', 'kor-water'])
})

test('re-adding a removed issue makes its prior votes count again', () => {
  const s = createStore()
  // Seed: kor-roads has 3 votes (src/data/issues.ts).
  const before = s.issueTally('koramangala').find((r) => r.issueId === 'kor-roads')?.count
  expect(before).toBe(3)

  s.setWardIssues('koramangala', ['kor-water', 'kor-waste', 'kor-lighting'], curator())
  expect(s.issueTally('koramangala').find((r) => r.issueId === 'kor-roads')).toBeUndefined()

  s.setWardIssues('koramangala', ['kor-water', 'kor-waste', 'kor-lighting', 'kor-roads'], curator())
  expect(s.issueTally('koramangala').find((r) => r.issueId === 'kor-roads')?.count).toBe(3)
})

test('setWardIssues throws when a supplied issue id belongs to a different ward, leaving ward + audit unchanged', () => {
  const s = createStore()
  const before = s.getWard('koramangala')!.issueIds
  const auditBefore = s.listAudit().length

  // ind-traffic is a real issue, but it belongs to indiranagar, not koramangala.
  expect(() =>
    s.setWardIssues('koramangala', ['kor-water', 'ind-traffic'], curator()),
  ).toThrow(/does not belong to ward/i)

  expect(s.getWard('koramangala')!.issueIds).toEqual(before)
  expect(s.listAudit()).toHaveLength(auditBefore)
})

test('setWardIssues throws when a supplied issue id is unknown, leaving ward + audit unchanged', () => {
  const s = createStore()
  const before = s.getWard('koramangala')!.issueIds
  const auditBefore = s.listAudit().length

  expect(() =>
    s.setWardIssues('koramangala', ['kor-water', 'issue-does-not-exist'], curator()),
  ).toThrow(/unknown issue/i)

  expect(s.getWard('koramangala')!.issueIds).toEqual(before)
  expect(s.listAudit()).toHaveLength(auditBefore)
})

test('listIssues drops a foreign-ward id even if it is present in a corrupt ward.issueIds (defense in depth)', () => {
  const s1 = createStore()
  const corrupted = s1.getState()
  // jayanagar starts with issueIds: [] (src/data/wards.ts) — hand-corrupt it to reference
  // koramangala's kor-roads, bypassing setWardIssues' guard entirely (direct localStorage write,
  // simulating a stale/corrupt rehydrated value).
  const jayanagar = corrupted.wards.find((w) => w.id === 'jayanagar')!
  jayanagar.issueIds = ['kor-roads']
  localStorage.setItem('bv-store', JSON.stringify(corrupted))

  const s2 = createStore() // rehydrates the corrupt state from localStorage
  expect(s2.listIssues('jayanagar')).toEqual([])
  expect(s2.issueTally('jayanagar')).toEqual([])
  // kor-roads itself, and its votes, are of course untouched — this is purely a leak guard.
  expect(s2.listIssues('koramangala').map((i) => i.id)).toContain('kor-roads')
})

// --- Fix 4: curators can author new ward issues -----------------------------------------------

test('addIssue creates a new issue, appends it to ward.issueIds, and audits', () => {
  const s = createStore()
  const before = s.listAudit().length

  const issue = s.addIssue(
    'koramangala',
    { title: 'Footpath encroachment', description: 'Vendors blocking footpaths.' },
    curator(),
  )

  expect(issue.wardId).toBe('koramangala')
  expect(issue.title).toBe('Footpath encroachment')
  expect(s.getWard('koramangala')?.issueIds).toContain(issue.id)
  expect(s.listIssues('koramangala').map((i) => i.id)).toContain(issue.id)
  expect(s.listAudit().length).toBe(before + 1)
  expect(s.listAudit()[s.listAudit().length - 1]?.action).toBe('issue.created')
})

test('addIssue ids are allocated from the persisted counter, not Date.now()/Math.random()', () => {
  const s1 = createStore()
  const issue = s1.addIssue('koramangala', { title: 'A', description: 'B' }, curator())
  const s2 = createStore()
  // If the id survives a fresh createStore() (localStorage reload) unchanged and deterministic,
  // it was allocated from the persisted seq counter.
  expect(s2.getState().issues.find((i) => i.id === issue.id)).toBeDefined()
})

test('addIssue respects curator ward scope', () => {
  const s = createStore()
  // u-curator is scoped to koramangala + indiranagar, not malleshwaram.
  expect(() =>
    s.addIssue('malleshwaram', { title: 'X', description: 'Y' }, curator()),
  ).toThrow(/scope/i)
})

test('addIssue by an admin bypasses ward scope', () => {
  const s = createStore()
  const admin = s.listUsers().find((u) => u.role === 'admin')!
  expect(() =>
    s.addIssue('malleshwaram', { title: 'X', description: 'Y' }, admin),
  ).not.toThrow()
})

test('updateIssue edits title/description and audits', () => {
  const s = createStore()
  const before = s.listAudit().length

  s.updateIssue('kor-roads', { title: 'Road quality, potholes & footpaths' }, curator())

  const updated = s.listIssues('koramangala').find((i) => i.id === 'kor-roads')
  expect(updated?.title).toBe('Road quality, potholes & footpaths')
  // Unpatched field untouched.
  expect(updated?.description).toBe('Condition and repair of internal roads.')
  expect(s.listAudit().length).toBe(before + 1)
  expect(s.listAudit()[s.listAudit().length - 1]?.action).toBe('issue.updated')
})

test('updateIssue respects curator ward scope (scoped by the issue own ward)', () => {
  const s = createStore()
  // mal-water belongs to malleshwaram, outside u-curator's scope.
  expect(() => s.updateIssue('mal-water', { title: 'Renamed' }, curator())).toThrow(/scope/i)
})

test('updateIssue throws for an unknown issue id', () => {
  const s = createStore()
  const admin = s.listUsers().find((u) => u.role === 'admin')!
  expect(() => s.updateIssue('not-a-real-issue', { title: 'X' }, admin)).toThrow(/unknown issue/i)
})

// --- updateCandidate must not publish an unsourced Sourced field (store-side backstop) ------

test('updateCandidate throws when patching a Sourced field without a valid source, and leaves the candidate + audit unchanged', () => {
  const s = createStore()
  const slug = 'koramangala-r-menon'
  const before = s.getCandidate(slug)!
  const auditBefore = s.listAudit().length

  // Missing source entirely.
  expect(() =>
    s.updateCandidate(slug, { assets: { value: 'Rs 1' } as never }, curator()),
  ).toThrow(/source/i)

  // Source present but label empty.
  expect(() =>
    s.updateCandidate(
      slug,
      { assets: { value: 'Rs 1', source: { type: 'curator', label: '' } } },
      curator(),
    ),
  ).toThrow(/source/i)

  // Source present with a label but an invalid type.
  expect(() =>
    s.updateCandidate(
      slug,
      { assets: { value: 'Rs 1', source: { type: 'guess' as never, label: 'Someone said so' } } },
      curator(),
    ),
  ).toThrow(/source/i)

  expect(s.getCandidate(slug)).toEqual(before)
  expect(s.listAudit().length).toBe(auditBefore)
})

test('updateCandidate publishes a Sourced field when the incoming value carries a complete source', () => {
  const s = createStore()
  const slug = 'koramangala-r-menon'
  const auditBefore = s.listAudit().length

  s.updateCandidate(
    slug,
    { assets: { value: 'Rs 5 crore', source: { type: 'affidavit', label: 'EC affidavit 2026' } } },
    curator(),
  )

  expect(s.getCandidate(slug)?.assets.value).toBe('Rs 5 crore')
  expect(s.getCandidate(slug)?.assets.source.label).toBe('EC affidavit 2026')
  expect(s.listAudit().length).toBe(auditBefore + 1)
})

test('updateCandidate still allows patching a non-Sourced field (e.g. party) with no source required', () => {
  const s = createStore()
  const slug = 'koramangala-r-menon'

  expect(() => s.updateCandidate(slug, { party: 'New Party Name' }, curator())).not.toThrow()
  expect(s.getCandidate(slug)?.party).toBe('New Party Name')
})

// --- Task 3: ?src= partner attribution persists onto the user record at registration -----------

test('createUser persists an optional src onto the new user record', () => {
  const s = createStore()
  const user = s.createUser({
    contact: 'attributed@example.com',
    homeWardId: 'koramangala',
    src: 'demo-rwa-one',
  })
  expect(user.src).toBe('demo-rwa-one')
  expect(s.listUsers().find((u) => u.id === user.id)?.src).toBe('demo-rwa-one')
})

test('createUser leaves src undefined when none is given (no attribution)', () => {
  const s = createStore()
  const user = s.createUser({ contact: 'unattributed@example.com', homeWardId: 'koramangala' })
  expect(user.src).toBeUndefined()
})

test('src attribution grants no permissions and changes no other field on the created user', () => {
  const s = createStore()
  const withSrc = s.createUser({
    contact: 'a@example.com',
    homeWardId: 'koramangala',
    src: 'demo-rwa-one',
  })
  const withoutSrc = s.createUser({ contact: 'b@example.com', homeWardId: 'koramangala' })
  // Same role, same active flag, same shape apart from contact/id/src — attribution changes
  // nothing about what the citizen can do.
  expect(withSrc.role).toBe(withoutSrc.role)
  expect(withSrc.active).toBe(withoutSrc.active)
  expect(withSrc.curatorWardIds).toEqual(withoutSrc.curatorWardIds)
})

test('createUser does not leak the src partner slug into the audit log', () => {
  const s = createStore()
  s.createUser({ contact: 'tracked@example.com', homeWardId: 'koramangala', src: 'demo-rwa-one' })
  const audit = s.listAudit()
  expect(audit.some((a) => a.detail.includes('demo-rwa-one'))).toBe(false)
})

// --- Task 4: /partner-with-us anonymous expression-of-interest funnel (PRD §5.13) --------------

test('submitInterest requires no User/actor argument at all — it is a genuinely anonymous write', () => {
  const s = createStore()
  // TypeScript-level proof lives in the call below (no user object is ever passed); this
  // assertion is the runtime half: the submission succeeds and lands `pending` with nobody
  // logged in and no account created as a side effect.
  const before = s.listUsers().length
  const interest = s.submitInterest({
    path: 'awareness',
    name: 'Jane Doe',
    contact: 'jane@example.com',
    note: 'Happy to forward to our building WhatsApp group.',
  })
  expect(interest.status).toBe('pending')
  expect(s.listUsers().length).toBe(before) // no account was created or required
})

test('submitInterest captures both paths', () => {
  const s = createStore()
  const awareness = s.submitInterest({
    path: 'awareness',
    name: 'A',
    contact: 'a@example.com',
    note: '',
  })
  const curation = s.submitInterest({
    path: 'curation',
    name: 'B',
    contact: 'b@example.com',
    wardId: 'jayanagar',
    note: 'I live in the ward and want to help keep it accurate.',
  })
  expect(awareness.path).toBe('awareness')
  expect(curation.path).toBe('curation')
  expect(curation.wardId).toBe('jayanagar')
})

test('submissions land in the admin queue as pending, listed by listInterests', () => {
  const s = createStore()
  s.submitInterest({ path: 'awareness', name: 'A', contact: 'a@example.com', note: '' })
  const all = s.listInterests()
  expect(all).toHaveLength(1)
  expect(all[0].status).toBe('pending')
})

test('submitInterest rate-limit guard: refuses a second submission from the same contact+path while the first is still pending', () => {
  const s = createStore()
  s.submitInterest({ path: 'awareness', name: 'A', contact: 'dup@example.com', note: '' })
  expect(() =>
    s.submitInterest({ path: 'awareness', name: 'A again', contact: 'dup@example.com', note: '' }),
  ).toThrow(/already have a pending application/i)
  expect(s.listInterests()).toHaveLength(1)
})

test('submitInterest rate-limit guard does not block a different contact, a different path, or a resubmission after the first was resolved', () => {
  const s = createStore()
  const admin = s.listUsers().find((u) => u.role === 'admin')!
  const first = s.submitInterest({ path: 'awareness', name: 'A', contact: 'dup2@example.com', note: '' })

  // Different path, same contact -> allowed.
  expect(() =>
    s.submitInterest({ path: 'curation', name: 'A', contact: 'dup2@example.com', note: '' }),
  ).not.toThrow()

  // Different contact, same path -> allowed.
  expect(() =>
    s.submitInterest({ path: 'awareness', name: 'C', contact: 'someone-else@example.com', note: '' }),
  ).not.toThrow()

  // Same contact+path, but the first was already resolved -> allowed again.
  s.reviewInterest(first.id, 'accepted', admin)
  expect(() =>
    s.submitInterest({ path: 'awareness', name: 'A', contact: 'dup2@example.com', note: '' }),
  ).not.toThrow()
})

test('reviewInterest requires an admin actor', () => {
  const s = createStore()
  const cur = curator()
  const interest = s.submitInterest({ path: 'awareness', name: 'A', contact: 'a2@example.com', note: '' })
  expect(() => s.reviewInterest(interest.id, 'accepted', cur)).toThrow(/admin/i)
  expect(s.listInterests().find((i) => i.id === interest.id)?.status).toBe('pending')
})

test('reviewInterest: nobody self-activates — status only changes via an explicit admin decision, and only that decision is audited', () => {
  const s = createStore()
  const admin = s.listUsers().find((u) => u.role === 'admin')!
  const interest = s.submitInterest({ path: 'curation', name: 'A', contact: 'a3@example.com', wardId: 'koramangala', note: '' })

  // Submitting alone never grants/activates anything.
  expect(s.listInterests().find((i) => i.id === interest.id)?.status).toBe('pending')
  const auditBefore = s.listAudit().length

  s.reviewInterest(interest.id, 'accepted', admin)

  expect(s.listInterests().find((i) => i.id === interest.id)?.status).toBe('accepted')
  const audit = s.listAudit()
  expect(audit.length).toBe(auditBefore + 1) // exactly one entry, for the admin's decision
  expect(audit[audit.length - 1].actorUserId).toBe(admin.id)
})

test('reviewInterest can also reject', () => {
  const s = createStore()
  const admin = s.listUsers().find((u) => u.role === 'admin')!
  const interest = s.submitInterest({ path: 'awareness', name: 'A', contact: 'a4@example.com', note: '' })
  s.reviewInterest(interest.id, 'rejected', admin)
  expect(s.listInterests().find((i) => i.id === interest.id)?.status).toBe('rejected')
})

test('reviewInterest throws for an unknown interest id', () => {
  const s = createStore()
  const admin = s.listUsers().find((u) => u.role === 'admin')!
  expect(() => s.reviewInterest('interest-does-not-exist', 'accepted', admin)).toThrow(/unknown interest/i)
})

test('reviewInterest does not dump the applicant name/contact into the audit-log detail string', () => {
  const s = createStore()
  const admin = s.listUsers().find((u) => u.role === 'admin')!
  const interest = s.submitInterest({
    path: 'awareness',
    name: 'Very Identifiable Name',
    contact: 'private-contact@example.com',
    note: '',
  })
  s.reviewInterest(interest.id, 'accepted', admin)
  const audit = s.listAudit()
  const entry = audit[audit.length - 1]
  expect(entry.detail).not.toContain('Very Identifiable Name')
  expect(entry.detail).not.toContain('private-contact@example.com')
})

// --- Task 5: ward data-readiness gating (PRD §9.1) ----------------------------------------------

// -- wardCompleteness: the mechanical check --

test('wardCompleteness: a freshly-seeded ward with fully sourced candidates is complete', () => {
  const s = createStore()
  const result = s.wardCompleteness('koramangala')
  expect(result.complete).toBe(true)
  expect(result.candidateCount).toBe(3)
  expect(result.issues).toEqual([])
})

// FIX 1 (real defect): this test used to assert `complete: true` for a zero-candidate ward — the
// literal "every candidate who filed has a complete record" check is vacuously true when nobody
// has filed, but that vacuous pass is exactly the harm PRD §9.1 exists to prevent: a curator/admin
// being told a ward's data is "ready" for a candidate-referencing send when there is nothing to
// reference. Rewritten to assert the corrected behavior: NOT complete, with a distinct, honest
// ward-level `reason` (not a per-candidate `issues` entry, since there is no candidate at fault).
test('wardCompleteness: a ward with zero candidates on record is NOT complete — a distinct "no candidates filed" reason, not a report-card gap', () => {
  const s = createStore()
  const result = s.wardCompleteness('jayanagar')
  expect(result.complete).toBe(false)
  expect(result.candidateCount).toBe(0)
  expect(result.issues).toEqual([]) // no candidate to attach a per-candidate gap to
  expect(result.reason).toMatch(/no candidates/i)
})

test('wardReadiness: a zero-candidate ward is not ready, and signOffWard refuses to sign it off', () => {
  const s = createStore()
  const admin = s.listUsers().find((u) => u.role === 'admin')!

  const readiness = s.wardReadiness('jayanagar')
  expect(readiness.complete).toBe(false)
  expect(readiness.ready).toBe(false)

  const auditBefore = s.listAudit().length
  expect(() => s.signOffWard('jayanagar', admin)).toThrow(/complete/i)
  expect(s.wardReadiness('jayanagar').signedOff).toBe(false)
  expect(s.listAudit().length).toBe(auditBefore)
})

test('wardCompleteness: an empty, un-marked field is a gap, not complete', () => {
  const s = createStore()
  const admin = s.listUsers().find((u) => u.role === 'admin')!
  s.addCandidate('jayanagar', fullCandidateInput({ pendingCases: gapSourced() }), admin)

  const result = s.wardCompleteness('jayanagar')
  expect(result.complete).toBe(false)
  expect(result.issues).toHaveLength(1)
  // Fix 4: reasons use the friendly field label, not the raw camelCase key — a curator reading
  // this panel should never have to decode "pendingCases".
  expect(result.issues[0].reasons.join(' ')).toMatch(/criminal record.*pending cases/i)
  expect(result.issues[0].reasons.join(' ')).not.toMatch(/pendingCases/)
})

test('wardCompleteness: "not declared" is a valid, complete answer — not a gap', () => {
  const s = createStore()
  const admin = s.listUsers().find((u) => u.role === 'admin')!
  s.addCandidate(
    'jayanagar',
    fullCandidateInput({
      pendingCases: notDeclaredSourced(),
      assets: notDeclaredSourced(),
      education: notDeclaredSourced(),
    }),
    admin,
  )

  const result = s.wardCompleteness('jayanagar')
  expect(result.complete).toBe(true)
  expect(result.issues).toEqual([])
})

test('wardCompleteness: a "not declared" field still requires a real source', () => {
  const s = createStore()
  const admin = s.listUsers().find((u) => u.role === 'admin')!
  // addCandidate's own guard requires a source label at creation time, so build the gap by
  // patching it in afterwards via a direct (still-guarded) updateCandidate call is not possible
  // either — the guard applies there too. This proves the two guards agree: there is no store
  // path that can produce a sourceless notDeclared field to begin with.
  expect(() =>
    s.addCandidate(
      'jayanagar',
      fullCandidateInput({
        pendingCases: { value: '', source: { type: 'affidavit', label: '' }, notDeclared: true },
      }),
      admin,
    ),
  ).toThrow(/source/i)
})

// -- wardReadiness / signOffWard: the human half --

test('wardReadiness: a mechanically complete ward is not ready until a curator signs off', () => {
  const s = createStore()
  const readiness = s.wardReadiness('koramangala')
  expect(readiness.complete).toBe(true)
  expect(readiness.signedOff).toBe(false)
  expect(readiness.ready).toBe(false)
})

test('signOffWard: a scoped curator can sign off a complete ward — it becomes ready and is audited', () => {
  const s = createStore()
  const auditBefore = s.listAudit().length

  s.signOffWard('koramangala', curator())

  const readiness = s.wardReadiness('koramangala')
  expect(readiness.signedOff).toBe(true)
  expect(readiness.ready).toBe(true)
  expect(s.listAudit().length).toBe(auditBefore + 1)
  expect(s.listAudit()[s.listAudit().length - 1].action).toMatch(/signoff/i)
})

test('signOffWard: out-of-scope curator is refused inline, and never leaves a false "signed off" state', () => {
  const s = createStore()
  const auditBefore = s.listAudit().length
  // malleshwaram is outside u-curator's scope (koramangala + indiranagar).
  expect(() => s.signOffWard('malleshwaram', curator())).toThrow(/scope/i)
  expect(s.wardReadiness('malleshwaram').signedOff).toBe(false)
  expect(s.listAudit().length).toBe(auditBefore)
})

test('signOffWard: admin bypasses ward scope', () => {
  const s = createStore()
  expect(() => s.signOffWard('malleshwaram', s.listUsers().find((u) => u.role === 'admin')!)).not.toThrow()
  expect(s.wardReadiness('malleshwaram').signedOff).toBe(true)
})

test('signOffWard: refuses to sign off an incomplete ward, leaving state + audit unchanged', () => {
  const s = createStore()
  const admin = s.listUsers().find((u) => u.role === 'admin')!
  s.addCandidate('jayanagar', fullCandidateInput({ assets: gapSourced() }), admin)
  const auditBefore = s.listAudit().length

  expect(() => s.signOffWard('jayanagar', admin)).toThrow(/complete/i)
  expect(s.wardReadiness('jayanagar').signedOff).toBe(false)
  expect(s.listAudit().length).toBe(auditBefore)
})

// -- addCandidate / withdrawCandidate: the only two store paths that change a ward's candidate set

test('addCandidate records a new nomination, scoped, sourced, and audited', () => {
  const s = createStore()
  const auditBefore = s.listAudit().length

  const candidate = s.addCandidate('koramangala', fullCandidateInput({ name: 'Fresh Filer' }), curator())

  expect(candidate.wardId).toBe('koramangala')
  expect(candidate.name).toBe('Fresh Filer')
  expect(s.listCandidatesByWard('koramangala')).toHaveLength(4)
  expect(s.listAudit().length).toBe(auditBefore + 1)
})

test('addCandidate respects curator ward scope, leaving candidates + audit unchanged', () => {
  const s = createStore()
  const before = s.listCandidatesByWard('malleshwaram').length
  const auditBefore = s.listAudit().length
  expect(() => s.addCandidate('malleshwaram', fullCandidateInput(), curator())).toThrow(/scope/i)
  expect(s.listCandidatesByWard('malleshwaram')).toHaveLength(before)
  expect(s.listAudit().length).toBe(auditBefore)
})

test('addCandidate refuses a field with no source, leaving candidates + audit unchanged', () => {
  const s = createStore()
  const before = s.listCandidatesByWard('koramangala').length
  const auditBefore = s.listAudit().length
  expect(() =>
    s.addCandidate(
      'koramangala',
      fullCandidateInput({ assets: { value: 'Rs 1', source: { type: 'affidavit', label: '' } } }),
      curator(),
    ),
  ).toThrow(/source/i)
  expect(s.listCandidatesByWard('koramangala')).toHaveLength(before)
  expect(s.listAudit().length).toBe(auditBefore)
})

test('withdrawCandidate removes the candidate record, scoped and audited', () => {
  const s = createStore()
  const auditBefore = s.listAudit().length
  s.withdrawCandidate('c-kor-2', curator())
  expect(s.listCandidatesByWard('koramangala')).toHaveLength(2)
  expect(s.getCandidate('koramangala-s-gowda')).toBeUndefined()
  expect(s.listAudit().length).toBe(auditBefore + 1)
})

test('withdrawCandidate respects curator ward scope, leaving candidates + audit unchanged', () => {
  const s = createStore()
  const before = s.listCandidatesByWard('malleshwaram').length
  const auditBefore = s.listAudit().length
  // c-mal-1 is in malleshwaram, outside u-curator's scope.
  expect(() => s.withdrawCandidate('c-mal-1', curator())).toThrow(/scope/i)
  expect(s.listCandidatesByWard('malleshwaram')).toHaveLength(before)
  expect(s.listAudit().length).toBe(auditBefore)
})

test('withdrawCandidate throws for an unknown candidate id', () => {
  const s = createStore()
  expect(() => s.withdrawCandidate('does-not-exist', curator())).toThrow(/unknown candidate/i)
})

// -- THE SUBTLEST REQUIREMENT: sign-off is cleared automatically on a material candidate-set change --

test('a new nomination clears an existing sign-off (subtlest requirement, add path)', () => {
  const s = createStore()
  s.signOffWard('koramangala', curator())
  expect(s.wardReadiness('koramangala').signedOff).toBe(true)

  s.addCandidate('koramangala', fullCandidateInput({ name: 'Late Filer' }), curator())

  const readiness = s.wardReadiness('koramangala')
  expect(readiness.signedOff).toBe(false)
  expect(readiness.ready).toBe(false)
  expect(readiness.clearedByCandidateChange).toBe(true)
})

test('a withdrawal clears an existing sign-off (subtlest requirement, withdraw path)', () => {
  const s = createStore()
  s.signOffWard('koramangala', curator())
  expect(s.wardReadiness('koramangala').signedOff).toBe(true)

  s.withdrawCandidate('c-kor-3', curator())

  const readiness = s.wardReadiness('koramangala')
  expect(readiness.signedOff).toBe(false)
  // The remaining 2 candidates are still each fully sourced/complete — proves this is NOT just
  // completeness incidentally flipping false; sign-off itself was cleared.
  expect(readiness.complete).toBe(true)
  expect(readiness.clearedByCandidateChange).toBe(true)
})

test('a plain field edit (updateCandidate) does NOT clear sign-off — only a set change does', () => {
  const s = createStore()
  s.signOffWard('koramangala', curator())

  s.updateCandidate(
    'koramangala-r-menon',
    { assets: { value: 'Rs 9 crore', source: { type: 'affidavit', label: 'Revised EC affidavit' } } },
    curator(),
  )

  const readiness = s.wardReadiness('koramangala')
  expect(readiness.signedOff).toBe(true)
  expect(readiness.clearedByCandidateChange).toBe(false)
})

test('a fresh sign-off after a clearing candidate-set change resets clearedByCandidateChange', () => {
  const s = createStore()
  s.signOffWard('koramangala', curator())
  s.addCandidate('koramangala', fullCandidateInput({ name: 'Another Filer' }), curator())
  expect(s.wardReadiness('koramangala').clearedByCandidateChange).toBe(true)

  s.signOffWard('koramangala', curator())

  const readiness = s.wardReadiness('koramangala')
  expect(readiness.signedOff).toBe(true)
  expect(readiness.clearedByCandidateChange).toBe(false)
})

// -- overrideHold: admin-only release of a comms hold --

test('overrideHold: admin releases a hold on an unready ward — it becomes ready and is audited', () => {
  const s = createStore()
  const admin = s.listUsers().find((u) => u.role === 'admin')!
  const auditBefore = s.listAudit().length

  expect(s.wardReadiness('malleshwaram').ready).toBe(false)
  s.overrideHold('malleshwaram', admin)

  const readiness = s.wardReadiness('malleshwaram')
  expect(readiness.overridden).toBe(true)
  expect(readiness.ready).toBe(true)
  expect(s.listAudit().length).toBe(auditBefore + 1)
})

test('overrideHold is admin-only', () => {
  const s = createStore()
  expect(() => s.overrideHold('malleshwaram', curator())).toThrow(/admin/i)
  expect(s.wardReadiness('malleshwaram').overridden).toBe(false)
})

test('overrideHold refuses to override a ward that is already ready', () => {
  const s = createStore()
  const admin = s.listUsers().find((u) => u.role === 'admin')!
  s.signOffWard('koramangala', admin)
  expect(s.wardReadiness('koramangala').ready).toBe(true)

  expect(() => s.overrideHold('koramangala', admin)).toThrow(/already ready|no.*hold/i)
})

// -- listHeldWards: the work queue /admin/partners (later task) will consume --

test('listHeldWards lists every not-ready ward and excludes an overridden one', () => {
  const s = createStore()
  const admin = s.listUsers().find((u) => u.role === 'admin')!

  const before = s.listHeldWards()
  expect(before.map((w) => w.wardId)).toContain('malleshwaram')
  expect(before.map((w) => w.wardId)).toContain('koramangala') // never signed off yet

  s.overrideHold('malleshwaram', admin)
  const after = s.listHeldWards()
  expect(after.map((w) => w.wardId)).not.toContain('malleshwaram')
  expect(after.map((w) => w.wardId)).toContain('koramangala')
})

// --- Task 6: /admin/partners — createPartner ----------------------------------------------------

test('createPartner requires an admin actor', () => {
  const s = createStore()
  expect(() => s.createPartner({ name: 'New RWA', kind: 'rwa', wardIds: [] }, curator())).toThrow(
    /admin/i,
  )
  expect(s.listPartners().some((p) => p.name === 'New RWA')).toBe(false)
})

test('createPartner derives a URL-safe slug from the partner name (no Date.now()/Math.random())', () => {
  const s = createStore()
  const admin = s.listUsers().find((u) => u.role === 'admin')!
  const partner = s.createPartner({ name: 'Sunset Layout RWA!', kind: 'rwa', wardIds: [] }, admin)
  expect(partner.slug).toBe('sunset-layout-rwa')
  expect(s.listPartners().some((p) => p.slug === partner.slug)).toBe(true)
})

test('createPartner resolves a slug collision deterministically via the persisted counter', () => {
  const s = createStore()
  const admin = s.listUsers().find((u) => u.role === 'admin')!
  const first = s.createPartner({ name: 'Civic Group', kind: 'ngo', wardIds: [] }, admin)
  const second = s.createPartner({ name: 'Civic Group', kind: 'ngo', wardIds: [] }, admin)
  expect(first.slug).not.toBe(second.slug)
  expect(second.slug).toMatch(/^civic-group-\d+$/)
})

test('createPartner writes the given wardIds verbatim onto the new partner', () => {
  const s = createStore()
  const admin = s.listUsers().find((u) => u.role === 'admin')!
  const partner = s.createPartner(
    { name: 'Ward Reach Org', kind: 'other', wardIds: ['shivajinagar'] },
    admin,
  )
  expect(partner.wardIds).toEqual(['shivajinagar'])
})

test('createPartner is audited exactly once, and the audit detail carries the (public-facing) partner name/slug', () => {
  const s = createStore()
  const admin = s.listUsers().find((u) => u.role === 'admin')!
  const before = s.listAudit().length
  const partner = s.createPartner({ name: 'Another Org', kind: 'other', wardIds: ['jayanagar'] }, admin)
  const audit = s.listAudit()
  expect(audit.length).toBe(before + 1)
  expect(audit[audit.length - 1].actorUserId).toBe(admin.id)
  expect(audit[audit.length - 1].detail).toContain(partner.slug)
})

test('createPartner records interestId when given one, and leaves it undefined otherwise (Fix 3 foreign key)', () => {
  const s = createStore()
  const admin = s.listUsers().find((u) => u.role === 'admin')!
  const fromEoi = s.createPartner(
    { name: 'From EOI Org', kind: 'rwa', wardIds: [], interestId: 'interest-42' },
    admin,
  )
  expect(fromEoi.interestId).toBe('interest-42')

  const directlyAdded = s.createPartner({ name: 'Direct Org', kind: 'rwa', wardIds: [] }, admin)
  expect(directlyAdded.interestId).toBeUndefined()
})

// --- Fix 1: updatePartner (IA §6.4 "add/edit partners and their slugs") -------------------------

test('updatePartner requires an admin actor and leaves the partner untouched otherwise', () => {
  const s = createStore()
  const partner = s.listPartners()[0]
  expect(() =>
    s.updatePartner(partner.slug, { name: 'Hacked Name' }, curator()),
  ).toThrow(/admin/i)
  expect(s.getPartner(partner.slug)?.name).toBe(partner.name)
})

test('updatePartner edits name/kind/wardIds but the slug never changes, even on a rename', () => {
  const s = createStore()
  const admin = s.listUsers().find((u) => u.role === 'admin')!
  const partner = s.listPartners()[0]
  const originalSlug = partner.slug

  const updated = s.updatePartner(
    originalSlug,
    { name: 'A Completely Different Name (fictional demo partner)', kind: 'press', wardIds: ['jayanagar'] },
    admin,
  )

  expect(updated.slug).toBe(originalSlug)
  expect(updated.name).toBe('A Completely Different Name (fictional demo partner)')
  expect(updated.kind).toBe('press')
  expect(updated.wardIds).toEqual(['jayanagar'])
  // The old /partner/{slug} URL and any already-distributed ?src={slug} link still resolve to
  // this same partner record after the rename.
  expect(s.getPartner(originalSlug)?.name).toBe('A Completely Different Name (fictional demo partner)')
})

test('updatePartner applies a partial patch — omitted fields are left as-is', () => {
  const s = createStore()
  const admin = s.listUsers().find((u) => u.role === 'admin')!
  const partner = s.listPartners()[0]

  const updated = s.updatePartner(partner.slug, { kind: 'other' }, admin)
  expect(updated.kind).toBe('other')
  expect(updated.name).toBe(partner.name)
  expect(updated.wardIds).toEqual(partner.wardIds)
})

test('updatePartner throws for an unknown slug', () => {
  const s = createStore()
  const admin = s.listUsers().find((u) => u.role === 'admin')!
  expect(() => s.updatePartner('not-a-real-partner', { name: 'x' }, admin)).toThrow(/unknown partner/i)
})

test('updatePartner is audited exactly once per call', () => {
  const s = createStore()
  const admin = s.listUsers().find((u) => u.role === 'admin')!
  const partner = s.listPartners()[0]
  const before = s.listAudit().length
  s.updatePartner(partner.slug, { kind: 'ngo' }, admin)
  const audit = s.listAudit()
  expect(audit.length).toBe(before + 1)
  expect(audit[audit.length - 1].action).toBe('partner.updated')
  expect(audit[audit.length - 1].actorUserId).toBe(admin.id)
})
