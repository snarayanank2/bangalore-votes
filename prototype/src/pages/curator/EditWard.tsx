import { useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useData, useStoreVersion } from '../../context/DataContext'
import { formatStamp } from '../../lib/stamps'
import type { Corporation } from '../../types'

const CORPORATIONS: Corporation[] = ['North', 'South', 'East', 'West', 'Central']

/**
 * Edit ward (PRD §5.1, IA §5.5, `/curator/ward/:wardId`) — ward metadata (name, number,
 * corporation zone).
 *
 * NO PER-FIELD SOURCE HERE: unlike Candidate, `Ward` (types.ts) carries no `Sourced<T>` fields —
 * name/number/corporation are all plain values with no provenance wrapper in the data model. So,
 * per the brief's "source per field where the model carries one", this form intentionally does
 * NOT fabricate a source selector that the store has nowhere to persist.
 *
 * SCOPE: same pattern as EditCandidate — never pre-checked, only surfaced inline (as the store's
 * `/scope/i` error) at save time, so a curator can still open the page for an out-of-scope ward
 * by URL without the page crashing.
 */
export default function EditWard() {
  const { wardId } = useParams<{ wardId: string }>()
  const { user } = useAuth()
  const data = useData()
  useStoreVersion()

  const ward = wardId ? data.getWard(wardId) : undefined

  const [name, setName] = useState(ward?.name ?? '')
  const [number, setNumber] = useState(ward ? String(ward.number) : '')
  const [corporation, setCorporation] = useState<Corporation>(ward?.corporation ?? 'South')
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [readinessError, setReadinessError] = useState<string | null>(null)
  const [readinessSaved, setReadinessSaved] = useState(false)

  if (!ward) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-8">
        <h1 className="text-xl font-bold text-ink">We couldn&apos;t find that ward</h1>
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
  // into the nested handleSubmit closure below.
  const activeWard = ward

  function handleSubmit(event: FormEvent): void {
    event.preventDefault()
    setSaved(false)

    if (!name.trim()) {
      setError('Enter the ward name.')
      return
    }
    const parsedNumber = Number(number)
    if (!Number.isFinite(parsedNumber) || parsedNumber <= 0) {
      setError('Enter a valid ward number.')
      return
    }

    try {
      data.updateWard(
        activeWard.id,
        {
          name: name.trim(),
          number: parsedNumber,
          corporation,
        },
        user,
      )
      setError(null)
      setSaved(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save this ward.')
    }
  }

  function handleSignOff(): void {
    setReadinessSaved(false)
    try {
      data.signOffWard(activeWard.id, user)
      setReadinessError(null)
      setReadinessSaved(true)
    } catch (err) {
      setReadinessError(err instanceof Error ? err.message : 'Could not sign off this ward.')
    }
  }

  // PRD §9.1: the mechanical check (wardCompleteness) + human sign-off state (wardReadiness).
  // Recomputed on every render, so a sign-off — or a candidate-set change elsewhere that clears
  // one — shows up immediately via useStoreVersion() above.
  const completeness = data.wardCompleteness(activeWard.id)
  const readiness = data.wardReadiness(activeWard.id)
  const signedOffBy = activeWard.readySignOff
    ? data.listUsers().find((u) => u.id === activeWard.readySignOff!.by)
    : undefined

  return (
    <div className="mx-auto max-w-2xl space-y-8 px-4 py-8">
      <div>
        <p className="text-sm font-medium uppercase tracking-wide text-brand">Ward {ward.number}</p>
        <h1 className="text-2xl font-bold text-ink sm:text-3xl">{ward.name}</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <p role="alert" className="rounded bg-red-50 px-3 py-2 text-sm text-red-800">
            {error}
          </p>
        )}
        {saved && !error && (
          <p className="rounded bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
            Saved — this ward&apos;s details are now updated.
          </p>
        )}

        <div>
          <label htmlFor="ward-name" className="mb-1 block text-sm font-medium text-ink">
            Ward name
          </label>
          <input
            id="ward-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
          />
        </div>

        <div>
          <label htmlFor="ward-number" className="mb-1 block text-sm font-medium text-ink">
            Ward number
          </label>
          <input
            id="ward-number"
            type="number"
            value={number}
            onChange={(e) => setNumber(e.target.value)}
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
          />
        </div>

        <div>
          <label htmlFor="ward-corporation" className="mb-1 block text-sm font-medium text-ink">
            Corporation zone
          </label>
          <select
            id="ward-corporation"
            value={corporation}
            onChange={(e) => setCorporation(e.target.value as Corporation)}
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
          >
            {CORPORATIONS.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        <button
          type="submit"
          className="w-full rounded bg-brand px-4 py-2 text-sm font-semibold text-white focus:outline-none focus:ring-2 focus:ring-brand"
        >
          Save changes
        </button>
      </form>

      <p className="text-sm">
        <Link
          to={`/curator/ward/${ward.id}/issues`}
          className="text-brand underline underline-offset-2 hover:no-underline"
        >
          Define this ward&apos;s votable issues
        </Link>
      </p>

      <section
        aria-labelledby="readiness-heading"
        className="space-y-4 rounded-lg border border-slate-200 p-4"
      >
        <div>
          <h2 id="readiness-heading" className="text-lg font-semibold text-ink">
            Ward data-readiness (candidate comms)
          </h2>
          <p className="mt-1 text-xs text-ink/60">
            A candidate-referencing send is held from this ward until its report cards are
            complete and a curator signs it off (PRD §9.1).
          </p>
        </div>

        {readinessError && (
          <p role="alert" className="rounded bg-red-50 px-3 py-2 text-sm text-red-800">
            {readinessError}
          </p>
        )}
        {readinessSaved && !readinessError && (
          <p className="rounded bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
            Signed off — this ward is now ready for candidate-referencing comms.
          </p>
        )}

        <div className="text-sm">
          <p className="font-medium text-ink">
            Completeness:{' '}
            {completeness.complete
              ? 'Complete'
              : completeness.candidateCount === 0
                ? 'Not ready — no candidates filed'
                : `${completeness.issues.length} candidate${completeness.issues.length === 1 ? '' : 's'} with gaps`}
          </p>
          {completeness.candidateCount === 0 && (
            <p className="mt-1 text-ink/70">
              {completeness.reason ?? 'No candidates have filed nominations in this ward yet.'}
            </p>
          )}
          {completeness.issues.length > 0 && (
            <ul className="mt-2 space-y-2">
              {completeness.issues.map((issue) => (
                <li
                  key={issue.candidateId}
                  className="rounded border border-amber-300 bg-amber-50 px-3 py-2"
                >
                  <p className="font-medium text-ink">{issue.candidateName}</p>
                  <ul className="mt-1 list-disc space-y-0.5 pl-5 text-ink/80">
                    {issue.reasons.map((reason) => (
                      <li key={reason}>{reason}</li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="text-sm">
          {readiness.signedOff ? (
            <p className="text-ink">
              Signed off{signedOffBy ? ` by ${signedOffBy.name}` : ''}
              {activeWard.readySignOff ? ` (${formatStamp(activeWard.readySignOff.at)})` : ''}.
            </p>
          ) : (
            <p className="text-ink/70">
              {readiness.clearedByCandidateChange
                ? 'Not yet signed off — the candidate list changed since the last sign-off; please review and sign off again.'
                : 'Not yet signed off.'}
            </p>
          )}
          {readiness.overridden && (
            <p className="mt-1 text-ink/70">
              An admin has overridden this ward&apos;s comms hold.
            </p>
          )}
          <p className="mt-1 font-medium text-ink">
            Ready for candidate-referencing comms: {readiness.ready ? 'Yes' : 'No'}
          </p>
        </div>

        {!readiness.signedOff && (
          <div>
            <button
              type="button"
              onClick={handleSignOff}
              disabled={!completeness.complete}
              className="rounded bg-brand px-4 py-2 text-sm font-semibold text-white focus:outline-none focus:ring-2 focus:ring-brand disabled:cursor-not-allowed disabled:opacity-50"
            >
              Mark ward ready
            </button>
            {!completeness.complete && (
              <p className="mt-1 text-xs text-ink/60">
                {completeness.candidateCount === 0
                  ? 'A ward with no candidates on record cannot be signed off for candidate-referencing comms.'
                  : "Complete every candidate's report card above before you can sign off."}
              </p>
            )}
          </div>
        )}
      </section>
    </div>
  )
}
