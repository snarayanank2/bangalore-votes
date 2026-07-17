import { render, screen, within } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { routeObjects } from '../routes'
import { AppProviders } from '../App'
import { RollDeadlineNotice, ROLL_DEADLINE_LABEL } from './RollDeadlineNotice'

function renderAt(path: string) {
  const router = createMemoryRouter(routeObjects, { initialEntries: [path] })
  render(
    <AppProviders>
      <RouterProvider router={router} />
    </AppProviders>,
  )
  return within(screen.getByRole('main'))
}

test('shows the roll deadline with an honest placeholder-date caveat', () => {
  render(<RollDeadlineNotice />)
  expect(screen.getByText(new RegExp(ROLL_DEADLINE_LABEL))).toBeInTheDocument()
  expect(screen.getAllByText(/cannot vote in this election/i).length).toBeGreaterThan(0)
  expect(screen.getAllByText(/placeholder/i).length).toBeGreaterThan(0)
})

test('renders nothing once the roll has closed (PRD: "shown until the roll closes")', () => {
  const { container } = render(<RollDeadlineNotice closed />)
  expect(container).toBeEmptyDOMElement()
})

test.each(['/', '/check-registration', '/voting-guide/voter-id'])(
  '%s carries the roll-deadline element (PRD §5.6/§5.7/§5.8)',
  (path) => {
    const main = renderAt(path)
    expect(main.getAllByText(new RegExp(ROLL_DEADLINE_LABEL)).length).toBeGreaterThan(0)
  },
)
