import { useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Button } from '../../components/Button'
import { useAuth } from '../../context/AuthContext'
import { useData, useStoreVersion } from '../../context/DataContext'
import type { Issue } from '../../types'

/**
 * Define ward issue list (PRD §5.4/§5.5, IA §5.6, `/curator/ward/:wardId/issues`) — the curator
 * control surface for which issues are votable in a ward, and for authoring the issues
 * themselves.
 *
 * TWO DIFFERENT ISSUE LISTS ON THIS PAGE:
 * - `data.listIssueCatalog(wardId)` — EVERY issue ever authored for this ward, whether or not it
 *   is currently votable. This page uses it for the toggle list, so a curator can re-check an
 *   issue they previously unchecked.
 * - `data.listIssues(wardId)` — only the issues currently named by `ward.issueIds`, in order.
 *   This is what the PUBLIC `/ward/:id/issues` page and `issueTally` read (Fix 1: `ward.issueIds`
 *   is the single source of truth for what citizens see and vote on). This editor does not use
 *   `listIssues` for its toggle list — that would make removed issues disappear from this page
 *   entirely, with no way to bring them back.
 *
 * "Save changes" below calls `setWardIssues`, which replaces `ward.issueIds` with whatever is
 * currently checked — this is what actually publishes/unpublishes an issue on the public page.
 * "Add a new issue" and "Edit" call `addIssue`/`updateIssue` (Fix 4), which persist and audit
 * immediately, independent of the checkbox form's own "Save changes" button. `addIssue` appends
 * the new issue straight into `ward.issueIds`, so it is votable immediately — this page also
 * marks it checked in the local toggle state to keep the two in sync.
 *
 * VOTES ARE NEVER DELETED OR REASSIGNED: no store mutation here reads or writes
 * `state.issueVotes`. Existing votes referencing an issue that gets unchecked are left completely
 * as-is (see edit.test.tsx) — there is no migration in the store to prune or reassign them, and
 * this page does not fabricate one. If the same issue id is later re-added to `ward.issueIds`,
 * those old votes count again automatically (tally is always computed live from `issueVotes`).
 * The "existing votes" count shown per issue below comes from `data.issueVoteCounts(wardId)` — a
 * narrow, aggregate-only selector (not `issueTally`, which only reports on CURRENTLY votable
 * issues) so a curator can see the true historical count even for an issue they've unchecked,
 * without this page paying for a full-store clone (`getState()`) on every render just to scan
 * `issueVotes` itself.
 */
