import { Link, useParams } from 'react-router-dom'
import { useData, useStoreVersion } from '../../context/DataContext'
import { useModal, type FlagField } from '../../context/ModalContext'
import { GatedButton } from '../../components/GatedButton'
import { SourceBadge } from '../../components/SourceBadge'
import { AiExtractedBadge } from '../../components/AiExtractedBadge'
import { BUTTON_BASE_CLASS, BUTTON_VARIANT_CLASSES } from '../../components/Button'
import type { Sourced } from '../../types'

/** The five sourced fields a citizen can flag, in report-card order. Keys must match the
 * `Candidate` field names — `submitFlag` records them verbatim (see FlagMisinformation). */
const FLAG_FIELDS: FlagField[] = [
  { key: 'trackRecord', label: 'Ward track record' },
  { key: 'pendingCases', label: 'Criminal record / pending cases' },
  { key: 'assets', label: 'Declared assets' },
  { key: 'education', label: 'Education / qualifications' },
  { key: 'approachability', label: 'Approachability' },
]

/** One report-card field: label, its sourced value, and a visible provenance badge. Every
 * field gets IDENTICAL neutral styling (PRD §11) — there is deliberately no red/green/scoring
 * treatment anywhere here, including on pending cases, so the page never implies a verdict. */
function ReportField({
  label,
  sourced,
  caveat,
}: {
  label: string
  sourced: Sourced<string>
  caveat?: string
}) {
  return (
    <div className="border-t border-gray-300 pt-4 first:border-t-0 first:pt-0">
      <dt className="text-sm text-gray-600">{label}</dt>
      <dd className="mt-1.5 space-y-1.5">
        {/* PRD §9.1: "not declared" is a fact about the affidavit, not a gap — render it as an
         *  explicit, neutral state, visibly distinct from both a real value and an empty/unknown
         *  field. Deliberately no warning colour and no wording implying concealment (PRD §11). */}
        {sourced.notDeclared ? (
          <p className="text-base italic text-ink/70">Not declared</p>
        ) : (
          <p className="text-base leading-relaxed text-ink">{sourced.value}</p>
        )}
        <div className="flex flex-wrap items-center gap-1.5">
          <SourceBadge source={sourced.source} />
          {sourced.aiExtracted && <AiExtractedBadge />}
        </div>
        {caveat && <p className="text-xs italic text-ink/60">{caveat}</p>}
      </dd>
    </div>
  )
}

/**
 * Candidate report card (PRD §5.2, IA §3.4, `/candidate/:candidateSlug`) — "the single
 * most-requested feature": a structured, neutral, sourced profile. Every sourced field carries
 * its own `SourceBadge` so a non-expert citizen can see at a glance whether a fact came from an
 * official EC affidavit or from curator-compiled context (PRD §11). No editorial voice, no
 * scoring, no colour-coded verdicts anywhere on this page — including pending cases, which is
 * deliberately styled exactly like every other field.
 */
export default function CandidateReportCard() {
  const { candidateSlug } = useParams<{ candidateSlug: string }>()
  const data = useData()
  const { openFlag } = useModal()
  useStoreVersion() // re-render after a curator edit or accepted flag mutates this candidate

  const candidate = candidateSlug ? data.getCandidate(candidateSlug) : undefined

  if (!candidate) {
    return (
      <div className="mx-auto max-w-prose px-4 py-8">
        <h1 className="text-xl text-ink">We couldn&apos;t find that candidate</h1>
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

  const ward = data.getWard(candidate.wardId)

  return (
    <div className="mx-auto max-w-prose space-y-8 px-4 py-8">
      <header className="flex items-center gap-4">
        <img
          src={candidate.photoUrl}
          alt=""
          className="h-20 w-20 flex-shrink-0 rounded-full border border-gray-300 bg-gray-100"
        />
        <div>
          {ward && <p className="text-sm font-medium text-forest">{ward.name}</p>}
          <h1 className="text-2xl text-ink sm:text-3xl">{candidate.name}</h1>
          <p className="text-sm text-ink/70">{candidate.party}</p>
        </div>
      </header>
      <p className="text-xs italic text-ink/60">
        Name, photo and party as filed in the EC nomination.
      </p>

      <dl className="space-y-4">
        <ReportField label="Ward track record" sourced={candidate.trackRecord} />
        <ReportField label="Criminal record / pending cases" sourced={candidate.pendingCases} />
        <ReportField label="Declared assets" sourced={candidate.assets} />
        <ReportField
          label="Education / qualifications"
          sourced={candidate.education}
          caveat="Self-declared educational qualification — it isn't the whole picture of a candidate's suitability."
        />
        <ReportField label="Approachability" sourced={candidate.approachability} />
      </dl>

      <section aria-labelledby="news-heading" className="space-y-2 border-t border-gray-300 pt-4">
        <div className="flex flex-wrap items-center gap-2">
          <h2 id="news-heading" className="text-sm font-semibold text-ink">
            News &amp; coverage
          </h2>
          <SourceBadge source={{ type: 'curator', label: 'Curator-compiled links' }} />
        </div>
        {candidate.news.length === 0 ? (
          <p className="text-sm text-ink/70">No news coverage recorded yet.</p>
        ) : (
          <ul className="space-y-1.5">
            {candidate.news.map((item) => (
              <li key={item.url + item.title} className="text-sm">
                <a
                  href={item.url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-forest underline underline-offset-2 hover:no-underline"
                >
                  {item.title}
                </a>
                <span className="text-ink/60"> — {item.publisher}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="flex flex-wrap gap-3 border-t border-gray-300 pt-6">
        <GatedButton
          variant="secondary"
          onAct={() =>
            openFlag({ wardId: candidate.wardId, candidateId: candidate.id, fields: FLAG_FIELDS })
          }
        >
          Flag an error
        </GatedButton>
        {ward && (
          <Link
            to={`/ward/${ward.id}/compare`}
            className={`${BUTTON_BASE_CLASS} ${BUTTON_VARIANT_CLASSES.secondary}`}
          >
            Compare candidates
          </Link>
        )}
        {ward && (
          <Link
            to={`/ward/${ward.id}/issues`}
            className={`${BUTTON_BASE_CLASS} ${BUTTON_VARIANT_CLASSES.tertiary}`}
          >
            Ward issues &amp; voting
          </Link>
        )}
      </div>
    </div>
  )
}
