import { useData, useStoreVersion } from '../../context/DataContext'
import { formatStamp } from '../../lib/stamps'

/**
 * Public data & key metrics (PRD §5.14, IA §3.14, `/data`) — "a platform that publishes other
 * people's records should publish its own." Coverage, integrity, and citizen-signal figures,
 * every one of them computed live from the store via `data.platformMetrics()` — nothing on this
 * page is hardcoded.
 *
 * `useStoreVersion()` is required here: these figures change whenever a citizen casts an issue
 * vote, flags something, or a curator publishes an edit — without it the page would go stale
 * after the first render.
 *
 * PHASING: PRD §5.14 says this page ships in Phase 2, not Phase 1, because early in a real
 * rollout it would honestly read "14 of 369 wards" — accurate, but damaging, and it hands critics
 * a number. That's a rollout/launch-sequencing decision, not a reason to hide the page in this
 * prototype build. What this component must NOT do is fake Phase-2-scale numbers to look better:
 * the seed only models 5 wards, so the honest coverage figure here is small, and the page says so
 * plainly rather than dressing it up.
 *
 * "AS OF": PRD §5.14 requires every figure to carry an "as of" timestamp. `Date.now()`/argless
 * `new Date()` are banned project-wide (they break determinism), so this is derived from the
 * store's own stamp convention (lib/stamps.ts) instead of the wall clock — specifically the most
 * recent audit-log event `platformMetrics()` can see. Individual issue votes are deliberately
 * unaudited (privacy — see castIssueVote in store.ts), so this marker does not move on a vote by
 * itself; a short note below it says so rather than implying more precision than the store has.
 *
 * MEDIAN TIME TO RESOLVE: intentionally rendered as "not available in this prototype," not a
 * computed number. Seed submissions carry real ISO-8601 timestamps, but flags are only ever
 * resolved live via the store's session counter (`t${n}`, not a clock) — the two aren't
 * commensurable, so subtracting one from the other would be a fabricated duration, which is worse
 * than admitting the figure isn't available yet. See `medianResolutionUnavailableReason` on
 * `platformMetrics()`'s return shape for the same reasoning in code.
 *
 * PRIVACY: every figure here is an aggregate. The city-wide issue roll-up sums vote counts per
 * issue across all wards — it never lists who voted or what any individual's top-3 was. This page
 * renders only what `platformMetrics()` returns; do not add a per-user join here.
 */
export default function Data() {
  const data = useData()
  useStoreVersion()

  const metrics = data.platformMetrics()
  const asOfLabel = metrics.asOf ? formatStamp(metrics.asOf) : 'no recorded activity yet'

  return (
    <div className="mx-auto max-w-3xl space-y-8 px-4 py-8">
      <div>
        <h1 className="text-2xl font-bold text-ink sm:text-3xl">Data &amp; key metrics</h1>
        <p className="mt-2 text-sm text-ink/80">
          A platform that publishes other people&apos;s records should publish its own. These
          figures are computed live from this platform&apos;s own data — coverage, integrity, and
          what citizens have said matters to them.
        </p>
      </div>

      <section
        aria-labelledby="prototype-scale-heading"
        className="space-y-2 rounded-lg border border-amber-300 bg-amber-50 p-4"
      >
        <h2
          id="prototype-scale-heading"
          className="text-sm font-semibold uppercase tracking-wide text-amber-900"
        >
          These are prototype-scale figures
        </h2>
        <p className="text-sm text-amber-900">
          This build only seeds a handful of demo wards, so the coverage numbers below are small
          by construction — they are not a claim about real citywide progress. The Bengaluru GBA
          election covers <strong>{metrics.coverage.totalWards} wards</strong>; the figures below
          show this prototype&apos;s coverage against that real total, honestly, rather than a
          dressed-up placeholder.
        </p>
      </section>

      <p className="text-xs italic text-ink/60">
        As of: <span className="font-medium text-ink/80">{asOfLabel}</span> — the most recent
        recorded platform event. Individual issue votes are never individually timestamped or
        audited (only aggregate counts are ever stored), so this marker does not move on a vote by
        itself.
      </p>

      <section aria-labelledby="coverage-heading" className="space-y-3">
        <h2 id="coverage-heading" className="text-lg font-semibold text-ink">
          Coverage
        </h2>
        <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Metric
            label="Wards with published candidate data"
            value={`${metrics.coverage.wardsWithPublishedCandidateData} of ${metrics.coverage.totalWards}`}
          />
          <Metric
            label="Report cards complete"
            value={`${metrics.coverage.reportCardsComplete} of ${metrics.coverage.totalCandidates}`}
          />
          <Metric label="Active curators" value={metrics.coverage.activeCurators} />
          <Metric label="Sources cited" value={metrics.coverage.sourcesCited} />
        </dl>
      </section>

      <section aria-labelledby="integrity-heading" className="space-y-3">
        <h2 id="integrity-heading" className="text-lg font-semibold text-ink">
          Integrity
        </h2>
        <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <Metric label="Flags raised" value={metrics.integrity.flagsRaised} />
          <Metric label="Flags resolved" value={metrics.integrity.flagsResolved} />
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-ink/60">
              Median time to resolve
            </dt>
            <dd className="mt-1 text-sm font-medium text-ink/80">Not available in this prototype</dd>
            <dd className="mt-1 text-xs text-ink/60">
              {metrics.integrity.medianResolutionUnavailableReason}
            </dd>
          </div>
        </dl>
      </section>

      <section aria-labelledby="citizen-signal-heading" className="space-y-3">
        <h2 id="citizen-signal-heading" className="text-lg font-semibold text-ink">
          Citizen signal
        </h2>
        <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <Metric label="Total issue votes cast" value={metrics.citizenSignal.totalIssueVotes} />
          <Metric label="Registered citizens" value={metrics.citizenSignal.registeredCitizens} />
        </dl>

        <div>
          <h3 className="text-sm font-semibold text-ink">
            City-wide issue roll-up
          </h3>
          <p className="mt-1 text-sm text-ink/70">
            What citizens across every ward say matters most, ranked by votes. Aggregate totals
            only — individual votes are never made public.
          </p>
          {metrics.citizenSignal.issueRollUp.length === 0 ? (
            <p className="mt-2 rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-sm text-ink/70">
              No issue votes have been cast yet.
            </p>
          ) : (
            <ol aria-label="City-wide ranked issues" className="mt-2 space-y-2">
              {metrics.citizenSignal.issueRollUp.map((row, index) => (
                <li
                  key={row.issueId}
                  className="flex items-center justify-between gap-3 rounded border border-slate-200 px-3 py-2 text-sm"
                >
                  <span className="text-ink">
                    <span className="mr-2 font-semibold text-brand">#{index + 1}</span>
                    {row.title}
                  </span>
                  <span className="whitespace-nowrap font-medium text-ink/80">
                    {row.count} {row.count === 1 ? 'vote' : 'votes'}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </div>
      </section>
    </div>
  )
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-ink/60">{label}</dt>
      <dd className="mt-1 text-xl font-bold text-ink">{value}</dd>
    </div>
  )
}
