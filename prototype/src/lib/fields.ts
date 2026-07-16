import type { CandidateSourcedField } from '../store/store'

/** Human-readable labels for the five sourced candidate fields a citizen can flag and a curator
 * can correct — mirrors CandidateReportCard.tsx's FLAG_FIELDS labels so the same field reads
 * identically on the report card, the account submissions list, and the curator review page. */
export const CANDIDATE_FIELD_LABELS: Record<CandidateSourcedField, string> = {
  trackRecord: 'Ward track record',
  pendingCases: 'Criminal record / pending cases',
  assets: 'Declared assets',
  education: 'Education / qualifications',
  approachability: 'Approachability',
}

const KNOWN_FIELDS = Object.keys(CANDIDATE_FIELD_LABELS) as CandidateSourcedField[]

/** Narrows a Submission's free-form `field` string to a known candidate sourced field, if it is
 * one — used to decide whether a flag can be resolved against a candidate's Sourced field. */
export function isCandidateSourcedField(field: string): field is CandidateSourcedField {
  return (KNOWN_FIELDS as string[]).includes(field)
}

/** Falls back to a humanized version of the raw field string (camelCase -> "Camel case") for any
 * field that isn't one of the five known candidate fields, so the UI never shows a raw camelCase
 * key verbatim. */
export function fieldLabel(field: string): string {
  if (isCandidateSourcedField(field)) return CANDIDATE_FIELD_LABELS[field]
  const spaced = field.replace(/([A-Z])/g, ' $1').trim()
  return spaced.charAt(0).toUpperCase() + spaced.slice(1)
}
