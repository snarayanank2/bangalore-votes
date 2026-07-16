import { useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useData, useStoreVersion } from '../../context/DataContext'
import type { Corporation } from '../../types'

const CORPORATIONS: Corporation[] = ['North', 'South', 'East', 'West', 'Central']

/**
 * Edit ward (PRD §5.1, IA §5.5, `/curator/ward/:wardId`) — ward metadata (name, number,
 * corporation zone) plus the human-readable old→new boundary mapping note.
 *
 * NO PER-FIELD SOURCE HERE: unlike Candidate, `Ward` (types.ts) carries no `Sourced<T>` fields —
 * name/number/corporation/oldWardsNote are all plain values with no provenance wrapper in the
 * data model. So, per the brief's "source per field where the model carries one", this form
 * intentionally does NOT fabricate a source selector that the store has nowhere to persist.
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
  const [oldWardsNote, setOldWardsNote] = useState(ward?.oldWardsNote ?? '')
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

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
    if (!oldWardsNote.trim()) {
      setError('Enter the old→new mapping note.')
      return
    }

    try {
      data.updateWard(
        activeWard.id,
        {
          name: name.trim(),
          number: parsedNumber,
          corporation,
          oldWardsNote: oldWardsNote.trim(),
        },
        user,
      )
      setError(null)
      setSaved(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save this ward.')
    }
  }

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

        <div>
          <label htmlFor="ward-old-note" className="mb-1 block text-sm font-medium text-ink">
            Old→new mapping note
          </label>
          <textarea
            id="ward-old-note"
            value={oldWardsNote}
            onChange={(e) => setOldWardsNote(e.target.value)}
            rows={3}
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
          />
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
    </div>
  )
}