export default function WardIssuesEditor() {
  const { wardId } = useParams<{ wardId: string }>()
  const { user } = useAuth()
  const data = useData()
  useStoreVersion()

  const ward = wardId ? data.getWard(wardId) : undefined
  const catalog = wardId ? data.listIssueCatalog(wardId) : []
  // Narrow, aggregate-only selector (never per-user vote choices) — avoids cloning the entire
  // store just to count votes per issue.
  const voteCountByIssue = new Map<string, number>(
    (wardId ? data.issueVoteCounts(wardId) : []).map((row) => [row.issueId, row.count]),
  )

  const [selected, setSelected] = useState<Set<string>>(() => new Set(ward?.issueIds ?? []))
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  const [newTitle, setNewTitle] = useState('')
  const [newDescription, setNewDescription] = useState('')
  const [addError, setAddError] = useState<string | null>(null)

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [editError, setEditError] = useState<string | null>(null)

  if (!ward) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-8">
        <h1 className="text-xl font-bold text-ink">We couldn&apos;t find that ward</h1>
        <p className="mt-2 text-sm text-ink/70">
          Check the link, or{' '}
          <Link to="/curator" className="text-forest underline underline-offset-2">
            back to your dashboard
          </Link>
          .
        </p>
      </div>
    )
  }
  // Re-bind into a definitely-assigned const: TS's early-return narrowing above doesn't survive
  // into the nested closures below (handleSubmit, handleAddIssue, ...).
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

  function handleAddIssue(event: FormEvent): void {
    event.preventDefault()
    if (!newTitle.trim() || !newDescription.trim()) {
      setAddError('Enter both a title and a description for the new issue.')
      return
    }
    try {
      const issue = data.addIssue(
        activeWard.id,
        { title: newTitle.trim(), description: newDescription.trim() },
        user,
      )
      // addIssue already appended the new id to ward.issueIds — keep local toggle state in sync
      // so it shows checked (votable) rather than looking unselected until the next save.
      setSelected((prev) => new Set(prev).add(issue.id))
      setNewTitle('')
      setNewDescription('')
      setAddError(null)
    } catch (err) {
      setAddError(err instanceof Error ? err.message : 'Could not add this issue.')
    }
  }

  function startEdit(issue: Issue): void {
    setEditingId(issue.id)
    setEditTitle(issue.title)
    setEditDescription(issue.description)
    setEditError(null)
  }

  function cancelEdit(): void {
    setEditingId(null)
    setEditError(null)
  }

  function handleSaveEdit(event: FormEvent): void {
    event.preventDefault()
    if (!editingId) return
    if (!editTitle.trim() || !editDescription.trim()) {
      setEditError('Title and description cannot be empty.')
      return
    }
    try {
      data.updateIssue(
        editingId,
        { title: editTitle.trim(), description: editDescription.trim() },
        user,
      )
      setEditingId(null)
      setEditError(null)
    } catch (err) {
      setEditError(err instanceof Error ? err.message : 'Could not save this issue.')
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-8 px-4 py-8">
      <div>
        <p className="text-sm font-medium text-forest">{ward.name}</p>
        <h1 className="text-2xl font-bold text-ink sm:text-3xl">Define ward issue list</h1>
        <p className="mt-1 text-sm text-ink/70">
          Add, edit, and choose which issues are votable in this ward&apos;s issue-voting page.
        </p>
      </div>

      <section aria-labelledby="add-issue-heading" className="space-y-3 rounded-md border border-gray-300 p-4">
        <h2 id="add-issue-heading" className="text-sm font-semibold text-ink">
          Add a new issue
        </h2>
        {addError && (
          <p role="alert" className="rounded-sm bg-brick-tint px-3 py-2 text-sm text-brick">
            {addError}
          </p>
        )}
        <form onSubmit={handleAddIssue} className="space-y-3">
          <div>
            <label htmlFor="new-issue-title" className="mb-1 block text-sm font-medium text-ink">
              Title
            </label>
            <input
              id="new-issue-title"
              type="text"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              className="min-h-[44px] w-full rounded-sm border border-gray-300 px-3 py-2 text-base focus:border-forest"
            />
          </div>
          <div>
            <label htmlFor="new-issue-description" className="mb-1 block text-sm font-medium text-ink">
              Description
            </label>
            <textarea
              id="new-issue-description"
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
              rows={2}
              className="w-full rounded-sm border border-gray-300 px-3 py-2 text-base focus:border-forest"
            />
          </div>
          <Button type="submit" variant="primary">
            Add issue
          </Button>
        </form>
      </section>

      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <p role="alert" className="rounded-sm bg-brick-tint px-3 py-2 text-sm text-brick">
            {error}
          </p>
        )}
        {saved && !error && (
          <p className="rounded-sm bg-forest-tint px-3 py-2 text-sm text-forest">
            Saved — the votable issue list is now updated.
          </p>
        )}

        {catalog.length === 0 ? (
          <p className="rounded-md border border-dashed border-gray-300 bg-gray-100 px-4 py-6 text-sm text-ink/70">
            No issues have been defined for this ward yet. Use &quot;Add a new issue&quot; above
            to author the first one.
          </p>
        ) : (
          <ul className="space-y-3">
            {catalog.map((issue) => {
              const checked = selected.has(issue.id)
              const votes = voteCountByIssue.get(issue.id) ?? 0
              const isEditing = editingId === issue.id
              return (
                <li key={issue.id} className="rounded-md border border-gray-300 p-4">
                  {isEditing ? (
                    <div className="space-y-2">
                      {editError && (
                        <p role="alert" className="rounded-sm bg-brick-tint px-3 py-2 text-sm text-brick">
                          {editError}
                        </p>
                      )}
                      <label htmlFor={`edit-title-${issue.id}`} className="block text-sm font-medium text-ink">
                        Title
                      </label>
                      <input
                        id={`edit-title-${issue.id}`}
                        type="text"
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        className="min-h-[44px] w-full rounded-sm border border-gray-300 px-3 py-2 text-base focus:border-forest"
                      />
                      <label htmlFor={`edit-description-${issue.id}`} className="block text-sm font-medium text-ink">
                        Description
                      </label>
                      <textarea
                        id={`edit-description-${issue.id}`}
                        value={editDescription}
                        onChange={(e) => setEditDescription(e.target.value)}
                        rows={2}
                        className="w-full rounded-sm border border-gray-300 px-3 py-2 text-base focus:border-forest"
                      />
                      <div className="flex gap-2">
                        <Button type="button" variant="primary" onClick={handleSaveEdit}>
                          Save issue
                        </Button>
                        <Button type="button" variant="secondary" onClick={cancelEdit}>
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start gap-3">
                      <input
                        id={`issue-${issue.id}`}
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggle(issue.id)}
                        className="mt-1 h-4 w-4 rounded-sm border-gray-300 text-forest"
                      />
                      <label htmlFor={`issue-${issue.id}`} className="flex-1">
                        <span className="block font-semibold text-ink">{issue.title}</span>
                        <span className="block text-sm text-ink/70">{issue.description}</span>
                        <span className="mt-1 block text-xs text-ink/60">
                          {votes} existing vote{votes === 1 ? '' : 's'} reference this issue
                          {votes > 0 && !checked
                            ? ' — unchecking it here does not remove those votes; re-adding this issue later will count them again.'
                            : ''}
                        </span>
                      </label>
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() => startEdit(issue)}
                        className="shrink-0"
                      >
                        Edit
                      </Button>
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        )}

        <Button type="submit" variant="primary" fullWidth>
          Save changes
        </Button>
      </form>
    </div>
  )
}
