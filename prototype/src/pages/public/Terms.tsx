/**
 * Terms & conditions (PRD §5.16, IA §3.17, `/terms`). Anonymous. Ships in Phase 0 alongside
 * `/privacy` (docs/overview.md §10).
 *
 * MANDATORY HONESTY: per PRD §5.16, `/terms` content "is outside a product spec's competence"
 * and needs a lawyer. This page renders the required section structure with a prominent
 * pending-legal-review notice, not authoritative-looking legal prose — see Privacy.tsx for the
 * matching rationale.
 */
export default function Terms() {
  return (
    <div className="mx-auto max-w-prose space-y-8 px-4 py-8">
      <div>
        <h1 className="text-2xl text-ink sm:text-3xl">Terms &amp; conditions</h1>
      </div>

      <section
        aria-labelledby="terms-pending-review-heading"
        className="space-y-2 rounded-md bg-sun-tint p-4"
      >
        <h2 id="terms-pending-review-heading" className="text-sm font-medium text-forest">
          Pending legal review — not the final terms
        </h2>
        <p className="text-sm text-ink">
          This page lays out the sections our terms of use will contain, so you can see what they
          will cover before they are finished. It is <strong>not the final terms of use</strong>,
          has not been reviewed by a lawyer, and creates no binding agreement. The finished,
          legally reviewed terms will replace this text before the platform accepts real
          registrations.
        </p>
      </section>

      <section aria-labelledby="acceptable-use-heading" className="space-y-2">
        <h2 id="acceptable-use-heading" className="text-lg font-semibold text-ink">
          Acceptable use
        </h2>
        <p className="text-sm text-ink/80">
          This section will set out what you can and can&apos;t do on Bangalore Votes — using the
          flag and issue-vote tools honestly, not attempting to disrupt or abuse the service, and
          not impersonating another person or organisation. Final wording is pending legal review.
        </p>
      </section>

      <section aria-labelledby="contribution-licensing-heading" className="space-y-2">
        <h2 id="contribution-licensing-heading" className="text-lg font-semibold text-ink">
          Contribution licensing
        </h2>
        <p className="text-sm text-ink/80">
          When you submit a <strong>flag</strong> or cast an <strong>issue vote</strong>, this
          section will describe what rights you grant Bangalore Votes to review, act on, and (for
          issue votes) publish your contribution in aggregate, consistent with the flag →
          correction → publish workflow (PRD §6) and the fact that issue votes are shown only as
          ward-level totals, never attributed to you individually. Final wording is pending legal
          review.
        </p>
      </section>

      <section aria-labelledby="accuracy-liability-heading" className="space-y-2">
        <h2 id="accuracy-liability-heading" className="text-lg font-semibold text-ink">
          Accuracy and liability disclaimers
        </h2>
        <p className="text-sm text-ink/80">
          Candidate report cards are compiled from official nomination affidavits and
          curator-sourced research, with every field carrying a visible source. Even with that
          sourcing standard, this section will disclaim that the platform cannot guarantee
          complete accuracy and is not a substitute for official Election Commission records.
          Final wording is pending legal review.
        </p>
      </section>

      <section aria-labelledby="termination-heading" className="space-y-2">
        <h2 id="termination-heading" className="text-lg font-semibold text-ink">
          Account termination
        </h2>
        <p className="text-sm text-ink/80">
          Consistent with the admin account-management capability (PRD §7), this section will
          describe the grounds on which an administrator may suspend or terminate an account —
          such as abusing the flagging or issue-voting systems, submitting knowingly false
          information, or other violations of acceptable use — and the process for it. Final
          wording is pending legal review.
        </p>
      </section>
    </div>
  )
}
