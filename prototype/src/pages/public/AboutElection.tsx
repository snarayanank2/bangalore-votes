/**
 * Election info / explainer (PRD §5.7, IA §3.8, `/about-election`). Anonymous, aimed at the
 * "didn't know this existed" segment — plain-language context on what a GBA ward election is and
 * why the corporator seat matters locally.
 *
 * A live `Date.now()` countdown is banned for this prototype (see task brief) — the status below
 * is a fixed, hand-maintained target string, matching the same convention already used on the
 * Home page banner. Update this constant by hand as real GBA election dates are officially
 * notified; never wire it to the system clock.
 */
const ELECTION_NOTICE_TARGET = 'September 2026 (expected)'
const ELECTION_STATUS = 'Not yet officially notified by the Election Commission'

export default function AboutElection() {
  return (
    <div className="mx-auto max-w-prose space-y-8 px-4 py-8">
      <div>
        <h1 className="text-2xl text-ink sm:text-3xl">About the GBA ward election</h1>
      </div>

      <section
        aria-labelledby="status-heading"
        className="space-y-2 rounded-md bg-sun-tint p-4"
      >
        <h2 id="status-heading" className="text-sm font-medium text-forest">
          Election status
        </h2>
        <p className="text-sm text-ink/90">{ELECTION_STATUS}.</p>
        <p className="text-sm text-ink/90">
          Official notification expected: <strong>{ELECTION_NOTICE_TARGET}</strong>. This date is
          a planning estimate, not an official announcement — we&apos;ll update it here the moment
          the Election Commission notifies the election, along with the confirmed polling date.
        </p>
      </section>

      <section aria-labelledby="what-heading" className="space-y-2">
        <h2 id="what-heading" className="text-lg font-semibold text-ink">
          What is the GBA ward election?
        </h2>
        <p className="text-sm text-ink/80">
          The Greater Bengaluru Authority (GBA) is Bengaluru&apos;s newly reorganised civic
          government, divided into wards after a fresh delimitation exercise. Each ward elects one
          <strong> corporator</strong> — a local representative who sits on the ward committee,
          raises ward-level issues (roads, water, drainage, waste, street lighting), and helps
          direct how civic funds are spent in your neighbourhood.
        </p>
        <p className="text-sm text-ink/80">
          Because wards were redrawn, the ward you voted in previously may not be the same ward
          you vote in this time — even if you haven&apos;t moved. Use the ward search on the home
          page to find your current ward and see who&apos;s standing once nominations are
          published.
        </p>
      </section>

      <section aria-labelledby="why-heading" className="space-y-2">
        <h2 id="why-heading" className="text-lg font-semibold text-ink">
          Why this local vote matters
        </h2>
        <p className="text-sm text-ink/80">
          The corporator is usually the government official closest to day-to-day civic life —
          the person a resident calls about a broken streetlight, an overflowing drain, or an
          uncollected garbage pile. Unlike state or national elections, a ward election is decided
          by a comparatively small number of votes, so each vote carries more relative weight.
        </p>
      </section>
    </div>
  )
}
