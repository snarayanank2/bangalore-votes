import { Link } from 'react-router-dom'
import { RollDeadlineNotice } from '../../components/RollDeadlineNotice'
import { BUTTON_BASE_CLASS, BUTTON_VARIANT_CLASSES } from '../../components/Button'

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
    <div className="mx-auto max-w-prose space-y-6 px-4 py-8">
      <div>
        <h1 className="text-2xl text-ink sm:text-3xl">Check your registration</h1>
        <p className="mt-2 text-sm text-ink/80">
          Confirm whether you&apos;re on the GBA electoral roll before election day. Checking is
          worth doing months in advance — well before candidate lists are published — so you have
          time to fix a problem if you find one.
        </p>
      </div>

      <RollDeadlineNotice />

      <div className="rounded-md border border-gray-300 p-4">
        <h2 className="text-sm font-semibold text-ink">Am I eligible in the first place?</h2>
        <p className="mt-1 text-sm text-ink/70">
          The check below is useless if you don&apos;t yet know whether you qualify, so start
          here:
        </p>
        <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm text-ink/70">
          <li>
            You must be <strong>18 or older on the qualifying date</strong>. Qualifying dates now
            fall <strong>quarterly</strong> (four dates a year) — if you turn 18 soon, you do not
            have to wait a full year to enrol, which many first-time voters assume.
          </li>
          <li>
            You can be enrolled in <strong>one place only</strong> — a registration elsewhere
            (another city, or your home town) must be transferred, not duplicated.
          </li>
          <li>
            Enrolment needs a recent passport-size photo, <strong>proof of age</strong> and{' '}
            <strong>proof of address</strong> (e.g. Aadhaar, passport, utility bill) — see the{' '}
            <Link to="/voting-guide/voter-id" className="text-forest underline underline-offset-2">
              Voter ID guide
            </Link>{' '}
            for the step-by-step forms.
          </li>
        </ul>
      </div>

      <div className="rounded-md border border-gray-300 p-4">
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
          className={`mt-3 ${BUTTON_BASE_CLASS} ${BUTTON_VARIANT_CLASSES.primary}`}
        >
          Open the official EC / CEO Karnataka electoral roll search (placeholder link in this
          prototype)
        </a>
      </div>

      <div className="rounded-md border border-gray-300 p-4">
        <h2 className="text-sm font-semibold text-ink">Not on the roll?</h2>
        <p className="mt-1 text-sm text-ink/70">
          If the search says you&apos;re not registered, or your details are out of date, see our{' '}
          <Link to="/voting-guide/voter-id" className="text-forest underline underline-offset-2">
            Voter ID guide
          </Link>{' '}
          for how to enrol or update your entry.
        </p>
      </div>
    </div>
  )
}
