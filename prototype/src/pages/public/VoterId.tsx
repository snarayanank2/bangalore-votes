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
    <div className="mx-auto max-w-2xl space-y-8 px-4 py-8">
      <div>
        <h1 className="text-2xl font-bold text-ink sm:text-3xl">
          Voter ID — new enrolment &amp; updates
        </h1>
        <p className="mt-2 text-sm text-ink/80">
          Your Voter ID (EPIC card) is issued by the Election Commission of India and is what
          gets you onto the electoral roll at your current address. Use the right guide below
          depending on your situation.
        </p>
      </div>

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
          className="inline-block text-sm font-medium text-brand underline underline-offset-2 hover:no-underline"
        >
          Open Form 6 on the official EC portal (placeholder link in this prototype)
        </a>
      </section>

      <section aria-labelledby="update-heading" className="space-y-3 border-t border-slate-200 pt-6">
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
          className="inline-block text-sm font-medium text-brand underline underline-offset-2 hover:no-underline"
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
