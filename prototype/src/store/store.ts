import { seed } from '../data'
import type {
  AuditEntry,
  Candidate,
  CandidateAffidavit,
  Interest,
  InterestPath,
  InterestStatus,
  Issue,
  IssueVote,
  NewsLink,
  NotificationPrefs,
  Partner,
  PartnerKind,
  Role,
  Source,
  Sourced,
  Submission,
  User,
  Ward,
} from '../types'

/** Starting point for a user's notification prefs before they've ever visited
 * /account/notifications — everything off, so nothing is implied as already subscribed. */
export const DEFAULT_NOTIFICATION_PREFS: NotificationPrefs = {
  emailEnabled: false,
  whatsappEnabled: false,
}

/** Names which registration-consent wording (RegisterLoginForm's final step) a user saw when
 *  they registered (PRD §10). Bump this whenever that copy materially changes, so an existing
 *  user's recorded consent is never silently reattributed to text they never saw. */
export const REGISTRATION_CONSENT_WORDING_VERSION = 'v1'

const KEY = 'bv-store'

export interface StoreState {
  wards: Ward[]
  candidates: Candidate[]
  issues: Issue[]
  issueVotes: IssueVote[]
  users: User[]
  submissions: Submission[]
  audit: AuditEntry[]
  /** Partner records (PRD §5.12) — seeded demo data in this prototype; admin-managed CRUD is a
   *  later task, so today this array only ever grows via `seed`, never a mutation. */
  partners: Partner[]
  /** Anonymous expressions of interest (PRD §5.13, `/partner-with-us`) — deliberately NOT part
   *  of `seed` (unlike `partners`): there is no demo-data reason to ship with pre-seeded
   *  applications, so a fresh/reset store always starts with an empty queue (see
   *  `loadInitialState`/`reset`). */
  interests: Interest[]
  /** Monotonic counter backing stamp(); persisted so it survives reload. */
  seq: number
}

export interface IssueTallyRow {
  issueId: string
  count: number
}

/** One row of the city-wide issue roll-up (`platformMetrics().citizenSignal.issueRollUp`) —
 *  AGGREGATE-only, same shape family as `IssueTallyRow`, just not scoped to a single ward. Never
 *  carries a userId or per-user vote selection (see the PRIVACY note on `platformMetrics`). */
export interface IssueRollUpRow {
  issueId: string
  wardId: string
  title: string
  count: number
}

/**
 * Self-accountability figures for the public `/data` page (PRD §5.14, IA §3.14) — "a platform
 * that publishes other people's records should publish its own." Every figure here is computed
 * live from the store; nothing is hardcoded. See `platformMetrics()` below for how each figure is
 * derived, and for why `integrity.medianTimeToResolve` is `null` rather than a fabricated
 * duration.
 */
export interface PlatformMetrics {
  /** The most recent audit-log event stamp at computation time (`AuditEntry.at` — either a real
   *  ISO seed timestamp or a live `t${n}` counter stamp), or `undefined` if the audit log is
   *  somehow empty. Render through `lib/stamps.ts`'s `formatStamp()` — never treat this as, or
   *  substitute it with, a wall-clock `Date.now()`/`new Date()` value. NOTE: `castIssueVote`
   *  deliberately writes no audit entry (privacy — see its file comment), so this stamp does not
   *  move when a citizen casts an issue vote; it reflects the latest published/moderation event,
   *  not the latest citizen-signal figure. */
  asOf: string | undefined
  coverage: {
    /** Wards with at least one published candidate record. */
    wardsWithPublishedCandidateData: number
    /** The real city-wide ward count (PRD §5.14) — NOT `listWards().length`, which is only the
     *  prototype's 5-ward seed. Deliberately not derived from the store, since the real figure
     *  isn't a property of this seed. */
    totalWards: number
    /** Candidates whose report card has all five Sourced fields populated with a non-empty value
     *  and a non-empty source label. */
    reportCardsComplete: number
    totalCandidates: number
    /** Curators with `role === 'curator' && active === true`. */
    activeCurators: number
    /** Count of individually-sourced candidate fields (value + valid source) across the whole
     *  platform — up to 5 per candidate. */
    sourcesCited: number
  }
  integrity: {
    /** FIX 3: the SUM of every flag submission's dedup `count` (not the number of `Submission`
     *  records) — e.g. seed `sub-1.count=2` + `sub-2.count=3` + `sub-3.count=1` = 6, not 3. PRD
     *  §6.3 frames this count explicitly as "a strong signal to the curator" of how many citizens
     *  are actively policing the data; counting only deduped queue records would silently halve
     *  that signal (3 vs the true 6 in seed). NOTE: this is intentionally NOT the same unit as
     *  `flagsResolved` below (record-based) — see that field's doc comment, and `/data`'s own
     *  wording, for why the two are not meant to read as an apples-to-apples ratio. */
    flagsRaised: number
    /** Flag submissions (queue RECORDS, not raw report count) no longer pending (`status` is
     *  `'accepted'` or `'rejected'`) — deliberately record-based, unlike `flagsRaised` above:
     *  resolution acts on the deduped queue item a curator reviews, not on each individual
     *  duplicate report that was merged into it. */
    flagsResolved: number
    /** Always `null` in this prototype — see `medianResolutionUnavailableReason`. */
    medianTimeToResolve: null
    /** Why `medianTimeToResolve` can't be computed: seed `Submission.createdAt` values are real
     *  ISO-8601 timestamps, but resolution is only ever recorded via a live `t${n}` monotonic
     *  counter stamp (see lib/stamps.ts) — the two are not commensurable, so subtracting one from
     *  the other would produce a fabricated duration, not a real one. `Date.now()` is banned
     *  project-wide, so there is no real clock to backfill this with either. */
    medianResolutionUnavailableReason: string
  }
  citizenSignal: {
    /** Per-issue vote counts aggregated across every ward (not scoped to one ward, unlike
     *  `issueTally`/`issueVoteCounts`), ranked highest first. AGGREGATE ONLY — see PRIVACY note
     *  on `platformMetrics`. */
    issueRollUp: IssueRollUpRow[]
    /** Number of issue-vote ballots cast (`IssueVote` records) — i.e. how many citizens have
     *  voted, not how many individual issue picks were made. */
    totalIssueVotes: number
    /** FIX 2: accounts with `role === 'citizen'` ONLY — curator and admin accounts are excluded,
     *  even though every role registers through the same single OTP mechanism (PRD §10). PRD
     *  §5.14 lists this figure under "citizen signal", and counting the platform's own staff
     *  (curators/admins) here would inflate a public citizen-engagement figure and read as
     *  self-serving on a self-accountability page. */
    registeredCitizens: number
  }
}

/**
 * Partner -> ward coverage against the real citywide ward count (PRD §5.12's admin coverage
 * view). `byWard`/`coveredWardIds`/`uncoveredWardIds` are scoped to this prototype's 5-ward seed
 * (the only wards that actually exist here to check membership against) — `totalWards` reports
 * the real 369 denominator honestly, same pattern as `PlatformMetrics.coverage.totalWards`. The
 * uncovered set is the work queue / early warning for reach skewing to central Bengaluru.
 */
export interface PartnerWardCoverage {
  totalWards: number
  coveredWardIds: string[]
  uncoveredWardIds: string[]
  byWard: { wardId: string; wardName: string; partnerSlugs: string[] }[]
}

/** Input to `createPartner` (PRD §5.12/§5.13, Task 6) — admin-provisioned, post-seed partner
 *  creation. No `slug` field: the slug is always derived from `name` (see `createPartner`'s doc
 *  comment), never accepted from a caller, so it can't be forged into colliding with or spoofing
 *  an existing partner's kit URL. */
export interface CreatePartnerInput {
  name: string
  kind: PartnerKind
  wardIds: string[]
  /** Set only when this partner is being provisioned from an accepted `awareness` `Interest`
   *  (PRD §5.13) — becomes `Partner.interestId`, the real foreign key `Partners.tsx` uses to find
   *  "its own" provisioned kit instead of matching on `name` (Fix: a name-match collides once an
   *  admin can also add a partner directly, below). Omitted when an admin adds a partner directly
   *  with no originating EOI. */
  interestId?: string
}

/** Patch accepted by `updatePartner` (IA §6.4 — "add/edit partners and their slugs"). Deliberately
 *  excludes `slug`: a partner's slug is derived once, at creation (`createPartner`), and never
 *  changes again, even when `name` is edited afterwards — see `updatePartner`'s doc comment for
 *  why (an already-distributed `?src=`/`/partner/{slug}` link must never silently break). */
export type PartnerPatch = Partial<Pick<Partner, 'name' | 'kind' | 'wardIds'>>

/** One row of `partnerRegistrationCounts()` — see that selector's doc comment for the privacy
 *  guarantee (aggregate counts only, no user ids). */
export interface PartnerRegistrationCount {
  slug: string
  count: number
}

export interface SubmitFlagInput {
  wardId: string
  candidateId?: string
  field: string
  detail: string
  sourceUrl?: string
}

