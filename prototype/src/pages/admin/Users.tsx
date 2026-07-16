import { useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { useData, useStoreVersion } from '../../context/DataContext'
import { fieldLabel } from '../../lib/fields'
import type { Submission, User } from '../../types'

interface RowProps {
  targetUser: User
  admin: User
}

function UserRow({ targetUser, admin }: RowProps) {
  const data = useData()
  const [error, setError] = useState<string | null>(null)
  const [showSubmissions, setShowSubmissions] = useState(false)

  function toggleActive(): void {
    try {
      data.setUserActive(targetUser.id, !targetUser.active, admin)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update this account.')
    }
  }

  function describe(sub: Submission): { ward: string; candidate?: string } {
    const ward = data.getWard(sub.wardId)?.name ?? sub.wardId
    const candidate = sub.candidateId
      ? data.listCandidatesByWard(sub.wardId).find((c) => c.id === sub.candidateId)?.name
      : undefined
    return { ward, candidate }
  }

  const submissions = data.listSubmissionsByUser(targetUser.id)

  return (
    <li className="space-y-3 rounded-lg border border-slate-200 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-semibold text-ink">{targetUser.name}</p>
          <p className="text-xs text-ink/60">{targetUser.contact}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full border border-slate-300 px-2 py-0.5 text-xs font-medium capitalize text-ink/70">
            {targetUser.role}
          </span>
          <span
            className={`rounded-full border px-2 py-0.5 text-xs font-medium ${
              targetUser.active
                ? 'border-emerald-300 bg-emerald-100 text-emerald-900'
                : 'border-red-300 bg-red-100 text-red-900'
            }`}
          >
            {targetUser.active ? 'Active' : 'Inactive'}
          </span>
        </div>
      </div>

      {error && (
        <p role="alert" className="rounded bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={toggleActive}
          className={`rounded border px-3 py-1.5 text-sm font-semibold focus:outline-none focus:ring-2 ${
            targetUser.active
              ? 'border-red-600 text-red-700 hover:bg-red-50 focus:ring-red-600'
              : 'border-emerald-600 text-emerald-700 hover:bg-emerald-50 focus:ring-emerald-600'
          }`}
        >
          {targetUser.active ? 'Deactivate' : 'Reactivate'}
        </button>
        <button
          type="button"
          onClick={() => setShowSubmissions((v) => !v)}
          className="rounded border border-slate-300 px-3 py-1.5 text-sm font-medium text-ink hover:border-brand focus:outline-none focus:ring-2 focus:ring-brand"
        >
          {showSubmissions ? 'Hide submissions' : 'View submissions'}
        </button>
      </div>

      {showSubmissions && (
        <div className="border-t border-slate-200 pt-3">
          {submissions.length === 0 ? (
            <p className="text-sm text-ink/70">No submissions from this user yet.</p>
          ) : (
            <ul className="space-y-2">
              {submissions.map((sub) => {
                const { ward, candidate } = describe(sub)
                return (
                  <li key={sub.id} className="rounded border border-slate-200 px-3 py-2 text-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-medium text-ink">{fieldLabel(sub.field)}</span>
                      <span className="text-xs uppercase tracking-wide text-ink/60">{sub.status}</span>
                    </div>
                    <p className="text-xs text-ink/60">
                      {ward}
                      {candidate ? ` · ${candidate}` : ''}
                    </p>
                    <p className="text-ink/80">{sub.detail}</p>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      )}
    </li>
  )
}

/**
 * Manage users (PRD §7, IA §6.3, `/admin/users`) — search accounts, deactivate/reactivate
 * (`user.active`), and inspect a user's submission (flag) history. Admin-only.
 *
 * Deactivating is a soft ban: `setUserActive` just flips the `active` flag (no data deletion),
 * and is fully reversible from this same page.
 */
export default function Users() {
  const { user } = useAuth()
  const data = useData()
  useStoreVersion()

  const [query, setQuery] = useState('')

  const users = data.listUsers()
  const q = query.trim().toLowerCase()
  const filtered = q
    ? users.filter(
        (u) =>
          u.name.toLowerCase().includes(q) ||
          u.contact.toLowerCase().includes(q) ||
          u.id.toLowerCase().includes(q),
      )
    : users

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-8">
      <div>
        <h1 className="text-2xl font-bold text-ink sm:text-3xl">Manage users</h1>
        <p className="mt-1 text-sm text-ink/70">
          {users.length} account{users.length === 1 ? '' : 's'} registered.
        </p>
      </div>

      <div>
        <label htmlFor="user-search" className="mb-1 block text-sm font-medium text-ink">
          Search by name or contact
        </label>
        <input
          id="user-search"
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="e.g. Asha, vikram@example.com"
          className="w-full max-w-sm rounded border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
        />
      </div>

      {filtered.length === 0 ? (
        <p className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-sm text-ink/70">
          No users match that search.
        </p>
      ) : (
        <ul className="space-y-4">
          {filtered.map((u) => (
            <UserRow key={u.id} targetUser={u} admin={user} />
          ))}
        </ul>
      )}
    </div>
  )
}
