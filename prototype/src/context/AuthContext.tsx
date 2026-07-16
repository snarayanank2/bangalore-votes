import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Role, User } from '../types'
import type { Store } from '../store/store'

const STORAGE_KEY = 'bv-auth'

/** Synthetic user representing the anonymous, unauthenticated visitor. */
const ANON_USER: User = {
  id: 'anon',
  name: 'Anonymous',
  contact: '',
  role: 'anonymous',
  language: 'en',
  active: true,
}

interface AuthValue {
  user: User
  role: Role
  isAuthed: boolean
  loginAs: (userId: string) => void
  loginNew: (contact: string, homeWardId: string, language?: User['language']) => void
  logout: () => void
  pendingAction: (() => void) | null
  requireAuth: (action: () => void) => void
  resolvePending: () => void
  cancelPending: () => void
}

const AuthContext = createContext<AuthValue | null>(null)

export function AuthProvider({ store, children }: { store: Store; children: ReactNode }) {
  const [userId, setUserId] = useState<string>(
    () => localStorage.getItem(STORAGE_KEY) ?? 'anon',
  )
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null)

  useEffect(() => {
    if (userId === 'anon') localStorage.removeItem(STORAGE_KEY)
    else localStorage.setItem(STORAGE_KEY, userId)
  }, [userId])

  const user: User =
    userId === 'anon' ? ANON_USER : (store.listUsers().find((u) => u.id === userId) ?? ANON_USER)

  function loginAs(id: string): void {
    setUserId(id)
  }

  /**
   * Registers a new citizen account via `store.createUser` (persists to localStorage — Task 10;
   * previously this built a transient React-state-only user that vanished on reload, see
   * task-6-8-report.md) and logs into it immediately.
   */
  function loginNew(contact: string, homeWardId: string, language?: User['language']): void {
    const created = store.createUser({ contact, homeWardId, language })
    setUserId(created.id)
  }

  function logout(): void {
    setUserId('anon')
  }

  /**
   * Runs `action` immediately if the visitor is already authenticated; otherwise stashes it in
   * the single `pendingAction` slot to run after login (see `resolvePending`).
   *
   * DECISION — last-wins, not queued: only one pending action is held at a time. A second
   * `requireAuth` call before the first resolves replaces the first action; the first tap's
   * intent is lost. This IS reachable in normal use: the Register/Login modal can be dismissed
   * without completing auth (Esc, backdrop click, the explicit close button — see Modal.tsx),
   * which leaves the page interactive again while a `pendingAction` is still stashed. To avoid a
   * later, unrelated gated tap silently overwriting (or a completed login silently firing) an
   * action the user already walked away from, every non-success dismissal of the login modal
   * calls `cancelPending()` (see below) to clear the slot first. So the only way `requireAuth` can
   * ever overwrite a still-pending action is two gated taps landing back-to-back before either the
   * login modal or its dismissal has run — genuinely concurrent, not something the UI's normal
   * click-tap-click sequence produces. Queuing multiple actions would add real complexity —
   * ordering, and ctx that may go stale if the page navigates in between — for that edge case.
   * Pinned by tests in AuthContext.test.tsx.
   */
  function requireAuth(action: () => void): void {
    if (user.role !== 'anonymous') {
      action()
      return
    }
    setPendingAction(() => action)
  }

  function resolvePending(): void {
    const action = pendingAction
    setPendingAction(null)
    if (action) action()
  }

  /**
   * Clears the stashed pending action WITHOUT running it. Called when the Register/Login modal is
   * dismissed without completing auth (Esc, backdrop click, explicit close) — a dismissed prompt
   * means the user abandoned that gated action, so it must not silently fire on some later,
   * unrelated login, nor sit around to be silently overwritten by a second gated tap.
   */
  function cancelPending(): void {
    setPendingAction(null)
  }

  const value: AuthValue = {
    user,
    role: user.role,
    isAuthed: user.role !== 'anonymous',
    loginAs,
    loginNew,
    logout,
    pendingAction,
    requireAuth,
    resolvePending,
    cancelPending,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
