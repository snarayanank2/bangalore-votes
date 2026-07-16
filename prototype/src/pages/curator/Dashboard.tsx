import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useData, useStoreVersion } from '../../context/DataContext'
import type { Ward } from '../../types'

/** How many recent audit rows to surface on the dashboard — enough to orient a curator logging
 * back in without turning this into a second copy of /admin/audit. */
const RECENT_ACTIVITY_LIMIT = 5

/** Turns an audit action code like "candidate.assets.updated" into "Candidate assets updated" —
 * distinct from lib/fields.ts's fieldLabel, which is for camelCase Candidate field keys, not
 * these dot-separated action codes. */
function humanizeAction(action: string): string {
  const spaced = action.replace(/[._]/g, ' ')
  return spaced.charAt(0).toUpperCase() + spaced.slice(1)
}

/**
 * Curator dashboard (PRD §6.1 step 3 entry point, IA §5.1, `/curator`) — home base for a
 * curator's work. Scoped entirely to the curator's assigned wards (`user.curatorWardIds`);
 * admins see every ward. Surfaces the pending review-queue count, recent audited activity in
 * scope, and quick links into the queue and into editing candidates/wards/issues.
 */
export default function Dashboard() {
  const { user } = useAuth()
  const data = useData()
  useStoreVersion() // re-render as flags arrive/get resolved and edits land

  const isAdmin = user.role === 'admin'
  const wards: Ward[] = isAdmin
    ? data.listWards()
    : (user.curatorWardIds ?? [])
        .map((id) => data.getWard(id))
        .filter((w): w is Ward => w !== undefined)

  const pendingCount = data.listQueueForCurator(user).length

  const candidates = wards.flatMap((ward) => data.listCandidatesByWard(ward.id))

  const scopedWardIds = new Set(wards.map((w) => w.id))
  const recentActivity = data
    .listAudit()
    .filter((entry) => isAdmin || (entry.wardId && scopedWardIds.has(entry.wardId)))
    .slice(-RECENT_ACTIVITY_LIMIT)
    .reverse()

  return (
    <div className="mx-auto max-w-3xl space-y-8 px-4 py-8">
      <div>
        <h1 className="text-2xl font-bold text-ink sm:text-3xl">Curator dashboard</h1>
        <p className="mt-1 text-sm text-ink/70">
          {isAdmin ? 'All wards (admin)' : wards.map((w) => w.name).join(', ') || 'No wards assigned'}
        </p>
      </div>

      <Link
        to="/curator/queue"
        className="block rounded-lg border border-brand/30 bg-brand/5 p-5 hover:bg-brand/10 focus:outline-none focus:ring-2 focus:ring-brand"
      >
        <p className="text-sm font-medium text-ink/70">Review queue</p>
        <p className="mt-1 text-3xl font-bold text-brand">
          {pendingCount} pending review{pendingCount === 1 ? '' : 's'}
        </p>
      </Link>

      <section aria-labelledby="quick-links-heading" className="space-y-3">
        <h2 id="quick-links-heading" className="text-lg font-semibold text-ink">
          Quick links
        </h2>

        {wards.length === 0 ? (
          <p className="text-sm text-ink/70">No wards are assigned to you yet.</p>
        ) : (
          <ul className="space-y-3">
            {wards.map((ward) => (
              <li key={ward.id} className="rounded-lg border border-slate-200 p-4">
                <h3 className="font-semibold text-ink">{ward.name}</h3>
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
                  <Link
                    to={`/curator/ward/${ward.id}`}
                    className="text-brand underline underline-offset-2 hover:no-underline"
                  >
                    Edit ward
                  </Link>
                  <Link
                    to={`/curator/ward/${ward.id}/issues`}
                    className="text-brand underline underline-offset-2 hover:no-underline"
                  >
                    Define ward issues
                  </Link>
                </div>
                {(() => {
                  const wardCandidates = candidates.filter((c) => c.wardId === ward.id)
                  if (wardCandidates.length === 0) return null
                  return (
                    <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
                      {wardCandidates.map((candidate) => (
                        <li key={candidate.id}>
                          <Link
                            to={`/curator/candidate/${candidate.id}`}
                            className="text-brand underline underline-offset-2 hover:no-underline"
                          >
                            Edit {candidate.name}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )
                })()}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="recent-activity-heading" className="space-y-3">
        <h2 id="recent-activity-heading" className="text-lg font-semibold text-ink">
          Recent activity
        </h2>
        {recentActivity.length === 0 ? (
          <p className="text-sm text-ink/70">Nothing recorded yet.</p>
        ) : (
          <ul className="space-y-2">
            {recentActivity.map((entry) => (
              <li key={entry.id} className="rounded border border-slate-200 px-3 py-2 text-sm">
                <span className="font-medium text-ink">{humanizeAction(entry.action)}</span>
                <span className="text-ink/70"> — {entry.detail}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
