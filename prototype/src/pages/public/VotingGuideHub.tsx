import { Link } from 'react-router-dom'

/**
 * Voting guide hub (PRD §5.8-§5.10, IA §3.9, `/voting-guide`). Anonymous. A simple index card
 * page linking to the three logistics guides — no content of its own beyond framing.
 */
export default function VotingGuideHub() {
  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-8">
      <div>
        <h1 className="text-2xl font-bold text-ink sm:text-3xl">Voting guide</h1>
        <p className="mt-2 text-sm text-ink/80">
          Everything you need to actually cast your vote — getting your voter ID sorted, what
          happens at the polling booth, and finding the right booth for you.
        </p>
      </div>

      <nav aria-label="Voting guide sections" className="grid gap-4 sm:grid-cols-1">
        <Link
          to="/voting-guide/voter-id"
          className="block rounded-lg border border-slate-200 p-4 hover:border-brand focus:outline-none focus:ring-2 focus:ring-brand"
        >
          <h2 className="font-semibold text-ink">Voter ID — new enrolment &amp; updates</h2>
          <p className="mt-1 text-sm text-ink/70">
            Register for the first time, or update/transfer your details if you&apos;ve moved.
          </p>
        </Link>
        <Link
          to="/voting-guide/how-to-vote"
          className="block rounded-lg border border-slate-200 p-4 hover:border-brand focus:outline-none focus:ring-2 focus:ring-brand"
        >
          <h2 className="font-semibold text-ink">How to vote</h2>
          <p className="mt-1 text-sm text-ink/70">
            A simple, step-by-step walk-through of polling day — what to bring and what to
            expect.
          </p>
        </Link>
        <Link
          to="/voting-guide/find-booth"
          className="block rounded-lg border border-slate-200 p-4 hover:border-brand focus:outline-none focus:ring-2 focus:ring-brand"
        >
          <h2 className="font-semibold text-ink">Find your polling booth</h2>
          <p className="mt-1 text-sm text-ink/70">
            Look up the exact location where you&apos;re assigned to vote.
          </p>
        </Link>
      </nav>
    </div>
  )
}
