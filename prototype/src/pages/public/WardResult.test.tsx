import { render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { routeObjects } from '../../routes'
import { AppProviders } from '../../App'

test('shows the ward name, number, and corporation', () => {
  const router = createMemoryRouter(routeObjects, { initialEntries: ['/ward/koramangala'] })
  render(
    <AppProviders>
      <RouterProvider router={router} />
    </AppProviders>,
  )

  expect(screen.getByRole('heading', { name: /koramangala/i })).toBeInTheDocument()
  expect(screen.getByText(/ward #151/i)).toBeInTheDocument()
  expect(screen.getByText(/south/i)).toBeInTheDocument()
})

test('an unknown ward id does not crash and shows an honest not-found message', () => {
  const router = createMemoryRouter(routeObjects, { initialEntries: ['/ward/not-a-real-ward'] })
  render(
    <AppProviders>
      <RouterProvider router={router} />
    </AppProviders>,
  )

  expect(screen.getByText(/couldn.t find that ward|ward not found/i)).toBeInTheDocument()
})

test('lists candidate names in the ward and shows a Compare link', () => {
  const router = createMemoryRouter(routeObjects, {
    initialEntries: ['/ward/koramangala/candidates'],
  })
  render(
    <AppProviders>
      <RouterProvider router={router} />
    </AppProviders>,
  )

  expect(screen.getByText('Radhika Menon')).toBeInTheDocument()
  expect(screen.getByText('Suresh Gowda')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: /compare/i })).toHaveAttribute(
    'href',
    '/ward/koramangala/compare',
  )
})

test('candidate rows link to the candidate report card', () => {
  const router = createMemoryRouter(routeObjects, {
    initialEntries: ['/ward/koramangala/candidates'],
  })
  render(
    <AppProviders>
      <RouterProvider router={router} />
    </AppProviders>,
  )

  expect(screen.getByRole('link', { name: /radhika menon/i })).toHaveAttribute(
    'href',
    '/candidate/koramangala-r-menon',
  )
})

test('shows an honest empty state for a ward with no candidates yet', () => {
  // jayanagar is seeded deliberately with zero candidates — nomination data only lands
  // near the official notification, and the empty state must reflect that honestly.
  const router = createMemoryRouter(routeObjects, {
    initialEntries: ['/ward/jayanagar/candidates'],
  })
  render(
    <AppProviders>
      <RouterProvider router={router} />
    </AppProviders>,
  )

  expect(screen.getByText(/no candidates.*(yet|nomination)/i)).toBeInTheDocument()
})

test('an unknown ward id on the candidates page does not crash', () => {
  const router = createMemoryRouter(routeObjects, {
    initialEntries: ['/ward/not-a-real-ward/candidates'],
  })
  render(
    <AppProviders>
      <RouterProvider router={router} />
    </AppProviders>,
  )

  expect(screen.getByText(/couldn.t find that ward|ward not found/i)).toBeInTheDocument()
})
