import { render, screen, within, act } from '@testing-library/react'
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

test('admin console links to roles, users, partners, and audit', () => {
  renderAt('/admin', 'u-admin')
  expect(screen.getByRole('link', { name: /roles/i })).toHaveAttribute('href', '/admin/roles')
  expect(screen.getByRole('link', { name: /users/i })).toHaveAttribute('href', '/admin/users')
  expect(screen.getByRole('link', { name: /partners/i })).toHaveAttribute('href', '/admin/partners')
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

// --- /admin/partners ---------------------------------------------------------------------------

test('non-admin (curator) is redirected away from /admin/partners', () => {
  const router = createMemoryRouter(routeObjects, { initialEntries: ['/admin/partners'] })
  localStorage.setItem('bv-auth', 'u-curator')
  render(
    <AppProviders>
      <RouterProvider router={router} />
    </AppProviders>,
  )
  expect(router.state.location.pathname).toBe('/')
})

test('anonymous visitor is redirected away from /admin/partners', () => {
  const router = createMemoryRouter(routeObjects, { initialEntries: ['/admin/partners'] })
  render(
    <AppProviders>
      <RouterProvider router={router} />
    </AppProviders>,
  )
  expect(router.state.location.pathname).toBe('/')
})

test('a curator can never see EOI applicant PII via /admin/partners — the RoleGuard blocks the page entirely', async () => {
  const user = userEvent.setup()
  const first = renderAt('/partner-with-us')
  await user.type(screen.getByLabelText(/name/i), 'Secret Applicant Name')
  await user.type(screen.getByLabelText(/email or whatsapp/i), 'secret@example.com')
  await user.click(screen.getByRole('button', { name: /submit application/i }))
  first.unmount()

  renderAt('/admin/partners', 'u-curator')
  expect(screen.queryByText('Secret Applicant Name')).not.toBeInTheDocument()
  expect(screen.queryByText('secret@example.com')).not.toBeInTheDocument()
})

test('partner coverage shows the uncovered set as a work queue, scoped against the real 369-ward denominator', () => {
  renderAt('/admin/partners', 'u-admin')
  expect(screen.getByText(/369/)).toBeInTheDocument()

  // Seed: demo-rwa-one covers koramangala, demo-civic-trust covers indiranagar + malleshwaram.
  // shivajinagar and jayanagar have no seeded partner -> the uncovered work queue.
  const uncovered = screen.getByRole('list', { name: /uncovered wards/i })
  expect(within(uncovered).getByText(/Shivajinagar/)).toBeInTheDocument()
  expect(within(uncovered).getByText(/Jayanagar/)).toBeInTheDocument()
  expect(within(uncovered).queryByText(/Koramangala/)).not.toBeInTheDocument()
  expect(within(uncovered).queryByText(/Indiranagar/)).not.toBeInTheDocument()
})

test('partner roster lists the seeded partners with a link to their kit page', () => {
  renderAt('/admin/partners', 'u-admin')
  const roster = screen.getByRole('list', { name: /partner roster/i })
  expect(
    within(roster).getByRole('link', { name: /Sample Layout Residents Welfare Association/i }),
  ).toHaveAttribute('href', '/partner/demo-rwa-one')
})

test('held wards show a reason and an admin can override the hold, and the store readiness flips immediately', async () => {
  const user = userEvent.setup()
  renderAt('/admin/partners', 'u-admin')

  // No seed ward has been signed off, so every ward is held to begin with (Task 5's own tests
  // pin this same fact about the seed).
  const heldList = screen.getByRole('list', { name: /held wards/i })
  const row = within(heldList).getByText('Koramangala').closest('li') as HTMLElement
  expect(within(row).getByText(/not yet complete|not.*signed off|sign-off/i)).toBeInTheDocument()

  await user.click(within(row).getByRole('button', { name: /override/i }))

  expect(store.wardReadiness('koramangala').overridden).toBe(true)
  expect(
    within(screen.getByRole('list', { name: /held wards/i })).queryByText('Koramangala'),
  ).not.toBeInTheDocument()
})

test('admin accepts an awareness expression of interest — it provisions a partner slug and a link to its kit', async () => {
  const user = userEvent.setup()
  const first = renderAt('/partner-with-us')
  await user.type(screen.getByLabelText(/name/i), 'Sample Layout RWA Two (fictional)')
  await user.type(screen.getByLabelText(/email or whatsapp/i), 'rwa-two@example.com')
  await user.click(screen.getByRole('button', { name: /submit application/i }))
  expect(screen.getByRole('status')).toBeInTheDocument()
  first.unmount()

  renderAt('/admin/partners', 'u-admin')
  const row = screen.getByText('Sample Layout RWA Two (fictional)').closest('li') as HTMLElement
  await user.click(within(row).getByRole('button', { name: /^accept$/i }))

  const partner = store.listPartners().find((p) => p.name === 'Sample Layout RWA Two (fictional)')
  expect(partner).toBeDefined()
  expect(store.listInterests().find((i) => i.contact === 'rwa-two@example.com')?.status).toBe(
    'accepted',
  )
  expect(
    within(row).getByRole('link', { name: new RegExp(`/partner/${partner!.slug}`) }),
  ).toHaveAttribute('href', `/partner/${partner!.slug}`)
})

test('admin accepts a curation expression of interest — hands off honestly, grants nothing automatically', async () => {
  const user = userEvent.setup()
  const first = renderAt('/partner-with-us')
  await user.click(screen.getByRole('radio', { name: /curate data/i }))
  await user.type(screen.getByLabelText(/name/i), 'Aspiring Curator')
  await user.type(screen.getByLabelText(/email or whatsapp/i), 'aspiring@example.com')
  await user.click(screen.getByRole('button', { name: /submit application/i }))
  first.unmount()

  const usersBefore = store.listUsers().length
  const partnersBefore = store.listPartners().length

  renderAt('/admin/partners', 'u-admin')
  const row = screen.getByText('Aspiring Curator').closest('li') as HTMLElement
  await user.click(within(row).getByRole('button', { name: /^accept$/i }))

  // Nobody self-activates: no account was created and no partner was provisioned. The applicant
  // is anonymous, so there is no account to grant a role to yet.
  expect(store.listUsers().length).toBe(usersBefore)
  expect(store.listPartners().length).toBe(partnersBefore)
  expect(store.listInterests().find((i) => i.contact === 'aspiring@example.com')?.status).toBe(
    'accepted',
  )
  expect(within(row).getByRole('link', { name: /roles/i })).toHaveAttribute('href', '/admin/roles')
})

test('admin rejects an application — status flips, no partner or role is ever granted', async () => {
  const user = userEvent.setup()
  const first = renderAt('/partner-with-us')
  await user.type(screen.getByLabelText(/name/i), 'Rejected Applicant')
  await user.type(screen.getByLabelText(/email or whatsapp/i), 'rejected@example.com')
  await user.click(screen.getByRole('button', { name: /submit application/i }))
  first.unmount()

  renderAt('/admin/partners', 'u-admin')
  const row = screen.getByText('Rejected Applicant').closest('li') as HTMLElement
  await user.click(within(row).getByRole('button', { name: /reject/i }))

  expect(
    store.listInterests().find((i) => i.contact === 'rejected@example.com')?.status,
  ).toBe('rejected')
  expect(store.listPartners().some((p) => p.name === 'Rejected Applicant')).toBe(false)
})

// --- Fix 1: add/edit partners directly (IA §6.4) ------------------------------------------------

test('admin adds a partner directly (no EOI) — it appears in the roster with a link to its kit', async () => {
  const user = userEvent.setup()
  renderAt('/admin/partners', 'u-admin')

  const form = screen.getByRole('form', { name: /add a partner/i })
  await user.type(within(form).getByLabelText(/partner name/i), 'Directly Added Org (fictional)')
  await user.selectOptions(within(form).getByLabelText(/partner type/i), 'ngo')
  await user.click(within(form).getByLabelText('Jayanagar'))
  await user.click(within(form).getByRole('button', { name: /add partner/i }))

  const created = store.listPartners().find((p) => p.name === 'Directly Added Org (fictional)')
  expect(created).toBeDefined()
  expect(created?.kind).toBe('ngo')
  expect(created?.wardIds).toEqual(['jayanagar'])
  expect(created?.interestId).toBeUndefined()

  const roster = screen.getByRole('list', { name: /partner roster/i })
  expect(
    within(roster).getByRole('link', { name: /Directly Added Org \(fictional\)/i }),
  ).toHaveAttribute('href', `/partner/${created!.slug}`)
})

test('a non-admin can never reach the add-partner form (RoleGuard blocks the whole page)', () => {
  const router = createMemoryRouter(routeObjects, { initialEntries: ['/admin/partners'] })
  localStorage.setItem('bv-auth', 'u-curator')
  render(
    <AppProviders>
      <RouterProvider router={router} />
    </AppProviders>,
  )
  expect(screen.queryByRole('form', { name: /add a partner/i })).not.toBeInTheDocument()
})

test('admin edits an existing partner\'s name/kind/wards — the slug stays the same, so its kit link never breaks', async () => {
  const user = userEvent.setup()
  renderAt('/admin/partners', 'u-admin')

  const originalSlug = store.listPartners().find((p) => p.slug === 'demo-rwa-one')!.slug
  const row = screen.getByText(/Sample Layout Residents Welfare Association/i).closest('li') as HTMLElement
  await user.click(within(row).getByRole('button', { name: /edit/i }))

  const nameInput = within(row).getByLabelText(/partner name/i)
  await user.clear(nameInput)
  await user.type(nameInput, 'Renamed Layout Association (fictional demo partner)')
  await user.selectOptions(within(row).getByLabelText(/partner type/i), 'other')
  await user.click(within(row).getByRole('button', { name: /^save$/i }))

  const updated = store.getPartner(originalSlug)
  expect(updated?.slug).toBe(originalSlug)
  expect(updated?.name).toBe('Renamed Layout Association (fictional demo partner)')
  expect(updated?.kind).toBe('other')

  // The kit link in the roster now points at the SAME slug — an already-shared /partner/{slug}
  // or ?src={slug} link is never broken by a rename.
  expect(
    screen.getByRole('link', { name: /Renamed Layout Association/i }),
  ).toHaveAttribute('href', `/partner/${originalSlug}`)
})

// --- Fix 2: registrations attributed per partner (IA §6.4), aggregate counts only ---------------

test('partner roster shows the aggregate registration count attributed to each partner', () => {
  renderAt('/admin/partners', 'u-admin')
  // Attribute two registrations to demo-rwa-one, none to demo-civic-trust. Store mutations
  // notify subscribers, and this page calls useStoreVersion(), so it re-renders immediately —
  // wrapped in act() since these calls happen outside a user-event-driven interaction.
  act(() => {
    store.createUser({ contact: 'via-partner-1@example.com', src: 'demo-rwa-one' })
    store.createUser({ contact: 'via-partner-2@example.com', src: 'demo-rwa-one' })
  })

  const rwaRow = screen.getByText(/Sample Layout Residents Welfare Association/i).closest('li') as HTMLElement
  const trustRow = screen.getByText(/Placeholder Civic Trust/i).closest('li') as HTMLElement

  expect(within(rwaRow).getByText(/2 registrations attributed/i)).toBeInTheDocument()
  expect(within(trustRow).getByText(/0 registrations attributed/i)).toBeInTheDocument()

  // No citizen name/contact is ever rendered on this admin page as a result of attribution.
  expect(screen.queryByText('via-partner-1@example.com')).not.toBeInTheDocument()
})

// --- Fix 3: partner<->interest linkage is a real foreign key, not a name-match ------------------

test('accepting an awareness EOI whose applicant name collides with an existing partner still links to its OWN kit, not the pre-existing one', async () => {
  const user = userEvent.setup()
  const setup = renderAt('/admin/partners', 'u-admin')

  // A partner with this exact name already exists (added directly, no EOI) BEFORE the EOI below
  // is even submitted — the old name-match lookup would have found this pre-existing partner
  // instead of the one this specific application provisions.
  let preExisting!: ReturnType<typeof store.createPartner>
  act(() => {
    preExisting = store.createPartner(
      { name: 'Colliding Name Org (fictional)', kind: 'other', wardIds: ['shivajinagar'] },
      store.listUsers().find((u) => u.role === 'admin')!,
    )
  })
  setup.unmount()

  const first = renderAt('/partner-with-us')
  await user.type(screen.getByLabelText(/name/i), 'Colliding Name Org (fictional)')
  await user.type(screen.getByLabelText(/email or whatsapp/i), 'colliding@example.com')
  await user.click(screen.getByRole('button', { name: /submit application/i }))
  first.unmount()

  renderAt('/admin/partners', 'u-admin')
  const row = screen.getByText('colliding@example.com').closest('li') as HTMLElement
  await user.click(within(row).getByRole('button', { name: /^accept$/i }))

  const interest = store.listInterests().find((i) => i.contact === 'colliding@example.com')!
  const provisioned = store.listPartners().find((p) => p.interestId === interest.id)
  expect(provisioned).toBeDefined()
  expect(provisioned!.slug).not.toBe(preExisting.slug)

  // The row's rendered kit link points at the newly-provisioned partner's own slug, not the
  // pre-existing, name-colliding one.
  expect(
    within(row).getByRole('link', { name: new RegExp(`/partner/${provisioned!.slug}`) }),
  ).toHaveAttribute('href', `/partner/${provisioned!.slug}`)
})
