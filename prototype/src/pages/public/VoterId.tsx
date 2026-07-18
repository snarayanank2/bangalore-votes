import { RollDeadlineNotice } from '../../components/RollDeadlineNotice'

/**
 * Voter-ID issuance & update (PRD §5.8, IA §3.10, `/voting-guide/voter-id`). Anonymous. Aimed at
 * first-time voters and citizens who've moved — plain, numbered steps rather than prose, per the
 * task brief's low-digital-literacy audience.
 *
 * All "official EC process" links are inert `href="#"` placeholders in this static prototype —
 * we never imply they submit anything for real.
 */
export default function VoterId() {
  return (
    <div className="mx-auto max-w-prose space-y-8 px-4 py-8">
      <div>
        <h1 className="text-2xl text-ink sm:text-3xl">
          Voter ID — new enrolment &amp; updates
        </h1>
        <p className="mt-2 text-sm text-ink/80">
          Your Voter ID (EPIC card) is issued by the Election Commission of India and is what
          gets you onto the electoral roll at your current address. Use the right guide below
          depending on your situation.
        </p>
      </div>

      <RollDeadlineNotice />

      <section aria-labelledby="new-heading" className="space-y-3">
        <h2 id="new-heading" className="text-lg font-semibold text-ink">
          I don&apos;t have a Voter ID yet (new enrolment)
        </h2>
        <p className="text-sm text-ink/70">
          You can register once you turn 18. This is done using Form 6.
        </p>
        <ol className="list-decimal space-y-2 pl-5 text-sm text-ink/90">
          <li>Open the official EC voter services portal and select Form 6 (new registration).</li>
          <li>
            Fill in your name, date of birth, and current residential address exactly as it
            appears on your address proof.
          </li>
          <li>
            Upload a recent passport-size photo and proof of age and address (e.g. Aadhaar,
            passport, utility bill).
          </li>
          <li>Submit the form. You&apos;ll get a reference number to track your application.</li>
          <li>
            A Booth Level Officer (BLO) may visit to verify your address before your entry is
            approved.
          </li>
        </ol>
        <a
          href="#"
          className="inline-block text-sm font-medium text-forest underline underline-offset-2 hover:no-underline"
        >
          Open Form 6 on the official EC portal (placeholder link in this prototype)
        </a>
      </section>

      <section
        aria-labelledby="elsewhere-heading"
        className="space-y-3 border-t border-gray-300 pt-6"
      >
        <h2 id="elsewhere-heading" className="text-lg font-semibold text-ink">
          I&apos;m registered in another city — does my vote count here?
        </h2>
        <p className="text-sm text-ink/90">
          <strong>No — a vote registered elsewhere does not count here.</strong> Many of
          Bengaluru&apos;s first-time local voters moved here from another city or state, and this
          is their first question. To vote in your GBA ward, transfer your registration to your
          Bengaluru address using <strong>Form 8</strong> (steps below) <strong>before the
          electoral roll closes</strong> — after that, you cannot vote in this election from
          either address.
        </p>
        <p className="text-sm text-ink/70">
          <strong>Renting, or living in a PG?</strong> You do not need to own property to enrol
          where you live. Commonly accepted proof of your current address includes a registered
          rent agreement, an Aadhaar card updated to this address, or a utility bill in your name;
          PG residents can ask the owner for a simple residence declaration. The official EC list
          of accepted documents is the final word — check it via the Form 8 link below.
        </p>
      </section>

      <section aria-labelledby="update-heading" className="space-y-3 border-t border-gray-300 pt-6">
        <h2 id="update-heading" className="text-lg font-semibold text-ink">
          I&apos;ve moved, or need to correct/transfer my details
        </h2>
        <p className="text-sm text-ink/70">
          If you already have a Voter ID but your address has changed, or a detail is wrong, use
          Form 8 instead of registering again.
        </p>
        <ol className="list-decimal space-y-2 pl-5 text-sm text-ink/90">
          <li>Open the official EC voter services portal and select Form 8 (correction / transfer).</li>
          <li>
            Enter your existing EPIC number and choose whether you&apos;re correcting a detail or
            transferring your registration to a new address.
          </li>
          <li>Upload proof for whatever you&apos;re changing (new address proof, corrected ID, etc.).</li>
          <li>Submit and note the reference number for tracking.</li>
          <li>
            Once approved, your entry moves to the correct ward — this also determines which
            polling booth you&apos;re assigned to.
          </li>
        </ol>
        <a
          href="#"
          className="inline-block text-sm font-medium text-forest underline underline-offset-2 hover:no-underline"
        >
          Open Form 8 on the official EC portal (placeholder link in this prototype)
        </a>
      </section>

      <p className="text-xs italic text-ink/60">
        Deadlines and exact form requirements can change with each Election Commission update —
        always confirm details on the official EC site before relying on this guide.
      </p>
    </div>
  )
}
