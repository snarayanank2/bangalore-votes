import type { ChangeEvent } from 'react'
import { useAuth } from '../context/AuthContext'
import { useData } from '../context/DataContext'

const DEMO_USERS = [
  { id: 'u-citizen', label: 'Citizen (Asha)' },
  { id: 'u-curator', label: 'Curator (Vikram)' },
  { id: 'u-admin', label: 'Admin' },
] as const

const RESET_VALUE = '__reset__'
const ANON_VALUE = 'anon'

/** Demo-only control (never gated behind auth itself) letting the prototype
 * jump between roles without a real OTP flow, plus a data-reset escape hatch.
 * Clearly labelled "Prototype" so it doesn't read as a real product control. */
export function DevRoleSwitcher() {
  const { user, loginAs, logout } = useAuth()
  const store = useData()

  function handleChange(event: ChangeEvent<HTMLSelectElement>): void {
    const value = event.target.value
    if (value === RESET_VALUE) {
      store.reset()
      logout()
      return
    }
    if (value === ANON_VALUE) {
      logout()
      return
    }
    loginAs(value)
  }

  return (
    <div className="flex items-center gap-1.5 text-xs">
      <label htmlFor="dev-role-switcher" className="font-semibold text-ink">
        ⚙ Prototype
      </label>
      <select
        id="dev-role-switcher"
        value={user.role === 'anonymous' ? ANON_VALUE : user.id}
        onChange={handleChange}
        className="rounded-sm border border-gray-300 bg-white px-1 py-0.5 text-ink"
      >
        <option value={ANON_VALUE}>Anonymous</option>
        {DEMO_USERS.map((demoUser) => (
          <option key={demoUser.id} value={demoUser.id}>
            {demoUser.label}
          </option>
        ))}
        <option value={RESET_VALUE}>Reset demo data</option>
      </select>
    </div>
  )
}
