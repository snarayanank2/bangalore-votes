import { useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { AiExtractedBadge } from '../../components/AiExtractedBadge'
import { useAuth } from '../../context/AuthContext'
import { useData, useStoreVersion } from '../../context/DataContext'
import { fieldLabel } from '../../lib/fields'
import type { CandidatePatch, CandidateSourcedField } from '../../store/store'
import type { NewsLink, Sourced, SourceType } from '../../types'

const SOURCED_FIELDS: CandidateSourcedField[] = [
  'trackRecord',
  'pendingCases',
  'assets',
  'education',
  'approachability',
]

interface FieldDraft {
  value: string
  sourceType: SourceType
  sourceLabel: string
  sourceUrl: string
  /** PRD §9.1: marks this field as an explicit "not declared" answer rather than a gap — see
   *  `Sourced.notDeclared`'s doc comment in types.ts. A source is still required when this is
   *  checked; only the value becomes optional (and is cleared on save, so a value typed before
   *  checking the box is never silently published alongside a "not declared" marker). */
  notDeclared: boolean
}

/** Builds a form draft from a stored Sourced field — used both by the initial useState and to
 *  refresh the three extracted fields after ingestAffidavit returns. Deliberately drops
 *  `aiExtracted`: drafts never carry the flag, so a subsequent Save publishes the field WITHOUT
 *  it — Save IS the §5.2 confirm action. */
function draftFrom(sourced: Sourced<string> | undefined): FieldDraft {
  return {
    value: sourced?.value ?? '',
    sourceType: sourced?.source.type ?? 'curator',
    sourceLabel: sourced?.source.label ?? '',
    sourceUrl: sourced?.source.url ?? '',
    notDeclared: sourced?.notDeclared ?? false,
  }
}

/**
 * Edit candidate (PRD §5.2/§11, IA §5.4, `/curator/candidate/:candidateId`) — a form over the
 * five report-card fields plus the curator-compiled news links.
 *
 * ROUTE PARAM: the URL carries the candidate's `id` (see routes.tsx and Dashboard.tsx's link,
 * `/curator/candidate/${candidate.id}`), NOT its `slug`. The store's mutation
 * (`updateCandidate`) is keyed by `slug`, so this page first resolves id -> candidate via the
 * `getCandidateById` selector, and then always calls `updateCandidate` with `candidate.slug`.
 *
 * SOURCE IS MANDATORY PER FIELD (PRD §5.2/§11 — every data point on the platform carries a
 * visible source; that's the product's core trust mechanism). Save is refused, inline, if any of
 * the five fields is missing a source label, or is missing both a value and a "Not declared"
 * marker (PRD §9.1 — "not declared" is itself a complete answer, so it substitutes for a value,
 * never for a source). Saving publishes immediately — curators are trusted, there is no
 * second-person approval (locked decision).
 *
 * SCOPE: this page never pre-checks scope — like SubmissionReview, it lets a curator open (and
 * fill out) the form for any candidate reachable by URL, and only surfaces the store's `/scope/i`
 * error inline, without crashing, at save time. Admins bypass scope entirely (store-side).
 */
export default function EditCandidate() {
  const { candidateId } = useParams<{ candidateId: string }>()
  const { user } = useAuth()
  const data = useData()
  useStoreVersion()

  const candidate = candidateId ? data.getCandidateById(candidateId) : undefined
  const ward = candidate ? data.getWard(candidate.wardId) : undefined

  const [name, setName] = useState(candidate?.name ?? '')
  const [party, setParty] = useState(candidate?.party ?? '')
  const [drafts, setDrafts] = useState<Record<CandidateSourcedField, FieldDraft>>(() => {
    const initial = {} as Record<CandidateSourcedField, FieldDraft>
    for (const field of SOURCED_FIELDS) initial[field] = draftFrom(candidate?.[field])
    return initial
  })
  const [news, setNews] = useState<NewsLink[]>(candidate?.news ?? [])
  const [newsTitle, setNewsTitle] = useState('')
  const [newsUrl, setNewsUrl] = useState('')
  const [newsPublisher, setNewsPublisher] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [affidavitFile, setAffidavitFile] = useState('')
  const [affidavitEcUrl, setAffidavitEcUrl] = useState('')
  const [ingestError, setIngestError] = useState<string | null>(null)
  const [ingested, setIngested] = useState(false)

  if (!candidate) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-8">
        <h1 className="text-xl font-bold text-ink">We couldn&apos;t find that candidate</h1>
        <p className="mt-2 text-sm text-ink/70">
          Check the link, or{' '}
          <Link to="/curator" className="text-brand underline underline-offset-2">
            back to your dashboard
          </Link>
          .
        </p>
      </div>
    )
  }
  // Re-bind into a definitely-assigned const: TS's early-return narrowing above doesn't survive
  // into the nested closures below (handleSubmit etc.), so capture the narrowed type here once.
  const activeCandidate = candidate

  function handleIngest(): void {
    setIngested(false)
    try {
      const updated = data.ingestAffidavit(
        activeCandidate.slug,
        { fileName: affidavitFile, ecUrl: affidavitEcUrl },
        user,
      )
      setDrafts((prev) => ({
        ...prev,
        pendingCases: draftFrom(updated.pendingCases),
        assets: draftFrom(updated.assets),
        education: draftFrom(updated.education),
      }))
      setIngestError(null)
      setIngested(true)
      setSaved(false)
    } catch (err) {
      setIngestError(err instanceof Error ? err.message : 'Could not ingest this affidavit.')
    }
  }

  function updateDraft(field: CandidateSourcedField, patch: Partial<FieldDraft>): void {
    setDrafts((prev) => ({ ...prev, [field]: { ...prev[field], ...patch } }))
    setSaved(false)
  }

  function handleAddNews(event: FormEvent): void {
    event.preventDefault()
    if (!newsTitle.trim() || !newsUrl.trim() || !newsPublisher.trim()) return
    setNews((prev) => [
      ...prev,
      { title: newsTitle.trim(), url: newsUrl.trim(), publisher: newsPublisher.trim() },
    ])
    setNewsTitle('')
    setNewsUrl('')
    setNewsPublisher('')
    setSaved(false)
  }

  function handleRemoveNews(index: number): void {
    setNews((prev) => prev.filter((_, i) => i !== index))
    setSaved(false)
  }

  function handleSubmit(event: FormEvent): void {
    event.preventDefault()
    setSaved(false)

    for (const field of SOURCED_FIELDS) {
      // PRD §9.1: "not declared" is a valid, complete answer, so a checked field skips the
      // value requirement below — but it still needs a real source (it's a fact about the
      // affidavit), same as every other field, checked unconditionally next.
      if (!drafts[field].notDeclared && !drafts[field].value.trim()) {
        setError(`Enter a value for "${fieldLabel(field)}", or mark it "Not declared".`)
        return
      }
      if (!drafts[field].sourceLabel.trim()) {
        setError(
          `Attach a source for "${fieldLabel(field)}" — every field must be sourced, including a "not declared" field.`,
        )
        return
      }
    }

    // Builds one candidate Sourced<string> field from its draft — "not declared" fields are
    // saved with an empty value (never whatever was typed before the box was checked), so the
    // published record can never show both a "not declared" marker and stray text (§9.1).
    function sourcedFrom(draft: FieldDraft): Sourced<string> {
      return {
        value: draft.notDeclared ? '' : draft.value.trim(),
        source: {
          type: draft.sourceType,
          label: draft.sourceLabel.trim(),
          url: draft.sourceUrl.trim() || undefined,
        },
        notDeclared: draft.notDeclared,
      }
    }

    const patch: CandidatePatch = {
      name: name.trim() || activeCandidate.name,
      party: party.trim() || activeCandidate.party,
      news,
      trackRecord: sourcedFrom(drafts.trackRecord),
      pendingCases: sourcedFrom(drafts.pendingCases),
      assets: sourcedFrom(drafts.assets),
      education: sourcedFrom(drafts.education),
      approachability: sourcedFrom(drafts.approachability),
    }

    try {
      data.updateCandidate(activeCandidate.slug, patch, user)
      setError(null)
      setSaved(true)
      // Save just published this patch without an aiExtracted marker on any field (the store
      // strips it), so the "Extraction published" banner's claim is no longer true — clear it.
      setIngested(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save this candidate.')
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-8 px-4 py-8">
      <div>
        <p className="text-sm font-medium uppercase tracking-wide text-brand">
          {ward?.name ?? candidate.wardId}
        </p>
        <h1 className="text-2xl font-bold text-ink sm:text-3xl">{candidate.name}</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        {error && (
          <p role="alert" className="rounded bg-red-50 px-3 py-2 text-sm text-red-800">
            {error}
          </p>
        )}
        {saved && !error && (
          <p className="rounded bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
            Saved — this candidate&apos;s report card is now updated.
          </p>
        )}

        <section aria-labelledby="basics-heading" className="space-y-3">
          <h2 id="basics-heading" className="text-sm font-semibold text-ink">
            Basics
          </h2>
          <div>
            <label htmlFor="candidate-name" className="mb-1 block text-sm font-medium text-ink">
              Name
            </label>
            <input
              id="candidate-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
            />
          </div>
          <div>
            <label htmlFor="candidate-party" className="mb-1 block text-sm font-medium text-ink">
              Party
            </label>
            <input
              id="candidate-party"
              type="text"
              value={party}
              onChange={(e) => setParty(e.target.value)}
              className="w-full rounded border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
            />
          </div>
        </section>

        <section aria-labelledby="affidavit-heading" className="space-y-3 rounded-lg border border-slate-200 p-4">
          <h2 id="affidavit-heading" className="text-sm font-semibold text-ink">
            Affidavit (Form 26) — AI-assisted ingestion
          </h2>
          {activeCandidate.affidavit && (
            <p className="text-sm text-ink/80">
              Affidavit on file:{' '}
              <strong>
                {activeCandidate.affidavit.providedFileName ?? activeCandidate.affidavit.providedEcUrl}
              </strong>{' '}
              —{' '}
              <a
                href={activeCandidate.affidavit.storedUrl}
                className="text-brand underline underline-offset-2"
              >
                stored copy (placeholder link in this prototype)
              </a>{' '}
              is the public source link on the extracted fields.
            </p>
          )}
          <p className="text-xs text-ink/60">
            Upload the candidate&apos;s EC affidavit PDF (type its file name to simulate the
            upload — no real file is read in this prototype) or paste its EC link. Extraction
            (simulated AI) fills cases, assets and education and publishes them immediately with
            a visible marker; <strong>saving this form confirms the fields and clears the
            marker</strong>.
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            <div>
              <label htmlFor="affidavit-file" className="mb-1 block text-xs font-medium text-ink/70">
                Affidavit PDF file name
              </label>
              <input
                id="affidavit-file"
                type="text"
                value={affidavitFile}
                onChange={(e) => setAffidavitFile(e.target.value)}
                placeholder="e.g. candidate-form26.pdf"
                className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
              />
            </div>
            <div>
              <label htmlFor="affidavit-ec-url" className="mb-1 block text-xs font-medium text-ink/70">
                …or EC link to the affidavit
              </label>
              <input
                id="affidavit-ec-url"
                type="text"
                value={affidavitEcUrl}
                onChange={(e) => setAffidavitEcUrl(e.target.value)}
                placeholder="https://…"
                className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
              />
            </div>
          </div>
          {ingestError && (
            <p role="alert" className="rounded bg-red-50 px-3 py-2 text-sm text-red-800">
              {ingestError}
            </p>
          )}
          {ingested && !ingestError && (
            <p className="rounded bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
              Extraction published — cases, assets and education below now carry AI-extracted
              markers until you confirm or edit them.
            </p>
          )}
          <button
            type="button"
            onClick={handleIngest}
            className="rounded border border-brand px-3 py-1.5 text-sm font-semibold text-brand hover:bg-brand/10 focus:outline-none focus:ring-2 focus:ring-brand"
          >
            Ingest affidavit &amp; extract (simulated AI)
          </button>
        </section>

        <section aria-labelledby="fields-heading" className="space-y-6">
          <h2 id="fields-heading" className="text-sm font-semibold text-ink">
            Report-card fields
          </h2>
          {SOURCED_FIELDS.map((field) => {
            const draft = drafts[field]
            const idBase = `field-${field}`
            return (
              <fieldset key={field} className="space-y-2 rounded-lg border border-slate-200 p-4">
                <legend className="px-1 text-sm font-semibold text-ink">{fieldLabel(field)}</legend>
                {activeCandidate[field].aiExtracted && <AiExtractedBadge />}
                <div>
                  <label htmlFor={`${idBase}-value`} className="mb-1 block text-sm font-medium text-ink">
                    {fieldLabel(field)} value
                  </label>
                  <textarea
                    id={`${idBase}-value`}
                    value={draft.value}
                    onChange={(e) => updateDraft(field, { value: e.target.value })}
                    rows={2}
                    disabled={draft.notDeclared}
                    className="w-full rounded border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand disabled:bg-slate-100 disabled:text-ink/50"
                  />
                </div>
                <div className="flex items-start gap-2">
                  <input
                    id={`${idBase}-not-declared`}
                    type="checkbox"
                    checked={draft.notDeclared}
                    onChange={(e) => updateDraft(field, { notDeclared: e.target.checked })}
                    className="mt-0.5 h-4 w-4 rounded border-slate-300 text-brand focus:outline-none focus:ring-2 focus:ring-brand"
                  />
                  <label htmlFor={`${idBase}-not-declared`} className="text-sm text-ink">
                    Not declared on the affidavit
                    <span className="block text-xs font-normal text-ink/60">
                      This is a complete answer, not a gap — it records that the affidavit itself
                      leaves this field blank. A source is still required below.
                    </span>
                  </label>
                </div>
                <div className="grid gap-2 sm:grid-cols-3">
                  <div>
                    <label htmlFor={`${idBase}-source-type`} className="mb-1 block text-xs font-medium text-ink/70">
                      {fieldLabel(field)} source type
                    </label>
                    <select
                      id={`${idBase}-source-type`}
                      value={draft.sourceType}
                      onChange={(e) => updateDraft(field, { sourceType: e.target.value as SourceType })}
                      className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
                    >
                      <option value="curator">Curator-compiled</option>
                      <option value="affidavit">Official (affidavit)</option>
                    </select>
                  </div>
                  <div>
                    <label htmlFor={`${idBase}-source-label`} className="mb-1 block text-xs font-medium text-ink/70">
                      {fieldLabel(field)} source label
                    </label>
                    <input
                      id={`${idBase}-source-label`}
                      type="text"
                      value={draft.sourceLabel}
                      onChange={(e) => updateDraft(field, { sourceLabel: e.target.value })}
                      className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
                    />
                  </div>
                  <div>
                    <label htmlFor={`${idBase}-source-url`} className="mb-1 block text-xs font-medium text-ink/70">
                      {fieldLabel(field)} source URL (optional)
                    </label>
                    <input
                      id={`${idBase}-source-url`}
                      type="text"
                      value={draft.sourceUrl}
                      onChange={(e) => updateDraft(field, { sourceUrl: e.target.value })}
                      placeholder="https://…"
                      className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
                    />
                  </div>
                </div>
              </fieldset>
            )
          })}
        </section>

        <section aria-labelledby="news-heading" className="space-y-3">
          <h2 id="news-heading" className="text-sm font-semibold text-ink">
            News links
          </h2>
          {news.length === 0 ? (
            <p className="text-sm text-ink/70">No news links yet.</p>
          ) : (
            <ul className="space-y-2">
              {news.map((link, index) => (
                <li
                  key={`${link.url}-${index}`}
                  className="flex items-center justify-between gap-3 rounded border border-slate-200 px-3 py-2 text-sm"
                >
                  <span className="text-ink">
                    {link.title} <span className="text-ink/60">— {link.publisher}</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => handleRemoveNews(index)}
                    aria-label={`Remove news link: ${link.title}`}
                    className="rounded border border-red-300 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-600"
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}

          <div className="grid gap-2 rounded-lg border border-dashed border-slate-300 p-4 sm:grid-cols-3">
            <div>
              <label htmlFor="news-title" className="mb-1 block text-xs font-medium text-ink/70">
                News title
              </label>
              <input
                id="news-title"
                type="text"
                value={newsTitle}
                onChange={(e) => setNewsTitle(e.target.value)}
                className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
              />
            </div>
            <div>
              <label htmlFor="news-url" className="mb-1 block text-xs font-medium text-ink/70">
                News URL
              </label>
              <input
                id="news-url"
                type="text"
                value={newsUrl}
                onChange={(e) => setNewsUrl(e.target.value)}
                placeholder="https://…"
                className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
              />
            </div>
            <div>
              <label htmlFor="news-publisher" className="mb-1 block text-xs font-medium text-ink/70">
                News publisher
              </label>
              <input
                id="news-publisher"
                type="text"
                value={newsPublisher}
                onChange={(e) => setNewsPublisher(e.target.value)}
                className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
              />
            </div>
            <div className="sm:col-span-3">
              <button
                type="button"
                onClick={handleAddNews}
                className="rounded border border-brand px-3 py-1.5 text-sm font-semibold text-brand hover:bg-brand/10 focus:outline-none focus:ring-2 focus:ring-brand"
              >
                Add news link
              </button>
            </div>
          </div>
        </section>

        <button
          type="submit"
          className="w-full rounded bg-brand px-4 py-2 text-sm font-semibold text-white focus:outline-none focus:ring-2 focus:ring-brand"
        >
          Save changes
        </button>
      </form>
    </div>
  )
}
