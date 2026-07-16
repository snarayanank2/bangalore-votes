import { Link } from 'react-router-dom'

/**
 * Press kit (PRD §5.15, IA §3.16, `/press`). Anonymous. Ships in Phase 1 even though it's a
 * Phase 2 asset — journalists arrive at the EC notification, and a kit assembled then is
 * assembled too late.
 *
 * MANDATORY HONESTY: spokesperson bios and quotes below are demo data for this prototype. They
 * must read as unmistakably fictional and must never be presented as, or confused with, real
 * Oorvani Foundation staff or any real person. Key stats link out to `/data`, which a later task
 * builds — this page only needs to link it, per PRD §5.15.
 */
export default function Press() {
  return (
    <div className="mx-auto max-w-2xl space-y-8 px-4 py-8">
      <div>
        <h1 className="text-2xl font-bold text-ink sm:text-3xl">Press kit</h1>
        <p className="mt-2 text-sm text-ink/80">
          Everything a journalist needs to file an accurate story about Bangalore Votes without
          having to reach anyone first.
        </p>
      </div>

      <section aria-labelledby="boilerplate-heading" className="space-y-4">
        <h2 id="boilerplate-heading" className="text-lg font-semibold text-ink">
          Boilerplate
        </h2>

        <div className="space-y-1">
          <h3 className="text-sm font-semibold text-ink">Boilerplate — 50 words</h3>
          <p className="text-sm text-ink/80">
            Bangalore Votes is a free, non-partisan guide to Bengaluru&apos;s GBA ward elections.
            It helps residents find their new ward, read neutral, sourced candidate report cards,
            compare candidates, and handle voting logistics — registration checks, voter ID, and
            polling-booth locations — in English and Kannada. Run by the Oorvani Foundation.
          </p>
        </div>

        <div className="space-y-1">
          <h3 className="text-sm font-semibold text-ink">Boilerplate — 100 words</h3>
          <p className="text-sm text-ink/80">
            Bangalore Votes is a free, non-partisan civic information platform built for
            Bengaluru&apos;s first ward-level (GBA / corporator) elections in roughly a decade.
            Citizens who don&apos;t know which of the new, post-delimitation wards they now belong
            to can look it up in seconds, then read structured, sourced candidate report cards —
            covering track record, criminal cases, declared assets, and education — compiled from
            official affidavits and trained local data curators. Citizens can also vote on the top
            local issues in their ward and see results publicly. The platform also covers
            registration checks, voter-ID guidance, and polling-booth lookup, fully in English and
            Kannada. It is run in production by the Oorvani Foundation, the trust behind{' '}
            <span className="italic">opencity.in</span>.
          </p>
        </div>

        <div className="space-y-1">
          <h3 className="text-sm font-semibold text-ink">Boilerplate — 200 words</h3>
          <p className="text-sm text-ink/80">
            Bangalore Votes is a free, non-partisan civic information platform built for
            Bengaluru&apos;s first ward-level (GBA / corporator) elections in roughly a decade.
            Citizen interviews found people willing to vote but blocked by a few concrete gaps:
            they don&apos;t know which new, post-delimitation ward they belong to, they can&apos;t
            find trustworthy information about local candidates, and existing sources — mainstream
            media, WhatsApp forwards, party workers — are widely seen as biased or unreliable.
            Bangalore Votes closes those gaps directly. A citizen can find their ward in seconds,
            then read a structured, neutral candidate report card for every contestant — covering
            party affiliation, ward track record, criminal cases, declared assets, and education —
            with every field carrying a visible source, official affidavit data clearly
            distinguished from curator-compiled context. Candidates in a ward can be compared side
            by side. Citizens can also vote on the top three local issues that matter to them, with
            results shown publicly per ward. The platform additionally covers registration and
            eligibility checks, voter-ID issuance and updates, how-to-vote guidance, and a
            polling-booth locator — all fully bilingual in English and Kannada. The platform is run
            in production by the Oorvani Foundation, the trust behind{' '}
            <span className="italic">opencity.in</span>, and takes no money from, and is not
            affiliated with, any political party or candidate.
          </p>
        </div>
      </section>

      <section aria-labelledby="key-stats-heading" className="space-y-2">
        <h2 id="key-stats-heading" className="text-lg font-semibold text-ink">
          Key stats
        </h2>
        <p className="text-sm text-ink/80">
          Current, as-of-timestamped coverage, integrity, and citizen-signal figures are published
          on our public data page.
        </p>
        <Link
          to="/data"
          className="inline-block text-sm font-medium text-brand underline underline-offset-2 hover:no-underline"
        >
          View current key stats on the data page
        </Link>
      </section>

      <section aria-labelledby="assets-heading" className="space-y-2">
        <h2 id="assets-heading" className="text-lg font-semibold text-ink">
          Logos &amp; screenshots
        </h2>
        <ul className="space-y-2">
          <li>
            <a
              href="#"
              className="text-sm font-medium text-brand underline underline-offset-2 hover:no-underline"
            >
              Bangalore Votes logo, transparent PNG (placeholder link in this prototype)
            </a>
          </li>
          <li>
            <a
              href="#"
              className="text-sm font-medium text-brand underline underline-offset-2 hover:no-underline"
            >
              Homepage screenshot (placeholder link in this prototype)
            </a>
          </li>
          <li>
            <a
              href="#"
              className="text-sm font-medium text-brand underline underline-offset-2 hover:no-underline"
            >
              Candidate report card screenshot (placeholder link in this prototype)
            </a>
          </li>
        </ul>
      </section>

      <section aria-labelledby="spokespeople-heading" className="space-y-3">
        <h2 id="spokespeople-heading" className="text-lg font-semibold text-ink">
          Spokespeople
        </h2>
        <p className="text-sm text-ink/80">
          The people and quotes below are <strong>fictional, for this prototype demo only</strong>.
          They are not real Oorvani Foundation staff or any real person, and none of these quotes
          were said by anyone real.
        </p>
        <div className="rounded-lg border border-slate-200 p-4">
          <p className="text-sm font-semibold text-ink">
            Demo spokesperson — Aditi Rao <span className="font-normal text-ink/60">(fictional, prototype demo only)</span>
          </p>
          <p className="mt-1 text-sm italic text-ink/80">
            &ldquo;Every fact on a report card carries its source — that&apos;s the whole idea.&rdquo;
          </p>
        </div>
        <div className="rounded-lg border border-slate-200 p-4">
          <p className="text-sm font-semibold text-ink">
            Demo spokesperson — Farhan Sheikh <span className="font-normal text-ink/60">(fictional, prototype demo only)</span>
          </p>
          <p className="mt-1 text-sm italic text-ink/80">
            &ldquo;We don&apos;t rank candidates. We show the same fields for everyone and let
            citizens decide.&rdquo;
          </p>
        </div>
      </section>

      <section aria-labelledby="press-contact-heading" className="space-y-2">
        <h2 id="press-contact-heading" className="text-lg font-semibold text-ink">
          Press contact
        </h2>
        <p className="text-sm text-ink/80">
          <a
            href="#"
            className="font-medium text-brand underline underline-offset-2 hover:no-underline"
          >
            press@bangalorevotes.example (placeholder link in this prototype)
          </a>
        </p>
        <p className="text-sm text-ink/80">
          We aim to respond to press queries within 2 business days (a placeholder commitment in
          this prototype, not a live SLA).
        </p>
      </section>

      <section aria-labelledby="press-neutrality-heading" className="space-y-2">
        <h2 id="press-neutrality-heading" className="text-lg font-semibold text-ink">
          Neutrality statement
        </h2>
        <p className="text-sm text-ink/80">
          Bangalore Votes doesn&apos;t endorse, rank, or score candidates, and carries no editorial
          commentary. Every candidate report card uses identical, neutral formatting for every
          field, and issue-voting results show only what citizens collectively say matters to
          them — never presented as an opinion poll or election prediction.
        </p>
      </section>

      <section aria-labelledby="press-sourcing-heading" className="space-y-1 border-t border-slate-200 pt-6">
        <h2 id="press-sourcing-heading" className="text-lg font-semibold text-ink">
          Sourcing methodology
        </h2>
        <p className="text-sm text-ink/80">
          For how data is sourced, verified, and attributed, see our{' '}
          <Link to="/about" className="text-brand underline underline-offset-2">
            sourcing methodology on the About page
          </Link>
          .
        </p>
      </section>
    </div>
  )
}
