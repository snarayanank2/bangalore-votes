import { render, screen, within, act } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { routeObjects } from '../../routes'
import { AppProviders } from '../../App'
import { useData } from '../../context/DataContext'

function renderAt(path: string) {
  const router = createMemoryRouter(routeObjects, { initialEntries: [path] })
  return render(
    <AppProviders>
      <RouterProvider router={router} />
    </AppProviders>,
  )
}

let store: ReturnType<typeof useData>
function StoreProbe() {
  store = useData()
  return null
}

test('shows one column header per candidate and one row label per report-card field', () => {
  renderAt('/ward/koramangala/compare')

  expect(screen.getByRole('columnheader', { name: /radhika menon/i })).toBeInTheDocument()
  expect(screen.getByRole('columnheader', { name: /suresh gowda/i })).toBeInTheDocument()
  expect(screen.getByRole('columnheader', { name: /vinay rao/i })).toBeInTheDocument()

  // "Declared assets" must appear exactly once as a row label, not once per candidate column.
  expect(screen.getAllByRole('rowheader', { name: /declared assets/i })).toHaveLength(1)
})

test('each field row shows its value with a source badge for every candidate', () => {
  renderAt('/ward/koramangala/compare')

  const assetsRow = screen.getByRole('rowheader', { name: /declared assets/i }).closest('tr')
  expect(assetsRow).not.toBeNull()
  const cells = within(assetsRow as HTMLElement).getAllByText(/Rs\s/i)
  expect(cells.length).toBe(3) // one per koramangala candidate
  expect(within(assetsRow as HTMLElement).getAllByText(/Official \(affidavit\)/i).length).toBe(3)
})

test('candidate column headers link through to the report card', () => {
  renderAt('/ward/koramangala/compare')

  expect(screen.getByRole('link', { name: /radhika menon/i })).toHaveAttribute(
    'href',
    '/candidate/koramangala-r-menon',
  )
})

// --- PRD §9.1/§11: "not declared" renders the same neutral marker as the report card ------------

test('a "not declared" field (seed: shivajinagar-t-ahmed, education) shows the neutral "Not declared" marker instead of a blank cell', () => {
  renderAt('/ward/shivajinagar/compare')

  const educationRow = screen.getByRole('rowheader', { name: /education/i }).closest('tr')
  expect(educationRow).not.toBeNull()
  expect(within(educationRow as HTMLElement).getByText('Not declared')).toBeInTheDocument()
  // Still carries its source badge, exactly like every other field.
  expect(
    within(educationRow as HTMLElement).getAllByText(/Official \(affidavit\)/i).length,
  ).toBeGreaterThan(0)
})

test('shows an honest empty state for a ward with no candidates yet', () => {
  renderAt('/ward/jayanagar/compare')
  expect(screen.getByText(/no candidates.*(yet|nomination)/i)).toBeInTheDocument()
})

test('an unknown ward id does not crash and shows an honest not-found message', () => {
  renderAt('/ward/not-a-real-ward/compare')
  expect(screen.getByText(/couldn.t find that ward|ward not found/i)).toBeInTheDocument()
})

// --- PRD §5.2: the AI-extracted marker also shows in the compare table --------------------------

test('AI-extracted fields carry their marker in the compare table too', () => {
  const router = createMemoryRouter(routeObjects, { initialEntries: ['/ward/koramangala/compare'] })
  render(
    <AppProviders>
      <StoreProbe />
      <RouterProvider router={router} />
    </AppProviders>,
  )
  const curatorUser = store.listUsers().find((u) => u.id === 'u-curator')!
  act(() => {
    store.ingestAffidavit('koramangala-r-menon', { fileName: 'menon-form26.pdf' }, curatorUser)
  })

  // One candidate ingested × three extracted fields.
  expect(screen.getAllByText('AI-extracted — not yet curator-confirmed')).toHaveLength(3)
})
