import { render, screen, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { routeObjects } from './routes'
import { AppProviders } from './App'
import { useAuth } from './context/AuthContext'
import { useData } from './context/DataContext'
import { useModal } from './context/ModalContext'

// sessionStorage backs the ?src= capture (see lib/attribution.ts) and is NOT reset by
// src/test/setup.ts's afterEach (that only clears localStorage) — clear it ourselves so a src
// captured in one test can't leak into the next.
afterEach(() => sessionStorage.clear())

let auth: ReturnType<typeof useAuth>
let data: ReturnType<typeof useData>
let modal: ReturnType<typeof useModal>
function Probe() {
  auth = useAuth()
  data = useData()
  modal = useModal()
  return null
}

async function registerViaModal(user: ReturnType<typeof userEvent.setup>, contact: string) {
  act(() => modal.openLogin())
  await user.type(screen.getByLabelText(/email or whatsapp/i), contact)
  await user.click(screen.getByRole('button', { name: /send otp/i }))
  await user.type(screen.getByLabelText(/enter the 6-digit code/i), '123456')
  await user.click(screen.getByRole('button', { name: /verify/i }))
  await user.selectOptions(screen.getByLabelText(/home ward/i), 'koramangala')
  await user.click(screen.getByRole('button', { name: /finish/i }))
}

test('?src= survives navigation away from the tagged URL and lands on the user record at registration', async () => {
  const user = userEvent.setup()
  const router = createMemoryRouter(routeObjects, { initialEntries: ['/?src=demo-rwa-one'] })
  render(
    <AppProviders>
      <Probe />
      <RouterProvider router={router} />
    </AppProviders>,
  )

  // Navigate away — the address bar no longer carries ?src=, but attribution must still apply.
  await user.click(screen.getByRole('link', { name: /check your registration/i }))
  expect(router.state.location.pathname).toBe('/check-registration')
  expect(router.state.location.search).toBe('')

  await registerViaModal(user, 'attributed-visitor@example.com')

  expect(auth.isAuthed).toBe(true)
  const created = data.listUsers().find((u) => u.contact === 'attributed-visitor@example.com')
  expect(created?.src).toBe('demo-rwa-one')
})

test('?src= grants no permissions and changes nothing else about the registered citizen', async () => {
  const user = userEvent.setup()
  const router = createMemoryRouter(routeObjects, { initialEntries: ['/?src=demo-rwa-one'] })
  render(
    <AppProviders>
      <Probe />
      <RouterProvider router={router} />
    </AppProviders>,
  )
  await registerViaModal(user, 'attributed-role-check@example.com')

  // A citizen registered via a partner-tagged link is a completely ordinary citizen — same
  // role, no elevated scope, nothing unlocked by the attribution.
  expect(auth.role).toBe('citizen')
  expect(auth.user.curatorWardIds).toBeUndefined()
  const created = data.listUsers().find((u) => u.contact === 'attributed-role-check@example.com')
  expect(created?.role).toBe('citizen')
})

test('a visit with no ?src= registers a user with no attribution', async () => {
  const user = userEvent.setup()
  const router = createMemoryRouter(routeObjects, { initialEntries: ['/'] })
  render(
    <AppProviders>
      <Probe />
      <RouterProvider router={router} />
    </AppProviders>,
  )
  await registerViaModal(user, 'no-src@example.com')
  const created = data.listUsers().find((u) => u.contact === 'no-src@example.com')
  expect(created?.src).toBeUndefined()
})
