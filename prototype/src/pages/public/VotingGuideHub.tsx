import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { RollDeadlineNotice } from '../../components/RollDeadlineNotice'

/**
 * First-time voter checklist (PRD §5.17, IA §3.9, `/voting-guide`). Anonymous. An ORDERED
 * checklist, not an index: the logistics pages each answer one question; a first-time voter
 * needs them in order. Each step deep-links to the page that does the work — no content is
 * duplicated here. This URL is also the forwardable "first-time voter link" carried in partner
 * kits (PRD §5.12).
 *
 * Step 4 (read the candidates) needs a ward for its URL: a registered visitor with a home ward
 * deep-links straight to that ward's candidate list; everyone else is sent to the ward finder
 * first (the same page step 3 already points at — knowing your ward IS the prerequisite).
 */
export default function VotingGuideHub() {
  const { isAuthed, user } = useAuth()
  const candidatesHref =
    isAuthed && user.homeWardId ? `/ward/${user.homeWardId}/candidates` : '/'

  const stepLink = 'font-semibold text-brand underline underline-offset-2 hover:no-underline'

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-8">
      <div>
        <h1 className="text-2xl font-bold text-ink sm:text-3xl">
          Voting guide — your first-time voter checklist
        </h1>
        <p className="mt-2 text-sm text-ink/80">
          Voting in your first Bengaluru ward election? Do these six things, in this order. Each
          step links to the page that does the work — nearly everyone is a first-timer for this
          format, so nothing here assumes you&apos;ve done it before.
        </p>
      </div>

      <ol aria-label="First-time voter checklist" className="space-y-4">
        <li className="rounded-lg border border-slate-200 p-4">
          <h2 className="font-semibold text-ink">
            1.{' '}
            <Link to="/check-registration" className={stepLink}>
              Check you&apos;re on the roll
            </Link>
          </h2>
          <p className="mt-1 text-sm text-ink/70">
            Confirm you&apos;re on the GBA electoral roll — months in advance, so there&apos;s
            time to fix a problem.
          </p>
        </li>
        <li className="space-y-2 rounded-lg border border-slate-200 p-4">
          <h2 className="font-semibold text-ink">
            2.{' '}
            <Link to="/voting-guide/voter-id" className={stepLink}>
              Enrol or transfer your Voter ID before the deadline
            </Link>
          </h2>
          <p className="mt-1 text-sm text-ink/70">
            New enrolment (Form 6), or transfer a registration from another city or address
            (Form 8). This step expires:
          </p>
          <RollDeadlineNotice />
        </li>
        <li className="rounded-lg border border-slate-200 p-4">
          <h2 className="font-semibold text-ink">
            3.{' '}
            <Link to="/" className={stepLink}>
              Find your ward
            </Link>
          </h2>
          <p className="mt-1 text-sm text-ink/70">
            Ward boundaries changed in the delimitation — find your new ward by name or area.
          </p>
        </li>
        <li className="rounded-lg border border-slate-200 p-4">
          <h2 className="font-semibold text-ink">
            4.{' '}
            <Link to={candidatesHref} className={stepLink}>
              Read the candidates
            </Link>
          </h2>
          <p className="mt-1 text-sm text-ink/70">
            Neutral, sourced report cards for every candidate in your ward — open your ward page
            to see them.
          </p>
        </li>
        <li className="rounded-lg border border-slate-200 p-4">
          <h2 className="font-semibold text-ink">
            5.{' '}
            <Link to="/voting-guide/find-booth" className={stepLink}>
              Find your polling booth
            </Link>
          </h2>
          <p className="mt-1 text-sm text-ink/70">
            Booths change between elections — look up the exact location you&apos;re assigned to.
          </p>
        </li>
        <li className="rounded-lg border border-slate-200 p-4">
          <h2 className="font-semibold text-ink">
            6.{' '}
            <Link to="/voting-guide/how-to-vote" className={stepLink}>
              Vote — how to vote on the day
            </Link>
          </h2>
          <p className="mt-1 text-sm text-ink/70">
            The step-by-step walk-through of polling day, plus a first-timer FAQ and what&apos;s
            different about a ward election.
          </p>
        </li>
      </ol>
    </div>
  )
}
