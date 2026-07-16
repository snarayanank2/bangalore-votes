import { Link, useParams } from 'react-router-dom'
import { useData } from '../../context/DataContext'
import { CandidateCard } from '../../components/CandidateCard'
import { RegisterForUpdatesSlot } from '../../components/RegisterForUpdatesSlot'

/** Candidates-in-ward list (IA §3.3, `/ward/:wardId/candidates`). Candidate data only exists
 * once the official nomination window opens, so an empty ward is a real, expected state — not
 * an error — and must read as honest rather than broken. */
export default function WardCandidates() {
  const { wardId } = useParams<{ wardId: string }>()
  const data = useData()

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
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-8">
      <div>
        <p className="text-sm font-medium uppercase tracking-wide text-brand">{ward.name}</p>
        <h1 className="text-2xl font-bold text-ink sm:text-3xl">Candidates in this ward</h1>
      </div>

      <RegisterForUpdatesSlot wardId={ward.id} />

      {candidates.length === 0 ? (
        <p className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-sm text-ink/70">
          No candidates yet — candidate nomination data is only published once the official
          nomination window opens. Check back closer to the election.
        </p>
      ) : (
        <>
          <Link
            to={`/ward/${ward.id}/compare`}
            className="inline-block rounded border border-brand px-4 py-2 text-sm font-semibold text-brand hover:bg-brand/5 focus:outline-none focus:ring-2 focus:ring-brand"
          >
            Compare candidates
          </Link>
          <ul className="space-y-3">
            {candidates.map((candidate) => (
              <CandidateCard key={candidate.id} candidate={candidate} />
            ))}
          </ul>
        </>
      )}
    </div>
  )
}
