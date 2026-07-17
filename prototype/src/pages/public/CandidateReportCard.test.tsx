import { render, screen, act, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { routeObjects } from '../../routes'
import { AppProviders } from '../../App'
import { useAuth } from '../../context/AuthContext'
import { useData } from '../../context/DataContext'

let auth: ReturnType<typeof useAuth>
let store: ReturnType<typeof useData>
function Probe() {
  auth = useAuth()
  store = useData()
  return null
}

function renderAt(path: string) {
  const router = createMemoryRouter(routeObjects, { initialEntries: [path] })
  return render(
    <AppProviders>
      <Probe />
      <RouterProvider router={router} />
    </AppProviders>,
  )
}

test('shows the candidate name, track record, and both affidavit and curator-compiled source badges', () => {
  renderAt('/candidate/koramangala-r-menon')

  expect(screen.getByRole('heading', { name: /radhika menon/i })).toBeInTheDocument()
  expect(screen.getByText(/stormwater drain desilting/i)).toBeInTheDocument()
  // pendingCases/assets/education are seeded as EC-affidavit sourced (task brief seed rule).
  expect(screen.getAllByText(/EC affidavit/i).length).toBeGreaterThan(0)
  // trackRecord/approachability are seeded as curator-compiled.
  expect(screen.getAllByText(/Curator-compiled/i).length).toBeGreaterThan(0)
})

test('every sourced field carries its own source badge (5 fields, 5 badges)', () => {
  renderAt('/candidate/koramangala-r-menon')

  // official/affidavit badges render with the SourceBadge "Official (affidavit)" label,
  // curator-compiled ones with "Curator-compiled" — both distinguishable at a glance.
  expect(screen.getAllByText('Official (affidavit)')).toHaveLength(3) // pendingCases, assets, education
  expect(screen.getAllByText('Curator-compiled').length).toBeGreaterThanOrEqual(2) // trackRecord, approachability (+ news section)
})

test('education is shown with a caveat that it is not the whole picture', () => {
  renderAt('/candidate/koramangala-r-menon')
  expect(screen.getByText(/isn.t the whole picture/i)).toBeInTheDocument()
})

test('shows the News & coverage section with curator-compiled links', () => {
  renderAt('/candidate/koramangala-r-menon')
  expect(screen.getByRole('heading', { name: /news & coverage/i })).toBeInTheDocument()
  expect(
    screen.getByRole('link', { name: /corporator pushes for faster drain desilting/i }),
  ).toHaveAttribute('href', '#')
})

test('clicking Flag an error opens the flag modal for a logged-in citizen', async () => {
  const user = userEvent.setup()
  renderAt('/candidate/koramangala-r-menon')
  act(() => auth.loginAs('u-citizen'))

  await user.click(screen.getByRole('button', { name: /flag an error/i }))

  expect(screen.getByRole('dialog', { name: /flag misinformation/i })).toBeInTheDocument()
  expect(screen.getByRole('option', { name: /declared assets/i })).toBeInTheDocument()
})

test('anonymous click on Flag an error shows the login modal first (resume-in-place gating)', async () => {
  const user = userEvent.setup()
  renderAt('/candidate/koramangala-r-menon')

  await user.click(screen.getByRole('button', { name: /flag an error/i }))

  expect(screen.getByRole('dialog', { name: /sign in/i })).toBeInTheDocument()
})

test('shows a plain-text provenance note that name, photo and party come from the EC nomination', () => {
  renderAt('/candidate/koramangala-r-menon')
  expect(screen.getByText(/name, photo and party.*EC nomination/i)).toBeInTheDocument()
})

// --- PRD §9.1: "not declared" is a fact about the affidavit, rendered as an explicit, neutral --
// state — distinct from both a real value and an empty/unknown field (PRD §11: no warning colour,
// no wording implying concealment).

test('a field marked "not declared" (seed: shivajinagar-t-ahmed, education) renders an explicit "Not declared" state with its source badge', () => {
  renderAt('/candidate/shivajinagar-t-ahmed')

  const educationTerm = screen.getByText('Education / qualifications')
  const dd = educationTerm.closest('div')!.querySelector('dd') as HTMLElement
  expect(within(dd).getByText('Not declared')).toBeInTheDocument()
  expect(within(dd).getByText(/Official \(affidavit\)/i)).toBeInTheDocument()

  // Neutral per PRD §11 — no warning/negative styling class on the "Not declared" text itself.
  const notDeclaredEl = within(dd).getByText('Not declared')
  expect(notDeclaredEl.className).not.toMatch(/red|warn|error|amber|accent/i)
})

test('an unknown candidate slug does not crash and shows an honest not-found message', () => {
  renderAt('/candidate/not-a-real-candidate')
  expect(screen.getByText(/couldn.t find that candidate/i)).toBeInTheDocument()
})

// --- PRD §5.2/§11: AI-extracted markers + the stored affidavit copy as the public source link ---

test('after ingestion, extracted fields carry the AI-extracted marker and link to the stored copy', () => {
  renderAt('/candidate/koramangala-r-menon')
  const curatorUser = store.listUsers().find((u) => u.id === 'u-curator')!
  act(() => {
    store.ingestAffidavit('koramangala-r-menon', { fileName: 'menon-form26.pdf' }, curatorUser)
  })

  expect(screen.getAllByText('AI-extracted — not yet curator-confirmed')).toHaveLength(3)
  const storedLinks = screen
    .getAllByRole('link', { name: 'source' })
    .filter((l) => l.getAttribute('href') === '#stored-affidavit-c-kor-1')
  expect(storedLinks).toHaveLength(3)
})

test('before any ingestion, no AI-extracted marker renders anywhere on the report card', () => {
  renderAt('/candidate/koramangala-r-menon')
  expect(screen.queryByText('AI-extracted — not yet curator-confirmed')).not.toBeInTheDocument()
})
