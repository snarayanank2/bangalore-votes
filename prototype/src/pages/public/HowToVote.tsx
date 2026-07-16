/**
 * How to vote (PRD §5.9, IA §3.11, `/voting-guide/how-to-vote`). Anonymous. A simple numbered
 * walk-through of polling day aimed squarely at first-time voters and the less-digital, less
 * English-fluent audience the product targets — short sentences, no jargon left unexplained.
 */
export default function HowToVote() {
  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-8">
      <div>
        <h1 className="text-2xl font-bold text-ink sm:text-3xl">How to vote</h1>
        <p className="mt-2 text-sm text-ink/80">
          Voting takes most people under ten minutes. Here&apos;s exactly what happens, step by
          step.
        </p>
      </div>

      <section aria-labelledby="steps-heading" className="space-y-3">
        <h2 id="steps-heading" className="text-lg font-semibold text-ink">
          On polling day
        </h2>
        <ol className="list-decimal space-y-3 pl-5 text-sm text-ink/90">
          <li>
            <strong>Find your booth.</strong> Use the polling booth finder to confirm the exact
            address — it may be different from previous elections.
          </li>
          <li>
            <strong>Carry your Voter ID.</strong> Bring your EPIC card. If you don&apos;t have it
            yet, most other government photo IDs (Aadhaar, passport, driving licence) are usually
            accepted as a backup — check the official EC list to be sure.
          </li>
          <li>
            <strong>Join the queue and verify your name.</strong> A polling official will check
            your name against the electoral roll for that booth.
          </li>
          <li>
            <strong>Get inked.</strong> An indelible ink mark is applied to your finger — this
            prevents duplicate voting and is a normal, required step.
          </li>
          <li>
            <strong>Cast your vote.</strong> At the voting machine (EVM), press the button next to
            your preferred candidate&apos;s name, party symbol, and photo. A beep confirms your
            vote was recorded.
          </li>
          <li>
            <strong>Check the VVPAT slip.</strong> A paper slip briefly displays behind a screen
            showing the candidate you voted for, so you can confirm it matches your choice.
          </li>
          <li>
            <strong>You&apos;re done.</strong> Leave the booth — there&apos;s nothing further to
            submit or sign.
          </li>
        </ol>
      </section>

      <section aria-labelledby="tips-heading" className="space-y-2 border-t border-slate-200 pt-6">
        <h2 id="tips-heading" className="text-lg font-semibold text-ink">
          A few things that trip people up
        </h2>
        <ul className="list-disc space-y-1.5 pl-5 text-sm text-ink/80">
          <li>Your polling booth can change between elections — always re-check before you go.</li>
          <li>Polling booths are free to enter; nobody should ask you for money or ID fees.</li>
          <li>You can only vote at the specific booth you&apos;re assigned to.</li>
        </ul>
      </section>
    </div>
  )
}
