import { render, screen, act, cleanup } from '@testing-library/react'
import { AuthProvider, useAuth } from './AuthContext'
import { createStore } from '../store/store'

let captured: ReturnType<typeof useAuth>
function Probe() { captured = useAuth(); return <div>{captured.role}</div> }

test('requireAuth stashes action when anonymous, runs after login', () => {
  const store = createStore()
  render(<AuthProvider store={store}><Probe /></AuthProvider>)
  expect(screen.getByText('anonymous')).toBeInTheDocument()
  let ran = false
  act(() => captured.requireAuth(() => { ran = true }))
  expect(ran).toBe(false)          // gated
  act(() => captured.loginAs('u-citizen'))
  act(() => captured.resolvePending())
  expect(ran).toBe(true)           // resumed in place
  expect(captured.role).toBe('citizen')
})

// --- Task 10: loginNew must persist via the store, not just React state ------------------

test('loginNew persists the new user across a fresh store/provider construction (reload)', () => {
  const store1 = createStore()
  render(<AuthProvider store={store1}><Probe /></AuthProvider>)
  act(() => captured.loginNew('new.citizen@example.com', 'koramangala'))
  expect(captured.role).toBe('citizen')
  const newId = captured.user.id
  expect(store1.listUsers().some((u) => u.id === newId)).toBe(true)
  cleanup()

  // Fresh store instance reading from the same localStorage — simulates a page reload.
  const store2 = createStore()
  render(<AuthProvider store={store2}><Probe /></AuthProvider>)
  // AuthProvider's userId initializer reads localStorage['bv-auth'], which loginNew persisted,
  // so the new user should already be logged in on remount.
  expect(captured.user.id).toBe(newId)
  expect(captured.user.contact).toBe('new.citizen@example.com')
  expect(captured.user.homeWardId).toBe('koramangala')
  expect(captured.role).toBe('citizen')
})

// --- Known issue: requireAuth's single pendingAction slot is last-wins, not queued ---------
// See the DECISION comment above requireAuth in AuthContext.tsx for the justification. Pinning
// the behavior here so a future change to queue actions is a deliberate, visible decision.

test('requireAuth is last-wins: a second gated action before login overwrites the first', () => {
  const store = createStore()
  render(<AuthProvider store={store}><Probe /></AuthProvider>)
  let firstRan = false
  let secondRan = false
  act(() => captured.requireAuth(() => { firstRan = true }))
  act(() => captured.requireAuth(() => { secondRan = true }))
  act(() => captured.loginAs('u-citizen'))
  act(() => captured.resolvePending())
  expect(firstRan).toBe(false)
  expect(secondRan).toBe(true)
})

// --- Fix 1: dismissing the login modal without completing auth must clear pendingAction --------
// Reproduces the exact scenario from the code review: (1) gated tap A stashes action A, (2) the
// login modal is dismissed WITHOUT auth completing (Esc/backdrop/close — simulated here directly
// via cancelPending(), which is what RegisterLogin's dismissal handler calls), (3) an unrelated
// gated tap B stashes action B, (4) login completes and resolvePending() runs. Action A must NOT
// fire, and must not have been silently "kept alive" only to be overwritten — it was abandoned at
// step 2, before B ever existed.

test('cancelPending clears an abandoned action so a later unrelated action is not silently lost or fired', () => {
  const store = createStore()
  render(<AuthProvider store={store}><Probe /></AuthProvider>)
  let firstRan = false
  let secondRan = false

  // 1. Anonymous user taps "Flag an error" on candidate A -> action A stashed.
  act(() => captured.requireAuth(() => { firstRan = true }))
  expect(captured.pendingAction).not.toBeNull()

  // 2. User dismisses the login modal (Esc/backdrop) without logging in -> A is abandoned.
  act(() => captured.cancelPending())
  expect(captured.pendingAction).toBeNull()

  // 3. User taps "Vote your top 3" elsewhere -> action B stashed.
  act(() => captured.requireAuth(() => { secondRan = true }))

  // 4. User completes login -> only B runs; A never fires.
  act(() => captured.loginAs('u-citizen'))
  act(() => captured.resolvePending())

  expect(firstRan).toBe(false)
  expect(secondRan).toBe(true)
})
