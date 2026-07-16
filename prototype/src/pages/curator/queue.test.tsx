import { render, screen, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { routeObjects } from '../../routes'
import { AppProviders } from '../../App'
import { useData } from '../../context/DataContext'
import type { User } from '../../types'

let store: ReturnType<typeof useData>
function Probe() {
  store = useData()
  return null
}

/** Mirrors the `renderAt` helper in `account.test.tsx` — logs in BEFORE the router mounts by
 * pre-seeding AuthContext's localStorage key, required for any /curator route since RoleGuard
 * redirects an anonymous visitor on the FIRST render. */
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

function curatorUser(): User {
  return store.listUsers().find((u) => u.id === 'u-curator') as User
}

// --- /curator (dashboard) --------------------------------------------------------------------

test('anonymous visitor is redirected away from /curator', () => {
  const router = createMemoryRouter(routeObjects, { initialEntries: ['/curator'] })
  render(
    <AppProviders>
      <RouterProvider router={router} />
    </AppProviders>,
  )
  expect(router.state.location.pathname).toBe('/')
})

test('dashboard shows the pending count scoped to the curator — only sub-1 (koramangala) counts', () => {
  renderAt('/curator', 'u-curator')

  // Seed: sub-1 pending/koramangala, sub-2 accepted/koramangala, sub-3 rejected/indiranagar.
  // Only sub-1 is pending, so the scoped count must be exactly 1.
  expect(screen.getByText(/1 pending review/i)).toBeInTheDocument()
})

test('admin dashboard sees the citywide pending count', () => {
  renderAt('/curator', 'u-admin')
  expect(screen.getByText(/1 pending review/i)).toBeInTheDocument()
})

// --- /curator/queue ---------------------------------------------------------------------------

test('queue lists only the pending, in-scope submission with its flag count', () => {
  renderAt('/curator/queue', 'u-curator')

  expect(screen.getByText(/declared assets/i)).toBeInTheDocument()
  // sub-1's dedup count is 2 — a strong signal, must be visibly surfaced.
  expect(screen.getByText(/2 flags/i)).toBeInTheDocument()
  // sub-2 (accepted) and sub-3 (rejected) must not appear even though they exist in seed data.
  expect(screen.queryByText(/co-led with two other volunteers/i)).not.toBeInTheDocument()
  expect(screen.queryByText(/motor vehicle case/i)).not.toBeInTheDocument()
})

test('a curator outside a ward never sees that ward\'s queue items', () => {
  renderAt('/curator/queue', 'u-curator')
  // u-curator only covers koramangala + indiranagar — nothing from malleshwaram/shivajinagar/
  // jayanagar should ever render here even if seeded.
  act(() => {
    const citizen = store.listUsers().find((u) => u.id === 'u-citizen') as User
    store.submitFlag(
      { wardId: 'malleshwaram', field: 'trackRecord', detail: 'unrelated out-of-scope flag' },
      citizen,
    )
  })
  expect(screen.queryByText(/unrelated out-of-scope flag/i)).not.toBeInTheDocument()
})

// --- /curator/queue/:submissionId — the full accept loop --------------------------------------

test('unknown submission id is handled gracefully, not a crash', () => {
  renderAt('/curator/queue/does-not-exist', 'u-curator')
  expect(screen.getByText(/couldn.t find that submission/i)).toBeInTheDocument()
})

test('FULL LOOP: curator accepts sub-1 with a new value + source — publishes immediately, audits, clears the queue', async () => {
  const user = userEvent.setup()
  const { router } = renderAt('/curator/queue/sub-1', 'u-curator')

  const auditBefore = store.listAudit().length

  const valueBox = screen.getByLabelText(/corrected value/i)
  await user.clear(valueBox)
  await user.type(
    valueBox,
    'Declared assets updated to approximately Rs 1.5 crore following a 2024 property sale.',
  )
  await user.type(screen.getByLabelText(/source label/i), 'Sub-registrar office confirmation')
  await user.type(screen.getByLabelText(/source url/i), 'https://example.com/registrar-confirmation')

  await user.click(screen.getByRole('button', { name: /accept.*publish/i }))

  // (a) candidate's assets value AND source updated
  const candidate = store.getCandidate('koramangala-r-menon')
  expect(candidate?.assets.value).toBe(
    'Declared assets updated to approximately Rs 1.5 crore following a 2024 property sale.',
  )
  expect(candidate?.assets.source.label).toBe('Sub-registrar office confirmation')
  expect(candidate?.assets.source.url).toBe('https://example.com/registrar-confirmation')

  // (b) submission status is now accepted
  expect(store.getSubmission('sub-1')?.status).toBe('accepted')

  // (c) audit log grew by exactly one
  expect(store.listAudit().length).toBe(auditBefore + 1)

  // (d) no longer in the curator's queue
  expect(store.listQueueForCurator(curatorUser()).find((s) => s.id === 'sub-1')).toBeUndefined()

  // redirected back to the queue
  expect(router.state.location.pathname).toBe('/curator/queue')
})

test('accept is refused without a source label (mandatory provenance)', async () => {
  const user = userEvent.setup()
  renderAt('/curator/queue/sub-1', 'u-curator')

  await user.click(screen.getByRole('button', { name: /accept.*publish/i }))

  expect(screen.getByRole('alert')).toHaveTextContent(/source/i)
  // Nothing was published.
  expect(store.getSubmission('sub-1')?.status).toBe('pending')
})

test('reject requires a reason, then routes back to the queue and shows the reason to the submitter', async () => {
  const user = userEvent.setup()
  const { router } = renderAt('/curator/queue/sub-1', 'u-curator')

  await user.click(screen.getByRole('button', { name: /reject/i }))
  expect(screen.getByRole('alert')).toHaveTextContent(/reason/i)

  await user.type(screen.getByLabelText(/reason/i), 'Affidavit figure already reflects the 2024 sale.')
  await user.click(screen.getByRole('button', { name: /reject/i }))

  const sub = store.getSubmission('sub-1')
  expect(sub?.status).toBe('rejected')
  expect(sub?.reason).toBe('Affidavit figure already reflects the 2024 sale.')
  expect(router.state.location.pathname).toBe('/curator/queue')
})

test('curator cannot act outside their ward scope — store error surfaces inline, no crash', async () => {
  const user = userEvent.setup()
  let outOfScopeId = ''
  act(() => {
    const citizen = store.listUsers().find((u) => u.id === 'u-citizen') as User
    const sub = store.submitFlag(
      { wardId: 'malleshwaram', field: 'trackRecord', detail: 'out of scope for u-curator' },
      citizen,
    )
    outOfScopeId = sub.id
  })

  const { router } = renderAt(`/curator/queue/${outOfScopeId}`, 'u-curator')

  await user.type(screen.getByLabelText(/corrected value/i), 'Some replacement text.')
  await user.type(screen.getByLabelText(/source label/i), 'Some source')
  await user.click(screen.getByRole('button', { name: /accept.*publish/i }))

  expect(screen.getByRole('alert')).toHaveTextContent(/scope/i)
  // Did not crash, did not navigate away, did not publish.
  expect(store.getSubmission(outOfScopeId)?.status).toBe('pending')
  expect(router.state.location.pathname).toBe(`/curator/queue/${outOfScopeId}`)
})

test('admin bypasses ward scope entirely', async () => {
  const user = userEvent.setup()
  let outOfScopeId = ''
  act(() => {
    const citizen = store.listUsers().find((u) => u.id === 'u-citizen') as User
    const sub = store.submitFlag(
      { wardId: 'malleshwaram', field: 'trackRecord', detail: 'admin can still act here' },
      citizen,
    )
    outOfScopeId = sub.id
  })

  renderAt(`/curator/queue/${outOfScopeId}`, 'u-admin')

  await user.type(screen.getByLabelText(/reason/i), 'Not credible, no source given.')
  await user.click(screen.getByRole('button', { name: /reject/i }))

  expect(store.getSubmission(outOfScopeId)?.status).toBe('rejected')
})
