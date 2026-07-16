import { render, screen, within } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { routeObjects } from '../../routes'
import { AppProviders } from '../../App'

function renderData() {
  const router = createMemoryRouter(routeObjects, { initialEntries: ['/data'] })
  render(
    <AppProviders>
      <RouterProvider router={router} />
    </AppProviders>,
  )
  // Scope to the page content, not the shared AppBar's own "Prototype" banner — this suite's
  // own honesty assertions use words ("prototype", "figures") that would otherwise collide
  // with the AppBar's fictional-data strip.
  return within(screen.getByRole('main'))
}

test('/data renders its <h1>', () => {
  const main = renderData()
  expect(main.getByRole('heading', { level: 1, name: /data.*(key )?metrics/i })).toBeInTheDocument()
})

test('/data renders the real seed coverage figures — 4 of 369 wards, 10 of 10 report cards complete', () => {
  const main = renderData()
  expect(main.getByText('4 of 369')).toBeInTheDocument()
  expect(main.getByText('10 of 10')).toBeInTheDocument()
})

test('/data renders active curators and sources cited from the store, not a hardcoded figure', () => {
  const main = renderData()
  const coverage = within(main.getByRole('heading', { name: /^coverage$/i }).closest('section')!)
  expect(coverage.getByText('1')).toBeInTheDocument() // active curators
  expect(coverage.getByText('50')).toBeInTheDocument() // sources cited
})

test('/data renders integrity figures and does not fabricate a median resolution time', () => {
  const main = renderData()
  const integrity = within(main.getByRole('heading', { name: /^integrity$/i }).closest('section')!)
  expect(integrity.getByText('3')).toBeInTheDocument() // flags raised
  expect(integrity.getByText('2')).toBeInTheDocument() // flags resolved
  expect(integrity.getByText(/not available in this prototype/i)).toBeInTheDocument()
  // No fabricated duration string like "3 days" or "12 hours" anywhere in the integrity section.
  expect(integrity.queryByText(/\d+\s*(day|hour|minute)s?\b/i)).not.toBeInTheDocument()
})

test('/data renders citizen-signal figures aggregated across every ward', () => {
  const main = renderData()
  const citizenSignal = within(
    main.getByRole('heading', { name: /citizen signal/i }).closest('section')!,
  )
  const totalVotesLabel = citizenSignal.getByText(/total issue votes cast/i)
  expect(totalVotesLabel.nextElementSibling?.textContent).toBe('3')
  expect(citizenSignal.getByRole('heading', { name: /city-wide issue roll-up/i })).toBeInTheDocument()
  // Seeded koramangala issues should appear, ranked.
  expect(citizenSignal.getByText(/road quality/i)).toBeInTheDocument()
  expect(citizenSignal.getByText(/water supply reliability/i)).toBeInTheDocument()
})

test('/data carries an "as of" marker that is not a raw wall-clock date', () => {
  const main = renderData()
  expect(main.getByText(/as of:/i)).toBeInTheDocument()
  // The marker must come from the store's stamp convention (a real seed ISO date rendered via
  // formatStamp, or "Demo event #n" for a live counter stamp) — never a bare ISO string dumped
  // straight from Date.now()/new Date().toISOString().
  expect(main.queryByText(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/)).not.toBeInTheDocument()
})

test('/data never exposes a per-user identifier — aggregates only', () => {
  const main = renderData()
  expect(main.queryByText(/u-citizen|seed-voter-1|seed-voter-2/)).not.toBeInTheDocument()
})

test('/data states plainly these are prototype-scale figures, not real citywide coverage', () => {
  const main = renderData()
  expect(main.getAllByText(/prototype/i).length).toBeGreaterThan(0)
})

test('/data does not offer a dataset download or API link (figures, not datasets — PRD §5.14/§16)', () => {
  const main = renderData()
  expect(main.queryByRole('link', { name: /download|export|api/i })).not.toBeInTheDocument()
})
