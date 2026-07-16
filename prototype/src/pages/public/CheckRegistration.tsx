import { Link } from 'react-router-dom'

/**
 * Check registration / eligibility (PRD §5.6, IA §3.7, `/check-registration`). Anonymous,
 * available months before candidate data exists — this is one of the earliest things citizens
 * look for.
 *
 * A GUIDED LINK-OUT, NOT AN ON-PLATFORM LOOKUP (PRD §5.6): this page used to simulate a roll
 * check with a fake, clearly-labelled demo result. That was replaced — a wrong answer about
 * someone's franchise is the worst error this platform could make, so the platform never accepts
 * or evaluates voter details itself. It explains the check in plain language and hands off to the
 * official EC / CEO Karnataka roll lookup (an inert `href="#"` placeholder in this prototype)
 * rather than pretend to replicate it.
 */
export default function CheckRegistration() {
  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-8">
      <div>
        <h1 className="text-2xl font-bold text-ink sm:text-3xl">Check your registration</h1>
        <p className="mt-2 text-sm text-ink/80">
          Confirm whether you&apos;re on the GBA electoral roll before election day. Checking is
          worth doing months in advance — well before candidate lists are published — so you have
          time to fix a problem if you find one.
        </p>
      </div>

      <div className="rounded-lg border border-slate-200 p-4">
        <h2 className="text-sm font-semibold text-ink">How to check</h2>
        <p className="mt-1 text-sm text-ink/70">
          The Election Commission of India runs the official electoral roll, and the CEO
          Karnataka site runs the official search tool for it. You&apos;ll need your name, date of
          birth, and address, or your Voter ID (EPIC) number if you have one. No voter details are
          entered or stored on this platform — the official source gives the real answer, and this
          page&apos;s only job is getting you there without confusion.
        </p>
        <a
          href="#"
          className="mt-3 inline-block rounded bg-brand px-4 py-2 text-sm font-semibold text-white focus:outline-none focus:ring-2 focus:ring-brand"
        >
          Open the official EC / CEO Karnataka electoral roll search (placeholder link in this
          prototype)
        </a>
      </div>

      <div className="rounded-lg border border-slate-200 p-4">
        <h2 className="text-sm font-semibold text-ink">Not on the roll?</h2>
        <p className="mt-1 text-sm text-ink/70">
          If the search says you&apos;re not registered, or your details are out of date, see our{' '}
          <Link to="/voting-guide/voter-id" className="text-brand underline underline-offset-2">
            Voter ID guide
          </Link>{' '}
          for how to enrol or update your entry.
        </p>
      </div>
    </div>
  )
}
