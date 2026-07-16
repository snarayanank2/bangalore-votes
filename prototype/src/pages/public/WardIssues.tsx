import { Link, useParams } from 'react-router-dom'
import { useData, useStoreVersion } from '../../context/DataContext'
import { useModal } from '../../context/ModalContext'
import { GatedButton } from '../../components/GatedButton'

/**
 * Ward issues & voting (PRD §5.4/§5.5, IA §3.6, `/ward/:wardId/issues`). Anonymous-readable:
 * the curator-defined issue list and the PUBLIC aggregate ranked results are visible to everyone
 * (issue-vote results are public per PRD §5.5/§14). Only the "Vote your top 3" action is gated —
 * via `GatedButton`, which opens Register/Login for an anonymous visitor and resumes the vote
 * modal in place afterwards (see GatedButton/ModalContext).
 *
 * NEUTRALITY: this prototype's seed data models no per-candidate, per-issue stance field
 * (`Candidate` in types.ts has no such field) — so this page never fabricates a candidate
 * position. It shows an honest "not yet recorded" note instead of inventing content, per PRD
 * §11 (no editorial voice, only real sourced facts and citizen signal).
 *
 * PRIVACY: only ever renders AGGREGATE counts from `issueTally` — never who voted for what. The
 * store itself writes no audit entry for individual votes for the same reason (see
 * `castIssueVote` in store.ts).
 */
export default function WardIssues() {
  const { wardId } = useParams<{ wardId: string }>()
  const data = useData()
  const { openVote } = useModal()
  useStoreVersion() // re-render after a citizen casts/changes an issue vote

  const ward = wardId ? data.getWard(wardId) : undefined

  if (!ward) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-8">
        <h1 className="text-xl font-bold text-ink">We couldn&apos;t find that ward</h1>
        <p className="mt-2 text-sm text-ink/70">
          Check the link, or{' '}
          <Link to="/" className="text-brand underline underline-offset-2">
            search for your ward by name
          </Link>
          .
        </p>
      </div>
    )
  }

  const issues = data.listIssues(ward.id)
  const tally = data.issueTally(ward.id)
  const issueById = new Map(issues.map((issue) => [issue.id, issue]))

  return (
    <div className="mx-auto max-w-2xl space-y-8 px-4 py-8">
      <div>
        <p className="text-sm font-medium uppercase tracking-wide text-brand">{ward.name}</p>
        <h1 className="text-2xl font-bold text-ink sm:text-3xl">Ward issues &amp; voting</h1>
      </div>

      <section aria-labelledby="issues-heading" className="space-y-3">
        <h2 id="issues-heading" className="text-lg font-semibold text-ink">
          Key issues in this ward
        </h2>
        {issues.length === 0 ? (
          <p className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-sm text-ink/70">
            No issues have been defined for this ward yet — a data curator sets the votable issue
            list. Check back closer to the election.
          </p>
        ) : (
          <ul className="space-y-3">
            {issues.map((issue) => (
              <li key={issue.id} className="rounded-lg border border-slate-200 p-4">
                <h3 className="font-semibold text-ink">{issue.title}</h3>
                <p className="mt-1 text-sm text-ink/80">{issue.description}</p>
                <p className="mt-2 text-xs italic text-ink/60">
                  Candidate stances on this issue are not yet recorded. We&apos;ll show what each
                  candidate says they&apos;ll do about it here as that information becomes
                  available.
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      {issues.length > 0 && (
        <section aria-labelledby="results-heading" className="space-y-3">
          <h2 id="results-heading" className="text-lg font-semibold text-ink">
            Public ranked results
          </h2>
          <p className="text-sm text-ink/70">
            What registered citizens in this ward say matters most, ranked by votes. Only
            aggregate totals are ever shown — individual votes are never made public.
          </p>
          <ol aria-label="Ranked results" className="space-y-2">
            {tally.map((row, index) => {
              const issue = issueById.get(row.issueId)
              if (!issue) return null
              return (
                <li
                  key={row.issueId}
                  className="flex items-center justify-between gap-3 rounded border border-slate-200 px-3 py-2 text-sm"
                >
                  <span className="text-ink">
                    <span className="mr-2 font-semibold text-brand">#{index + 1}</span>
                    {issue.title}
                  </span>
                  <span className="whitespace-nowrap font-medium text-ink/80">
                    {row.count} {row.count === 1 ? 'vote' : 'votes'}
                  </span>
                </li>
              )
            })}
          </ol>
        </section>
      )}

      {issues.length > 0 && (
        <section aria-labelledby="vote-heading" className="space-y-3 border-t border-slate-200 pt-6">
          <h2 id="vote-heading" className="text-lg font-semibold text-ink">
            Vote for your top issues
          </h2>
          <p className="text-sm text-ink/70">
            Voting is limited to your registered home ward. If this isn&apos;t your home ward,
            you&apos;ll be shown which ward you can vote in.
          </p>
          <GatedButton
            onAct={() => openVote({ wardId: ward.id })}
            className="rounded bg-brand px-4 py-2 text-sm font-semibold text-white focus:outline-none focus:ring-2 focus:ring-brand"
          >
            Vote your top 3
          </GatedButton>
        </section>
      )}
    </div>
  )
}