/** Input to `ingestAffidavit` (PRD §5.2) — the curator either "uploads" the affidavit PDF (in
 *  this prototype: provides its file name; no real file is read) or pastes its EC link (which
 *  production would fetch and store; here it is recorded verbatim). At least one is required. */
export interface IngestAffidavitInput {
  fileName?: string
  ecUrl?: string
}

/** Input to `submitInterest` (PRD §5.13) — deliberately has no actor/User field anywhere in its
 *  shape, matching the form it backs: `/partner-with-us` is an anonymous write path. */
export interface SubmitInterestInput {
  path: InterestPath
  name: string
  contact: string
  wardId?: string
  note: string
}

export type InterestDecision = Exclude<InterestStatus, 'pending'>

export type CandidateSourcedField =
  | 'trackRecord'
  | 'pendingCases'
  | 'assets'
  | 'education'
  | 'approachability'

/** Mirrors `lib/fields.ts`'s `CANDIDATE_FIELD_LABELS` keys. Duplicated here (not imported)
 * because `store.ts` is the data-integrity boundary and must not depend on UI-layer modules —
 * keep the two lists in sync by hand if a sourced field is ever added or removed. */
const CANDIDATE_SOURCED_FIELDS: readonly CandidateSourcedField[] = [
  'trackRecord',
  'pendingCases',
  'assets',
  'education',
  'approachability',
]

/** Mirrors `lib/fields.ts`'s `CANDIDATE_FIELD_LABELS` values, for the exact same reason
 * `CANDIDATE_SOURCED_FIELDS` above is duplicated rather than imported: the store must not depend
 * on UI-layer modules. Used only to phrase `wardCompleteness`'s per-candidate gap reasons in
 * plain English (e.g. "Criminal record / pending cases") instead of a raw camelCase field key a
 * curator would otherwise have to decode. Keep in sync by hand if a sourced field is ever added,
 * renamed, or removed. */
const CANDIDATE_FIELD_LABELS: Record<CandidateSourcedField, string> = {
  trackRecord: 'Ward track record',
  pendingCases: 'Criminal record / pending cases',
  assets: 'Declared assets',
  education: 'Education / qualifications',
  approachability: 'Approachability',
}

function isCandidateSourcedField(field: string): field is CandidateSourcedField {
  return (CANDIDATE_SOURCED_FIELDS as readonly string[]).includes(field)
}

/** Structural check that an incoming patch value for a `Sourced<string>` candidate field is
 *  actually complete — a non-empty source `label` and a valid `type`. This is the store-side
 *  backstop for PRD §11's "every field carries a visible source": `EditCandidate.tsx` already
 *  guards this client-side, but the store is the data-integrity boundary and must not trust any
 *  caller (a future form, a bug, a direct console call) to have done so. */
function isValidSourcedPatchValue(value: unknown): value is Sourced<string> {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Record<string, unknown>
  if (typeof v.value !== 'string') return false
  // PRD §9.1: notDeclared is optional, but if present it must be a real boolean — a field marked
  // "not declared" still MUST carry a valid source (checked below, unconditionally), since "not
  // declared" is a fact about the affidavit, not the absence of sourcing.
  if (v.notDeclared !== undefined && typeof v.notDeclared !== 'boolean') return false
  // PRD §5.2: aiExtracted is optional; if present it must be a real boolean. Callers outside
  // ingestAffidavit (curator form saves) simply omit it — which is what clears the marker.
  if (v.aiExtracted !== undefined && typeof v.aiExtracted !== 'boolean') return false
  if (typeof v.source !== 'object' || v.source === null) return false
  const source = v.source as Record<string, unknown>
  if (typeof source.label !== 'string' || source.label.trim() === '') return false
  if (source.type !== 'affidavit' && source.type !== 'curator') return false
  return true
}

/** The real GBA ward count (PRD §5.14/§12) — the denominator `platformMetrics()` reports coverage
 *  against. Intentionally NOT derived from `seed.wards.length` (5 in this prototype): the whole
 *  point of §5.14's coverage figure is to show real progress against the real city, not against
 *  however many wards this demo happens to seed. */
const TOTAL_WARDS_CITYWIDE = 369

/** A candidate's report card field is "complete" (PRD §5.14 coverage, and PRD §9.1's ward
 *  completeness check — shared by both so the two definitions never drift apart) when it carries
 *  a non-empty source label AND either a non-empty value OR an explicit `notDeclared: true`
 *  marker. "Not declared" is a valid, complete answer (§9.1) — it still needs a real source, but
 *  never needs a populated value on top of that. */
function isCompleteSourcedField(field: Sourced<string>): boolean {
  if (field.source.label.trim() === '') return false
  if (field.notDeclared) return true
  return field.value.trim() !== ''
}

/** The five Sourced fields on a Candidate record, in a fixed order — reused by both the
 *  "report cards complete" and "sources cited" figures so they stay consistent with each other. */
function candidateSourcedFieldValues(candidate: Candidate): Sourced<string>[] {
  return [
    candidate.trackRecord,
    candidate.pendingCases,
    candidate.assets,
    candidate.education,
    candidate.approachability,
  ]
}

export type WardPatch = Partial<Pick<Ward, 'name' | 'number' | 'corporation'>>

export type CandidatePatch = Partial<Omit<Candidate, 'id' | 'slug' | 'wardId'>>

export type IssuePatch = Partial<Pick<Issue, 'title' | 'description'>>

export interface NewIssueInput {
  title: string
  description: string
}

/** Edit payload applied to a candidate's Sourced field when a submission is accepted. */
export interface SubmissionEdit {
  candidateSlug?: string
  field?: CandidateSourcedField
  value?: string
  source?: Source
}

// ---- Task 5: ward data-readiness gating (PRD §9.1) --------------------------------------------

/** Everything needed to record a brand-new nomination in a ward (`addCandidate`) — the one of
 *  two store paths (with `withdrawCandidate`) that can change a ward's candidate SET, as opposed
 *  to `updateCandidate`, which only edits an existing candidate's field content. Sourcing is
 *  mandatory on all five fields at creation time too (same guard as `updateCandidate`) — a
 *  candidate can never enter the store without a source, "not declared" included. */
export interface NewCandidateInput {
  name: string
  party: string
  photoUrl?: string
  trackRecord: Sourced<string>
  pendingCases: Sourced<string>
  assets: Sourced<string>
  education: Sourced<string>
  approachability: Sourced<string>
  news?: NewsLink[]
}

/** Per-candidate gaps found by `wardCompleteness` — empty `reasons` never appears (a candidate
 *  with no gaps is simply absent from `WardCompleteness.issues`). */
export interface WardCompletenessCandidateIssue {
  candidateId: string
  candidateName: string
  reasons: string[]
}

/** PRD §9.1's MECHANICAL half of ward readiness — see `wardCompleteness`'s doc comment. */
export interface WardCompleteness {
  wardId: string
  complete: boolean
  candidateCount: number
  issues: WardCompletenessCandidateIssue[]
  /** Set only when `complete` is `false` for a WARD-LEVEL reason that isn't any one candidate's
   *  gap — today that's exactly the `candidateCount === 0` case ("no candidates filed"), which is
   *  a distinct, honest reason from "fields are missing" (Fix 1: a zero-candidate ward used to be
   *  vacuously complete). `issues` stays `[]` in this case — there is no candidate to attach a
   *  per-candidate gap to. Absent whenever `complete` is `true`, or when incompleteness is fully
   *  explained by `issues`. */
  reason?: string
}

/** PRD §9.1: `{ complete, signedOff, ready }` plus two extra fields this codebase's UI needs —
 *  see `wardReadiness`'s doc comment for what each means. */
export interface WardReadiness {
  wardId: string
  complete: boolean
  signedOff: boolean
  /** True when a PRIOR sign-off was cleared by a candidate-set change and nothing has re-signed
   *  it off since — PRD §9.1's subtlest requirement, surfaced so a curator dashboard can call out
   *  these wards ahead of ones that were simply never signed off. */
  clearedByCandidateChange: boolean
  overridden: boolean
  ready: boolean
}

/** One row of `listHeldWards()` — the work queue `/admin/partners` (later task) shows admins so
 *  they can see curator-coverage gaps and, where warranted, `overrideHold`. */
export interface HeldWard {
  wardId: string
  wardName: string
  readiness: WardReadiness
}

/**
 * Starting point for the seq counter on a freshly-seeded store. Derived from
 * the total number of seeded records so any ids/timestamps stamp() produces
 * are guaranteed not to collide with hand-authored seed ids (sub-1, audit-1, …).
 */
function baseSeqFromSeed(): number {
  return (
    seed.wards.length +
    seed.candidates.length +
    seed.issues.length +
    seed.issueVotes.length +
    seed.users.length +
    seed.submissions.length +
    seed.audit.length +
    seed.partners.length
  )
}

/** Narrow, cheap shape check — enough to catch truncated/garbage localStorage values. */
function isStoreStateShape(value: unknown): value is StoreState {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Record<string, unknown>
  return Array.isArray(v.wards)
}

