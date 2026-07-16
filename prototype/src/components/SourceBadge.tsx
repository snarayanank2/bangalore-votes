import type { Source } from '../types'

const LABEL: Record<Source['type'], string> = {
  affidavit: 'Official (affidavit)',
  curator: 'Curator-compiled',
}

const STYLE: Record<Source['type'], string> = {
  affidavit: 'bg-official/10 text-official border-official/40',
  curator: 'bg-curated/10 text-curated border-curated/40',
}

/** Small provenance pill shown next to every sourced field — distinguishes
 * official/affidavit data from curator-compiled context (PRD §10). */
export function SourceBadge({ source }: { source: Source }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${STYLE[source.type]}`}
    >
      <span>{LABEL[source.type]}</span>
      <span aria-hidden="true">·</span>
      <span>{source.label}</span>
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
