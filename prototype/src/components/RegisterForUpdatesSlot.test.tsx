import { render, screen, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AppProviders } from '../App'
import { useAuth } from '../context/AuthContext'
import { RegisterForUpdatesSlot } from './RegisterForUpdatesSlot'

let auth: ReturnType<typeof useAuth>
function Probe() {
  auth = useAuth()
  return null
}

// citizen seed data (data/users.ts) starts homed in koramangala.
const OWN_WARD = 'koramangala'
const OTHER_WARD = 'indiranagar'

test('anonymous visitor sees a "Register for updates" button that opens the login modal with the ward pre-filled', async () => {
  const user = userEvent.setup()
  render(
    <AppProviders>
      <Probe />
      <RegisterForUpdatesSlot wardId={OTHER_WARD} />
    </AppProviders>,
  )

  await user.click(screen.getByRole('button', { name: /register for updates/i }))
  expect(screen.getByRole('dialog', { name: /sign in/i })).toBeInTheDocument()

  await user.type(screen.getByLabelText(/email or whatsapp/i), 'ward-page-registrant@example.com')
  await user.click(screen.getByRole('button', { name: /send otp/i }))
  await user.type(screen.getByLabelText(/enter the 6-digit code/i), '123456')
  await user.click(screen.getByRole('button', { name: /verify/i }))

  // Read-only ward, not a picker — the visitor never chooses, since the ward page already told us.
  expect(screen.queryByRole('combobox', { name: /home ward/i })).not.toBeInTheDocument()
  expect(screen.getByText(/indiranagar/i)).toBeInTheDocument()

  await user.click(screen.getByRole('button', { name: /finish/i }))

  expect(auth.isAuthed).toBe(true)
  expect(auth.user.homeWardId).toBe(OTHER_WARD)
})

test('registered visitor viewing their own home ward sees "Receiving updates", no control', () => {
  render(
    <AppProviders>
      <Probe />
      <RegisterForUpdatesSlot wardId={OWN_WARD} />
    </AppProviders>,
  )

  act(() => auth.loginAs('u-citizen'))

  expect(screen.getByText(/receiving updates/i)).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /register for updates/i })).not.toBeInTheDocument()
})

test('registered visitor viewing a different ward sees nothing here (switching lives on /account)', () => {
  render(
    <AppProviders>
      <Probe />
      <RegisterForUpdatesSlot wardId={OTHER_WARD} />
    </AppProviders>,
  )

  act(() => auth.loginAs('u-citizen'))

  expect(screen.queryByText(/receiving updates/i)).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /register for updates/i })).not.toBeInTheDocument()
})
