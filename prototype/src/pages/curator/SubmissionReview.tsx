import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useData, useStoreVersion } from '../../context/DataContext'
import { SourceBadge } from '../../components/SourceBadge'
import { fieldLabel, isCandidateSourcedField } from '../../lib/fields'
import type { Source, SourceType } from '../../types'

const STATUS_LABEL: Record<string, string> = {
  pending: 'Pending',
  accepted: 'Accepted',
  rejected: 'Rejected',
}

/**
 * Submission review (PRD §6.1 steps 3–5, §11, IA §5.3, `/curator/queue/{submission-id}`) — the
 * page that closes the flag → correction → publish → record loop. Shows the flag, the field's
 * CURRENT value + source, then offers two independent actions:
 *
 * - Accept: edit the value and attach a source (MANDATORY — PRD §6/§11: every field carries a
 *   visible source, so a correction can never publish without one). Calls
 *   `acceptSubmission`, which writes the new value straight into the candidate's Sourced field
 *   and publishes it immediately — curators are trusted, there is no second approval (locked
 *   decision) — then appends one audit entry.
 * - Reject: requires a reason, shown back to the submitter on `/account/submissions`.
 *
 * Both actions redirect to `/curator/queue` on success. The store enforces ward scope
 * (`requireScope` inside accept/reject) — this page never checks scope itself, it just surfaces
 * whatever error the store throws as an inline, non-crashing message (curators can still open a
 * submission outside their scope by URL; they just can't act on it).
 */
