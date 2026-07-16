import { useData, useStoreVersion } from '../../context/DataContext'
import { formatStamp } from '../../lib/stamps'

/**
 * Audit log (PRD §11, IA §6.4, `/admin/audit`) — the full, immutable trail of published changes
 * and admin/moderation actions: who (actor), what (action), when (at), which ward, and the
 * human-readable detail. Admin-only. Supports the platform's credibility claim: every published
 * change is traceable and (via the underlying data) reversible.
 *
 * NEWEST FIRST: `listAudit()` returns entries in the order the store appended them (oldest
 * first — same append-order convention Dashboard.tsx's "recent activity" relies on), so this page
 * simply reverses that array rather than trying to sort by `at` — `at` is a mix of real ISO
 * timestamps (seed data) and monotonic `t${n}` stamps (anything created live), which don't sort
 * consistently against each other as strings (see lib/stamps.ts's compareStampsNewestFirst for a
 * comparator that does handle this, used where entries can't rely on append order — e.g.
 * curator/Queue.tsx). The "When" column renders `at` through lib/stamps.ts's `formatStamp` so a
 * live counter stamp reads as "Demo event #n" rather than a raw `t9`.
 *
 * PRIVACY (standing controller decision): this page renders ONLY what `listAudit()` returns.
 * Individual issue-vote choices are deliberately never written to the audit log by the store
 * (`castIssueVote` appends no audit entry — see store.ts) precisely so nothing here can leak
 * "user X voted for A, B, C". This page does not read `getState().issueVotes` or any other
 * per-user vote data — do not add such a join here.
 */
export default function Audit() {
  const data = useData()
  useStoreVersion()

  const entries = [...data.listAudit()].reverse()
  const users = data.listUsers()

  function actorName(actorUserId: string): string {
    return users.find((u) => u.id === actorUserId)?.name ?? actorUserId
  }

  function wardName(wardId: string | undefined): string {
    if (!wardId) return '—'
    return data.getWard(wardId)?.name ?? wardId
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-8">
      <div>
        <h1 className="text-2xl font-bold text-ink sm:text-3xl">Audit log</h1>
        <p className="mt-1 text-sm text-ink/70">
          {entries.length} entr{entries.length === 1 ? 'y' : 'ies'} — every published change and
          admin action, newest first.
        </p>
      </div>

      {entries.length === 0 ? (
        <p className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-sm text-ink/70">
          Nothing recorded yet.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-ink/60">
              <tr>
                <th scope="col" className="px-3 py-2">When</th>
                <th scope="col" className="px-3 py-2">Actor</th>
                <th scope="col" className="px-3 py-2">Action</th>
                <th scope="col" className="px-3 py-2">Ward</th>
                <th scope="col" className="px-3 py-2">Detail</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr key={entry.id} className="border-t border-slate-200 align-top">
                  <td className="whitespace-nowrap px-3 py-2 text-ink/70">{formatStamp(entry.at)}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-ink">{actorName(entry.actorUserId)}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-ink">{entry.action}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-ink/70">{wardName(entry.wardId)}</td>
                  <td className="px-3 py-2 text-ink/80">{entry.detail}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
