import { Link, useParams } from 'react-router-dom'
import { useData, useStoreVersion } from '../../context/DataContext'
import { SourceBadge } from '../../components/SourceBadge'
import { RegisterForUpdatesSlot } from '../../components/RegisterForUpdatesSlot'
import type { Candidate, Sourced } from '../../types'

interface FieldSpec {
  label: string
  caveat?: string
  get: (candidate: Candidate) => Sourced<string>
}

/** Same fields, same order, same labels as the candidate report card (PRD §5.3 — "spans the
 * same fields as the report card so rows line up cleanly"). One row per field. */
const FIELDS: FieldSpec[] = [
  { label: 'Ward track record', get: (c) => c.trackRecord },
  { label: 'Criminal record / pending cases', get: (c) => c.pendingCases },
  { label: 'Declared assets', get: (c) => c.assets },
  {
    label: 'Education / qualifications',
    caveat: "Self-declared educational qualification — it isn't the whole picture of a candidate's suitability.",
    get: (c) => c.education,
  },
  { label: 'Approachability', get: (c) => c.approachability },
]

/**
 * Candidate comparison view (PRD §5.3, IA §3.5, `/ward/:wardId/compare`) — a column-per-candidate
 * TABLE, not a scrolling feed, with one row per report-card field so values line up cleanly
 * across candidates. The table lives inside its own `overflow-x-auto` container so a wide table
 * scrolls within itself on narrow screens; the page body never scrolls horizontally. Same neutral,
 * every-field-sourced treatment as the report card (PRD §11) — no ranking or scoring.
 */
export default function CompareCandidates() {
  const { wardId } = useParams<{ wardId: string }>()
  const data = useData()
  useStoreVersion() // re-render after a curator edit or accepted flag mutates a candidate

  const ward = wardId ? data.getWard(wardId) : undefined

  if (!ward) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-8">
        <h1 className="text-xl font-bold text-ink">We couldn&apos;t find that ward</h1>
        <p className="mt-2 text-sm text-ink/70">
          Check the link, or{' '}
          <Link to="/" className="text-brand underline underline-offset-2">
            search for your ward by name
          </Link>
          .
        </p>
      </div>
    )
  }

  const candidates = data.listCandidatesByWard(ward.id)

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-8">
      <div>
        <p className="text-sm font-medium uppercase tracking-wide text-brand">{ward.name}</p>
        <h1 className="text-2xl font-bold text-ink sm:text-3xl">Compare candidates</h1>
      </div>

      <RegisterForUpdatesSlot wardId={ward.id} />

      {candidates.length === 0 ? (
        <p className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-sm text-ink/70">
          No candidates yet — candidate nomination data is only published once the official
          nomination window opens. Check back closer to the election.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200">
          <table className="w-full min-w-[640px] border-collapse text-left">
            <caption className="sr-only">Candidate comparison for {ward.name}</caption>
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th scope="col" className="min-w-[9rem] px-3 py-3">
                  <span className="sr-only">Field</span>
                </th>
                {candidates.map((candidate) => (
                  <th
                    key={candidate.id}
                    scope="col"
                    className="min-w-[12rem] px-3 py-3 align-top font-normal"
                  >
                    <Link
                      to={`/candidate/${candidate.slug}`}
                      className="flex flex-col items-start gap-1 rounded focus:outline-none focus:ring-2 focus:ring-brand"
                    >
                      <img
                        src={candidate.photoUrl}
                        alt=""
                        className="h-12 w-12 rounded-full border border-slate-200 bg-white"
                      />
                      <span className="font-semibold text-ink">{candidate.name}</span>
                      <span className="text-xs font-normal text-ink/70">{candidate.party}</span>
                    </Link>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {FIELDS.map((field) => (
                <tr key={field.label} className="border-b border-slate-200 align-top last:border-b-0">
                  <th scope="row" className="min-w-[9rem] px-3 py-3 text-sm font-semibold text-ink">
                    {field.label}
                  </th>
                  {candidates.map((candidate) => {
                    const sourced = field.get(candidate)
                    return (
                      <td key={candidate.id} className="min-w-[12rem] px-3 py-3 align-top">
                        {/* PRD §9.1/§11: same neutral "Not declared" treatment as the report
                         *  card — a fact about the affidavit, not a gap, and not styled as a
                         *  warning. */}
                        {sourced.notDeclared ? (
                          <p className="text-sm italic text-ink/70">Not declared</p>
                        ) : (
                          <p className="text-sm text-ink/90">{sourced.value}</p>
                        )}
                        <div className="mt-1.5">
                          <SourceBadge source={sourced.source} />
                        </div>
                        {field.caveat && (
                          <p className="mt-1 text-xs italic text-ink/60">{field.caveat}</p>
                        )}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Link
        to={`/ward/${ward.id}/candidates`}
        className="inline-block text-sm text-brand underline underline-offset-2"
      >
        Back to candidate list
      </Link>
    </div>
  )
}
