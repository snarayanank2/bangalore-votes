import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useData } from '../context/DataContext'

/**
 * Ward-name search — the site's #1 entry point ("which ward am I in now?").
 * Filters `listWards()` by name; selecting a result navigates to `/ward/{id}`.
 *
 * Real address/pincode → ward geocoding is out of scope for this static
 * prototype (see task brief); this only searches the ward NAME a citizen
 * already knows or can guess, and says so plainly rather than implying a
 * working address lookup. (PRD §5.1: ward lookup is by address or pincode —
 * not voter ID, which this platform never collects for ward-finding.)
 */
export function WardSearch() {
  const navigate = useNavigate()
  const { listWards } = useData()
  const [query, setQuery] = useState('')

  const trimmed = query.trim()
  const results = trimmed
    ? listWards().filter((ward) => ward.name.toLowerCase().includes(trimmed.toLowerCase()))
    : []

  function handleSelect(wardId: string): void {
    navigate(`/ward/${wardId}`)
  }

  return (
    <div className="w-full max-w-md">
      <label htmlFor="ward-search" className="mb-1 block text-sm font-medium text-ink">
        Search for your ward by name
      </label>
      <input
        id="ward-search"
        type="text"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="e.g. Koramangala"
        autoComplete="off"
        className="min-h-[44px] w-full rounded-sm border border-gray-300 px-3 py-2 text-base text-ink focus:border-forest"
      />
      <p className="mt-1 text-xs text-ink/60">
        Looking up your ward by address or pincode isn&apos;t available yet — search by ward name.
      </p>

      {trimmed &&
        (results.length > 0 ? (
          <ul className="mt-2 divide-y divide-gray-300 rounded-sm border border-gray-300 bg-white">
            {results.map((ward) => (
              <li key={ward.id}>
                <button
                  type="button"
                  onClick={() => handleSelect(ward.id)}
                  className="block min-h-[44px] w-full px-3 py-2 text-left text-sm text-ink hover:bg-gray-100"
                >
                  {ward.name} — Ward #{ward.number}, {ward.corporation}
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-ink/70">
            No ward matches &ldquo;{trimmed}&rdquo;. Check the spelling, or try again closer to the
            official notification once boundary data is fully published.
          </p>
        ))}
    </div>
  )
}
