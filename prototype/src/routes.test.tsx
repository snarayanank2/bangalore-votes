import { render, screen } from '@testing-library/react'
import { RouterProvider, createMemoryRouter } from 'react-router-dom'
import { routeObjects } from './routes'
import { AppProviders } from './App'

test('renders the home route inside the shell', () => {
  const router = createMemoryRouter(routeObjects, { initialEntries: ['/'] })
  render(
    <AppProviders>
      <RouterProvider router={router} />
    </AppProviders>,
  )
  expect(screen.getByRole('banner')).toBeInTheDocument() // AppBar
})

test('renders the fictional-data warning banner on every page', () => {
  const router = createMemoryRouter(routeObjects, { initialEntries: ['/'] })
  render(
    <AppProviders>
      <RouterProvider router={router} />
    </AppProviders>,
  )
  expect(
    screen.getByText(/Prototype.*sample data is fictional.*Not real candidates or election data/i),
  ).toBeInTheDocument()
})

test('renders the footer landmark', () => {
  const router = createMemoryRouter(routeObjects, { initialEntries: ['/'] })
  render(
    <AppProviders>
      <RouterProvider router={router} />
    </AppProviders>,
  )
  expect(screen.getByRole('contentinfo')).toBeInTheDocument()
})

test('routes to a curator page and redirects an anonymous visitor away from it', () => {
  const router = createMemoryRouter(routeObjects, { initialEntries: ['/curator'] })
  render(
    <AppProviders>
      <RouterProvider router={router} />
    </AppProviders>,
  )
  // RoleGuard redirects anonymous users to '/', which renders the Home placeholder heading.
  expect(screen.getByRole('heading', { name: 'Home' })).toBeInTheDocument()
})

test('renders a deep public page placeholder by heading', () => {
  const router = createMemoryRouter(routeObjects, { initialEntries: ['/about'] })
  render(
    <AppProviders>
      <RouterProvider router={router} />
    </AppProviders>,
  )
  expect(screen.getByRole('heading', { name: 'About' })).toBeInTheDocument()
})
