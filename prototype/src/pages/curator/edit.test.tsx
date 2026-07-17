import { render, screen, act, within } from '@testing-library/react'
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

// --- PRD §9.1: curator can mark a field "not declared" — a complete answer, not a gap ----------

test('curator can mark a field "not declared" — publishes with an empty value and the marker, still sourced', async () => {
  const user = userEvent.setup()
  renderAt('/curator/candidate/c-kor-1', 'u-curator')

  const assetsGroup = screen.getByRole('group', { name: /declared assets/i })
  const valueBox = within(assetsGroup).getByLabelText(/declared assets value/i)
  await user.click(within(assetsGroup).getByLabelText(/not declared on the affidavit/i))
  expect(valueBox).toBeDisabled()

  await user.click(screen.getByRole('button', { name: /save changes/i }))

  const candidate = store.getCandidate('koramangala-r-menon')
  expect(candidate?.assets.notDeclared).toBe(true)
  expect(candidate?.assets.value).toBe('')
  // The seeded source is untouched — "not declared" still needs a real source.
  expect(candidate?.assets.source.label).toBe('EC affidavit')
  expect(screen.getByText(/saved/i)).toBeInTheDocument()
})

test('a "not declared" field still requires a source — save is refused if the source label is cleared', async () => {
  const user = userEvent.setup()
  renderAt('/curator/candidate/c-kor-1', 'u-curator')

  const assetsGroup = screen.getByRole('group', { name: /declared assets/i })
  await user.click(within(assetsGroup).getByLabelText(/not declared on the affidavit/i))
  await user.clear(within(assetsGroup).getByLabelText(/declared assets source label/i))

  await user.click(screen.getByRole('button', { name: /save changes/i }))

  expect(screen.getByRole('alert')).toHaveTextContent(/source/i)
  // Nothing was published — the seeded value and source are both untouched.
  const candidate = store.getCandidate('koramangala-r-menon')
  expect(candidate?.assets.notDeclared).toBeUndefined()
  expect(candidate?.assets.value).toMatch(/1\.8 crore/)
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

  const nameBox = screen.getByLabelText(/ward name/i)
  await user.clear(nameBox)
  await user.type(nameBox, 'Koramangala Extension')

  await user.click(screen.getByRole('button', { name: /save changes/i }))

  const ward = store.getWard('koramangala')
  expect(ward?.name).toBe('Koramangala Extension')
  expect(store.listAudit().length).toBe(auditBefore + 1)
})

test('curator cannot save a ward outside their scope — inline error, no crash', async () => {
  const user = userEvent.setup()
  renderAt('/curator/ward/malleshwaram', 'u-curator')

  await user.click(screen.getByRole('button', { name: /save changes/i }))

  expect(screen.getByRole('alert')).toHaveTextContent(/scope/i)
})

// --- Task 5: ward data-readiness gating readiness panel (PRD §9.1) -----------------------------

test('readiness panel shows a mechanically complete, not-yet-signed-off ward', () => {
  renderAt('/curator/ward/koramangala', 'u-curator')
  expect(screen.getByRole('heading', { name: /ward data.readiness/i })).toBeInTheDocument()
  expect(screen.getByText(/not.*signed off/i)).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /mark ward ready/i })).toBeEnabled()
})

test('curator signs off a complete, in-scope ward — publishes immediately and audits', async () => {
  const user = userEvent.setup()
  renderAt('/curator/ward/koramangala', 'u-curator')
  const auditBefore = store.listAudit().length

  await user.click(screen.getByRole('button', { name: /mark ward ready/i }))

  expect(store.wardReadiness('koramangala').signedOff).toBe(true)
  expect(store.wardReadiness('koramangala').ready).toBe(true)
  expect(store.listAudit().length).toBe(auditBefore + 1)
  expect(screen.getAllByText(/ready for candidate-referencing comms/i).length).toBeGreaterThan(0)
})

test('signing off outside scope surfaces the store error inline and never leaves a false "signed off" state', async () => {
  const user = userEvent.setup()
  renderAt('/curator/ward/malleshwaram', 'u-curator')

  await user.click(screen.getByRole('button', { name: /mark ward ready/i }))

  expect(screen.getByRole('alert')).toHaveTextContent(/scope/i)
  expect(store.wardReadiness('malleshwaram').signedOff).toBe(false)
})

