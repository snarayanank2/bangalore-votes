import { useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useData, useStoreVersion } from '../../context/DataContext'
import { fieldLabel } from '../../lib/fields'
import type { CandidatePatch, CandidateSourcedField } from '../../store/store'
import type { NewsLink, SourceType } from '../../types'

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
 * the five fields is missing a value or a source label. Saving publishes immediately — curators
 * are trusted, there is no second-person approval (locked decision).
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
    for (const field of SOURCED_FIELDS) {
      const sourced = candidate?.[field]
      initial[field] = {
        value: sourced?.value ?? '',
        sourceType: sourced?.source.type ?? 'curator',
        sourceLabel: sourced?.source.label ?? '',
        sourceUrl: sourced?.source.url ?? '',
      }
    }
    return initial
  })
  const [news, setNews] = useState<NewsLink[]>(candidate?.news ?? [])
  const [newsTitle, setNewsTitle] = useState('')
  const [newsUrl, setNewsUrl] = useState('')
  const [newsPublisher, setNewsPublisher] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

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
      if (!drafts[field].value.trim()) {
        setError(`Enter a value for "${fieldLabel(field)}".`)
        return
      }
      if (!drafts[field].sourceLabel.trim()) {
        setError(`Attach a source for "${fieldLabel(field)}" — every field must be sourced.`)
        return
      }
    }

    const patch: CandidatePatch = {
      name: name.trim() || activeCandidate.name,
      party: party.trim() || activeCandidate.party,
      news,
      trackRecord: {
        value: drafts.trackRecord.value.trim(),
        source: {
          type: drafts.trackRecord.sourceType,
          label: drafts.trackRecord.sourceLabel.trim(),
          url: drafts.trackRecord.sourceUrl.trim() || undefined,
        },
      },
      pendingCases: {
        value: drafts.pendingCases.value.trim(),
        source: {
          type: drafts.pendingCases.sourceType,
          label: drafts.pendingCases.sourceLabel.trim(),
          url: drafts.pendingCases.sourceUrl.trim() || undefined,
        },
      },
      assets: {
        value: drafts.assets.value.trim(),
        source: {
          type: drafts.assets.sourceType,
          label: drafts.assets.sourceLabel.trim(),
          url: drafts.assets.sourceUrl.trim() || undefined,
        },
      },
      education: {
        value: drafts.education.value.trim(),
        source: {
          type: drafts.education.sourceType,
          label: drafts.education.sourceLabel.trim(),
          url: drafts.education.sourceUrl.trim() || undefined,
        },
      },
      approachability: {
        value: drafts.approachability.value.trim(),
        source: {
          type: drafts.approachability.sourceType,
          label: drafts.approachability.sourceLabel.trim(),
          url: drafts.approachability.sourceUrl.trim() || undefined,
        },
      },
    }

    try {
      data.updateCandidate(activeCandidate.slug, patch, user)
      setError(null)
      setSaved(true)
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
                <div>
                  <label htmlFor={`${idBase}-value`} className="mb-1 block text-sm font-medium text-ink">
                    {fieldLabel(field)} value
                  </label>
                  <textarea
                    id={`${idBase}-value`}
                    value={draft.value}
                    onChange={(e) => updateDraft(field, { value: e.target.value })}
                    rows={2}
                    className="w-full rounded border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
                  />
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
