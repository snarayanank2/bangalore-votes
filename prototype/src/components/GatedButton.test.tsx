import { render, screen, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AppProviders } from '../App'
import { useAuth } from '../context/AuthContext'
import { GatedButton } from './GatedButton'

let auth: ReturnType<typeof useAuth>
function Probe() {
  auth = useAuth()
  return null
}

test('anonymous click opens the login modal instead of running the action', async () => {
  const user = userEvent.setup()
  let ran = false
  render(
    <AppProviders>
      <Probe />
      <GatedButton onAct={() => { ran = true }}>Flag</GatedButton>
    </AppProviders>,
  )

  await user.click(screen.getByRole('button', { name: 'Flag' }))

  expect(ran).toBe(false)
  expect(screen.getByRole('dialog', { name: /sign in/i })).toBeInTheDocument()
})

test('authenticated click runs the action immediately, no modal', async () => {
  const user = userEvent.setup()
  let ran = false
  render(
    <AppProviders>
      <Probe />
      <GatedButton onAct={() => { ran = true }}>Vote</GatedButton>
    </AppProviders>,
  )

  act(() => auth.loginAs('u-citizen'))
  await user.click(screen.getByRole('button', { name: 'Vote' }))

  expect(ran).toBe(true)
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
})
