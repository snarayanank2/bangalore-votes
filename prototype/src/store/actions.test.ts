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