export default function SubmissionReview() {
  const { submissionId } = useParams<{ submissionId: string }>()
  const { user } = useAuth()
  const data = useData()
  const navigate = useNavigate()
  useStoreVersion()

  const submission = submissionId ? data.getSubmission(submissionId) : undefined
  const ward = submission ? data.getWard(submission.wardId) : undefined
  const candidate =
    submission?.candidateId !== undefined
      ? data
          .listCandidatesByWard(submission.wardId)
          .find((c) => c.id === submission.candidateId)
      : undefined
  const sourcedField =
    submission && isCandidateSourcedField(submission.field) ? submission.field : undefined
  const currentSourced = candidate && sourcedField ? candidate[sourcedField] : undefined

  const [value, setValue] = useState(currentSourced?.value ?? '')
  const [sourceType, setSourceType] = useState<SourceType>('curator')
  const [sourceLabel, setSourceLabel] = useState('')
  const [sourceUrl, setSourceUrl] = useState('')
  const [reason, setReason] = useState('')
  const [acceptError, setAcceptError] = useState<string | null>(null)
  const [rejectError, setRejectError] = useState<string | null>(null)

  if (!submission) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-8">
        <h1 className="text-xl font-bold text-ink">We couldn&apos;t find that submission</h1>
        <p className="mt-2 text-sm text-ink/70">
          It may have already been handled. <Link to="/curator/queue" className="text-brand underline underline-offset-2">Back to the queue</Link>.
        </p>
      </div>
    )
  }

  function handleAccept(event: FormEvent): void {
    event.preventDefault()
    if (!submission) return
    if (!value.trim()) {
      setAcceptError('Enter the corrected value.')
      return
    }
    if (!sourceLabel.trim()) {
      setAcceptError('Attach a source for this correction — every field must be sourced.')
      return
    }
    const source: Source = {
      type: sourceType,
      label: sourceLabel.trim(),
      url: sourceUrl.trim() || undefined,
    }
    try {
      data.acceptSubmission(submission.id, user, {
        candidateSlug: candidate?.slug,
        field: sourcedField,
        value: value.trim(),
        source,
      })
      setAcceptError(null)
      navigate('/curator/queue')
    } catch (err) {
      setAcceptError(err instanceof Error ? err.message : 'Could not accept this submission.')
    }
  }

  function handleReject(event: FormEvent): void {
    event.preventDefault()
    if (!submission) return
    if (!reason.trim()) {
      setRejectError('Give a reason — it is shown back to the person who flagged this.')
      return
    }
    try {
      data.rejectSubmission(submission.id, user, reason.trim())
      setRejectError(null)
      navigate('/curator/queue')
    } catch (err) {
      setRejectError(err instanceof Error ? err.message : 'Could not reject this submission.')
    }
  }

  const resolved = submission.status !== 'pending'

  return (
    <div className="mx-auto max-w-2xl space-y-8 px-4 py-8">
      <div>
        <p className="text-sm font-medium uppercase tracking-wide text-brand">
          {ward?.name ?? submission.wardId}
          {candidate ? ` · ${candidate.name}` : ''}
        </p>
        <h1 className="text-2xl font-bold text-ink sm:text-3xl">{fieldLabel(submission.field)}</h1>
        {submission.count > 1 && (
          <p className="mt-1 inline-flex items-center rounded-full border border-accent bg-accent/10 px-2 py-0.5 text-xs font-semibold text-accent">
            {submission.count} citizens flagged this
          </p>
        )}
      </div>

      {resolved && (
        <p className="rounded bg-slate-100 px-3 py-2 text-sm text-ink/80">
          This submission has already been resolved: <strong>{STATUS_LABEL[submission.status]}</strong>
          {submission.reason ? ` — ${submission.reason}` : ''}.{' '}
          <Link to="/curator/queue" className="text-brand underline underline-offset-2">
            Back to the queue
          </Link>
        </p>
      )}

      <section aria-labelledby="flag-heading" className="space-y-2 rounded-lg border border-slate-200 p-4">
        <h2 id="flag-heading" className="text-sm font-semibold text-ink">
          What was flagged
        </h2>
        <p className="text-sm text-ink/90">{submission.detail}</p>
        {submission.sourceUrl && (
          <a
            href={submission.sourceUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-block text-sm text-brand underline underline-offset-2 hover:no-underline"
          >
            Submitter&apos;s source
          </a>
        )}
      </section>

      <section aria-labelledby="current-heading" className="space-y-2">
        <h2 id="current-heading" className="text-sm font-semibold text-ink">
          Current value
        </h2>
        {currentSourced ? (
          <div className="space-y-1.5 rounded-lg border border-slate-200 p-4">
            <p className="text-sm text-ink/90">{currentSourced.value}</p>
            <SourceBadge source={currentSourced.source} />
          </div>
        ) : (
          <p className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-3 text-sm text-ink/70">
            This flag isn&apos;t tied to a known candidate field, so there is no current sourced
            value to show.
          </p>
        )}
      </section>

      {!resolved && (
        <div className="grid gap-6 sm:grid-cols-2">
          <form onSubmit={handleAccept} className="space-y-3 rounded-lg border border-emerald-300 bg-emerald-50/40 p-4">
            <h2 className="text-sm font-semibold text-ink">Accept &amp; publish correction</h2>
            {acceptError && (
              <p role="alert" className="rounded bg-red-50 px-3 py-2 text-sm text-red-800">
                {acceptError}
              </p>
            )}
            <div>
              <label htmlFor="accept-value" className="mb-1 block text-sm font-medium text-ink">
                Corrected value
              </label>
              <textarea
                id="accept-value"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                rows={3}
                className="w-full rounded border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
              />
            </div>
            <div>
              <label htmlFor="accept-source-type" className="mb-1 block text-sm font-medium text-ink">
                Source type
              </label>
              <select
                id="accept-source-type"
                value={sourceType}
                onChange={(e) => setSourceType(e.target.value as SourceType)}
                className="w-full rounded border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
              >
                <option value="curator">Curator-compiled</option>
                <option value="affidavit">Official (affidavit)</option>
              </select>
            </div>
            <div>
              <label htmlFor="accept-source-label" className="mb-1 block text-sm font-medium text-ink">
                Source label
              </label>
              <input
                id="accept-source-label"
                type="text"
                value={sourceLabel}
                onChange={(e) => setSourceLabel(e.target.value)}
                placeholder="e.g. Sub-registrar office confirmation"
                className="w-full rounded border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
              />
            </div>
            <div>
              <label htmlFor="accept-source-url" className="mb-1 block text-sm font-medium text-ink">
                Source URL (optional)
              </label>
              <input
                id="accept-source-url"
                type="text"
                value={sourceUrl}
                onChange={(e) => setSourceUrl(e.target.value)}
                placeholder="https://…"
                className="w-full rounded border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
              />
            </div>
            <button
              type="submit"
              className="w-full rounded bg-brand px-4 py-2 text-sm font-semibold text-white focus:outline-none focus:ring-2 focus:ring-brand"
            >
              Accept &amp; publish
            </button>
          </form>

          <form onSubmit={handleReject} className="space-y-3 rounded-lg border border-red-300 bg-red-50/40 p-4">
            <h2 className="text-sm font-semibold text-ink">Reject this flag</h2>
            {rejectError && (
              <p role="alert" className="rounded bg-red-50 px-3 py-2 text-sm text-red-800">
                {rejectError}
              </p>
            )}
            <div>
              <label htmlFor="reject-reason" className="mb-1 block text-sm font-medium text-ink">
                Reason
              </label>
              <textarea
                id="reject-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
                placeholder="Shown to the citizen who flagged this."
                className="w-full rounded border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
              />
            </div>
            <button
              type="submit"
              className="w-full rounded border border-red-600 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-red-600"
            >
              Reject flag
            </button>
          </form>
        </div>
      )}
    </div>
  )
}
