/**
 * How to vote (PRD §5.9, IA §3.11, `/voting-guide/how-to-vote`). Anonymous. A simple numbered
 * walk-through of polling day aimed squarely at first-time voters and the less-digital, less
 * English-fluent audience the product targets — short sentences, no jargon left unexplained.
 */
export default function HowToVote() {
  return (
    <div className="mx-auto max-w-prose space-y-6 px-4 py-8">
      <div>
        <h1 className="text-2xl text-ink sm:text-3xl">How to vote</h1>
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
            <strong>Cast your vote.</strong> Whether GBA ward polls will use EVMs (electronic
            voting machines) or paper ballots has <strong>not yet been announced</strong> by the
            State Election Commission. If EVMs are used: press the button next to your preferred
            candidate&apos;s name, party symbol, and photo — a beep confirms your vote, and a
            VVPAT paper slip briefly displays behind a screen so you can check it matches your
            choice. If paper ballots are used: stamp your choice and fold the ballot as the
            polling official directs. This page will be updated as soon as the format is
            confirmed.
          </li>
          <li>
            <strong>You&apos;re done.</strong> Leave the booth — there&apos;s nothing further to
            submit or sign.
          </li>
        </ol>
      </section>

      <section aria-labelledby="tips-heading" className="space-y-2 border-t border-gray-300 pt-6">
        <h2 id="tips-heading" className="text-lg font-semibold text-ink">
          A few things that trip people up
        </h2>
        <ul className="list-disc space-y-1.5 pl-5 text-sm text-ink/80">
          <li>Your polling booth can change between elections — always re-check before you go.</li>
          <li>Polling booths are free to enter; nobody should ask you for money or ID fees.</li>
          <li>You can only vote at the specific booth you&apos;re assigned to.</li>
        </ul>
      </section>

      <section aria-labelledby="faq-heading" className="space-y-3 border-t border-gray-300 pt-6">
        <h2 id="faq-heading" className="text-lg font-semibold text-ink">
          First-time voter FAQ
        </h2>
        <dl className="space-y-3 text-sm">
          <div>
            <dt className="font-semibold text-ink">My Voter ID (EPIC card) hasn&apos;t arrived — can I still vote?</dt>
            <dd className="mt-0.5 text-ink/80">
              Yes, if your name is on the electoral roll. The EC publishes a list of alternative
              photo documents accepted at the booth — Aadhaar, passport, driving licence, and
              others.{' '}
              <a href="#" className="text-forest underline underline-offset-2">
                Official EC alternative-document list (placeholder link in this prototype)
              </a>
            </dd>
          </div>
          <div>
            <dt className="font-semibold text-ink">What is a voter slip?</dt>
            <dd className="mt-0.5 text-ink/80">
              A slip distributed before polling day showing your name, roll entry, and booth. It
              helps officials find your entry quickly, but it is not an identity document on its
              own — carry a photo ID too.
            </dd>
          </div>
          <div>
            <dt className="font-semibold text-ink">What if I don&apos;t want to vote for anyone?</dt>
            <dd className="mt-0.5 text-ink/80">
              Every ballot includes <strong>NOTA</strong> (&quot;None of the Above&quot;) as the
              last option — choosing it records that you voted without supporting any candidate.
            </dd>
          </div>
          <div>
            <dt className="font-semibold text-ink">What can&apos;t I take inside?</dt>
            <dd className="mt-0.5 text-ink/80">
              <strong>Phones</strong> and cameras are not allowed inside the polling booth. Leave
              your phone at home or with a companion outside.
            </dd>
          </div>
        </dl>
      </section>

      <section
        aria-labelledby="ward-difference-heading"
        className="space-y-2 border-t border-gray-300 pt-6"
      >
        <h2 id="ward-difference-heading" className="text-lg font-semibold text-ink">
          What&apos;s different about a ward election
        </h2>
        <ul className="list-disc space-y-1.5 pl-5 text-sm text-ink/80">
          <li>
            You elect <strong>one corporator per ward</strong> — the most local elected
            representative you have, responsible for streets, drains, waste, and lighting in your
            neighbourhood.
          </li>
          <li>
            This is the first election under the new <strong>five-corporation GBA structure</strong>{' '}
            (Greater Bengaluru Authority) that replaced the single BBMP.
          </li>
          <li>
            Your ward may <strong>not match your assembly constituency</strong> — the boundaries
            are different, so check your ward with the ward finder even if you know your MLA seat.
          </li>
          <li>
            The last ward election was roughly a decade ago — for this format,{' '}
            <strong>every voter is a first-timer</strong>, whatever your experience of assembly or
            general elections.
          </li>
        </ul>
      </section>
    </div>
  )
}
