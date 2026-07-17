/** Visible marker for an affidavit field populated by AI extraction (PRD §5.2) — shown wherever
 * the field appears (report card, compare table, curator editor) until a curator confirms or
 * edits it, which clears `Sourced.aiExtracted`. Rendered NEXT TO the SourceBadge, never instead
 * of it — provenance and confirmation status are different facts. The exact text below is pinned
 * by tests; keep helper copy elsewhere from duplicating it verbatim. */
export function AiExtractedBadge() {
  return (
    <span className="inline-flex items-center rounded-full border border-amber-400 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-900">
      AI-extracted — not yet curator-confirmed
    </span>
  )
}
