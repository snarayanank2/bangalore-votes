import { useState, type FormEvent } from 'react'

/**
 * Find polling booth (PRD §5.10, IA §3.12, `/voting-guide/find-booth`). Anonymous.
 *
 * HONESTY: exactly like Check registration, this static prototype has no real address→booth
 * geocoding. The lookup below always returns the same fixed, clearly-labelled DEMO result. A
 * citizen who shows up at a fabricated address on election day is real, tangible harm — so this
 * must never read as an authoritative booth assignment.
 */
export default function FindBooth() {
  const [address, setAddress] = useState('')
  const [searched, setSearched] = useState(false)

  function handleSubmit(event: FormEvent): void {
    event.preventDefault()
    setSearched(true)
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-8">
      <div>
        <h1 className="text-2xl font-bold text-ink sm:text-3xl">Find your polling booth</h1>
        <p className="mt-2 text-sm text-ink/80">
          Your assigned polling booth is tied to your address on the electoral roll, and can
          change between elections. Look it up before polling day so there are no surprises.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3 rounded-lg border border-slate-200 p-4">
        <label htmlFor="booth-lookup" className="block text-sm font-medium text-ink">
          Your address or Voter ID (EPIC number)
        </label>
        <input
          id="booth-lookup"
          type="text"
          value={address}
          onChange={(event) => setAddress(event.target.value)}
          placeholder="e.g. your house/flat number and street"
          autoComplete="off"
          className="w-full rounded border border-slate-300 px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-brand"
        />
        <button
          type="submit"
          className="rounded bg-brand px-4 py-2 text-sm font-semibold text-white focus:outline-none focus:ring-2 focus:ring-brand"
        >
          Find my booth
        </button>
      </form>

      {searched && (
        <div
          role="status"
          className="space-y-3 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900"
        >
          <p className="font-semibold uppercase tracking-wide">
            Prototype demo result — not a real booth lookup
          </p>
          <p>
            This is a sample result for demonstration only. This prototype has no real
            address-to-booth data, so this isn&apos;t a real assignment — please don&apos;t use it
            to decide where to go on election day.
          </p>
          <div className="rounded border border-amber-200 bg-white p-3 text-ink">
            <p className="font-medium">Sample booth: Govt. Higher Primary School, 5th Cross</p>
            <p className="text-ink/70">Illustrative address only — not a real polling location.</p>
            <div
              role="img"
              aria-label="Illustrative placeholder — not a real map of a polling booth location"
              className="mt-2 flex h-32 items-center justify-center rounded border-2 border-dashed border-slate-300 bg-slate-50 text-center text-xs text-ink/60"
            >
              Map placeholder — illustrative only, not a real booth location.
            </div>
          </div>
        </div>
      )}

      <div className="rounded-lg border border-slate-200 p-4">
        <h2 className="text-sm font-semibold text-ink">
          Prefer to check directly with the Election Commission?
        </h2>
        <p className="mt-1 text-sm text-ink/70">
          The Election Commission&apos;s own polling station locator is the authoritative source.
        </p>
        <a
          href="#"
          className="mt-2 inline-block text-sm font-medium text-brand underline underline-offset-2 hover:no-underline"
        >
          Open the official EC polling station locator (placeholder link in this prototype)
        </a>
      </div>
    </div>
  )
}
