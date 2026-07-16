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
  loginNew: (contact: string, homeWardId: string) => void
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
  // Users created via loginNew() in this session — the store has no
  // "register user" mutation (out of Task 5's scope), so transient citizen
  // accounts live here rather than in store state. They do not survive a
  // page reload; see task-6-8-report.md for the tradeoff.
  const [transientUsers, setTransientUsers] = useState<User[]>([])
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null)

  useEffect(() => {
    if (userId === 'anon') localStorage.removeItem(STORAGE_KEY)
    else localStorage.setItem(STORAGE_KEY, userId)
  }, [userId])

  const user: User =
    userId === 'anon'
      ? ANON_USER
      : (store.listUsers().find((u) => u.id === userId) ??
        transientUsers.find((u) => u.id === userId) ??
        ANON_USER)

  function loginAs(id: string): void {
    setUserId(id)
  }

  function loginNew(contact: string, homeWardId: string): void {
    const n = store.stamp()
    const newUser: User = {
      id: `user-${n}`,
      name: contact,
      contact,
      role: 'citizen',
      homeWardId,
      language: 'en',
      active: true,
    }
    setTransientUsers((prev) => [...prev, newUser])
    setUserId(newUser.id)
  }

  function logout(): void {
    setUserId('anon')
  }

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