test('a ward with an incomplete candidate lists the gap and disables sign-off', async () => {
  // Seed the gap directly via the store (admin bypasses scope) before rendering the target page,
  // mirroring the "re-adds a previously removed issue" pattern elsewhere in this file: mutate,
  // unmount, then render fresh so the new DataProvider rehydrates from the persisted state.
  const first = renderAt('/curator', 'u-admin')
  act(() => {
    store.addCandidate(
      'jayanagar',
      {
        name: 'Incomplete Filer',
        party: 'Independent',
        trackRecord: { value: 'x', source: { type: 'curator', label: 'Curator note' } },
        pendingCases: { value: '', source: { type: 'affidavit', label: 'EC affidavit' } }, // gap
        assets: { value: 'x', source: { type: 'affidavit', label: 'EC affidavit' } },
        education: { value: 'x', source: { type: 'affidavit', label: 'EC affidavit' } },
        approachability: { value: 'x', source: { type: 'curator', label: 'Curator note' } },
      },
      store.listUsers().find((u) => u.role === 'admin')!,
    )
  })
  first.unmount()

  renderAt('/curator/ward/jayanagar', 'u-admin')
  expect(screen.getByText(/incomplete filer/i)).toBeInTheDocument()
  // Fix 4: the gap reason uses the friendly field label, not the raw camelCase key.
  expect(screen.getByText(/criminal record.*pending cases/i)).toBeInTheDocument()
  expect(screen.queryByText(/pendingCases/)).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: /mark ward ready/i })).toBeDisabled()
})

