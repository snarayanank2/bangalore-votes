import { Link } from 'react-router-dom'

/**
 * About & how we source data — the trust page (PRD §5.11 + §11, IA §3.13, `/about`). Anonymous.
 * Establishes who runs the platform, who funds it, how data is sourced/verified, the neutrality
 * stance, and the data commitments citizens get in return for registering.
 *
 * MANDATORY HONESTY: must state plainly that this build is a prototype seeded with fictional
 * data — it deploys publicly against a real, upcoming election, so this page is the place a
 * skeptical reader checks first.
 *
 * Funding disclosure detail (named funders vs. categories only) is an open question (PRD §17) —
 * this page states plainly that disclosure is pending that decision and names no funders. The
 * Oorvani Foundation is a real organisation; only what the docs state about it is asserted here
 * (that it runs the platform in production and is the trust behind opencity.in) — nothing about
 * its history, staff, or funders is invented.
 */
export default function About() {
  return (
    <div className="mx-auto max-w-prose space-y-8 px-4 py-8">
      <div>
        <h1 className="text-2xl text-ink sm:text-3xl">About &amp; how we source data</h1>
      </div>

      <section
        aria-labelledby="prototype-heading"
        className="space-y-2 rounded-md bg-sun-tint p-4"
      >
        <h2 id="prototype-heading" className="text-sm font-medium text-forest">
          This is a prototype
        </h2>
        <p className="text-sm text-ink">
          This build of Bangalore Votes is a prototype. Every ward, candidate, and news link you
          see here is fictional sample data used to demonstrate how the real platform would work
          — none of it describes real people or a real GBA election outcome. Nothing here should
          be used to make a decision about an actual candidate or ward.
        </p>
      </section>

      <section aria-labelledby="who-heading" className="space-y-2">
        <h2 id="who-heading" className="text-lg font-semibold text-ink">
          Who runs this
        </h2>
        <p className="text-sm text-ink/80">
          Bangalore Votes is run in production by the <strong>Oorvani Foundation</strong>, the
          trust that operates <span className="italic">opencity.in</span>. It is an independent,
          non-partisan civic information project — it isn&apos;t affiliated with, and doesn&apos;t
          take money from, any political party or candidate. Its only goal is to give Bengaluru
          residents accurate, easy-to-find ward election information ahead of voting day.
        </p>
      </section>

      <section aria-labelledby="funding-heading" className="space-y-2">
        <h2 id="funding-heading" className="text-lg font-semibold text-ink">
          Funding
        </h2>
        <p className="text-sm text-ink/80">
          For a platform whose entire value rests on neutrality, who pays for it is the first
          question a skeptical reader should ask — and the answer shouldn&apos;t have to be
          requested. This section will disclose who funds Bangalore Votes. How much detail it
          shows — named funders and amounts, or funder categories only — is <strong>still an
          open decision</strong>; no funders are named here because that decision hasn&apos;t
          been made yet, not because there is nothing to disclose.
        </p>
      </section>

      <section aria-labelledby="data-commitments-heading" className="space-y-2">
        <h2 id="data-commitments-heading" className="text-lg font-semibold text-ink">
          What we do with your data
        </h2>
        <p className="text-sm text-ink/80">
          The Oorvani Foundation <strong>does not sell or share your data with third
          parties</strong>. If you register, the contact details you give us are used for two
          things only: <strong>ward election updates</strong> for your area, and{' '}
          <strong>critical product updates</strong> — meaning service-affecting notices, such as a
          data breach, a material change to our terms, or the platform shutting down, never to
          announce new features. Full detail lives on the{' '}
          <Link to="/privacy" className="text-forest underline underline-offset-2">
            privacy policy
          </Link>{' '}
          page.
        </p>
      </section>

      <section aria-labelledby="sourcing-heading" className="space-y-2">
        <h2 id="sourcing-heading" className="text-lg font-semibold text-ink">
          How data is sourced and verified
        </h2>
        <p className="text-sm text-ink/80">
          Every fact you see on a candidate&apos;s report card is labelled with where it came
          from. Some fields — like pending cases and declared assets — come directly from
          candidates&apos; official nomination affidavits filed with the Election Commission.
          Other fields — like a candidate&apos;s ward track record or approachability — are
          compiled by trained local <strong>data curators</strong> from public reporting and
          verifiable sources, and are marked as curator-compiled rather than official.
        </p>
        <p className="text-sm text-ink/80">
          Curators are recruited and vetted for a specific ward or zone, and their edits go live
          immediately once published — we trust them, but we don&apos;t hide that trust: every
          change is written to an audit trail recording who changed what, when, and why, so any
          edit can be reviewed or rolled back later.
        </p>
        <p className="text-sm text-ink/80">
          If you spot something wrong, use the <strong>Flag an error</strong> button on any
          candidate page — it routes straight to the curator responsible for that ward.
        </p>
      </section>

      <section aria-labelledby="primary-sources-heading" className="space-y-2">
        <h2 id="primary-sources-heading" className="text-lg font-semibold text-ink">
          Primary sources
        </h2>
        <p className="text-sm text-ink/80">
          These are the kinds of official records this platform relies on. This is a static
          prototype with no live network access, so the links below don&apos;t resolve to real
          pages here — in the live product they would point to the actual government source.
        </p>
        <ul className="space-y-2">
          <li>
            <a
              href="#"
              className="text-sm font-medium text-forest underline underline-offset-2 hover:no-underline"
            >
              EC candidate nomination affidavits (placeholder link in this prototype)
            </a>
          </li>
          <li>
            <a
              href="#"
              className="text-sm font-medium text-forest underline underline-offset-2 hover:no-underline"
            >
              Official election notifications (placeholder link in this prototype)
            </a>
          </li>
          <li>
            <a
              href="#"
              className="text-sm font-medium text-forest underline underline-offset-2 hover:no-underline"
            >
              GBA ward-delimitation data (placeholder link in this prototype)
            </a>
          </li>
        </ul>
      </section>

      <section aria-labelledby="neutrality-heading" className="space-y-2">
        <h2 id="neutrality-heading" className="text-lg font-semibold text-ink">
          Our neutrality stance
        </h2>
        <p className="text-sm text-ink/80">
          We don&apos;t endorse, rank, or score candidates, and we don&apos;t write editorial
          commentary about any of them. Every candidate&apos;s report card uses identical,
          neutral formatting for every field — including sensitive ones like pending criminal
          cases — so the presentation itself never implies a verdict. Issue-voting results show
          only what citizens collectively say matters to them; they are not, and are never
          presented as, an opinion poll or election prediction.
        </p>
      </section>

      <section aria-labelledby="contact-heading" className="space-y-1 border-t border-gray-300 pt-6">
        <h2 id="contact-heading" className="text-lg font-semibold text-ink">
          Questions or corrections
        </h2>
        <p className="text-sm text-ink/80">
          For anything you see on a candidate or ward page, the fastest route is the{' '}
          <strong>Flag an error</strong> button on that page. For everything else, see the{' '}
          <Link to="/voting-guide" className="text-forest underline underline-offset-2">
            voting guide
          </Link>{' '}
          for logistics questions.
        </p>
      </section>
    </div>
  )
}
