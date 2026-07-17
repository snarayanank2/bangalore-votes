/**
 * Privacy policy (PRD §5.16, IA §3.18, `/privacy`). Anonymous. Ships in Phase 0 — the earliest
 * page on the critical path, since Meta requires a published privacy-policy URL to approve
 * WhatsApp Business API onboarding.
 *
 * MANDATORY HONESTY: the PRD is explicit that "`/terms` and `/privacy` content is outside a
 * product spec's competence" and needs a lawyer, and that `/privacy` is additionally blocked on
 * an undecided retention period (PRD §17). This page therefore renders the REQUIRED SECTION
 * STRUCTURE with a prominent pending-legal-review notice — it must never read as an authoritative
 * policy a citizen could rely on. Retention and the "future civic tools" consent checkbox are
 * open questions (§17) and are left explicitly marked as such, not guessed at.
 */
export default function Privacy() {
  return (
    <div className="mx-auto max-w-2xl space-y-8 px-4 py-8">
      <div>
        <h1 className="text-2xl font-bold text-ink sm:text-3xl">Privacy policy</h1>
      </div>

      <section
        aria-labelledby="pending-review-heading"
        className="space-y-2 rounded-lg border border-amber-300 bg-amber-50 p-4"
      >
        <h2 id="pending-review-heading" className="text-sm font-semibold uppercase tracking-wide text-amber-900">
          Pending legal review — not the final policy
        </h2>
        <p className="text-sm text-amber-900">
          This page lays out the sections our privacy policy will contain, so you can see what it
          will cover before it is finished. It is <strong>not the final policy</strong>, has not
          been reviewed by a lawyer, and should not be relied on as a statement of your actual
          rights or of how your data is handled. The finished, legally reviewed policy will
          replace this text before the platform accepts real registrations.
        </p>
      </section>

      <section aria-labelledby="operator-heading" className="space-y-2">
        <h2 id="operator-heading" className="text-lg font-semibold text-ink">
          Who operates this platform
        </h2>
        <p className="text-sm text-ink/80">
          Bangalore Votes is run in production by the <strong>Oorvani Foundation</strong>, the
          trust that operates <span className="italic">opencity.in</span>. The finished policy
          will state the Foundation&apos;s full registered details and contact information here.
        </p>
      </section>

      <section aria-labelledby="collected-heading" className="space-y-2">
        <h2 id="collected-heading" className="text-lg font-semibold text-ink">
          What we collect, and why
        </h2>
        <p className="text-sm text-ink/80">This section will describe each of the following:</p>
        <ul className="list-disc space-y-1 pl-5 text-sm text-ink/80">
          <li>
            <strong>Email and/or phone (WhatsApp)</strong> — to create your account and send you
            updates.
          </li>
          <li>
            <strong>Address, used to determine your ward</strong> — so updates and your issue vote
            are routed to the correct ward.
          </li>
          <li>
            <strong>Language preference</strong> — so account content and updates are sent in
            English or Kannada, as you choose.
          </li>
          <li>
            <strong>Partner attribution (the <code>src</code> parameter)</strong> — if you arrived
            via a partner&apos;s shared link, that attribution is stored on your record for
            measurement only. It grants no permissions and changes nothing you see.
          </li>
          <li>
            <strong>Standard server logs</strong> — basic request logs kept for security and
            reliability of the service.
          </li>
          <li>
            <strong>Google Analytics usage data and cookies</strong> — visitor and event
            measurement (page views, ward-finder usage, registration funnel steps, language
            toggles) uses Google Analytics across public pages, alongside the platform&apos;s own
            server-side application events — which remain the source of truth for registration
            and contribution counts.
          </li>
        </ul>
      </section>

      <section aria-labelledby="consent-heading" className="space-y-2">
        <h2 id="consent-heading" className="text-lg font-semibold text-ink">
          Consent and withdrawal
        </h2>
        <p className="text-sm text-ink/80">
          Registering for email or WhatsApp updates is opt-in. The finished policy will describe
          how consent is captured at registration and how you can withdraw it at any time from{' '}
          <span className="font-medium">Account → Notifications</span> — turning off a channel
          stops future messages on it.
        </p>
      </section>

      <section aria-labelledby="commitments-heading" className="space-y-2">
        <h2 id="commitments-heading" className="text-lg font-semibold text-ink">
          Data commitments
        </h2>
        <p className="text-sm text-ink/80">
          The Oorvani Foundation <strong>does not sell or share your data with third parties</strong>.
          Contact details are used for two purposes only: <strong>ward-scoped election updates</strong>{' '}
          and <strong>critical product updates</strong> — narrowly, service-affecting notices such
          as a data breach, a material change to these terms, or the platform shutting down, never
          to announce new features. Using contact details for anything beyond these two purposes —
          including a future civic-tools product — would need fresh consent, not this policy.
        </p>
        <p className="text-sm text-ink/80">
          <strong>Issue votes are published only in aggregate.</strong> The public ward-issues page
          shows ranked totals for a ward, never an individual citizen&apos;s vote.
        </p>
      </section>

      <section aria-labelledby="dpdp-heading" className="space-y-2">
        <h2 id="dpdp-heading" className="text-lg font-semibold text-ink">
          DPDP Act 2023 and your rights
        </h2>
        <p className="text-sm text-ink/80">
          India&apos;s <strong>Digital Personal Data Protection Act, 2023 (DPDP Act 2023)</strong>{' '}
          applies to the personal data this platform collects. The finished policy will set out,
          in the Act&apos;s terms, your rights as a <strong>data principal</strong> — including
          access to your data, correction, and erasure — and how to exercise them.
        </p>
      </section>

      <section aria-labelledby="grievance-heading" className="space-y-2">
        <h2 id="grievance-heading" className="text-lg font-semibold text-ink">
          Grievance officer
        </h2>
        <p className="text-sm text-ink/80">
          The DPDP Act 2023 requires a named grievance officer citizens can contact about their
          data. That officer has <strong>not yet been named</strong> in this prototype — their
          name and contact details are to be appointed and published here as part of the legally
          reviewed policy, before real registrations are accepted.
        </p>
      </section>

      <section aria-labelledby="retention-heading" className="space-y-2">
        <h2 id="retention-heading" className="text-lg font-semibold text-ink">
          Retention
        </h2>
        <p className="text-sm text-ink/80">
          How long citizen contact data is kept is an <strong>open question, not yet decided</strong>{' '}
          — this policy must eventually state either a retention period or a deletion trigger, and
          until that decision is made, this remains a blocker on publishing a finished privacy
          policy. No period is stated here because none has been decided.
        </p>
      </section>

      <section aria-labelledby="privacy-review-footer-heading" className="space-y-1 border-t border-slate-200 pt-6">
        <h2 id="privacy-review-footer-heading" className="text-lg font-semibold text-ink">
          Questions about this draft
        </h2>
        <p className="text-sm text-ink/80">
          This is prototype scaffolding, not a live legal document — see the notice at the top of
          this page.
        </p>
      </section>
    </div>
  )
}
