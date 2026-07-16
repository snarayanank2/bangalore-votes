import { useEffect, useState, type FormEvent } from 'react'
import { Modal } from '../Modal'
import { useAuth } from '../../context/AuthContext'
import { useData } from '../../context/DataContext'
import type { VoteContext } from '../../context/ModalContext'

const MAX_ISSUES = 3

interface CastIssueVoteProps {
  open: boolean
  ctx: VoteContext | null
  onClose: () => void
}

/**
 * Cast-issue-vote modal (IA §7.3). Unlike Flag (any ward), voting is restricted to the citizen's
 * REGISTERED HOME WARD — `ctx.wardId` is whatever ward the triggering page was on, which may not
 * match. When it doesn't, the form is replaced by an inline explanation naming the user's actual
 * home ward; there is nothing to submit.
 *
 * Only ever opened via a gated trigger (`GatedButton`), so by the time this is visible the user
 * is authenticated — either immediately, or after the Register/Login modal resumes this one in
 * place via `useAuth().resolvePending()` (see ModalContext / GatedButton), mirroring
 * FlagMisinformation.
 *
 * Does NOT pre-populate from the citizen's existing vote-set — like FlagMisinformation, the form
 * resets blank each time it opens. Submitting always replaces the prior set (castIssueVote's
 * job), which is the "changeable later" product rule from IA §7.3.
 */
export function CastIssueVote({ open, ctx, onClose }: CastIssueVoteProps) {
  const { user } = useAuth()
  const { listIssues, getWard, castIssueVote } = useData()

  const [selected, setSelected] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)

  useEffect(() => {
    if (open) {
      setSelected([])
      setError(null)
      setSubmitted(false)
    }
  }, [open, ctx])

  const issues = ctx ? listIssues(ctx.wardId) : []
  const wardMismatch = !!ctx && ctx.wardId !== user.homeWardId
  const homeWard = wardMismatch && user.homeWardId ? getWard(user.homeWardId) : undefined

  function toggle(issueId: string): void {
    setSelected((prev) => {
      if (prev.includes(issueId)) return prev.filter((id) => id !== issueId)
      if (prev.length >= MAX_ISSUES) return prev
      return [...prev, issueId]
    })
  }

  function handleSubmit(event: FormEvent): void {
    event.preventDefault()
    if (!ctx) return
    try {
      castIssueVote(user, ctx.wardId, selected)
      setError(null)
      setSubmitted(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not submit your vote.')
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Vote your top 3 issues">
      {wardMismatch ? (
        <p role="alert" className="rounded bg-red-50 px-3 py-2 text-sm text-red-800">
          You can only vote in your home ward
          {homeWard ? `, ${homeWard.name}.` : '.'}
        </p>
      ) : (
        <>
          {error && (
            <p role="alert" className="mb-3 rounded bg-red-50 px-3 py-2 text-sm text-red-800">
              {error}
            </p>
          )}
          {submitted ? (
            <div className="space-y-3">
              <p className="text-sm text-ink">
                Thanks — your top issues for this ward have been recorded. You can change your
                vote any time.
              </p>
              <button
                type="button"
                onClick={onClose}
                className="w-full rounded bg-brand px-4 py-2 text-sm font-semibold text-white focus:outline-none focus:ring-2 focus:ring-brand"
              >
                Close
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-3">
              <p className="text-sm text-ink">
                Select up to three issues that matter most to you.{' '}
                <span className="font-medium">
                  {selected.length} of {MAX_ISSUES} selected
                </span>
              </p>
              <fieldset className="space-y-2">
                <legend className="sr-only">Ward issues</legend>
                {issues.map((issue) => {
                  const checked = selected.includes(issue.id)
                  const disabled = !checked && selected.length >= MAX_ISSUES
                  return (
                    <label
                      key={issue.id}
                      className={`flex items-start gap-2 rounded border border-slate-200 p-3 text-sm ${disabled ? 'opacity-50' : ''}`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={disabled}
                        onChange={() => toggle(issue.id)}
                        className="mt-0.5"
                      />
                      <span>
                        <span className="block font-medium text-ink">{issue.title}</span>
                        <span className="block text-slate-600">{issue.description}</span>
                      </span>
                    </label>
                  )
                })}
              </fieldset>
              <button
                type="submit"
                disabled={selected.length === 0}
                className="w-full rounded bg-brand px-4 py-2 text-sm font-semibold text-white focus:outline-none focus:ring-2 focus:ring-brand disabled:cursor-not-allowed disabled:opacity-50"
              >
                Submit
              </button>
            </form>
          )}
        </>
      )}
    </Modal>
  )
}
