import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { routeObjects } from '../../routes'
import { AppProviders } from '../../App'

test('searching a ward and selecting a result navigates to the ward page', async () => {
  const user = userEvent.setup()
  const router = createMemoryRouter(routeObjects, { initialEntries: ['/'] })
  render(
    <AppProviders>
      <RouterProvider router={router} />
    </AppProviders>,
  )

  await user.type(screen.getByLabelText(/search for your ward/i), 'kora')
  await user.click(screen.getByRole('button', { name: /Koramangala/i }))

  expect(router.state.location.pathname).toBe('/ward/koramangala')
})

test('shows shortcut cards to check registration and the voting guide', () => {
  const router = createMemoryRouter(routeObjects, { initialEntries: ['/'] })
  render(
    <AppProviders>
      <RouterProvider router={router} />
    </AppProviders>,
  )

  // Scoped to <main> — the global Footer (present on every page) also has a
  // plain "Voting guide" link, which would otherwise collide with this query.
  const main = within(screen.getByRole('main'))

  expect(main.getByRole('link', { name: /check.*registration/i })).toHaveAttribute(
    'href',
    '/check-registration',
  )
  expect(main.getByRole('link', { name: /voting guide/i })).toHaveAttribute(
    'href',
    '/voting-guide',
  )
})

test('typing a query with no matching ward shows an honest no-results message', async () => {
  const user = userEvent.setup()
  const router = createMemoryRouter(routeObjects, { initialEntries: ['/'] })
  render(
    <AppProviders>
      <RouterProvider router={router} />
    </AppProviders>,
  )

  await user.type(screen.getByLabelText(/search for your ward/i), 'zzznotaward')

  expect(screen.getByText(/no ward matches/i)).toBeInTheDocument()
})
