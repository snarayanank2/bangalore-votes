import { useAuth } from '../../context/AuthContext'
import { useData, useStoreVersion } from '../../context/DataContext'
import { fieldLabel } from '../../lib/fields'
import type { Submission, SubmissionStatus } from '../../types'

const STATUS_LABEL: Record<SubmissionStatus, string> = {
  pending: 'Pending',
  accepted: 'Accepted',
  rejected: 'Rejected',
}

const STATUS_STYLE: Record<SubmissionStatus, string> = {
  pending: 'bg-amber-100 text-amber-900 border-amber-300',
  accepted: 'bg-emerald-100 text-emerald-900 border-emerald-300',
  rejected: 'bg-red-100 text-red-900 border-red-300',
}

function StatusPill({ status }: { status: SubmissionStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[status]}`}
    >
      {STATUS_LABEL[status]}
    </span>
  )
}

/**
 * My submissions (PRD §6.2, IA §4.3, `/account/submissions`). Registered-only. Shows the CURRENT
 * user's own flags and what happened to each — pending / accepted / rejected, with the rejection
 * reason surfaced when there is one (a citizen must be able to see why a correction wasn't made).
 *
 * PRIVACY: always reads `listSubmissionsByUser(user.id)` off the AUTHENTICATED user from
 * useAuth() — never a route param or any other user's id — so this can never leak another
 * citizen's flags.
 */
export default function Submissions() {
  const { user } = useAuth()
  const data = useData()
  useStoreVersion() // re-render after a curator accepts/rejects one of these submissions

  const submissions = data.listSubmissionsByUser(user.id)

  function describe(sub: Submission): { ward: string; candidate?: string } {
    const ward = data.getWard(sub.wardId)?.name ?? sub.wardId
    const candidate = sub.candidateId
      ? data.listCandidatesByWard(sub.wardId).find((c) => c.id === sub.candidateId)?.name
      : undefined
    return { ward, candidate }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-8">
      <div>
        <h1 className="text-2xl font-bold text-ink sm:text-3xl">My submissions</h1>
        <p className="mt-1 text-sm text-ink/70">Flags you have reported and what happened to them.</p>
      </div>

      {submissions.length === 0 ? (
        <p className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-sm text-ink/70">
          You haven&apos;t flagged anything yet. Visit a candidate&apos;s report card to flag an
          error.
        </p>
      ) : (
        <ul className="space-y-3">
          {submissions.map((sub) => {
            const { ward, candidate } = describe(sub)
            return (
              <li key={sub.id} className="space-y-2 rounded-lg border border-slate-200 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="font-semibold text-ink">{fieldLabel(sub.field)}</h2>
                  <StatusPill status={sub.status} />
                </div>
                <p className="text-xs uppercase tracking-wide text-ink/60">
                  {ward}
                  {candidate ? ` · ${candidate}` : ''}
                </p>
                <p className="text-sm text-ink/80">{sub.detail}</p>
                {sub.status === 'rejected' && sub.reason && (
                  <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-800">
                    <span className="font-semibold">Why it was rejected: </span>
                    {sub.reason}
                  </p>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
