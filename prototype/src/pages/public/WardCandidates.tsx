import { Link, useParams } from 'react-router-dom'
import { useData } from '../../context/DataContext'
import { CandidateCard } from '../../components/CandidateCard'
import { RegisterForUpdatesSlot } from '../../components/RegisterForUpdatesSlot'
import { BUTTON_BASE_CLASS, BUTTON_VARIANT_CLASSES } from '../../components/Button'

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
        <h1 className="text-xl text-ink">We couldn&apos;t find that ward</h1>
        <p className="mt-2 text-sm text-ink/70">
          Check the link, or{' '}
          <Link to="/" className="text-forest underline underline-offset-2">
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
        <p className="text-sm font-medium text-forest">{ward.name}</p>
        <h1 className="text-2xl text-ink sm:text-3xl">Candidates in this ward</h1>
      </div>

      <RegisterForUpdatesSlot wardId={ward.id} />

      {candidates.length === 0 ? (
        <p className="rounded-md border border-dashed border-gray-300 bg-gray-100 px-4 py-6 text-sm text-ink/70">
          No candidates yet — candidate nomination data is only published once the official
          nomination window opens. Check back closer to the election.
        </p>
      ) : (
        <>
          <Link
            to={`/ward/${ward.id}/compare`}
            className={`${BUTTON_BASE_CLASS} ${BUTTON_VARIANT_CLASSES.secondary}`}
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
