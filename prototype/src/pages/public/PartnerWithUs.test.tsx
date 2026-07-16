import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { routeObjects } from '../../routes'
import { AppProviders } from '../../App'
import { useAuth } from '../../context/AuthContext'
import { useData } from '../../context/DataContext'

function renderAt(path: string) {
  const router = createMemoryRouter(routeObjects, { initialEntries: [path] })
  render(
    <AppProviders>
      <RouterProvider router={router} />
    </AppProviders>,
  )
  return within(screen.getByRole('main'))
}

test('/partner-with-us renders its <h1>', () => {
  const main = renderAt('/partner-with-us')
  expect(main.getByRole('heading', { level: 1, name: /partner with us/i })).toBeInTheDocument()
})

test('states both paths, each with a time commitment and a vetting/neutrality expectation', () => {
  const main = renderAt('/partner-with-us')
  expect(main.getByRole('heading', { name: /spread awareness/i })).toBeInTheDocument()
  expect(main.getByRole('heading', { name: /curate data/i })).toBeInTheDocument()
  expect(main.getAllByText(/time commitment/i).length).toBe(2)
  expect(main.getAllByText(/vetting|neutrality|endorsement|trust you first/i).length).toBeGreaterThanOrEqual(2)
})

test('one form covers both paths via a path selector', () => {
  const main = renderAt('/partner-with-us')
  expect(main.getByRole('radio', { name: /spread awareness/i })).toBeInTheDocument()
  expect(main.getByRole('radio', { name: /curate data/i })).toBeInTheDocument()
  // Exactly one submit button — one shared form, not two separate ones.
  expect(main.getAllByRole('button', { name: /submit/i })).toHaveLength(1)
})

test('the form does not require an account: no sign-in prompt/link gates it, and there is no requireAuth wall', () => {
  const main = renderAt('/partner-with-us')
  expect(main.queryByRole('button', { name: /sign in/i })).not.toBeInTheDocument()
  expect(main.getByRole('button', { name: /submit/i })).toBeInTheDocument()
})

test('submitting the anonymous form succeeds without ever logging in, and lands pending (nobody self-activates)', async () => {
  const user = userEvent.setup()
  let auth: ReturnType<typeof useAuth>
  let data: ReturnType<typeof useData>
  function Probe() {
    auth = useAuth()
    data = useData()
    return null
  }
  const router = createMemoryRouter(routeObjects, { initialEntries: ['/partner-with-us'] })
  render(
    <AppProviders>
      <Probe />
      <RouterProvider router={router} />
    </AppProviders>,
  )
  const main = within(screen.getByRole('main'))

  await user.type(main.getByLabelText(/name/i), 'Test Resident')
  await user.type(main.getByLabelText(/email or whatsapp/i), 'volunteer@example.com')
  await user.click(main.getByRole('button', { name: /submit/i }))

  expect(auth!.isAuthed).toBe(false) // never logged in
  const stored = data!.listInterests().find((i) => i.contact === 'volunteer@example.com')
  expect(stored?.status).toBe('pending') // queued for an admin, not auto-granted anything
  expect(main.getAllByText(/pending|review/i).length).toBeGreaterThan(0)
})

test('a second submission from the same contact while the first is still pending is refused with a visible error (rate-limit guard)', async () => {
  const user = userEvent.setup()
  const router = createMemoryRouter(routeObjects, { initialEntries: ['/about'] })
  render(
    <AppProviders>
      <RouterProvider router={router} />
    </AppProviders>,
  )

  // First submission, navigating via a real footer link (not router.navigate directly).
  await user.click(screen.getByRole('link', { name: /partner with us/i }))
  let main = within(screen.getByRole('main'))
  await user.type(main.getByLabelText(/name/i), 'First')
  await user.type(main.getByLabelText(/email or whatsapp/i), 'rate-limited@example.com')
  await user.click(main.getByRole('button', { name: /submit/i }))
  await screen.findAllByText(/pending admin review/i)

  // Navigate away and back via real links, then try again with the same contact.
  await user.click(screen.getByRole('link', { name: /^about/i }))
  await user.click(screen.getByRole('link', { name: /partner with us/i }))
  main = within(screen.getByRole('main'))
  await user.type(main.getByLabelText(/name/i), 'Second')
  await user.type(main.getByLabelText(/email or whatsapp/i), 'rate-limited@example.com')
  await user.click(main.getByRole('button', { name: /submit/i }))

  expect(main.getByRole('alert')).toHaveTextContent(/already have a pending application/i)
})
