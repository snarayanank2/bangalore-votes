import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useData, useStoreVersion } from '../../context/DataContext'
import { fieldLabel } from '../../lib/fields'
import { compareStampsNewestFirst } from '../../lib/stamps'
import type { Submission } from '../../types'

type SortKey = 'count' | 'newest'

const ALL_WARDS = 'all'

/**
 * Review queue (PRD §6.1 step 3, §6.3, IA §5.2, `/curator/queue`) — the deduped, ward-scoped list
 * of PENDING flags a curator needs to act on. `listQueueForCurator` already applies both filters
 * that matter for trust: pending-only (accepted/rejected submissions never reappear here) and
 * ward-scope (a curator only ever sees flags inside their assigned wards; admins see all).
 *
 * A submission's `count` — how many citizens independently flagged the same field — is a strong
 * de-dup signal per PRD §6.3, so it's surfaced as a visible badge on every item, and is one of
 * the two sort options.
 */
export default function Queue() {
  const { user } = useAuth()
  const data = useData()
  useStoreVersion() // re-render as new flags arrive or items are resolved

  const [sort, setSort] = useState<SortKey>('count')
  const [wardFilter, setWardFilter] = useState<string>(ALL_WARDS)

  const queue = data.listQueueForCurator(user)

  const wardOptions = useMemo(() => {
    const ids = Array.from(new Set(queue.map((s) => s.wardId)))
    return ids
      .map((id) => data.getWard(id))
      .filter((w): w is NonNullable<typeof w> => w !== undefined)
  }, [queue, data])

  const filtered = wardFilter === ALL_WARDS ? queue : queue.filter((s) => s.wardId === wardFilter)

  const sorted = [...filtered].sort((a, b) =>
    sort === 'count' ? b.count - a.count : compareStampsNewestFirst(a.createdAt, b.createdAt),
  )

  function describe(sub: Submission): { ward: string; candidate?: string } {
    const ward = data.getWard(sub.wardId)?.name ?? sub.wardId
    const candidate = sub.candidateId
      ? data.listCandidatesByWard(sub.wardId).find((c) => c.id === sub.candidateId)?.name
      : undefined
    return { ward, candidate }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-8">
      <div>
        <h1 className="text-2xl font-bold text-ink sm:text-3xl">Review queue</h1>
        <p className="mt-1 text-sm text-ink/70">
          {queue.length} pending item{queue.length === 1 ? '' : 's'} awaiting review in your wards.
        </p>
      </div>

      {queue.length > 0 && (
        <div className="flex flex-wrap gap-4">
          <div>
            <label htmlFor="queue-ward-filter" className="mb-1 block text-xs font-medium text-ink/70">
              Ward
            </label>
            <select
              id="queue-ward-filter"
              value={wardFilter}
              onChange={(e) => setWardFilter(e.target.value)}
              className="min-h-[44px] rounded-sm border border-gray-300 px-3 py-1.5 text-base focus:border-forest"
            >
              <option value={ALL_WARDS}>All wards</option>
              {wardOptions.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="queue-sort" className="mb-1 block text-xs font-medium text-ink/70">
              Sort by
            </label>
            <select
              id="queue-sort"
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
              className="min-h-[44px] rounded-sm border border-gray-300 px-3 py-1.5 text-base focus:border-forest"
            >
              <option value="count">Most flagged</option>
              <option value="newest">Newest</option>
            </select>
          </div>
        </div>
      )}

      {sorted.length === 0 ? (
        <p className="rounded-md border border-dashed border-gray-300 bg-gray-100 px-4 py-6 text-sm text-ink/70">
          Nothing pending — the queue is clear.
        </p>
      ) : (
        <ul className="space-y-3">
          {sorted.map((sub) => {
            const { ward, candidate } = describe(sub)
            return (
              <li key={sub.id}>
                <Link
                  to={`/curator/queue/${sub.id}`}
                  className="block space-y-2 rounded-md border border-gray-300 p-4 hover:border-forest"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h2 className="font-semibold text-ink">{fieldLabel(sub.field)}</h2>
                    {sub.count > 1 && (
                      <span className="inline-flex items-center rounded-full border border-gray-300 bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-600">
                        {sub.count} flags
                      </span>
                    )}
                  </div>
                  <p className="text-sm font-medium text-ink/60">
                    {ward}
                    {candidate ? ` · ${candidate}` : ''}
                  </p>
                  <p className="text-sm text-ink/80">{sub.detail}</p>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
