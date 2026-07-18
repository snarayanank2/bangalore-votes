import type { Source } from '../types'

const LABEL: Record<Source['type'], string> = {
  affidavit: 'Official (affidavit)',
  curator: 'Curator-compiled',
}

// design-system.md §3 — the reserved provenance badge treatment. These two color pairs
// (forest-tint/forest, gray-100/gray-600) are reserved for this signature; nothing else on a
// content page may reuse them (§3 rule 1), so a glance always answers "where did this come from."
const STYLE: Record<Source['type'], string> = {
  affidavit: 'bg-forest-tint text-forest border-transparent',
  curator: 'bg-gray-100 text-gray-600 border-transparent',
}

/** Small provenance pill shown next to every sourced field — distinguishes
 * official/affidavit data from curator-compiled context (PRD §10, design-system.md §3). */
export function SourceBadge({ source }: { source: Source }) {
  // The kind ("Curator-compiled") and the specific label ("EC affidavit") are both shown,
  // but curator sources are conventionally labelled "Curator-compiled" too — printing both
  // would render "Curator-compiled · Curator-compiled". Only append what adds information.
  const detail = source.label === LABEL[source.type] ? null : source.label
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium ${STYLE[source.type]}`}
    >
      <span>{LABEL[source.type]}</span>
      {detail && (
        <>
          <span aria-hidden="true">·</span>
          <span>{detail}</span>
        </>
      )}
      {source.url && (
        <a
          href={source.url}
          target="_blank"
          rel="noreferrer"
          className="underline underline-offset-2 hover:no-underline"
        >
          source
        </a>
      )}
    </span>
  )
}
