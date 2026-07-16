import { seed } from '../data'
import type {
  AuditEntry,
  Candidate,
  Issue,
  IssueVote,
  Role,
  Source,
  Submission,
  User,
  Ward,
} from '../types'

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

export type WardPatch = Partial<Pick<Ward, 'name' | 'number' | 'corporation' | 'oldWardsNote'>>

export type CandidatePatch = Partial<Omit<Candidate, 'id' | 'slug' | 'wardId'>>

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

function loadInitialState(): StoreState {
  const raw = localStorage.getItem(KEY)
  if (raw) {
    return JSON.parse(raw) as StoreState
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

  function stamp(): number {
    state.seq = (state.seq ?? baseSeqFromSeed()) + 1
    persist()
    return state.seq
  }

  function appendAudit(entry: Omit<AuditEntry, 'id' | 'at'>): void {
    const n = stamp()
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
    return state.wards.find((w) => w.id === id)
  }

  function listWards(): Ward[] {
    return [...state.wards]
  }

  function getCandidate(slug: string): Candidate | undefined {
    return state.candidates.find((c) => c.slug === slug)
  }

  function listCandidatesByWard(wardId: string): Candidate[] {
    return state.candidates.filter((c) => c.wardId === wardId)
  }

  function listIssues(wardId: string): Issue[] {
    return state.issues.filter((i) => i.wardId === wardId)
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
    if (user.role === 'admin') return pending
    const scope = user.curatorWardIds ?? []
    return pending.filter((s) => scope.includes(s.wardId))
  }

  function getSubmission(id: string): Submission | undefined {
    return state.submissions.find((s) => s.id === id)
  }

  function listSubmissionsByUser(userId: string): Submission[] {
    return state.submissions.filter((s) => s.submittedByUserId === userId)
  }

  function listAudit(): AuditEntry[] {
    return [...state.audit]
  }

  function listUsers(): User[] {
    return [...state.users]
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

    const n = stamp()
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

  function acceptSubmission(submissionId: string, curator: User, edit: SubmissionEdit): void {
    const submission = requireSubmission(submissionId)
    requireScope(curator, submission.wardId)

    if (edit.candidateSlug && edit.field && edit.value !== undefined && edit.source) {
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
    user.curatorWardIds = role === 'curator' ? [...(wardIds ?? [])] : undefined
    appendAudit({
      actorUserId: admin.id,
      action: 'user.role.updated',
      detail: `Set ${user.id} role=${role}${role === 'curator' ? ` (wards: ${(wardIds ?? []).join(', ') || '(none)'})` : ''}.`,
    })
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
    setUserActive,
    setUserRole,
  }
}

export type Store = ReturnType<typeof createStore>
