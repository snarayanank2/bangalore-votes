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
   * `requireAuth` call before the first resolves silently replaces the first action; the first
   * tap's intent is lost. This is intentional for the prototype: `GatedButton` opens the
   * page-blocking Register/Login modal on the very same gated tap that stashes the action, so
   * there is no idle window in the shipped UI for an unrelated second gated tap to land while the
   * first is still pending behind a hidden modal (the modal's full-viewport backdrop blocks
   * clicks elsewhere). Queuing multiple actions would add real complexity — ordering, and ctx
   * that may go stale if the page navigates in between — for a case that shouldn't be reachable
   * through normal use. Pinned by a test in AuthContext.test.tsx.
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
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