// FIX 1 (real defect — rewritten, was previously pinning the bug as intended behavior): a
// zero-candidate ward used to be treated as "vacuously complete" and signable — the literal
// "every candidate who filed has a complete record" check is vacuously true when nobody has
// filed, but that is exactly the harm PRD §9.1 exists to prevent (telling a curator/admin a
// ward's data is "ready" for a candidate-referencing send when there is nothing to reference).
// Rewritten to assert the corrected, honest behavior: sign-off stays disabled, and the panel
// says WHY in a way that is true ("no candidates filed"), not "fields are missing".
test('a ward with zero candidates on record is NOT ready — sign-off is disabled with an honest "no candidates filed" reason', () => {
  renderAt('/curator/ward/jayanagar', 'u-admin')

  expect(screen.getByRole('button', { name: /mark ward ready/i })).toBeDisabled()
  expect(screen.getByText(/no candidates have filed/i)).toBeInTheDocument()
  expect(store.wardReadiness('jayanagar').ready).toBe(false)
  expect(store.wardReadiness('jayanagar').complete).toBe(false)
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

test('removing an issue does not delete the underlying issueVotes records, but stops it counting/showing publicly (Fix 1)', async () => {
  const user = userEvent.setup()
  renderAt('/curator/ward/koramangala/issues', 'u-curator')

  const votesBefore = store.getState().issueVotes.filter((v) => v.issueIds.includes('kor-roads'))
  expect(votesBefore.length).toBeGreaterThan(0)

  await user.click(screen.getByLabelText(/road quality/i))
  await user.click(screen.getByRole('button', { name: /save changes/i }))

  // The raw vote records referencing the now-excluded issue id are untouched — setWardIssues only
  // ever writes ward.issueIds, never state.issueVotes. A citizen's historical vote-set is theirs.
  const votesAfter = store.getState().issueVotes.filter((v) => v.issueIds.includes('kor-roads'))
  expect(votesAfter).toEqual(votesBefore)

  // But the public page and tally now DO respect ward.issueIds (Fix 1) — a removed issue
  // disappears from both, even though the underlying votes are preserved.
  expect(store.listIssues('koramangala').find((i) => i.id === 'kor-roads')).toBeUndefined()
  expect(store.issueTally('koramangala').find((r) => r.issueId === 'kor-roads')).toBeUndefined()
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

// --- Fix 4: curators can author new ward issues (addIssue/updateIssue), wired into this page --

test('curator adds a brand-new issue — it is votable immediately and shows on the public page', async () => {
  const user = userEvent.setup()
  renderAt('/curator/ward/jayanagar/issues', 'u-admin')

  await user.type(screen.getByLabelText(/^title$/i), 'Footpath encroachment')
  await user.type(screen.getByLabelText(/^description$/i), 'Vendors blocking footpaths near the market.')
  await user.click(screen.getByRole('button', { name: /add issue/i }))

  expect(screen.getByLabelText(/footpath encroachment/i)).toBeChecked()

  const ward = store.getWard('jayanagar')
  expect(ward?.issueIds).toHaveLength(1)
  const newIssue = store.listIssues('jayanagar')[0]
  expect(newIssue.title).toBe('Footpath encroachment')
  // Fix 1: listIssues is what the public /ward/:id/issues page renders — the new issue is on it.
  expect(store.listIssues('jayanagar').map((i) => i.id)).toContain(newIssue.id)
})

test('curator edits an existing issue title and description — publishes immediately and audits', async () => {
  const user = userEvent.setup()
  renderAt('/curator/ward/koramangala/issues', 'u-curator')
  const auditBefore = store.listAudit().length

  await user.click(screen.getAllByRole('button', { name: /^edit$/i })[0])
  // Two "Title" fields are on screen at once: the always-present "Add a new issue" form, and the
  // one that just appeared inline for the issue being edited — the latter is the second match.
  const titleBox = screen.getAllByLabelText(/^title$/i)[1]
  await user.clear(titleBox)
  await user.type(titleBox, 'Road quality, potholes & footpath damage')
  await user.click(screen.getByRole('button', { name: /save issue/i }))

  expect(store.listAudit().length).toBe(auditBefore + 1)
  const updated = store.listIssues('koramangala').find((i) => i.title.includes('footpath damage'))
  expect(updated).toBeDefined()
})

// --- PRD §5.2: AI-assisted affidavit ingestion from the curator editor --------------------------

test('curator ingests an affidavit — extracted fields publish immediately, marked, audited as a system entry', async () => {
  const user = userEvent.setup()
  renderAt('/curator/candidate/c-kor-1', 'u-curator')
  const auditBefore = store.listAudit().length

  await user.type(screen.getByLabelText(/affidavit pdf file name/i), 'menon-form26.pdf')
  await user.click(screen.getByRole('button', { name: /ingest affidavit/i }))

  const candidate = store.getCandidate('koramangala-r-menon')!
  expect(candidate.affidavit?.providedFileName).toBe('menon-form26.pdf')
  expect(candidate.assets.aiExtracted).toBe(true)
  expect(candidate.education.notDeclared).toBe(true)

  // Per-field markers appear on the three extracted fields.
  expect(screen.getAllByText('AI-extracted — not yet curator-confirmed')).toHaveLength(3)
  // The form drafts were refreshed from the extraction.
  expect(screen.getByLabelText(/declared assets value/i)).toHaveValue(candidate.assets.value)

  const audit = store.listAudit()
  const last = audit[audit.length - 1]
  expect(last.action).toBe('candidate.affidavit.extracted')
  expect(last.actorUserId).toBe('system')
  expect(store.listAudit().length).toBe(auditBefore + 1)
})

test('ingest with neither a file nor a link surfaces an inline error, no crash, nothing written', async () => {
  const user = userEvent.setup()
  renderAt('/curator/candidate/c-kor-1', 'u-curator')

  await user.click(screen.getByRole('button', { name: /ingest affidavit/i }))

  expect(screen.getByRole('alert')).toHaveTextContent(/file|link/i)
  expect(store.getCandidate('koramangala-r-menon')?.affidavit).toBeUndefined()
})

test('saving the form after ingestion confirms the fields and clears every AI-extracted marker', async () => {
  const user = userEvent.setup()
  renderAt('/curator/candidate/c-kor-1', 'u-curator')

  await user.type(screen.getByLabelText(/affidavit pdf file name/i), 'menon-form26.pdf')
  await user.click(screen.getByRole('button', { name: /ingest affidavit/i }))
  await user.click(screen.getByRole('button', { name: /save changes/i }))

  const candidate = store.getCandidate('koramangala-r-menon')!
  expect(candidate.pendingCases.aiExtracted).toBeUndefined()
  expect(candidate.assets.aiExtracted).toBeUndefined()
  expect(candidate.education.aiExtracted).toBeUndefined()
  // "Not declared" itself survives the confirm — only the AI marker clears.
  expect(candidate.education.notDeclared).toBe(true)
  expect(screen.queryByText('AI-extracted — not yet curator-confirmed')).not.toBeInTheDocument()
  expect(screen.queryByText(/extraction published/i)).not.toBeInTheDocument()
})

test('out-of-scope ingest surfaces the store scope error inline, no crash', async () => {
  const user = userEvent.setup()
  renderAt('/curator/candidate/c-mal-1', 'u-curator')

  await user.type(screen.getByLabelText(/affidavit pdf file name/i), 'iyer.pdf')
  await user.click(screen.getByRole('button', { name: /ingest affidavit/i }))

  expect(screen.getByRole('alert')).toHaveTextContent(/scope/i)
  expect(store.getCandidate('malleshwaram-k-iyer')?.affidavit).toBeUndefined()
})
