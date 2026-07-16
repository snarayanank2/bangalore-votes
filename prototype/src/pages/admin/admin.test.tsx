import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { routeObjects } from '../../routes'
import { AppProviders } from '../../App'
import { useData } from '../../context/DataContext'

let store: ReturnType<typeof useData>
function Probe() {
  store = useData()
  return null
}

/** Mirrors the `renderAt` helper in curator's queue.test.tsx / edit.test.tsx. */
function renderAt(path: string, as?: string) {
  if (as) localStorage.setItem('bv-auth', as)
  const router = createMemoryRouter(routeObjects, { initialEntries: [path] })
  const view = render(
    <AppProviders>
      <Probe />
      <RouterProvider router={router} />
    </AppProviders>,
  )
  return { router, ...view }
}

// --- /admin (console) ----------------------------------------------------------------------------

test('non-admin (curator) is redirected away from /admin', () => {
  const router = createMemoryRouter(routeObjects, { initialEntries: ['/admin'] })
  localStorage.setItem('bv-auth', 'u-curator')
  render(
    <AppProviders>
      <RouterProvider router={router} />
    </AppProviders>,
  )
  expect(router.state.location.pathname).toBe('/')
})

test('anonymous visitor is redirected away from /admin', () => {
  const router = createMemoryRouter(routeObjects, { initialEntries: ['/admin'] })
  render(
    <AppProviders>
      <RouterProvider router={router} />
    </AppProviders>,
  )
  expect(router.state.location.pathname).toBe('/')
})

test('admin console links to roles, users, and audit', () => {
  renderAt('/admin', 'u-admin')
  expect(screen.getByRole('link', { name: /roles/i })).toHaveAttribute('href', '/admin/roles')
  expect(screen.getByRole('link', { name: /users/i })).toHaveAttribute('href', '/admin/users')
  expect(screen.getByRole('link', { name: /audit/i })).toHaveAttribute('href', '/admin/audit')
})

// --- /admin/roles ----------------------------------------------------------------------------

test('admin grants the curator role with a ward scope to a citizen', async () => {
  const user = userEvent.setup()
  renderAt('/admin/roles', 'u-admin')

  const row = screen.getByText('Asha Rao').closest('li') as HTMLElement
  await user.selectOptions(within(row).getByLabelText(/role/i), 'curator')
  await user.click(within(row).getByLabelText(/Malleshwaram/i))
  await user.click(within(row).getByRole('button', { name: /save/i }))

  const updated = store.listUsers().find((u) => u.id === 'u-citizen')
  expect(updated?.role).toBe('curator')
  expect(updated?.curatorWardIds).toEqual(['malleshwaram'])
})

test('admin revokes the curator role — store clears curatorWardIds (documented store behaviour)', async () => {
  const user = userEvent.setup()
  renderAt('/admin/roles', 'u-admin')

  const row = screen.getByText('Vikram Shet').closest('li') as HTMLElement
  await user.selectOptions(within(row).getByLabelText(/role/i), 'citizen')
  await user.click(within(row).getByRole('button', { name: /save/i }))

  const updated = store.listUsers().find((u) => u.id === 'u-curator')
  expect(updated?.role).toBe('citizen')
  expect(updated?.curatorWardIds).toBeUndefined()
})

// --- /admin/users ----------------------------------------------------------------------------

test('admin toggles a user inactive, and listUsers() reflects active:false', async () => {
  const user = userEvent.setup()
  renderAt('/admin/users', 'u-admin')

  const row = screen.getByText('Asha Rao').closest('li') as HTMLElement
  await user.click(within(row).getByRole('button', { name: /deactivate/i }))

  expect(store.listUsers().find((u) => u.id === 'u-citizen')?.active).toBe(false)
  expect(within(row).getByRole('button', { name: /reactivate/i })).toBeInTheDocument()
})

test('reactivating flips active back to true', async () => {
  const user = userEvent.setup()
  renderAt('/admin/users', 'u-admin')

  const row = screen.getByText('Asha Rao').closest('li') as HTMLElement
  await user.click(within(row).getByRole('button', { name: /deactivate/i }))
  await user.click(within(row).getByRole('button', { name: /reactivate/i }))

  expect(store.listUsers().find((u) => u.id === 'u-citizen')?.active).toBe(true)
})

test('search filters the user list by name/contact', async () => {
  const user = userEvent.setup()
  renderAt('/admin/users', 'u-admin')

  await user.type(screen.getByLabelText(/search/i), 'vikram')

  expect(screen.getByText('Vikram Shet')).toBeInTheDocument()
  expect(screen.queryByText('Asha Rao')).not.toBeInTheDocument()
})

test('viewing a user shows their submission history', async () => {
  const user = userEvent.setup()
  renderAt('/admin/users', 'u-admin')

  const row = screen.getByText('Asha Rao').closest('li') as HTMLElement
  await user.click(within(row).getByRole('button', { name: /view submissions/i }))

  // u-citizen submitted sub-1 (seed data) — asset field on koramangala-r-menon.
  expect(within(row).getByText(/declared assets/i)).toBeInTheDocument()
})

// --- /admin/audit ----------------------------------------------------------------------------

test('audit log shows seed rows, newest first', () => {
  renderAt('/admin/audit', 'u-admin')

  const rows = screen.getAllByRole('row')
  // header row + at least the two seeded audit entries.
  expect(rows.length).toBeGreaterThanOrEqual(3)
  // audit-2 (indiranagar, later) should render before audit-1 (koramangala, earlier).
  const bodyText = screen.getByRole('table').textContent ?? ''
  expect(bodyText.indexOf('Priya Shetty')).toBeGreaterThanOrEqual(0)
  expect(bodyText.indexOf('Refreshed asset summary')).toBeLessThan(
    bodyText.indexOf('Corrected track-record wording'),
  )
})

test('audit log never renders individual issue-vote choices — only listAudit() content', () => {
  renderAt('/admin/audit', 'u-admin')
  // Seed issue votes reference specific issue ids/users — none of that should ever leak here.
  expect(screen.queryByText(/kor-roads/i)).not.toBeInTheDocument()
  expect(screen.queryByText(/kor-water/i)).not.toBeInTheDocument()
})

test('audit reflects a fresh mutation immediately (e.g. after a role change elsewhere)', async () => {
  const user = userEvent.setup()
  const first = renderAt('/admin/roles', 'u-admin')
  const row = screen.getByText('Asha Rao').closest('li') as HTMLElement
  await user.selectOptions(within(row).getByLabelText(/role/i), 'curator')
  await user.click(within(row).getByLabelText(/Koramangala/i))
  await user.click(within(row).getByRole('button', { name: /save/i }))
  first.unmount()

  renderAt('/admin/audit', 'u-admin')
  expect(screen.getByText(/role=curator/i)).toBeInTheDocument()
})

test('audit log never renders a raw t{n} counter stamp — a store-generated entry shows as a "Demo event"', async () => {
  const user = userEvent.setup()
  const first = renderAt('/admin/roles', 'u-admin')
  const row = screen.getByText('Asha Rao').closest('li') as HTMLElement
  await user.selectOptions(within(row).getByLabelText(/role/i), 'curator')
  await user.click(within(row).getByLabelText(/Koramangala/i))
  await user.click(within(row).getByRole('button', { name: /save/i }))
  first.unmount()

  renderAt('/admin/audit', 'u-admin')
  const bodyText = screen.getByRole('table').textContent ?? ''
  expect(bodyText).toMatch(/Demo event #\d+/)
  expect(bodyText).not.toMatch(/\bt\d+\b/)
})
