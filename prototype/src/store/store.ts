import { seed } from '../data'
import type {
  AuditEntry,
  Candidate,
  Issue,
  IssueVote,
  NotificationPrefs,
  Role,
  Source,
  Submission,
  User,
  Ward,
} from '../types'

/** Starting point for a user's notification prefs before they've ever visited
 * /account/notifications — everything off, so nothing is implied as already subscribed. */
export const DEFAULT_NOTIFICATION_PREFS: NotificationPrefs = {
  emailEnabled: false,
  whatsappEnabled: false,
  subscriptions: { electionNotice: false, rollDeadlines: false, candidateChanges: false },
}

const KEY = 'bv-store'

export interface StoreState {
  wards: Ward[]
  candidates: Candidate[]
  issues: Issue[]
  issueVotes: IssueVote[]
  users: User[]
  submissions: Submission[]
  audit: AuditEntry[]
  /** Monotonic counter backing stamp(); persisted so it survives reload. */
  seq: number
}

export interface IssueTallyRow {
  issueId: string
  count: number
}

export interface SubmitFlagInput {
  wardId: string
  candidateId?: string
  field: string
  detail: string
  sourceUrl?: string
}

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

function isCandidateSourcedField(field: string): field is CandidateSourcedField {
  return (CANDIDATE_SOURCED_FIELDS as readonly string[]).includes(field)
}

export type WardPatch = Partial<Pick<Ward, 'name' | 'number' | 'corporation' | 'oldWardsNote'>>

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
    seed.audit.length
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
  const cloned = structuredClone(seed) as Omit<StoreState, 'seq'>
  return { ...cloned, seq: baseSeqFromSeed() }
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
   */
  function listIssues(wardId: string): Issue[] {
    const ward = state.wards.find((w) => w.id === wardId)
    if (!ward) return []
    const byId = new Map(state.issues.map((i) => [i.id, i]))
    const ordered = ward.issueIds
      .map((id) => byId.get(id))
      .filter((i): i is Issue => i !== undefined)
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

  // ---- lifecycle -----------------------------------------------------------

  function subscribe(fn: () => void): () => void {
    listeners.add(fn)
    return () => listeners.delete(fn)
  }

  function reset(): void {
    state = { ...structuredClone(seed), seq: baseSeqFromSeed() }
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
   * NOTE: does not write an audit entry (controller decision). Issue-vote results are only
   * ever surfaced in aggregate (issueTally); logging "user X voted for A,B" into the
   * admin-readable audit log would leak individual voting choices, which was never requested
   * and isn't needed to support rollback/provenance of published data.
   */
  function castIssueVote(user: User, wardId: string, issueIds: string[]): IssueVote {
    const uniqueCount = new Set(issueIds).size
    if (issueIds.length > 3 || uniqueCount !== issueIds.length) {
      throw new Error('You can vote your top 3 issues')
    }
    if (wardId !== user.homeWardId) {
      throw new Error('You can only vote in your home ward')
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
    Object.assign(candidate, patch)
    appendAudit({
      actorUserId: curator.id,
      action: 'candidate.updated',
      wardId: candidate.wardId,
      detail: `Updated candidate fields: ${Object.keys(patch).join(', ') || '(none)'} for ${candidate.name} (${candidate.id}).`,
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

  function setWardIssues(wardId: string, issues: string[], curator: User): void {
    const ward = requireWard(wardId)
    requireScope(curator, wardId)
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
   */
  function createUser(input: {
    contact: string
    homeWardId?: string
    name?: string
    language?: User['language']
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
    }
    state.users.push(user)
    appendAudit({
      actorUserId: user.id,
      action: 'user.created',
      wardId: input.homeWardId,
      detail: `Registered new citizen ${user.id} (${input.contact}).`,
    })
    persist()
    return user
  }

  /**
   * Lets a citizen set/change their own registered home ward (WardResult's "Set as my ward"
   * action, IA §3.2). Takes an actor `User` like the other actor-sensitive mutators
   * (`castIssueVote`, `acceptSubmission`, `setUserRole`) and asserts self-only: the actor must be
   * the same user as `userId`, UNLESS the actor is an admin (admins may set another user's home
   * ward, e.g. from an admin support flow). Audited like the other account/data mutations, and
   * validates the ward exists (requireWard throws otherwise) so a bad id can never silently
   * corrupt a user's homeWardId.
   */
  function setHomeWard(userId: string, wardId: string, actor: User): void {
    if (actor.id !== userId) requireAdmin(actor)
    const user = requireUser(userId)
    requireWard(wardId)
    user.homeWardId = wardId
    appendAudit({
      actorUserId: actor.id,
      action: 'user.homeWard.updated',
      wardId,
      detail: `Set home ward to ${wardId} for ${user.id}.`,
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
    user.notificationPrefs = { ...prefs, subscriptions: { ...prefs.subscriptions } }
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
    listCandidatesByWard,
    listIssues,
    listIssueCatalog,
    getIssueVote,
    issueTally,
    listQueueForCurator,
    getSubmission,
    listSubmissionsByUser,
    listAudit,
    listUsers,
    subscribe,
    reset,
    stamp,
    submitFlag,
    castIssueVote,
    acceptSubmission,
    rejectSubmission,
    updateCandidate,
    updateWard,
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
