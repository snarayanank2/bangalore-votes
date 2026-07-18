import { Link } from 'react-router-dom'
import type { Candidate } from '../types'

/** A single candidate row on the "Candidates in ward" list (IA §3.3): photo,
 * name, party/independent — links through to the full report card. */
// §7.5 candidate row: photo 56px circle, name text-xl Manrope 700, party name in text-sm —
// identical shape reused in ward lists and compare headers.
export function CandidateCard({ candidate }: { candidate: Candidate }) {
  return (
    <li>
      <Link
        to={`/candidate/${candidate.slug}`}
        className="flex items-center gap-4 rounded-md border border-gray-300 p-4 hover:border-forest"
      >
        <img
          src={candidate.photoUrl}
          alt=""
          className="h-14 w-14 flex-shrink-0 rounded-full border border-gray-300 bg-gray-100"
        />
        <span>
          <span className="block font-heading text-xl font-bold text-ink">{candidate.name}</span>
          <span className="block text-sm text-ink/70">{candidate.party}</span>
        </span>
      </Link>
    </li>
  )
}
