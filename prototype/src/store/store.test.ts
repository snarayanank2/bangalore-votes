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

test('createUser deep-clones its result — mutating it does not corrupt a subsequent read', () => {
  const s = createStore()
  const user = s.createUser({ contact: 'clone-check@example.com', homeWardId: 'koramangala' })
  user.homeWardId = 'HACKED'
  const reread = s.listUsers().find((u) => u.id === user.id)
  expect(reread?.homeWardId).toBe('koramangala')
  expect(s.getState().users.find((u) => u.id === user.id)?.homeWardId).toBe('koramangala')
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

// --- PRD §9.1: the seeded "not declared" field is actually exercised, not just theoretical -----

test('seed: shivajinagar-t-ahmed.education is marked "not declared" with a real source, and wardCompleteness treats it as complete', () => {
  const s = createStore()
  const candidate = s.getCandidate('shivajinagar-t-ahmed')
  expect(candidate?.education.notDeclared).toBe(true)
  expect(candidate?.education.value).toBe('')
  expect(candidate?.education.source.label.trim()).not.toBe('')

  const completeness = s.wardCompleteness('shivajinagar')
  expect(completeness.complete).toBe(true)
  expect(completeness.issues).toEqual([])
})

// --- platformMetrics: /data self-accountability figures (PRD §5.14) ---------------------
//
// Asserted against the REAL seed shape (src/data/*.ts), not invented numbers:
//  - 5 seeded wards, 4 of which have at least one candidate (jayanagar has none).
//  - 10 seeded candidates, every one with all five Sourced fields sourced, and either populated
//    or explicitly `notDeclared: true` (shivajinagar-t-ahmed's `education` — PRD §9.1: a "not
//    declared" field is still complete, so this does NOT change reportCardsComplete/sourcesCited
//    below).
//  - 3 users: 1 citizen, 1 active curator, 1 admin — registeredCitizens (Fix 2) counts the 1
//    citizen only, not all 3 accounts.
//  - 3 submissions (queue records): sub-1 pending (count 2), sub-2 accepted (count 3), sub-3
//    rejected (count 1) — flagsRaised (Fix 3) sums the counts (2+3+1=6), not the record count (3).
//  - 3 seeded issue votes, all in koramangala: kor-roads x3, kor-water x3, kor-waste x1.

test('platformMetrics: coverage figures come from the real seed, against the real 369-ward total', () => {
  const s = createStore()
  const metrics = s.platformMetrics()

  expect(metrics.coverage.totalWards).toBe(369)
  expect(metrics.coverage.wardsWithPublishedCandidateData).toBe(4)
  expect(metrics.coverage.totalCandidates).toBe(10)
  expect(metrics.coverage.reportCardsComplete).toBe(10)
  expect(metrics.coverage.activeCurators).toBe(1)
  expect(metrics.coverage.sourcesCited).toBe(50) // 10 candidates x 5 sourced fields each
})

test('platformMetrics: integrity figures come from the real seed; median time to resolve is honestly unavailable, not fabricated', () => {
  const s = createStore()
  const metrics = s.platformMetrics()

  // Fix 3: flagsRaised is the SUM of each submission's dedup count (2+3+1=6), not the number of
  // (deduped) queue records (3) — PRD §6.3 frames the count as the real citizen-policing signal.
  expect(metrics.integrity.flagsRaised).toBe(6)
  // flagsResolved stays record-based (deliberately not the same unit as flagsRaised): resolution
  // acts on the deduped queue item, not the underlying raw report count.
  expect(metrics.integrity.flagsResolved).toBe(2)
  expect(metrics.integrity.medianTimeToResolve).toBeNull()
  expect(metrics.integrity.medianResolutionUnavailableReason).toMatch(/not computable|counter|clock/i)
})

test('platformMetrics: citizen signal aggregates issue votes across every ward, not just one', () => {
  const s = createStore()
  const metrics = s.platformMetrics()

  expect(metrics.citizenSignal.totalIssueVotes).toBe(3)
  // Fix 2: registeredCitizens counts role === 'citizen' only (1), excluding the seed's curator and
  // admin accounts (platform staff, not a citizen-engagement signal).
  expect(metrics.citizenSignal.registeredCitizens).toBe(1)

  const byId = new Map(metrics.citizenSignal.issueRollUp.map((r) => [r.issueId, r]))
  expect(byId.get('kor-roads')?.count).toBe(3)
  expect(byId.get('kor-water')?.count).toBe(3)
  expect(byId.get('kor-waste')?.count).toBe(1)
  // Ranked highest first.
  for (let i = 1; i < metrics.citizenSignal.issueRollUp.length; i++) {
    expect(metrics.citizenSignal.issueRollUp[i - 1].count).toBeGreaterThanOrEqual(
      metrics.citizenSignal.issueRollUp[i].count,
    )
  }
})

test('platformMetrics: a fresh vote immediately changes the city-wide roll-up (live, not cached)', () => {
  const s = createStore()
  const citizen = s.listUsers().find((u) => u.id === 'u-citizen')!
  const before = s.platformMetrics().citizenSignal.totalIssueVotes
  s.castIssueVote(citizen, citizen.homeWardId!, ['kor-lighting'])
  const after = s.platformMetrics()
  expect(after.citizenSignal.totalIssueVotes).toBe(before) // still 3 ballots, one changed
  const byId = new Map(after.citizenSignal.issueRollUp.map((r) => [r.issueId, r]))
  expect(byId.get('kor-lighting')?.count).toBe(1)
})

test('platformMetrics: exposes only aggregates — no per-user vote data anywhere in the shape', () => {
  const s = createStore()
  const metrics = s.platformMetrics()

  for (const row of metrics.citizenSignal.issueRollUp) {
    expect(Object.keys(row).sort()).toEqual(['count', 'issueId', 'title', 'wardId'])
  }
  // No seeded voter id ever leaks into the serialized shape.
  const serialized = JSON.stringify(metrics)
  expect(serialized).not.toMatch(/u-citizen|seed-voter-1|seed-voter-2|userId/)
})

test('platformMetrics: asOf reflects the most recent recorded audit event and advances after a curator publish', () => {
  const s = createStore()
  const before = s.platformMetrics().asOf
  expect(before).toBeTruthy()

  const curator = s.listUsers().find((u) => u.role === 'curator')!
  s.updateWard('koramangala', { name: 'Koramangala Updated' }, curator)

  const after = s.platformMetrics().asOf
  expect(after).not.toBe(before)
})

test('platformMetrics deep-clones its result', () => {
  const s = createStore()
  const metrics = s.platformMetrics()
  metrics.coverage.totalCandidates = -1
  metrics.citizenSignal.issueRollUp.push({ issueId: 'hacked', wardId: 'x', title: 'x', count: 999 })
  const again = s.platformMetrics()
  expect(again.coverage.totalCandidates).not.toBe(-1)
  expect(again.citizenSignal.issueRollUp.find((r) => r.issueId === 'hacked')).toBeUndefined()
})

// --- Task 3: partner model (PRD §5.12) ----------------------------------------------------------

test('listPartners returns the seeded demo partners, deep-cloned', () => {
  const s = createStore()
  const partners = s.listPartners()
  expect(partners.length).toBeGreaterThanOrEqual(2)
  partners[0].name = 'mutated'
  expect(s.listPartners()[0].name).not.toBe('mutated')
})

test('getPartner resolves a known slug and returns undefined for an unknown one', () => {
  const s = createStore()
  const known = s.listPartners()[0]
  expect(s.getPartner(known.slug)?.slug).toBe(known.slug)
  expect(s.getPartner('not-a-real-partner')).toBeUndefined()
})

test('seeded partners are unmistakably fictional demo organisations', () => {
  const s = createStore()
  for (const p of s.listPartners()) {
    expect(p.name).toMatch(/fictional|demo|sample|placeholder/i)
  }
})

test('partnerWardCoverage reports the real 369-ward denominator and splits seed wards into covered/uncovered', () => {
  const s = createStore()
  const coverage = s.partnerWardCoverage()
  expect(coverage.totalWards).toBe(369)
  expect(coverage.coveredWardIds.length + coverage.uncoveredWardIds.length).toBe(s.listWards().length)
  for (const row of coverage.byWard) {
    expect(row.partnerSlugs.length > 0).toBe(coverage.coveredWardIds.includes(row.wardId))
  }
})

test('partnerWardCoverage deep-clones its result', () => {
  const s = createStore()
  const coverage = s.partnerWardCoverage()
  coverage.uncoveredWardIds.push('hacked')
  expect(s.partnerWardCoverage().uncoveredWardIds).not.toContain('hacked')
})

// --- Fix 2: partnerRegistrationCounts (IA §6.4 "registrations attributed per partner") ----------

test('partnerRegistrationCounts starts every known partner at 0 and increments only on a matching src', () => {
  const s = createStore()
  const partner = s.listPartners()[0]
  const before = s.partnerRegistrationCounts().find((r) => r.slug === partner.slug)
  expect(before?.count).toBe(0)

  s.createUser({ contact: 'attributed@example.com', src: partner.slug })
  const after = s.partnerRegistrationCounts().find((r) => r.slug === partner.slug)
  expect(after?.count).toBe(1)

  // A registration with no src, or a different partner's src, never inflates this partner's count.
  s.createUser({ contact: 'no-src@example.com' })
  expect(s.partnerRegistrationCounts().find((r) => r.slug === partner.slug)?.count).toBe(1)
})

test('partnerRegistrationCounts: an unrecognised/typo\'d src does not crash and is not attributed to any real partner', () => {
  const s = createStore()
  const before = s.partnerRegistrationCounts()
  expect(() => s.createUser({ contact: 'typo@example.com', src: 'demo-rwa-onee' })).not.toThrow()
  const after = s.partnerRegistrationCounts()
  // Every real partner's count is unchanged — the typo slug matches none of them.
  for (const row of before) {
    expect(after.find((r) => r.slug === row.slug)?.count).toBe(row.count)
  }
  // The typo'd slug itself never appears as a row — this selector only reports real partners.
  expect(after.some((r) => r.slug === 'demo-rwa-onee')).toBe(false)
})

test('partnerRegistrationCounts exposes AGGREGATE COUNTS ONLY — no user id, contact, or name anywhere in the shape', () => {
  const s = createStore()
  const partner = s.listPartners()[0]
  const user = s.createUser({
    contact: 'distinctive-contact@example.com',
    name: 'Distinctive Citizen Name',
    src: partner.slug,
  })
  const counts = s.partnerRegistrationCounts()

  for (const row of counts) {
    expect(Object.keys(row).sort()).toEqual(['count', 'slug'])
  }
  const serialized = JSON.stringify(counts)
  expect(serialized).not.toMatch(/distinctive-contact@example\.com/)
  expect(serialized).not.toMatch(/Distinctive Citizen Name/)
  expect(serialized).not.toContain(user.id)
})

test('partnerRegistrationCounts deep-clones its result', () => {
  const s = createStore()
  const counts = s.partnerRegistrationCounts()
  counts.push({ slug: 'hacked', count: 999 })
  expect(s.partnerRegistrationCounts().some((r) => r.slug === 'hacked')).toBe(false)
})
