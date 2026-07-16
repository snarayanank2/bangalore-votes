import { render, screen, within, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { routeObjects } from '../../routes'
import { AppProviders } from '../../App'
import { useData } from '../../context/DataContext'
import { useI18n } from '../../context/I18nContext'

let store: ReturnType<typeof useData>
let i18n: ReturnType<typeof useI18n>
function Probe() {
  store = useData()
  i18n = useI18n()
  return null
}

/**
 * Renders `path` inside the full route tree. `as`, if given, logs in BEFORE the router mounts
 * (by pre-seeding AuthContext's localStorage key, which its useState initializer reads
 * synchronously) — required for any /account or /curator route: RoleGuard redirects an
 * anonymous visitor to '/' via `<Navigate replace>` on the FIRST render, and that redirect
 * already happened by the time a later `act(() => auth.loginAs(...))` would run, so logging in
 * after the fact does not bring the router back to `path`. This mirrors real behavior too — an
 * anonymous visitor hitting a gated URL bounces to home and stays there until they navigate to
 * it again, deliberately, once logged in.
 */
function renderAt(path: string, as?: string) {
  if (as) localStorage.setItem('bv-auth', as)
  const router = createMemoryRouter(routeObjects, { initialEntries: [path] })
  return render(
    <AppProviders>
      <Probe />
      <RouterProvider router={router} />
    </AppProviders>,
  )
}

// --- /account ------------------------------------------------------------------------------

test('anonymous visitor is redirected away from /account', () => {
  const router = createMemoryRouter(routeObjects, { initialEntries: ['/account'] })
  render(
    <AppProviders>
      <RouterProvider router={router} />
    </AppProviders>,
  )
  expect(router.state.location.pathname).toBe('/')
})

test('shows the logged-in citizen basic profile', () => {
  renderAt('/account', 'u-citizen')

  // getAllByText (not getByText): "Asha Rao" legitimately appears twice within <main> — once in
  // the page's own subheading ("Asha Rao · asha@example.com") and once in the Profile section's
  // Name row — plus a third time in the AppBar's account link, which is why this is additionally
  // scoped to <main>.
  const main = within(screen.getByRole('main'))
  expect(main.getAllByText(/asha rao/i).length).toBeGreaterThan(0)
  expect(main.getAllByText(/asha@example\.com/i).length).toBeGreaterThan(0)
})

test('changing the saved language preference persists it on the user record', async () => {
  const user = userEvent.setup()
  renderAt('/account', 'u-citizen')

  // getByRole (not getByLabelText): the page's <section aria-labelledby="language-heading">
  // shares the accessible name "Language" fragment-matching /language/i with the select's own
  // <label>, so getByLabelText matches both — getByRole('combobox', ...) unambiguously targets
  // just the form control.
  await user.selectOptions(screen.getByRole('combobox', { name: /language/i }), 'kn')

  expect(store.listUsers().find((u) => u.id === 'u-citizen')?.language).toBe('kn')
  expect(i18n.lang).toBe('kn') // saved preference also drives the session-wide toggle
})

test('changing the home ward select persists it on the user record', async () => {
  const user = userEvent.setup()
  renderAt('/account', 'u-citizen')

  // getByRole (not getByLabelText): the page's <section aria-labelledby="ward-heading"> shares
  // the same accessible name ("Home ward") as the <select>'s own <label>, so getByLabelText
  // matches both the section and the select — getByRole('combobox', ...) unambiguously targets
  // just the form control.
  await user.selectOptions(screen.getByRole('combobox', { name: /home ward/i }), 'indiranagar')

  expect(store.listUsers().find((u) => u.id === 'u-citizen')?.homeWardId).toBe('indiranagar')
})

// --- /account/notifications ------------------------------------------------------------------

test('notifications page discloses that delivery is simulated', () => {
  renderAt('/account/notifications', 'u-citizen')

  expect(screen.getByText(/simulated/i)).toBeInTheDocument()
})

test('toggling a channel and a subscription persists both on the user record', async () => {
  const user = userEvent.setup()
  renderAt('/account/notifications', 'u-citizen')

  await user.click(screen.getByLabelText(/email/i))
  await user.click(screen.getByLabelText(/election date|election notice/i))

  const updated = store.listUsers().find((u) => u.id === 'u-citizen')
  expect(updated?.notificationPrefs?.emailEnabled).toBe(true)
  expect(updated?.notificationPrefs?.subscriptions.electionNotice).toBe(true)
})

test('toggling a preference does not write an audit entry (personal setting, not published data)', async () => {
  const user = userEvent.setup()
  renderAt('/account/notifications', 'u-citizen')
  const before = store.listAudit().length

  await user.click(screen.getByLabelText(/whatsapp/i))

  expect(store.listAudit().length).toBe(before)
})

// --- /account/submissions --------------------------------------------------------------------

test("lists the citizen's own flags with a status pill for each of pending/accepted/rejected", () => {
  renderAt('/account/submissions', 'u-citizen')

  // Seed: sub-1 pending (assets), sub-2 accepted (trackRecord), sub-3 rejected (pendingCases) —
  // all three already belong to u-citizen (src/data/submissions.ts).
  // Exact, case-sensitive matches for the three status pills — a loose /pending/i regex also
  // matches sub-3's field heading "Criminal record / pending cases", which is a false positive,
  // not a real second "Pending" pill.
  expect(screen.getByText(/declared assets/i)).toBeInTheDocument()
  expect(screen.getByText('Pending')).toBeInTheDocument()
  expect(screen.getByText('Accepted')).toBeInTheDocument()
  expect(screen.getByText('Rejected')).toBeInTheDocument()
})

test('shows the rejection reason for a rejected submission', () => {
  renderAt('/account/submissions', 'u-citizen')

  expect(screen.getByText(/no court record found supporting withdrawal/i)).toBeInTheDocument()
})

test("never shows another user's submissions", () => {
  renderAt('/account/submissions', 'u-citizen')
  act(() => {
    // A second citizen flags something unrelated; only u-citizen is logged in here.
    const other = store.createUser({ contact: 'other.citizen@example.com', homeWardId: 'malleshwaram' })
    store.submitFlag(
      { wardId: 'malleshwaram', field: 'trackRecord', detail: 'unrelated flag by another user' },
      other,
    )
  })

  expect(screen.queryByText(/unrelated flag by another user/i)).not.toBeInTheDocument()
})
