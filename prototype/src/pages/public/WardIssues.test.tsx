import { render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { routeObjects } from '../../routes'
import { AppProviders } from '../../App'

function renderAt(path: string) {
  const router = createMemoryRouter(routeObjects, { initialEntries: [path] })
  render(
    <AppProviders>
      <RouterProvider router={router} />
    </AppProviders>,
  )
}

test('lists the ward\'s curator-defined issues', () => {
  renderAt('/ward/koramangala/issues')

  expect(screen.getByRole('heading', { name: 'Road quality & potholes' })).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: 'Water supply reliability' })).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: 'Garbage collection & segregation' })).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: 'Street lighting & safety' })).toBeInTheDocument()
})

test('shows public ranked results in non-increasing vote-count order', () => {
  renderAt('/ward/koramangala/issues')

  const list = screen.getByRole('list', { name: /ranked results|top issues/i })
  const items = list.querySelectorAll('li')
  expect(items.length).toBeGreaterThanOrEqual(2)

  const counts = Array.from(items).map((li) => {
    const match = li.textContent?.match(/(\d+)\s*vote/i)
    return match ? Number(match[1]) : NaN
  })
  expect(counts.every((n) => !Number.isNaN(n))).toBe(true)
  expect(counts[0]).toBeGreaterThanOrEqual(counts[1])
})

test('shows an honest note that candidate stances are not yet recorded', () => {
  renderAt('/ward/koramangala/issues')

  expect(
    screen.getAllByText(/stance.*not yet recorded|not yet recorded.*stance/i).length,
  ).toBeGreaterThan(0)
})

test('shows a Vote your top 3 action', () => {
  renderAt('/ward/koramangala/issues')

  expect(screen.getByRole('button', { name: /vote your top 3/i })).toBeInTheDocument()
})

test('notes that voting is limited to the home ward', () => {
  renderAt('/ward/koramangala/issues')

  expect(screen.getByText(/home ward/i)).toBeInTheDocument()
})

test('an unknown ward id does not crash and shows an honest not-found message', () => {
  renderAt('/ward/not-a-real-ward/issues')

  expect(screen.getByText(/couldn.t find that ward|ward not found/i)).toBeInTheDocument()
})

test('shows an honest empty state for a ward with no issues defined yet', () => {
  renderAt('/ward/jayanagar/issues')

  expect(screen.getByText(/no issues.*(yet|defined)/i)).toBeInTheDocument()
})
