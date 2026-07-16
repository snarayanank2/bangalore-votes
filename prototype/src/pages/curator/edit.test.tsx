import { render, screen } from '@testing-library/react'
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

/** Mirrors the `renderAt` helper in `queue.test.tsx` — logs in BEFORE the router mounts by
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

// --- /curator/candidate/:candidateId -----------------------------------------------------------

test('unknown candidate id is handled gracefully, not a crash', () => {
  renderAt('/curator/candidate/does-not-exist', 'u-curator')
  expect(screen.getByText(/couldn.t find that candidate/i)).toBeInTheDocument()
})

test('route param is the candidate ID (not slug) — resolves via the store correctly', () => {
  // c-kor-1's slug is koramangala-r-menon; the route only ever carries the id.
  renderAt('/curator/candidate/c-kor-1', 'u-curator')
  expect(screen.getByRole('heading', { name: /radhika menon/i })).toBeInTheDocument()
})

test('curator edits a sourced field with a new value and source — publishes immediately and audits', async () => {
  const user = userEvent.setup()
  renderAt('/curator/candidate/c-kor-1', 'u-curator')
  const auditBefore = store.listAudit().length

  const valueBox = screen.getByLabelText(/declared assets value/i)
  await user.clear(valueBox)
  await user.type(valueBox, 'Updated declared assets figure following a fresh filing.')

  const labelBox = screen.getByLabelText(/declared assets source label/i)
  await user.clear(labelBox)
  await user.type(labelBox, 'Fresh EC affidavit filing')

  await user.click(screen.getByRole('button', { name: /save changes/i }))

  const candidate = store.getCandidate('koramangala-r-menon')
  expect(candidate?.assets.value).toBe('Updated declared assets figure following a fresh filing.')
  expect(candidate?.assets.source.label).toBe('Fresh EC affidavit filing')
  expect(store.listAudit().length).toBe(auditBefore + 1)
  expect(screen.getByText(/saved/i)).toBeInTheDocument()
})

test('save is refused if a field is cleared of its source label — every field must stay sourced', async () => {
  const user = userEvent.setup()
  renderAt('/curator/candidate/c-kor-1', 'u-curator')

  const labelBox = screen.getByLabelText(/declared assets source label/i)
  await user.clear(labelBox)

  await user.click(screen.getByRole('button', { name: /save changes/i }))

  expect(screen.getByRole('alert')).toHaveTextContent(/source/i)
  // Nothing was published.
  const candidate = store.getCandidate('koramangala-r-menon')
  expect(candidate?.assets.source.label).toBe('EC affidavit')
})

test('curator can add and remove a news link, and it persists on save', async () => {
  const user = userEvent.setup()
  renderAt('/curator/candidate/c-kor-1', 'u-curator')

  await user.type(screen.getByLabelText(/news title/i), 'New coverage of the campaign')
  await user.type(screen.getByLabelText(/news url/i), 'https://example.com/news')
  await user.type(screen.getByLabelText(/news publisher/i), 'Example Times')
  await user.click(screen.getByRole('button', { name: /add news link/i }))

  expect(screen.getByText('New coverage of the campaign')).toBeInTheDocument()

  // Remove the original seeded news item.
  await user.click(screen.getByRole('button', { name: /remove.*drain desilting/i }))
  expect(screen.queryByText(/faster drain desilting/i)).not.toBeInTheDocument()

  await user.click(screen.getByRole('button', { name: /save changes/i }))

  const candidate = store.getCandidate('koramangala-r-menon')
  expect(candidate?.news).toHaveLength(1)
  expect(candidate?.news[0].title).toBe('New coverage of the campaign')
})

test('curator cannot save a candidate outside their ward scope — store error surfaces inline, no crash', async () => {
  const user = userEvent.setup()
  // c-mal-1 is in malleshwaram — outside u-curator's scope (koramangala + indiranagar).
  renderAt('/curator/candidate/c-mal-1', 'u-curator')

  await user.click(screen.getByRole('button', { name: /save changes/i }))

  expect(screen.getByRole('alert')).toHaveTextContent(/scope/i)
  const candidate = store.getCandidate('malleshwaram-k-iyer')
  expect(candidate?.trackRecord.value).toMatch(/heritage market/i)
})

test('admin bypasses ward scope on candidate edit', async () => {
  const user = userEvent.setup()
  renderAt('/curator/candidate/c-mal-1', 'u-admin')

  await user.click(screen.getByRole('button', { name: /save changes/i }))

  expect(screen.getByText(/saved/i)).toBeInTheDocument()
})

// --- /curator/ward/:wardId ----------------------------------------------------------------------

test('unknown ward id is handled gracefully, not a crash', () => {
  renderAt('/curator/ward/does-not-exist', 'u-curator')
  expect(screen.getByText(/couldn.t find that ward/i)).toBeInTheDocument()
})

test('curator edits ward metadata — publishes immediately and audits', async () => {
  const user = userEvent.setup()
  renderAt('/curator/ward/koramangala', 'u-curator')
  const auditBefore = store.listAudit().length

  const noteBox = screen.getByLabelText(/old.new mapping note/i)
  await user.clear(noteBox)
  await user.type(noteBox, 'Updated mapping note after a boundary clarification.')

  await user.click(screen.getByRole('button', { name: /save changes/i }))

  const ward = store.getWard('koramangala')
  expect(ward?.oldWardsNote).toBe('Updated mapping note after a boundary clarification.')
  expect(store.listAudit().length).toBe(auditBefore + 1)
})

test('curator cannot save a ward outside their scope — inline error, no crash', async () => {
  const user = userEvent.setup()
  renderAt('/curator/ward/malleshwaram', 'u-curator')

  await user.click(screen.getByRole('button', { name: /save changes/i }))

  expect(screen.getByRole('alert')).toHaveTextContent(/scope/i)
})

// --- /curator/ward/:wardId/issues ---------------------------------------------------------------

test('shows the current votable issues for the ward, matching seed state', () => {
  renderAt('/curator/ward/koramangala/issues', 'u-curator')
  expect(screen.getByLabelText(/street lighting & safety/i)).toBeChecked()
  expect(screen.getByLabelText(/road quality/i)).toBeChecked()
})

test('curator removes an issue from the votable list — ward.issueIds shrinks and is audited', async () => {
  const user = userEvent.setup()
  renderAt('/curator/ward/koramangala/issues', 'u-curator')
  const auditBefore = store.listAudit().length

  await user.click(screen.getByLabelText(/street lighting & safety/i))
  await user.click(screen.getByRole('button', { name: /save changes/i }))

  const ward = store.getWard('koramangala')
  expect(ward?.issueIds).not.toContain('kor-lighting')
  expect(ward?.issueIds).toHaveLength(3)
  expect(store.listAudit().length).toBe(auditBefore + 1)
})

test('curator re-adds a previously removed issue — ward.issueIds grows back', async () => {
  const user = userEvent.setup()
  const first = renderAt('/curator/ward/koramangala/issues', 'u-curator')

  await user.click(screen.getByLabelText(/street lighting & safety/i))
  await user.click(screen.getByRole('button', { name: /save changes/i }))
  expect(store.getWard('koramangala')?.issueIds).toHaveLength(3)
  first.unmount()

  // Re-render fresh (picks up the just-saved state) and re-check the box.
  renderAt('/curator/ward/koramangala/issues', 'u-curator')
  await user.click(screen.getByLabelText(/street lighting & safety/i))
  await user.click(screen.getByRole('button', { name: /save changes/i }))

  expect(store.getWard('koramangala')?.issueIds).toContain('kor-lighting')
  expect(store.getWard('koramangala')?.issueIds).toHaveLength(4)
})

test('removing an issue does not delete or alter the underlying issueVotes records (no store-level migration exists)', async () => {
  const user = userEvent.setup()
  renderAt('/curator/ward/koramangala/issues', 'u-curator')

  const votesBefore = store.getState().issueVotes.filter((v) => v.issueIds.includes('kor-roads'))
  expect(votesBefore.length).toBeGreaterThan(0)

  await user.click(screen.getByLabelText(/road quality/i))
  await user.click(screen.getByRole('button', { name: /save changes/i }))

  // The raw vote records referencing the now-excluded issue id are untouched — setWardIssues only
  // ever writes ward.issueIds, never state.issueVotes.
  const votesAfter = store.getState().issueVotes.filter((v) => v.issueIds.includes('kor-roads'))
  expect(votesAfter).toEqual(votesBefore)
  // And the public tally is UNCHANGED too — issueTally reads state.issues by wardId, not
  // ward.issueIds, so excluding an issue here does not currently remove it from the public page.
  const tallyRow = store.issueTally('koramangala').find((r) => r.issueId === 'kor-roads')
  expect(tallyRow?.count).toBe(votesBefore.length)
})

test('curator cannot save issues outside their ward scope — inline error, no crash', async () => {
  const user = userEvent.setup()
  renderAt('/curator/ward/malleshwaram/issues', 'u-curator')

  await user.click(screen.getByRole('button', { name: /save changes/i }))

  expect(screen.getByRole('alert')).toHaveTextContent(/scope/i)
})

test('a ward with no issues yet shows an empty state, not a crash', () => {
  renderAt('/curator/ward/jayanagar/issues', 'u-admin')
  expect(screen.getByText(/no issues.*defined/i)).toBeInTheDocument()
})
