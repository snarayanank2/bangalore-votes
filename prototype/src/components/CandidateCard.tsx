import { Link } from 'react-router-dom'
import type { Candidate } from '../types'

/** A single candidate row on the "Candidates in ward" list (IA §3.3): photo,
 * name, party/independent — links through to the full report card. */
export function CandidateCard({ candidate }: { candidate: Candidate }) {
  return (
    <li>
      <Link
        to={`/candidate/${candidate.slug}`}
        className="flex items-center gap-4 rounded-lg border border-slate-200 p-4 hover:border-brand focus:outline-none focus:ring-2 focus:ring-brand"
      >
        <img
          src={candidate.photoUrl}
          alt=""
          className="h-14 w-14 flex-shrink-0 rounded-full border border-slate-200 bg-slate-50"
        />
        <span>
          <span className="block font-semibold text-ink">{candidate.name}</span>
          <span className="block text-sm text-ink/70">{candidate.party}</span>
        </span>
      </Link>
    </li>
  )
}
