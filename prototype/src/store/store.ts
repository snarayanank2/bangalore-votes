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
  submittedByUserId: string
}

export type CandidateSourcedField =
  | 'trackRecord'
  | 'pendingCases'
  | 'assets'
  | 'education'
  | 'approachability'

export type WardPatch = Partial<Pick<Ward, 'name' | 'number' | 'corporation' | 'oldWardsNote'>>

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

  function requireCandidate(candidateId: string): Candidate {
    const candidate = state.candidates.find((c) => c.id === candidateId)
    if (!candidate) throw new Error(`Unknown candidate: ${candidateId}`)
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
  function assertWardScope(actorUserId: string, wardId: string): void {
    const actor = requireUser(actorUserId)
    if (actor.role === 'admin') return
    if (actor.role === 'curator' && actor.curatorWardIds?.includes(wardId)) return
    throw new Error(`Actor ${actorUserId} is out of scope for ward ${wardId}`)
  }

  function assertAdmin(actorUserId: string): void {
    const actor = requireUser(actorUserId)
    if (actor.role !== 'admin') throw new Error(`Actor ${actorUserId} must be an admin`)
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
    if (user.role === 'admin') return [...state.submissions]
    const scope = user.curatorWardIds ?? []
    return state.submissions.filter((s) => scope.includes(s.wardId))
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

  function submitFlag(input: SubmitFlagInput): Submission {
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
        actorUserId: input.submittedByUserId,
        action: 'submission.flag.duplicate',
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
      submittedByUserId: input.submittedByUserId,
      status: 'pending',
      count: 1,
      createdAt: `t${n}`,
    }
    state.submissions.push(submission)
    appendAudit({
      actorUserId: input.submittedByUserId,
      action: 'submission.flag.created',
      wardId: input.wardId,
      detail: `New flag on ${input.field} (${submission.id}).`,
    })
    persist()
    return submission
  }

  function castIssueVote(userId: string, wardId: string, issueIds: string[]): void {
    const uniqueCount = new Set(issueIds).size
    if (issueIds.length > 3 || uniqueCount !== issueIds.length) {
      throw new Error('You may vote for up to top 3 issues, with no duplicates.')
    }
    const user = requireUser(userId)
    if (wardId !== user.homeWardId) {
      throw new Error('You may only vote on issues in your home ward.')
    }

    state.issueVotes = state.issueVotes.filter((v) => !(v.userId === userId && v.wardId === wardId))
    state.issueVotes.push({ userId, wardId, issueIds: [...issueIds] })

    appendAudit({
      actorUserId: userId,
      action: 'issueVote.cast',
      wardId,
      detail: `Voted for issues: ${issueIds.join(', ') || '(none)'}.`,
    })
    persist()
  }

  function acceptSubmission(submissionId: string, actorUserId: string): void {
    const submission = requireSubmission(submissionId)
    assertWardScope(actorUserId, submission.wardId)
    submission.status = 'accepted'
    appendAudit({
      actorUserId,
      action: 'submission.accepted',
      wardId: submission.wardId,
      detail: `Accepted flag ${submission.id} on ${submission.field}.`,
    })
    persist()
  }

  function rejectSubmission(submissionId: string, actorUserId: string, reason: string): void {
    const submission = requireSubmission(submissionId)
    assertWardScope(actorUserId, submission.wardId)
    submission.status = 'rejected'
    submission.reason = reason
    appendAudit({
      actorUserId,
      action: 'submission.rejected',
      wardId: submission.wardId,
      detail: `Rejected flag ${submission.id} on ${submission.field}: ${reason}`,
    })
    persist()
  }

  function updateCandidate(
    candidateId: string,
    field: CandidateSourcedField,
    value: string,
    source: Source,
    actorUserId: string,
  ): void {
    const candidate = requireCandidate(candidateId)
    assertWardScope(actorUserId, candidate.wardId)
    candidate[field] = { value, source }
    appendAudit({
      actorUserId,
      action: `candidate.${field}.updated`,
      wardId: candidate.wardId,
      detail: `Updated ${field} for ${candidate.name} (${candidate.id}).`,
    })
    persist()
  }

  function updateWard(wardId: string, patch: WardPatch, actorUserId: string): void {
    const ward = requireWard(wardId)
    assertWardScope(actorUserId, wardId)
    Object.assign(ward, patch)
    appendAudit({
      actorUserId,
      action: 'ward.updated',
      wardId,
      detail: `Updated ward fields: ${Object.keys(patch).join(', ') || '(none)'}.`,
    })
    persist()
  }

  function setWardIssues(wardId: string, issueIds: string[], actorUserId: string): void {
    const ward = requireWard(wardId)
    assertWardScope(actorUserId, wardId)
    ward.issueIds = [...issueIds]
    appendAudit({
      actorUserId,
      action: 'ward.issues.updated',
      wardId,
      detail: `Set votable issues to: ${issueIds.join(', ') || '(none)'}.`,
    })
    persist()
  }

  function setUserActive(userId: string, active: boolean, actorUserId: string): void {
    assertAdmin(actorUserId)
    const user = requireUser(userId)
    user.active = active
    appendAudit({
      actorUserId,
      action: 'user.active.updated',
      detail: `Set ${user.id} active=${active}.`,
    })
    persist()
  }

  function setUserRole(userId: string, role: Role, actorUserId: string): void {
    assertAdmin(actorUserId)
    const user = requireUser(userId)
    user.role = role
    appendAudit({
      actorUserId,
      action: 'user.role.updated',
      detail: `Set ${user.id} role=${role}.`,
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
