import { useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { useData, useStoreVersion } from '../../context/DataContext'
import { Button } from '../../components/Button'
import type { Role, User, Ward } from '../../types'

const ASSIGNABLE_ROLES: Role[] = ['citizen', 'curator', 'admin']

interface RowProps {
  targetUser: User
  wards: Ward[]
  admin: User
}

/** One user's role + ward-scope editor. Local draft state so a change to the role dropdown (or a
 * ward checkbox) doesn't write to the store until "Save" — matches the explicit-save pattern used
 * on the curator edit pages (Task 21), rather than mutating on every click. */
function RoleRow({ targetUser, wards, admin }: RowProps) {
  const data = useData()
  const [role, setRole] = useState<Role>(targetUser.role)
  const [wardIds, setWardIds] = useState<Set<string>>(new Set(targetUser.curatorWardIds ?? []))
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  function toggleWard(id: string): void {
    setSaved(false)
    setWardIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function handleSave(): void {
    setSaved(false)
    try {
      // setUserRole itself clears curatorWardIds when role !== 'curator' (documented store
      // behaviour) — passing wardIds here regardless is harmless, since the store ignores it.
      data.setUserRole(targetUser.id, role, Array.from(wardIds), admin)
      setError(null)
      setSaved(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save this role change.')
    }
  }

  const roleSelectId = `role-${targetUser.id}`

  return (
    <li className="space-y-3 rounded-md border border-gray-300 p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <p className="font-semibold text-ink">{targetUser.name}</p>
          <p className="text-xs text-ink/60">{targetUser.contact}</p>
        </div>
        <span className="rounded-full border border-transparent bg-gray-100 px-2.5 py-0.5 text-xs font-medium capitalize text-gray-600">
          Currently: {targetUser.role}
        </span>
      </div>

      {error && (
        <p role="alert" className="rounded-sm bg-brick-tint px-3 py-2 text-sm text-brick">
          {error}
        </p>
      )}
      {saved && !error && (
        <p className="rounded-sm bg-forest-tint px-3 py-2 text-sm text-forest">Saved.</p>
      )}

      <div>
        <label htmlFor={roleSelectId} className="mb-1 block text-sm font-medium text-ink">
          Role
        </label>
        <select
          id={roleSelectId}
          value={role}
          onChange={(e) => {
            setRole(e.target.value as Role)
            setSaved(false)
          }}
          className="w-full max-w-xs min-h-[44px] rounded-sm border border-gray-300 px-3 py-2 text-base focus:border-forest"
        >
          {ASSIGNABLE_ROLES.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
      </div>

      {role === 'curator' && (
        <fieldset className="space-y-1">
          <legend className="mb-1 text-sm font-medium text-ink">Ward scope</legend>
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            {wards.map((ward) => {
              const id = `ward-${targetUser.id}-${ward.id}`
              return (
                <div key={ward.id} className="flex items-center gap-1.5">
                  <input
                    id={id}
                    type="checkbox"
                    checked={wardIds.has(ward.id)}
                    onChange={() => toggleWard(ward.id)}
                    className="h-4 w-4 rounded-sm border-gray-300 text-forest focus:ring-forest"
                  />
                  <label htmlFor={id} className="text-sm text-ink">
                    {ward.name}
                  </label>
                </div>
              )
            })}
          </div>
        </fieldset>
      )}

      <Button type="button" variant="primary" onClick={handleSave}>
        Save
      </Button>
    </li>
  )
}

/**
 * Roles & access (PRD §7, IA §6.2, `/admin/roles`) — grant/revoke the curator role and set a
 * curator's ward scope. This is the ONLY place ward scope (`user.curatorWardIds`) is assigned —
 * it's what `requireScope` in the store enforces on every curator mutation.
 *
 * Admin-only (RoleGuard). Calls `setUserRole(userId, role, wardIds, admin)` directly with the
 * CURRENT authenticated admin user object (never a route param), per the store's User-object
 * (not id) calling convention.
 */
export default function Roles() {
  const { user } = useAuth()
  const data = useData()
  useStoreVersion()

  const users = data.listUsers()
  const wards = data.listWards()

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-8">
      <div>
        <h1 className="text-2xl text-ink sm:text-3xl">Roles &amp; access</h1>
        <p className="mt-1 text-sm text-ink/70">
          Grant or revoke the curator role, and set which wards a curator is scoped to.
        </p>
      </div>

      <ul className="space-y-4">
        {users.map((u) => (
          <RoleRow key={u.id} targetUser={u} wards={wards} admin={user} />
        ))}
      </ul>
    </div>
  )
}
