import { Link } from 'react-router-dom'
import { WardSearch } from '../../components/WardSearch'
import { RollDeadlineNotice } from '../../components/RollDeadlineNotice'

/**
 * Static, fixed target for the countdown banner. A live `Date.now()` clock is
 * banned for this prototype (see task brief) — the date is a hard-coded
 * placeholder to be updated by hand as real GBA election dates firm up.
 */
const ELECTION_NOTICE_TARGET = 'September 2026 (expected)'

export default function Home() {
  return (
    <div className="mx-auto max-w-2xl space-y-8 px-4 py-8">
      <section className="space-y-2 rounded-md border border-gray-300 bg-white p-6 text-center">
        <p className="text-sm font-medium text-forest">GBA ward elections</p>
        <h1 className="text-2xl text-ink sm:text-3xl">
          Find your ward. Know your candidates.
        </h1>
        <p className="text-sm text-ink/80">
          Official notification expected: <strong>{ELECTION_NOTICE_TARGET}</strong>. Candidate
          data will be added ward by ward as it becomes available after the notification.
        </p>
        <RollDeadlineNotice />
      </section>

      <section aria-labelledby="ward-search-heading" className="space-y-3">
        <h2 id="ward-search-heading" className="text-lg text-ink">
          Which ward am I in?
        </h2>
        <WardSearch />
      </section>

      <section aria-label="Shortcuts" className="grid gap-4 sm:grid-cols-2">
        <Link
          to="/check-registration"
          className="block rounded-md border border-gray-300 p-4 hover:border-forest"
        >
          <h3 className="text-ink">Check your registration</h3>
          <p className="mt-1 text-sm text-ink/70">Confirm you&apos;re on the electoral roll.</p>
        </Link>
        <Link
          to="/voting-guide"
          className="block rounded-md border border-gray-300 p-4 hover:border-forest"
        >
          <h3 className="text-ink">Voting guide</h3>
          <p className="mt-1 text-sm text-ink/70">
            Voter ID, how to vote, and finding your polling booth.
          </p>
        </Link>
      </section>
    </div>
  )
}
