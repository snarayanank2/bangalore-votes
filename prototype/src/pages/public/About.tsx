import { Link } from 'react-router-dom'

/**
 * About & how we source data — the trust page (PRD §5.11 + §11, IA §3.13, `/about`). Anonymous.
 * Establishes who runs the platform, how data is sourced/verified, and the neutrality stance.
 *
 * MANDATORY HONESTY: must state plainly that this build is a prototype seeded with fictional
 * data — it deploys publicly against a real, upcoming election, so this page is the place a
 * skeptical reader checks first.
 */
export default function About() {
  return (
    <div className="mx-auto max-w-2xl space-y-8 px-4 py-8">
      <div>
        <h1 className="text-2xl font-bold text-ink sm:text-3xl">About &amp; how we source data</h1>
      </div>

      <section
        aria-labelledby="prototype-heading"
        className="space-y-2 rounded-lg border border-amber-300 bg-amber-50 p-4"
      >
        <h2 id="prototype-heading" className="text-sm font-semibold uppercase tracking-wide text-amber-900">
          This is a prototype
        </h2>
        <p className="text-sm text-amber-900">
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
          Bangalore Votes is an independent, non-partisan civic information project. It isn&apos;t
          affiliated with, and doesn&apos;t take money from, any political party or candidate. Its
          only goal is to give Bengaluru residents accurate, easy-to-find ward election
          information ahead of voting day.
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

      <section aria-labelledby="contact-heading" className="space-y-1 border-t border-slate-200 pt-6">
        <h2 id="contact-heading" className="text-lg font-semibold text-ink">
          Questions or corrections
        </h2>
        <p className="text-sm text-ink/80">
          For anything you see on a candidate or ward page, the fastest route is the{' '}
          <strong>Flag an error</strong> button on that page. For everything else, see the{' '}
          <Link to="/voting-guide" className="text-brand underline underline-offset-2">
            voting guide
          </Link>{' '}
          for logistics questions.
        </p>
      </section>
    </div>
  )
}
