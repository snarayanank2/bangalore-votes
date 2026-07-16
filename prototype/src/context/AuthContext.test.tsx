import { render, screen, act } from '@testing-library/react'
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
