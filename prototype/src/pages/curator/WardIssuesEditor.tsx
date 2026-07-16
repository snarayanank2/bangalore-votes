import { useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useData, useStoreVersion } from '../../context/DataContext'

/**
 * Define ward issue list (PRD §5.4/§5.5, IA §5.6, `/curator/ward/:wardId/issues`) — the curator
 * control surface for which issues are votable in a ward.
 *
 * STORE GAP (read before changing this page): the only mutation available is
 * `setWardIssues(wardId, issueIds, curator)`, which writes `ward.issueIds` and nothing else.
 * There is no `addIssue`/`updateIssue` mutation to author a brand-new issue's title/description —
 * every `Issue` record (with its title + description) is fixed at seed time. So "add/remove" here
 * means toggling which of the ward's EXISTING catalog issues (`data.listIssues(wardId)`, which
 * reads the master `state.issues` table filtered by ward) are currently marked votable; it cannot
 * create genuinely new issue content, and this page does not pretend otherwise.
 *
 * MORE IMPORTANTLY — `ward.issueIds` is NOT actually consulted by the public voting page: both
 * `listIssues(wardId)` (what `/ward/:id/issues` renders) and `issueTally(wardId)` (the public
 * ranked results) filter `state.issues` by `wardId` directly, never by `ward.issueIds`. So toggling
 * an issue off here and saving does NOT currently remove it from the public page or its tally —
 * `ward.issueIds` looks vestigial in the read path as implemented. This page still lets a curator
 * set it (it's real, audited, persisted state, and is the field the brief describes as the
 * "votable issue list"), but does not claim an effect the store doesn't deliver. See
 * task-21-22-report.md for the full writeup — this was flagged, not silently shipped.
 *
 * VOTES ARE NEVER TOUCHED: `setWardIssues` never reads or writes `state.issueVotes`. Existing
 * votes referencing an issue that gets unchecked here are left completely as-is (see the
 * "removing an issue does not delete..." test in edit.test.tsx) — there is no migration in the
 * store to prune or reassign them, and this page does not fabricate one.
 */
export default function WardIssuesEditor() {
  const { wardId } = useParams<{ wardId: string }>()
  const { user } = useAuth()
  const data = useData()
  useStoreVersion()

  const ward = wardId ? data.getWard(wardId) : undefined
  const catalog = wardId ? data.listIssues(wardId) : []
  const tally = wardId ? data.issueTally(wardId) : []
  const voteCountByIssue = new Map(tally.map((row) => [row.issueId, row.count]))

  const [selected, setSelected] = useState<Set<string>>(() => new Set(ward?.issueIds ?? []))
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  if (!ward) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-8">
        <h1 className="text-xl font-bold text-ink">We couldn&apos;t find that ward</h1>
        <p className="mt-2 text-sm text-ink/70">
          Check the link, or{' '}
          <Link to="/curator" className="text-brand underline underline-offset-2">
            back to your dashboard
          </Link>
          .
        </p>
      </div>
    )
  }
  // Re-bind into a definitely-assigned const: TS's early-return narrowing above doesn't survive
  // into the nested handleSubmit closure below.
  const activeWard = ward

  function toggle(issueId: string): void {
    setSaved(false)
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(issueId)) next.delete(issueId)
      else next.add(issueId)
      return next
    })
  }

  function handleSubmit(event: FormEvent): void {
    event.preventDefault()
    setSaved(false)
    try {
      data.setWardIssues(activeWard.id, Array.from(selected), user)
      setError(null)
      setSaved(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the issue list.')
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-8 px-4 py-8">
      <div>
        <p className="text-sm font-medium uppercase tracking-wide text-brand">{ward.name}</p>
        <h1 className="text-2xl font-bold text-ink sm:text-3xl">Define ward issue list</h1>
        <p className="mt-1 text-sm text-ink/70">
          Choose which issues are votable in this ward&apos;s issue-voting page.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <p role="alert" className="rounded bg-red-50 px-3 py-2 text-sm text-red-800">
            {error}
          </p>
        )}
        {saved && !error && (
          <p className="rounded bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
            Saved — the votable issue list is now updated.
          </p>
        )}

        {catalog.length === 0 ? (
          <p className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-sm text-ink/70">
            No issues have been defined for this ward yet. This prototype has no way to author a
            brand-new issue&apos;s title and description — that would need a store change beyond
            this page&apos;s scope.
          </p>
        ) : (
          <ul className="space-y-3">
            {catalog.map((issue) => {
              const checked = selected.has(issue.id)
              const votes = voteCountByIssue.get(issue.id) ?? 0
              return (
                <li key={issue.id} className="rounded-lg border border-slate-200 p-4">
                  <div className="flex items-start gap-3">
                    <input
                      id={`issue-${issue.id}`}
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggle(issue.id)}
                      className="mt-1 h-4 w-4 rounded border-slate-300 text-brand focus:ring-brand"
                    />
                    <label htmlFor={`issue-${issue.id}`} className="flex-1">
                      <span className="block font-semibold text-ink">{issue.title}</span>
                      <span className="block text-sm text-ink/70">{issue.description}</span>
                      <span className="mt-1 block text-xs text-ink/60">
                        {votes} existing vote{votes === 1 ? '' : 's'} reference this issue
                        {votes > 0 && !checked
                          ? ' — unchecking it here will not remove those votes, and will not currently change the public tally either (see the note above).'
                          : ''}
                      </span>
                    </label>
                  </div>
                </li>
              )
            })}
          </ul>
        )}

        <button
          type="submit"
          className="w-full rounded bg-brand px-4 py-2 text-sm font-semibold text-white focus:outline-none focus:ring-2 focus:ring-brand"
        >
          Save changes
        </button>
      </form>
    </div>
  )
}