function loadInitialState(): StoreState {
  const raw = localStorage.getItem(KEY)
  if (raw) {
    try {
      const parsed: unknown = JSON.parse(raw)
      if (isStoreStateShape(parsed)) return parsed
      // Parsed fine but isn't a StoreState (e.g. missing `wards`) — fall through to seed.
    } catch {
      // Malformed JSON — fall through to seed.
    }
  }
  const cloned = structuredClone(seed) as Omit<StoreState, 'seq' | 'interests'>
  return { ...cloned, seq: baseSeqFromSeed(), interests: [] }
}

export function createStore() {
  let state: StoreState = loadInitialState()
  const listeners = new Set<() => void>()

  function persist(): void {
    localStorage.setItem(KEY, JSON.stringify(state))
    for (const listener of listeners) listener()
  }

  /** Advances the persisted counter WITHOUT persisting. Internal use inside a mutation, so the
   *  mutation can do its own single persist() once its state is fully consistent (Fix 2). */
  function nextSeq(): number {
    state.seq = (state.seq ?? baseSeqFromSeed()) + 1
    return state.seq
  }

  /** Public, standalone id/counter allocator — persists immediately since callers may use it
   *  outside of a larger mutation (e.g. the existing cross-reload monotonicity test). */
  function stamp(): number {
    const n = nextSeq()
    persist()
    return n
  }

  /** Does NOT persist — the enclosing mutation persists exactly once, after all state
   *  (submission/candidate/user changes AND this audit entry) is fully consistent. */
  function appendAudit(entry: Omit<AuditEntry, 'id' | 'at'>): void {
    const n = nextSeq()
    state.audit.push({ id: `audit-${n}`, at: `t${n}`, ...entry })
  }

  function requireUser(userId: string): User {
    const user = state.users.find((u) => u.id === userId)
    if (!user) throw new Error(`Unknown user: ${userId}`)
    return user
  }

  function requireCandidateBySlug(slug: string): Candidate {
    const candidate = state.candidates.find((c) => c.slug === slug)
    if (!candidate) throw new Error(`Unknown candidate: ${slug}`)
    return candidate
  }

  function requireWard(wardId: string): Ward {
    const ward = state.wards.find((w) => w.id === wardId)
    if (!ward) throw new Error(`Unknown ward: ${wardId}`)
    return ward
  }

  function requireIssue(id: string): Issue {
    const issue = state.issues.find((i) => i.id === id)
    if (!issue) throw new Error(`Unknown issue: ${id}`)
    return issue
  }

  function requireSubmission(submissionId: string): Submission {
    const submission = state.submissions.find((s) => s.id === submissionId)
    if (!submission) throw new Error(`Unknown submission: ${submissionId}`)
    return submission
  }

  function requireInterest(id: string): Interest {
    const interest = state.interests.find((i) => i.id === id)
    if (!interest) throw new Error(`Unknown interest: ${id}`)
    return interest
  }

  function requirePartner(slug: string): Partner {
    const partner = state.partners.find((p) => p.slug === slug)
    if (!partner) throw new Error(`Unknown partner: ${slug}`)
    return partner
  }

  /** Curators may only act within their assigned wards; admins bypass. */
  function requireScope(user: User, wardId: string): void {
    if (user.role === 'admin') return
    if (user.role === 'curator' && user.curatorWardIds?.includes(wardId)) return
    throw new Error('Outside your ward scope')
  }

  function requireAdmin(user: User): void {
    if (user.role !== 'admin') throw new Error(`${user.id} must be an admin`)
  }

  // ---- read selectors ----------------------------------------------------

  function getState(): StoreState {
    return structuredClone(state)
  }

  function getWard(id: string): Ward | undefined {
    const ward = state.wards.find((w) => w.id === id)
    return ward ? structuredClone(ward) : undefined
  }

  function listWards(): Ward[] {
    return structuredClone(state.wards)
  }

  function getCandidate(slug: string): Candidate | undefined {
    const candidate = state.candidates.find((c) => c.slug === slug)
    return candidate ? structuredClone(candidate) : undefined
  }

  /** Resolves a candidate by `id` (as opposed to `getCandidate`'s `slug` lookup) — used by
   *  `EditCandidate.tsx`, whose route param is the candidate's id, not its slug. Avoids that page
   *  having to call `getState()` (which deep-clones the entire store) just to find one candidate. */
  function getCandidateById(id: string): Candidate | undefined {
    const candidate = state.candidates.find((c) => c.id === id)
    return candidate ? structuredClone(candidate) : undefined
  }

  function listCandidatesByWard(wardId: string): Candidate[] {
    return structuredClone(state.candidates.filter((c) => c.wardId === wardId))
  }

  /**
   * ALL issues ever authored for a ward, regardless of whether they're currently in
   * `ward.issueIds` — i.e. the full master catalog `listIssues` used to (incorrectly) expose as
   * "the public list" before Fix 1. Curator-facing only: `WardIssuesEditor` uses this (not
   * `listIssues`) to render the full toggle list, so a curator can re-check an issue they
   * previously unchecked — `listIssues` alone can no longer show it once it drops out of
   * `ward.issueIds`. The public voting page (`WardIssues.tsx`) must keep using `listIssues`.
   */
  function listIssueCatalog(wardId: string): Issue[] {
    return structuredClone(state.issues.filter((i) => i.wardId === wardId))
  }

  /**
   * `ward.issueIds` is the single source of truth for which issues are votable in a ward, and in
   * what order — this is what a curator's `setWardIssues`/`addIssue`/`updateIssue` edits actually
   * control on the public page (IA §5.6, PRD §5.5). Returns the issues named by `ward.issueIds`,
   * in that order; an id with no matching `Issue` record (shouldn't happen in practice) is
   * silently skipped rather than crashing the page. An unknown wardId returns `[]`, matching the
   * previous filter-based behavior for a ward with no issues.
   *
   * DEFENSE IN DEPTH: also drops any resolved issue whose own `wardId` doesn't match the `wardId`
   * argument. `setWardIssues` guards against a foreign-ward id ever being written into
   * `ward.issueIds` in the first place, but this filter is a second, independent line of defense
   * against a corrupt or hand-edited `ward.issueIds` (e.g. a stale value rehydrated from
   * localStorage) ever leaking another ward's issue onto this ward's public page or tally.
   */
  function listIssues(wardId: string): Issue[] {
    const ward = state.wards.find((w) => w.id === wardId)
    if (!ward) return []
    const byId = new Map(state.issues.map((i) => [i.id, i]))
    const ordered = ward.issueIds
      .map((id) => byId.get(id))
      .filter((i): i is Issue => i !== undefined && i.wardId === wardId)
    return structuredClone(ordered)
  }

  /** The user's current vote-set for a ward, if they've cast one — `undefined` otherwise. Used to
   *  pre-populate the Cast-issue-vote modal so a returning voter can see and edit their existing
   *  picks instead of the form silently resetting blank (IA §7.3's "changeable" vote). */
  function getIssueVote(userId: string, wardId: string): IssueVote | undefined {
    const vote = state.issueVotes.find((v) => v.userId === userId && v.wardId === wardId)
    return vote ? structuredClone(vote) : undefined
  }

  function issueTally(wardId: string): IssueTallyRow[] {
    const issues = listIssues(wardId)
    const rows = issues.map((issue) => ({
      issueId: issue.id,
      count: state.issueVotes.filter((v) => v.wardId === wardId && v.issueIds.includes(issue.id))
        .length,
    }))
    return rows.sort((a, b) => b.count - a.count)
  }

  /**
   * Per-issue AGGREGATE vote counts for every issue id referenced by any vote cast in this ward —
   * unlike `issueTally`, NOT scoped to only the currently-votable issues named by
   * `ward.issueIds`. Powers `WardIssuesEditor`'s "N existing votes reference this issue" display
   * (including for an issue a curator has since unchecked), without that page having to call
   * `getState()` — a `structuredClone` of the ENTIRE store — just to scan `issueVotes` itself.
   *
   * PRIVACY: returns AGGREGATE counts only, never which user cast which vote or what else was in
   * a user's top-3. Individual vote choices never leave the store (see `castIssueVote`'s note on
   * why it writes no audit entry — the same reasoning applies here: this selector must never grow
   * a per-user return shape).
   */
  function issueVoteCounts(wardId: string): IssueTallyRow[] {
    const counts = new Map<string, number>()
    for (const vote of state.issueVotes) {
      if (vote.wardId !== wardId) continue
      for (const issueId of vote.issueIds) {
        counts.set(issueId, (counts.get(issueId) ?? 0) + 1)
      }
    }
    return Array.from(counts, ([issueId, count]) => ({ issueId, count }))
  }

  function listQueueForCurator(user: User): Submission[] {
    const pending = state.submissions.filter((s) => s.status === 'pending')
    if (user.role === 'admin') return structuredClone(pending)
    const scope = user.curatorWardIds ?? []
    return structuredClone(pending.filter((s) => scope.includes(s.wardId)))
  }

  function getSubmission(id: string): Submission | undefined {
    const submission = state.submissions.find((s) => s.id === id)
    return submission ? structuredClone(submission) : undefined
  }

  function listSubmissionsByUser(userId: string): Submission[] {
    return structuredClone(state.submissions.filter((s) => s.submittedByUserId === userId))
  }

  function listAudit(): AuditEntry[] {
    return structuredClone(state.audit)
  }

  function listUsers(): User[] {
    return structuredClone(state.users)
  }

  /** The full expression-of-interest queue (PRD §5.13), any status. No guard here (mirrors
   *  `listAudit`'s existing precedent — access is restricted at the routing layer, by the
   *  admin-only RoleGuard on the later admin-review page, not inside the store). */
  function listInterests(): Interest[] {
    return structuredClone(state.interests)
  }

  function getPartner(slug: string): Partner | undefined {
    const partner = state.partners.find((p) => p.slug === slug)
    return partner ? structuredClone(partner) : undefined
  }

  function listPartners(): Partner[] {
    return structuredClone(state.partners)
  }

  /** See `PartnerWardCoverage`'s doc comment for what's real (369) vs. prototype-scoped (the
   *  per-ward breakdown, limited to this seed's 5 wards). */
  function partnerWardCoverage(): PartnerWardCoverage {
    const byWard = state.wards.map((ward) => ({
      wardId: ward.id,
      wardName: ward.name,
      partnerSlugs: state.partners.filter((p) => p.wardIds.includes(ward.id)).map((p) => p.slug),
    }))
    const coveredWardIds = byWard.filter((w) => w.partnerSlugs.length > 0).map((w) => w.wardId)
    const uncoveredWardIds = byWard.filter((w) => w.partnerSlugs.length === 0).map((w) => w.wardId)
    return structuredClone({
      totalWards: TOTAL_WARDS_CITYWIDE,
      coveredWardIds,
      uncoveredWardIds,
      byWard,
    })
  }

  /**
   * Per-partner registration counts (IA §6.4 — "registrations attributed per partner"; PRD §5.13's
   * promised "report of what the forwarding achieved"). Counts how many `User` records carry each
   * partner's slug in `User.src` (set once, at registration — see `createUser`).
   *
   * PRIVACY (Critical): AGGREGATE COUNTS ONLY. Returns exactly `{ slug, count }` for every
   * currently-known partner — never a userId, name, or contact, and never a list of who registered
   * via a partner. Attribution is measurement-only (§5.12: "grants no permissions and changes
   * nothing the citizen sees") — this selector must never grow a per-user return shape, the same
   * standing rule already applied to `issueVoteCounts`/`platformMetrics.citizenSignal.issueRollUp`.
   *
   * Every known partner is included even with zero registrations (so the roster can render "0"
   * rather than omitting a row). An unrecognised/typo'd `src` value stored on a user (by design —
   * see `createUser`'s doc comment, attribution is never validated at write time) simply matches no
   * `counts` key here and is silently excluded from every partner's count — it is NOT folded into
   * any real partner's total (that would misattribute a typo to an organisation that never earned
   * it), and it never throws.
   */
  function partnerRegistrationCounts(): PartnerRegistrationCount[] {
    const counts = new Map<string, number>()
    for (const partner of state.partners) counts.set(partner.slug, 0)
    for (const user of state.users) {
      if (user.src !== undefined && counts.has(user.src)) {
        counts.set(user.src, (counts.get(user.src) ?? 0) + 1)
      }
    }
    return structuredClone(Array.from(counts, ([slug, count]) => ({ slug, count })))
  }

  /**
   * Self-accountability figures for `/data` (PRD §5.14) — see the `PlatformMetrics` doc comment
   * for what each figure means and why `medianTimeToResolve` is `null`. Every number here is
   * computed live from `state`; nothing is hardcoded, so the page always reflects the current
   * store (curator publishes, new flags, issue votes, new registrations).
   *
   * PRIVACY (standing controller decision, same as `issueVoteCounts`): this selector returns
   * AGGREGATES ONLY. `citizenSignal.issueRollUp` sums vote counts per issue across every ward —
   * it never returns a per-user vote record, a userId, or an individual's issue picks. Do not add
   * a per-user breakdown to this selector's return shape.
   */
  function platformMetrics(): PlatformMetrics {
    const wardsWithCandidates = new Set(state.candidates.map((c) => c.wardId))
    const reportCardsComplete = state.candidates.filter((c) =>
      candidateSourcedFieldValues(c).every(isCompleteSourcedField),
    ).length
    const sourcesCited = state.candidates.reduce(
      (sum, c) => sum + candidateSourcedFieldValues(c).filter(isCompleteSourcedField).length,
      0,
    )
    const activeCurators = state.users.filter((u) => u.role === 'curator' && u.active).length

    // FIX 3: sum of each submission's dedup `count` — the measure of citizen policing PRD §6.3
    // calls a "strong signal to the curator" — NOT the number of (deduped) queue records.
    const flagsRaised = state.submissions.reduce((sum, s) => sum + s.count, 0)
    // Deliberately record-based (unlike flagsRaised): resolution acts on the deduped queue item.
    const flagsResolved = state.submissions.filter((s) => s.status !== 'pending').length

    // AGGREGATE across every ward — deliberately not scoped to one wardId, unlike
    // issueTally/issueVoteCounts. Counts only; never which user cast which vote.
    const rollUpCounts = new Map<string, number>()
    for (const vote of state.issueVotes) {
      for (const issueId of vote.issueIds) {
        rollUpCounts.set(issueId, (rollUpCounts.get(issueId) ?? 0) + 1)
      }
    }
    const issueRollUp: IssueRollUpRow[] = Array.from(rollUpCounts, ([issueId, count]) => {
      const issue = state.issues.find((i) => i.id === issueId)
      return { issueId, wardId: issue?.wardId ?? '', title: issue?.title ?? issueId, count }
    }).sort((a, b) => b.count - a.count)

    // `state.audit` is always in append order (oldest first — see Audit.tsx's file comment for
    // why that's a safe assumption to rely on directly instead of re-sorting), so its last entry
    // is the most recently recorded event without needing to import lib/stamps.ts's comparator
    // into the store layer.
    const asOf = state.audit.length > 0 ? state.audit[state.audit.length - 1].at : undefined

    const metrics: PlatformMetrics = {
      asOf,
      coverage: {
        wardsWithPublishedCandidateData: wardsWithCandidates.size,
        totalWards: TOTAL_WARDS_CITYWIDE,
        reportCardsComplete,
        totalCandidates: state.candidates.length,
        activeCurators,
        sourcesCited,
      },
      integrity: {
        flagsRaised,
        flagsResolved,
        medianTimeToResolve: null,
        medianResolutionUnavailableReason:
          "Not computable in this prototype: seed submissions carry real ISO-8601 timestamps, but resolution events use a live session counter, not a clock — the two can't be subtracted into a real duration without fabricating one.",
      },
      citizenSignal: {
        issueRollUp,
        totalIssueVotes: state.issueVotes.length,
        // FIX 2: citizen-role accounts only — curators/admins are platform staff, not citizens.
        registeredCitizens: state.users.filter((u) => u.role === 'citizen').length,
      },
    }
    return structuredClone(metrics)
  }

  /** PRD §9.1 completeness: does one candidate's report card carry everything required for a
   *  ward's data to be ready for a candidate-referencing send? Returns a list of human-readable
   *  gaps — empty when the candidate has none. Name/party come straight off the EC nomination and
   *  must simply be present (non-empty); each of the five Sourced fields must carry a real
   *  source, and either a populated value or an explicit `notDeclared` marker (§9.1: a valid,
   *  complete answer, not a gap) — see `isCompleteSourcedField`. Reasons use `CANDIDATE_FIELD_LABELS`'
   *  friendly names (e.g. "Criminal record / pending cases"), not the raw camelCase field key —
   *  curators read these directly on the readiness panel (Fix 4). */
  function candidateReadinessIssues(candidate: Candidate): string[] {
    const issues: string[] = []
    if (!candidate.name.trim()) issues.push('Candidate name is missing.')
    if (!candidate.party.trim()) issues.push('Party / independent status is missing.')
    for (const field of CANDIDATE_SOURCED_FIELDS) {
      if (!isCompleteSourcedField(candidate[field])) {
        issues.push(
          `${CANDIDATE_FIELD_LABELS[field]} needs a source, and either a value or an explicit "not declared" marker.`,
        )
      }
    }
    return issues
  }

  /**
   * PRD §9.1's MECHANICAL completeness check — half of what makes a ward "ready" for a
   * candidate-referencing send (the other half is human curator sign-off — see `signOffWard`).
   * Every candidate currently on record for the ward (i.e. who has filed a nomination) must carry
   * name + party and every Sourced field either populated or explicitly `notDeclared`, each with
   * a real source.
   *
   * FIX 1 (real defect, previously pinned by tests as intended behavior): a ward with ZERO
   * candidates on record is NOT complete. The literal reading of "every candidate who has filed a
   * nomination has a report card" is vacuously true when nobody has filed — but PRD §9.1 exists
   * to stop exactly the failure mode a vacuous pass would create: a curator or admin being told a
   * ward's data is "ready" for a candidate-referencing send when there is nothing to reference.
   * This is a distinct, honest WARD-LEVEL reason ("no candidates filed"), not a per-candidate
   * report-card gap, so it is surfaced via `reason`, not `issues` (which stays `[]` — there is no
   * candidate to attach a gap to).
   *
   * Read selector: does not throw for an unknown wardId (matches `listCandidatesByWard`'s
   * convention) — an id with no matching candidates is just reported as 0 candidates, incomplete.
   */
  function wardCompleteness(wardId: string): WardCompleteness {
    const candidates = state.candidates.filter((c) => c.wardId === wardId)
    if (candidates.length === 0) {
      return structuredClone({
        wardId,
        complete: false,
        candidateCount: 0,
        issues: [],
        reason:
          'No candidates have filed nominations in this ward yet — there is nothing to reference in a candidate-referencing send.',
      })
    }
    const issues: WardCompletenessCandidateIssue[] = []
    for (const candidate of candidates) {
      const reasons = candidateReadinessIssues(candidate)
      if (reasons.length > 0) {
        issues.push({ candidateId: candidate.id, candidateName: candidate.name, reasons })
      }
    }
    return structuredClone({
      wardId,
      complete: issues.length === 0,
      candidateCount: candidates.length,
      issues,
    })
  }

  /**
   * PRD §9.1: a ward is `ready` for a candidate-referencing send only when BOTH `complete`
   * (mechanical, see `wardCompleteness`) AND `signedOff` (human, see `signOffWard`) hold — or an
   * admin has explicitly `overridden` the hold (see `overrideHold`). `clearedByCandidateChange`
   * flags a ward whose sign-off was automatically cleared by a candidate-set change (§9.1's
   * subtlest requirement) so a curator dashboard can call it out ahead of a ward that was simply
   * never signed off. Read selector: does not throw for an unknown wardId.
   */
  function wardReadiness(wardId: string): WardReadiness {
    const ward = state.wards.find((w) => w.id === wardId)
    const completeness = wardCompleteness(wardId)
    const signedOff = ward?.readySignOff !== undefined
    const overridden = ward?.holdOverride !== undefined
    const clearedByCandidateChange = ward?.signOffClearedByCandidateChange === true
    const ready = (completeness.complete && signedOff) || overridden
    return structuredClone({
      wardId,
      complete: completeness.complete,
      signedOff,
      clearedByCandidateChange,
      overridden,
      ready,
    })
  }

  /** Wards NOT currently ready for a candidate-referencing send (PRD §9.1) — the work queue
   *  `/admin/partners` (later task) surfaces so admins can see curator-coverage gaps and, where
   *  warranted, `overrideHold`. An overridden ward is `ready` (see `wardReadiness`), so it never
   *  appears here once overridden. */
  function listHeldWards(): HeldWard[] {
    return structuredClone(
      state.wards
        .map((ward) => ({ wardId: ward.id, wardName: ward.name, readiness: wardReadiness(ward.id) }))
        .filter((row) => !row.readiness.ready),
    )
  }

  // ---- lifecycle -----------------------------------------------------------

  function subscribe(fn: () => void): () => void {
    listeners.add(fn)
    return () => listeners.delete(fn)
  }

  function reset(): void {
    state = { ...structuredClone(seed), seq: baseSeqFromSeed(), interests: [] }
    persist()
  }

  // ---- mutations -----------------------------------------------------------

  function submitFlag(input: SubmitFlagInput, user: User): Submission {
    const existing = state.submissions.find(
      (s) =>
        s.status === 'pending' &&
        s.wardId === input.wardId &&
        s.candidateId === input.candidateId &&
        s.field === input.field,
    )
    if (existing) {
      existing.count += 1
      appendAudit({
        actorUserId: user.id,
        action: 'flag.submitted',
        wardId: input.wardId,
        detail: `Duplicate flag on ${input.field} merged into ${existing.id} (count ${existing.count}).`,
      })
      persist()
      return existing
    }

    const n = nextSeq()
    const submission: Submission = {
      id: `sub-${n}`,
      kind: 'flag',
      wardId: input.wardId,
      candidateId: input.candidateId,
      field: input.field,
      detail: input.detail,
      sourceUrl: input.sourceUrl,
      submittedByUserId: user.id,
      status: 'pending',
      count: 1,
      createdAt: `t${n}`,
    }
    state.submissions.push(submission)
    appendAudit({
      actorUserId: user.id,
      action: 'flag.submitted',
      wardId: input.wardId,
      detail: `New flag on ${input.field} (${submission.id}).`,
    })
    persist()
    return submission
  }

  /**
   * Anonymous expression of interest (PRD §5.13, `/partner-with-us`). Deliberately takes NO
   * User/actor argument and is never wrapped by `requireAuth` anywhere in the UI: requiring
   * registration before someone can volunteer would filter out exactly the RWA/civic-org
   * volunteers this recruitment funnel exists to reach (an RWA is an institution, not a citizen
   * with a home ward). Always lands `pending` — see `reviewInterest` for the only way status
   * ever changes ("nobody self-activates", §5.13/§14).
   *
   * NOT audited: submitting an interest is neither a published data change nor a moderation/
   * admin action (the audit log's standing scope — see castIssueVote's note above for the same
   * reasoning applied elsewhere), and it would put an anonymous applicant's name/contact into an
   * admin-readable log before any admin has even looked at the application.
   *
   * RATE-LIMIT GUARD (§6.3) — HONEST SCOPE: this is a client-side, single-browser prototype with
   * no server, no IP address, and (per project ban) no Date.now() to build a real time-window
   * limiter from. The guard below refuses a second submission for the same (contact, path) pair
   * while an earlier one from that contact is still `pending` — enough to stop a naive repeated
   * submit (double-click, a resubmitted form, a dumb retry loop) from queuing duplicate
   * admin-review items, mirroring submitFlag's existing "collapse duplicates" pattern above. It
   * does NOT: limit submission frequency/rate in any real sense, identify or block a specific
   * browser/device/IP, or stop an abuser who simply varies the contact field each time. This is
   * NOT abuse protection — real rate-limiting needs a real backend, which this prototype has
   * none of.
   */
  function submitInterest(input: SubmitInterestInput): Interest {
    const contactKey = input.contact.trim().toLowerCase()
    const duplicate = state.interests.find(
      (i) =>
        i.status === 'pending' &&
        i.path === input.path &&
        i.contact.trim().toLowerCase() === contactKey,
    )
    if (duplicate) {
      throw new Error(
        'You already have a pending application for this path — an admin will review it soon.',
      )
    }

    const n = nextSeq()
    const interest: Interest = {
      id: `interest-${n}`,
      path: input.path,
      name: input.name,
      contact: input.contact,
      wardId: input.wardId,
      note: input.note,
      status: 'pending',
      createdAt: `t${n}`,
    }
    state.interests.push(interest)
    persist()
    return interest
  }

  /**
   * Admin decision on an anonymous expression of interest (PRD §5.13 — "nobody self-activates").
   * This function ONLY records the decision — flips `status` and writes one audit entry for the
   * moderation action itself. It does NOT provision a partner slug/kit for an accepted
   * `awareness` applicant, or hand a `curation` applicant off into the curator-vetting flow: both
   * are real admin-facing workflows that build on top of this store API in the later
   * admin-review-page task (this task's scope is "provide the store API").
   *
   * Audited as a moderation action, per the audit log's standing scope of "published data changes
   * + moderation/admin actions". Deliberately does NOT copy the applicant's name/contact into the
   * audit detail string — the audit log is admin-readable, and the same judgment applied to
   * citizen votes/prefs applies here: the moderation trail needs to record WHAT decision was made
   * and on WHICH application id, not re-expose an anonymous applicant's personal contact details
   * a second time in a differently-scoped, differently-audienced log.
   */
  function reviewInterest(id: string, decision: InterestDecision, admin: User): void {
    requireAdmin(admin)
    const interest = requireInterest(id)
    interest.status = decision
    appendAudit({
      actorUserId: admin.id,
      action: 'interest.reviewed',
      wardId: interest.wardId,
      detail: `${decision === 'accepted' ? 'Accepted' : 'Rejected'} ${interest.path} interest application ${interest.id}.`,
    })
    persist()
  }

  /** Lowercases, collapses any run of non-alphanumeric characters into a single hyphen, and trims
   *  leading/trailing hyphens — e.g. "Sunset Layout RWA!" -> "sunset-layout-rwa". Falls back to
   *  the literal string "partner" for a name with no alphanumeric characters at all (never returns
   *  an empty slug). */
  function slugifyPartnerName(name: string): string {
    const slug = name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
    return slug || 'partner'
  }

  /** Guarantees a slug not already used by an existing partner. On a collision, appends the
   *  persisted `nextSeq()` counter (never `Date.now()`/`Math.random()`, both banned project-wide)
   *  until unique — so provisioning two partners from the same name (e.g. two EOI applicants who
   *  both typed "Civic Group") still produces two distinct, addressable `/partner/{slug}` pages. */
  function uniquePartnerSlug(name: string): string {
    const base = slugifyPartnerName(name)
    if (!state.partners.some((p) => p.slug === base)) return base
    let candidate: string
    do {
      candidate = `${base}-${nextSeq()}`
    } while (state.partners.some((p) => p.slug === candidate))
    return candidate
  }

  /**
   * Admin-provisions a new Partner record (PRD §5.12/§5.13) — the only way a `Partner` is ever
   * created after the initial seed. Slug is always DERIVED from `input.name` (see
   * `uniquePartnerSlug`), never accepted as a caller-supplied field, so nothing can forge a slug
   * that collides with (or impersonates) an existing partner's kit URL. Admin-only (`requireAdmin`
   * — PRD §7's "Manage partners & view ward coverage" row), checked before any mutation. Published
   * change: audited, with the partner's own name/slug in the detail string — unlike an EOI
   * applicant's contact details, a Partner's name is meant to be public-facing (it is literally
   * what renders on the partner's own `/partner/{slug}` kit page), so recording it in the
   * admin-readable audit log is not a privacy leak the way copying an applicant's contact would be.
   *
   * Two callers: `/admin/partners`'s EOI-review flow, on accepting an `awareness` application
   * (PRD §5.13 — "accepting an awareness applicant provisions a partner slug and kit"), which
   * passes `input.interestId` so the new `Partner.interestId` records a real foreign key back to
   * the `Interest` that prompted it (see `Partner.interestId`'s doc comment in types.ts — this
   * replaced an earlier name-match lookup that could collide); and `/admin/partners`'s "add
   * partner" form (IA §6.4), which calls this with no `interestId` for a partner with no
   * originating EOI.
   */
  function createPartner(input: CreatePartnerInput, admin: User): Partner {
    requireAdmin(admin)
    const slug = uniquePartnerSlug(input.name)
    const partner: Partner = {
      slug,
      name: input.name,
      kind: input.kind,
      wardIds: [...input.wardIds],
      interestId: input.interestId,
    }
    state.partners.push(partner)
    appendAudit({
      actorUserId: admin.id,
      action: 'partner.created',
      detail: `Created partner ${partner.name} (${partner.slug}).`,
    })
    persist()
    return structuredClone(partner)
  }

  /**
   * Admin-edits an existing Partner's name/kind/ward coverage (IA §6.4 — "add/edit partners and
   * their slugs"). Admin-only (`requireAdmin`), checked before any write. `slug` is NOT part of
   * `PartnerPatch` and never changes here, even when `name` changes: this partner's slug is what
   * `?src={slug}` links already in the wild and its `/partner/{slug}` kit URL are keyed on — a
   * rename that also re-derived the slug would silently break both, and this prototype has no way
   * to redirect an old slug to a new one. So a rename keeps the same slug permanently; if the
   * name drifts far from the slug, that's a visible, honest trade-off, not a broken link.
   * Published change: audited, same "the partner's own name is public-facing" reasoning as
   * `createPartner`'s doc comment.
   */
  function updatePartner(slug: string, patch: PartnerPatch, admin: User): Partner {
    requireAdmin(admin)
    const partner = requirePartner(slug)
    if (patch.name !== undefined) partner.name = patch.name
    if (patch.kind !== undefined) partner.kind = patch.kind
    if (patch.wardIds !== undefined) partner.wardIds = [...patch.wardIds]
    appendAudit({
      actorUserId: admin.id,
      action: 'partner.updated',
      detail: `Updated partner ${partner.name} (${partner.slug}).`,
    })
    persist()
    return structuredClone(partner)
  }

  /**
   * NOTE: does not write an audit entry (controller decision). Issue-vote results are only
   * ever surfaced in aggregate (issueTally); logging "user X voted for A,B" into the
   * admin-readable audit log would leak individual voting choices, which was never requested
   * and isn't needed to support rollback/provenance of published data.
   *
   * Every id in `issueIds` must resolve to a known `Issue` that is currently votable in THIS
   * ward, i.e. present in `ward.issueIds` (the authoritative source of truth — see `listIssues`
   * and `setWardIssues`'s matching guard). Checked before any mutation, so a rejected call
   * leaves `issueVotes` (and, since this function never audits, the audit log too) completely
   * untouched — no partial writes. Without this, a caller could record a vote for another
   * ward's issue, or for an id that doesn't exist at all, silently polluting `issueTally` /
   * `issueVoteCounts` and the public results.
   */
  function castIssueVote(user: User, wardId: string, issueIds: string[]): IssueVote {
    const uniqueCount = new Set(issueIds).size
    if (issueIds.length > 3 || uniqueCount !== issueIds.length) {
      throw new Error('You can vote your top 3 issues')
    }
    if (wardId !== user.homeWardId) {
      throw new Error('You can only vote in your home ward')
    }
    const ward = requireWard(wardId)
    for (const issueId of issueIds) {
      requireIssue(issueId)
      if (!ward.issueIds.includes(issueId)) {
        throw new Error(`Issue ${issueId} is not votable in ward ${wardId}`)
      }
    }

    state.issueVotes = state.issueVotes.filter(
      (v) => !(v.userId === user.id && v.wardId === wardId),
    )
    const vote: IssueVote = { userId: user.id, wardId, issueIds: [...issueIds] }
    state.issueVotes.push(vote)
    persist()
    return vote
  }

  /**
   * Accepting a flag that targets a known candidate Sourced field (`submission.candidateId` is
   * set AND `submission.field` is one of the five `CandidateSourcedField`s) MUST publish a
   * complete, sourced edit — sourcing is mandatory (PRD §6/§11). Previously an incomplete `edit`
   * was silently skipped while the submission was still marked `accepted` and audited, producing
   * a FALSE "this was published" audit trail. Now it throws instead, before any state is touched.
   *
   * A submission that does NOT target a candidate field (e.g. `candidateId` undefined, or a
   * free-form `field` that isn't one of the five known Sourced fields — a legitimate shape per
   * `SubmitFlagInput`, exercised by `actions.test.ts`'s ward-level flag tests) has nothing to
   * publish to a candidate. Accepting it is a pure moderation decision — status + audit only, no
   * candidate write, and no source is required, since there's no field to attach one to.
   */
  function acceptSubmission(submissionId: string, curator: User, edit: SubmissionEdit): void {
    const submission = requireSubmission(submissionId)
    requireScope(curator, submission.wardId)

    const targetsCandidateField =
      submission.candidateId !== undefined && isCandidateSourcedField(submission.field)

    if (targetsCandidateField) {
      if (!edit.candidateSlug || !edit.field || edit.value === undefined || !edit.source) {
        throw new Error(
          'Cannot accept this flag: a corrected value and a source are required to publish a candidate field.',
        )
      }
      const candidate = requireCandidateBySlug(edit.candidateSlug)
      candidate[edit.field] = { value: edit.value, source: edit.source }
    }

    submission.status = 'accepted'
    appendAudit({
      actorUserId: curator.id,
      action: edit.field ? `candidate.${edit.field}.updated` : 'submission.accepted',
      wardId: submission.wardId,
      detail: `Accepted flag ${submission.id}${edit.field ? ` on ${edit.field}` : ''}.`,
    })
    persist()
  }

  function rejectSubmission(submissionId: string, curator: User, reason: string): void {
    const submission = requireSubmission(submissionId)
    requireScope(curator, submission.wardId)
    submission.status = 'rejected'
    submission.reason = reason
    appendAudit({
      actorUserId: curator.id,
      action: 'submission.rejected',
      wardId: submission.wardId,
      detail: `Rejected flag ${submission.id} on ${submission.field}: ${reason}`,
    })
    persist()
  }

  function updateCandidate(slug: string, patch: CandidatePatch, curator: User): void {
    const candidate = requireCandidateBySlug(slug)
    requireScope(curator, candidate.wardId)
    // Sanitize into a copy — never mutate the caller's patch object. The aiExtracted flag is
    // reserved for ingestAffidavit; curator saves always publish unmarked (confirm-by-edit), so
    // any caller-supplied aiExtracted on a sourced field is stripped here, whether it's trying to
    // falsely mark a human-written field or to preserve the marker across a confirming save.
    const sanitizedPatch: Record<string, unknown> = { ...patch }
    for (const key of Object.keys(patch)) {
      if (!isCandidateSourcedField(key)) continue
      const value = (patch as Record<string, unknown>)[key]
      if (!isValidSourcedPatchValue(value)) {
        throw new Error(
          `Cannot publish "${key}": a sourced field requires a non-empty source label and a source type of 'affidavit' or 'curator'.`,
        )
      }
      const { aiExtracted: _aiExtracted, ...rest } = value
      sanitizedPatch[key] = rest
    }
    Object.assign(candidate, sanitizedPatch)
    appendAudit({
      actorUserId: curator.id,
      action: 'candidate.updated',
      wardId: candidate.wardId,
      detail: `Updated candidate fields: ${Object.keys(patch).join(', ') || '(none)'} for ${candidate.name} (${candidate.id}).`,
    })
    persist()
  }

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
    const affidavit: CandidateAffidavit = {
      providedFileName: fileName,
      providedEcUrl: ecUrl,
      storedUrl,
      ingestedAt: `t${n}`,
    }
    candidate.affidavit = affidavit

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

  /**
   * PRD §9.1's subtlest requirement: a ward's sign-off is only ever valid against the exact
   * candidate set it was given for. Called by every store path that changes WHICH candidates
   * exist in a ward — today that is exactly `addCandidate` and `withdrawCandidate` below, and NO
   * other mutation (in particular, NOT `updateCandidate`, which only edits an existing
   * candidate's field content and is not a "candidate set" change). Any future mutation that adds
   * or removes a candidate from a ward MUST call this too. No-op on `signOffClearedByCandidateChange`
   * if the ward was not currently signed off, so this never fabricates a "was cleared" flag for a
   * ward that was never signed off in the first place.
   */
  function clearReadySignOffForCandidateChange(ward: Ward): void {
    if (ward.readySignOff !== undefined) {
      ward.signOffClearedByCandidateChange = true
    }
    ward.readySignOff = undefined
  }

  /**
   * Records a new nomination filed in a ward (PRD §9.1: "...a new nomination..." materially
   * changes the candidate set). Ward-scoped like every other curator write. Sourcing is mandatory
   * on every one of the five report-card fields at creation time too — reuses the exact same
   * `isValidSourcedPatchValue` guard as `updateCandidate`, so a candidate can never enter the
   * store with an invalid/missing source (a `notDeclared` field still needs a real source — see
   * `Sourced.notDeclared`'s doc comment in types.ts). All guards run before any write. Clears the
   * ward's sign-off (see `clearReadySignOffForCandidateChange`) since the candidate list it was
   * given against no longer exists unchanged. Published change: audited.
   */
  function addCandidate(wardId: string, input: NewCandidateInput, curator: User): Candidate {
    const ward = requireWard(wardId)
    requireScope(curator, wardId)
    if (!input.name.trim()) throw new Error("Enter the candidate's name.")
    if (!input.party.trim()) throw new Error('Enter the candidate’s party (or "Independent").')
    for (const field of CANDIDATE_SOURCED_FIELDS) {
      if (!isValidSourcedPatchValue(input[field])) {
        throw new Error(
          `Cannot record this candidate: "${field}" needs a non-empty source label and a source type of 'affidavit' or 'curator'.`,
        )
      }
    }
    const n = nextSeq()
    const candidate: Candidate = {
      id: `c-${n}`,
      slug: `${wardId}-candidate-${n}`,
      wardId,
      name: input.name.trim(),
      photoUrl: input.photoUrl ?? '',
      party: input.party.trim(),
      trackRecord: input.trackRecord,
      pendingCases: input.pendingCases,
      assets: input.assets,
      education: input.education,
      approachability: input.approachability,
      news: input.news ?? [],
    }
    state.candidates.push(candidate)
    clearReadySignOffForCandidateChange(ward)
    appendAudit({
      actorUserId: curator.id,
      action: 'candidate.nominated',
      wardId,
      detail: `Recorded new nomination: ${candidate.name} (${candidate.id}).`,
    })
    persist()
    return structuredClone(candidate)
  }

  /**
   * Records a withdrawn nomination (PRD §9.1: "...or a withdrawal") — removes the candidate
   * record entirely, mirroring how a withdrawn candidate no longer appears anywhere
   * citizen-facing. Ward-scoped by the candidate's own wardId, checked before any write. Clears
   * the ward's sign-off for the same reason as `addCandidate`. Published change: audited.
   */
  function withdrawCandidate(candidateId: string, curator: User): void {
    const candidate = state.candidates.find((c) => c.id === candidateId)
    if (!candidate) throw new Error(`Unknown candidate: ${candidateId}`)
    requireScope(curator, candidate.wardId)
    const ward = requireWard(candidate.wardId)
    state.candidates = state.candidates.filter((c) => c.id !== candidateId)
    clearReadySignOffForCandidateChange(ward)
    appendAudit({
      actorUserId: curator.id,
      action: 'candidate.withdrawn',
      wardId: candidate.wardId,
      detail: `Recorded withdrawal: ${candidate.name} (${candidate.id}).`,
    })
    persist()
  }

  function updateWard(id: string, patch: WardPatch, curator: User): void {
    const ward = requireWard(id)
    requireScope(curator, id)
    Object.assign(ward, patch)
    appendAudit({
      actorUserId: curator.id,
      action: 'ward.updated',
      wardId: id,
      detail: `Updated ward fields: ${Object.keys(patch).join(', ') || '(none)'}.`,
    })
    persist()
  }

  /**
   * PRD §9.1's human half of ward readiness: a curator explicitly marks a ward ready for
   * candidate-referencing comms. Requires mechanical completeness first (`wardCompleteness`) — a
   * curator cannot sign off a ward with known gaps; "the mechanical check alone cannot tell a
   * thin ward from a finished one" (§9.1) describes what sign-off adds ON TOP of completeness,
   * not a bypass of it. Ward-scoped like every other curator mutation (`requireScope`), checked
   * BEFORE any write, so an out-of-scope call never produces a false "signed off" state. Resets
   * `signOffClearedByCandidateChange` — this is a fresh sign-off against the current candidate
   * set. Published change: audited (§9.1 says so explicitly).
   */
  function signOffWard(wardId: string, curator: User): void {
    const ward = requireWard(wardId)
    requireScope(curator, wardId)
    const completeness = wardCompleteness(wardId)
    if (!completeness.complete) {
      throw new Error(
        "Cannot sign off: this ward's report cards are not complete yet — see the gaps listed above.",
      )
    }
    const n = nextSeq()
    ward.readySignOff = { by: curator.id, at: `t${n}` }
    ward.signOffClearedByCandidateChange = false
    appendAudit({
      actorUserId: curator.id,
      action: 'ward.readySignOff.set',
      wardId,
      detail: `Signed off ${ward.name} as ready for candidate-referencing comms.`,
    })
    persist()
  }

  /**
   * PRD §9.1: admin override of a comms hold — releases a candidate-referencing send for a ward
   * that isn't (mechanically complete AND signed off), e.g. a known curator-coverage gap the
   * admin has decided not to block a send on. Admin-only (§7's "Override ward comms hold" = Admin
   * column only, no Scope) — `requireAdmin`, not `requireScope`. Refuses to override a ward
   * that's already ready without one, so the audit trail never claims to have released a hold
   * that didn't exist. Published change: audited.
   */
  function overrideHold(wardId: string, admin: User): void {
    const ward = requireWard(wardId)
    requireAdmin(admin)
    const completeness = wardCompleteness(wardId)
    const alreadySignedOff = ward.readySignOff !== undefined
    if (completeness.complete && alreadySignedOff) {
      throw new Error('This ward is already ready — there is no comms hold to override.')
    }
    const n = nextSeq()
    ward.holdOverride = { by: admin.id, at: `t${n}` }
    appendAudit({
      actorUserId: admin.id,
      action: 'ward.holdOverride.set',
      wardId,
      detail: `Overrode the comms hold on ${ward.name}.`,
    })
    persist()
  }

  /**
   * Every id in `issues` must resolve to a known `Issue` that belongs to THIS ward — checked
   * before any mutation. Without this, a cross-ward id written into `ward.issueIds` would leak
   * another ward's issue onto this ward's public `/ward/:id/issues` page and into its tally (see
   * `listIssues`'s defense-in-depth filter for the second half of this guarantee). Guard runs
   * entirely before `ward.issueIds` is written and before `appendAudit`, so a rejected call leaves
   * both the ward and the audit log untouched — no partial writes.
   */
  function setWardIssues(wardId: string, issues: string[], curator: User): void {
    const ward = requireWard(wardId)
    requireScope(curator, wardId)
    for (const issueId of issues) {
      const issue = requireIssue(issueId)
      if (issue.wardId !== wardId) {
        throw new Error(`Issue ${issueId} does not belong to ward ${wardId}`)
      }
    }
    ward.issueIds = [...issues]
    appendAudit({
      actorUserId: curator.id,
      action: 'ward.issues.updated',
      wardId,
      detail: `Set votable issues to: ${issues.join(', ') || '(none)'}.`,
    })
    persist()
  }

  /**
   * Authors a brand-new votable issue for a ward (PRD §5.5/IA §5.6 — curators must be able to
   * add, not just toggle, ward issues). Scope-guarded like the other curator mutations. Id comes
   * from the persisted `nextSeq()` counter (never `Date.now()`/`Math.random()`), following the
   * same `<kind>-<n>` convention as `sub-${n}`/`u-${n}`. Appends the new issue's id to
   * `ward.issueIds` immediately, so — per `listIssues`/`issueTally` now reading `ward.issueIds`
   * as the source of truth (Fix 1) — it shows up on the public `/ward/:id/issues` page and joins
   * the tally (starting at 0 votes) as soon as this returns.
   */
  function addIssue(wardId: string, input: NewIssueInput, curator: User): Issue {
    const ward = requireWard(wardId)
    requireScope(curator, wardId)
    const n = nextSeq()
    const issue: Issue = {
      id: `issue-${n}`,
      wardId,
      title: input.title,
      description: input.description,
    }
    state.issues.push(issue)
    ward.issueIds = [...ward.issueIds, issue.id]
    appendAudit({
      actorUserId: curator.id,
      action: 'issue.created',
      wardId,
      detail: `Added issue "${issue.title}" (${issue.id}).`,
    })
    persist()
    return structuredClone(issue)
  }

  /** Edits an existing issue's title/description (PRD §5.5/IA §5.6). Scope-guarded by the
   *  issue's own wardId — a curator can only edit issues in wards they're assigned to. Does not
   *  touch `ward.issueIds` or `state.issueVotes`; it only changes the issue's own content, which
   *  is reflected everywhere the issue's id already appears (public page, tally, editor). */
  function updateIssue(issueId: string, patch: IssuePatch, curator: User): void {
    const issue = requireIssue(issueId)
    requireScope(curator, issue.wardId)
    Object.assign(issue, patch)
    appendAudit({
      actorUserId: curator.id,
      action: 'issue.updated',
      wardId: issue.wardId,
      detail: `Updated issue fields: ${Object.keys(patch).join(', ') || '(none)'} for ${issue.title} (${issue.id}).`,
    })
    persist()
  }

  function setUserActive(userId: string, active: boolean, admin: User): void {
    requireAdmin(admin)
    const user = requireUser(userId)
    user.active = active
    appendAudit({
      actorUserId: admin.id,
      action: 'user.active.updated',
      detail: `Set ${user.id} active=${active}.`,
    })
    persist()
  }

  function setUserRole(userId: string, role: Role, wardIds: string[] | undefined, admin: User): void {
    requireAdmin(admin)
    const user = requireUser(userId)
    user.role = role
    // INTENTIONAL: any role change away from 'curator' clears curatorWardIds, even a temporary
    // demotion. A non-curator carrying a stale ward scope is worse than losing it — if the user
    // is later re-promoted, an admin must re-assign wards explicitly. Pinned by a test in
    // actions.test.ts ("setUserRole clears curatorWardIds ...").
    user.curatorWardIds = role === 'curator' ? [...(wardIds ?? [])] : undefined
    appendAudit({
      actorUserId: admin.id,
      action: 'user.role.updated',
      detail: `Set ${user.id} role=${role}${role === 'curator' ? ` (wards: ${(wardIds ?? []).join(', ') || '(none)'})` : ''}.`,
    })
    persist()
  }

  /**
   * Registers a new citizen account so registration survives reload (previously AuthContext only
   * held new users in transient React state). Audited as an account event, consistent with the
   * audit log's scope of published data changes + moderation/admin actions — individual issue
   * votes remain unaudited (see castIssueVote above).
   *
   * `src` (PRD §5.12): the partner slug, if any, this registration is attributed to via a
   * `?src=` link the visitor arrived on (captured/threaded by `lib/attribution.ts` +
   * `AuthContext.loginNew`). Persisted onto the user record verbatim, with NO validation against
   * `state.partners` — attribution is measurement-only, so an unrecognised/typo'd slug is still
   * recorded as-is rather than silently dropped or rejected. Deliberately NOT written into the
   * audit detail string below: the audit log is admin-readable, and turning "who referred this
   * citizen" into a permanent, cross-referenceable audit-log fact would make the log a
   * citizen-tracking surface, which is exactly what §5.12's "grants no permissions, changes
   * nothing the citizen sees" is guarding against.
   *
   * `futureToolsConsent` (PRD §17, deps §2.6/§7.2): the separate, optional future-civic-tools
   * opt-in — see `User.futureToolsConsent`'s doc comment for why it is not folded into
   * `registrationConsent`.
   */
  function createUser(input: {
    contact: string
    homeWardId?: string
    name?: string
    language?: User['language']
    src?: string
    futureToolsConsent?: boolean
  }): User {
    const n = nextSeq()
    const user: User = {
      id: `u-${n}`,
      name: input.name ?? input.contact,
      contact: input.contact,
      role: 'citizen',
      homeWardId: input.homeWardId,
      language: input.language ?? 'en',
      curatorWardIds: undefined,
      active: true,
      src: input.src,
      registrationConsent: {
        at: `t${nextSeq()}`,
        wordingVersion: REGISTRATION_CONSENT_WORDING_VERSION,
      },
      futureToolsConsent: input.futureToolsConsent,
    }
    state.users.push(user)
    appendAudit({
      actorUserId: user.id,
      action: 'user.created',
      wardId: input.homeWardId,
      detail: `Registered new citizen ${user.id} (${input.contact}).`,
    })
    persist()
    return structuredClone(user)
  }

  /**
   * Lets a citizen set/change their own registered home ward — `/account`'s home-ward select
   * (IA §4.1) is the only UI that calls this directly; a ward page's "register for updates" slot
   * (IA §3.2) sets it implicitly via registration instead (PRD §5.1: home-ward switching lives on
   * `/account` only). Takes an actor `User` like the other actor-sensitive mutators
   * (`castIssueVote`, `acceptSubmission`, `setUserRole`) and asserts self-only: the actor must be
   * the same user as `userId`, UNLESS the actor is an admin (admins may set another user's home
   * ward, e.g. from an admin support flow). Audited like the other account/data mutations, and
   * validates the ward exists (requireWard throws otherwise) so a bad id can never silently
   * corrupt a user's homeWardId.
   *
   * PRD §5.5 / IA §7.3: "one active vote-set" means only the CURRENT home ward's issue vote
   * counts. Moving to a new ward therefore retires (deletes) any issue vote the user cast in
   * their previous ward — otherwise a stale vote-set would keep counting in that ward's public
   * issueTally/issueVoteCounts forever, even though the voter no longer lives there. A first-time
   * set (no previous ward) retires nothing.
   */
  function setHomeWard(userId: string, wardId: string, actor: User): void {
    if (actor.id !== userId) requireAdmin(actor)
    const user = requireUser(userId)
    requireWard(wardId)
    const previousWardId = user.homeWardId
    user.homeWardId = wardId
    if (previousWardId && previousWardId !== wardId) {
      state.issueVotes = state.issueVotes.filter(
        (v) => !(v.userId === userId && v.wardId === previousWardId),
      )
    }
    appendAudit({
      actorUserId: actor.id,
      action: 'user.homeWard.updated',
      wardId,
      detail:
        previousWardId && previousWardId !== wardId
          ? `Set home ward to ${wardId} for ${user.id}, retiring their issue vote-set in ${previousWardId}.`
          : `Set home ward to ${wardId} for ${user.id}.`,
    })
    persist()
  }

  /**
   * Sets a user's saved UI/notification language (PRD §8 — governs their notifications, and
   * (via the Account page) the session-wide language toggle when they change it there).
   *
   * NOT audited, by controller decision: the audit log's scope is published data changes and
   * moderation/admin actions (see the file-level comment on castIssueVote above for the same
   * reasoning applied to individual issue votes). A citizen's own language preference is a
   * personal setting, not published data — writing it into the admin-readable audit log would
   * only add noise, not provenance anyone needs.
   */
  function setLanguagePref(userId: string, language: User['language']): void {
    const user = requireUser(userId)
    user.language = language
    persist()
  }

  /**
   * Sets a user's notification channel + subscription preferences (IA §4.2 — email/WhatsApp
   * toggles, ward-update subscriptions). Simulated only: this store never sends anything, it just
   * records the preference (see Notifications.tsx for the user-facing "simulated" disclosure).
   *
   * NOT audited, by controller decision, for the same privacy reason as setLanguagePref/
   * castIssueVote above: a user's own notification settings are a personal preference, not
   * published data or a moderation action — dumping "user X subscribed to Y" into the
   * admin-visible audit log would be a privacy leak with no provenance value.
   */
  function setNotificationPrefs(userId: string, prefs: NotificationPrefs): void {
    const user = requireUser(userId)
    user.notificationPrefs = { ...prefs }
    persist()
  }

  // Persist the freshly-seeded (or rehydrated) state immediately so that
  // 'localStorage.getItem(KEY)' is truthy right after construction.
  persist()

  return {
    getState,
    getWard,
    listWards,
    getCandidate,
    getCandidateById,
    listCandidatesByWard,
    listIssues,
    listIssueCatalog,
    getIssueVote,
    issueTally,
    issueVoteCounts,
    listQueueForCurator,
    getSubmission,
    listSubmissionsByUser,
    listAudit,
    listUsers,
    listInterests,
    getPartner,
    listPartners,
    partnerWardCoverage,
    partnerRegistrationCounts,
    platformMetrics,
    wardCompleteness,
    wardReadiness,
    listHeldWards,
    subscribe,
    reset,
    stamp,
    submitFlag,
    submitInterest,
    reviewInterest,
    createPartner,
    updatePartner,
    castIssueVote,
    acceptSubmission,
    rejectSubmission,
    updateCandidate,
    ingestAffidavit,
    addCandidate,
    withdrawCandidate,
    updateWard,
    signOffWard,
    overrideHold,
    setWardIssues,
    addIssue,
    updateIssue,
    setUserActive,
    setUserRole,
    createUser,
    setHomeWard,
    setLanguagePref,
    setNotificationPrefs,
  }
}

export type Store = ReturnType<typeof createStore>
