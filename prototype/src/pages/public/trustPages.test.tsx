import { render, screen, within } from '@testing-library/react'
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
  // Scope queries to the page content, not the shared AppBar/Footer shell — mirrors
  // staticPages.test.tsx's convention so this suite's own "prototype"/"fictional" assertions
  // don't collide with the AppBar's mandatory banner.
  return within(screen.getByRole('main'))
}

const PAGES: { path: string; heading: RegExp }[] = [
  { path: '/privacy', heading: /privacy/i },
  { path: '/terms', heading: /terms/i },
  { path: '/press', heading: /press/i },
]

test.each(PAGES)('$path renders its <h1>', ({ path, heading }) => {
  const main = renderAt(path)
  expect(main.getByRole('heading', { level: 1, name: heading })).toBeInTheDocument()
})

describe('/privacy and /terms do not read as live, actionable policy', () => {
  test.each(['/privacy', '/terms'])('%s shows a prominent pending-legal-review notice', (path) => {
    const main = renderAt(path)
    expect(main.getAllByText(/pending legal review/i).length).toBeGreaterThan(0)
    expect(main.getAllByText(/not the final/i).length).toBeGreaterThan(0)
  })

  test('/privacy marks retention as an open, undecided question rather than stating a period', () => {
    const main = renderAt('/privacy')
    expect(main.getByRole('heading', { name: /retention/i })).toBeInTheDocument()
    expect(main.getAllByText(/open question|not yet decided|undecided|still deciding/i).length).toBeGreaterThan(0)
    // Must not assert a concrete retention period like "12 months" / "2 years" / "90 days".
    expect(main.queryByText(/\b\d+\s*(day|month|year)s?\b/i)).not.toBeInTheDocument()
  })

  test('/privacy names the operator, the DPDP Act 2023, and a pending grievance officer', () => {
    const main = renderAt('/privacy')
    expect(main.getAllByText(/Oorvani Foundation/i).length).toBeGreaterThan(0)
    expect(main.getAllByText(/DPDP Act 2023/i).length).toBeGreaterThan(0)
    expect(main.getByRole('heading', { name: /grievance officer/i })).toBeInTheDocument()
    // No invented name/contact stands in for the officer — it must read as pending.
    expect(main.getAllByText(/to be (named|appointed)|pending|not yet appointed/i).length).toBeGreaterThan(0)
  })

  test('/privacy lists what is collected and that issue votes publish only in aggregate', () => {
    const main = renderAt('/privacy')
    expect(main.getAllByText(/email/i).length).toBeGreaterThan(0)
    expect(main.getAllByText(/phone/i).length).toBeGreaterThan(0)
    expect(main.getAllByText(/ward/i).length).toBeGreaterThan(0)
    expect(main.getAllByText(/aggregate/i).length).toBeGreaterThan(0)
  })

  test('/privacy discloses Google Analytics usage data and cookies, and server logs (PRD §5.16)', () => {
    const main = renderAt('/privacy')
    expect(main.getAllByText(/Google Analytics/i).length).toBeGreaterThan(0)
    expect(main.getAllByText(/cookies/i).length).toBeGreaterThan(0)
    expect(main.getAllByText(/server logs/i).length).toBeGreaterThan(0)
  })

  test('/terms covers acceptable use, contribution licensing, disclaimers, and termination grounds', () => {
    const main = renderAt('/terms')
    expect(main.getByRole('heading', { name: /acceptable use/i })).toBeInTheDocument()
    expect(main.getByRole('heading', { name: /contribution licens/i })).toBeInTheDocument()
    expect(main.getByRole('heading', { name: /disclaimer|accuracy|liability/i })).toBeInTheDocument()
    expect(main.getByRole('heading', { name: /termination/i })).toBeInTheDocument()
  })
})

describe('/press', () => {
  test('offers boilerplate at three lengths', () => {
    const main = renderAt('/press')
    expect(main.getAllByText(/50 words?/i).length).toBeGreaterThan(0)
    expect(main.getAllByText(/100 words?/i).length).toBeGreaterThan(0)
    expect(main.getAllByText(/200 words?/i).length).toBeGreaterThan(0)
  })

  test('links to /data for key stats', () => {
    const main = renderAt('/press')
    const link = main.getByRole('link', { name: /data|key stats/i })
    expect(link).toHaveAttribute('href', '/data')
  })

  test('links to /about for sourcing methodology', () => {
    const main = renderAt('/press')
    const link = main.getByRole('link', { name: /sourcing|methodology/i })
    expect(link).toHaveAttribute('href', '/about')
  })

  test('states a contact response time', () => {
    const main = renderAt('/press')
    expect(main.getAllByText(/respond|response time/i).length).toBeGreaterThan(0)
    expect(main.getAllByText(/business day|hours/i).length).toBeGreaterThan(0)
  })

  test('spokesperson bios/quotes are clearly marked as a fictional demo, not real Oorvani staff', () => {
    const main = renderAt('/press')
    expect(main.getByRole('heading', { name: /spokespe/i })).toBeInTheDocument()
    expect(main.getAllByText(/fictional/i).length).toBeGreaterThan(0)
  })
})

describe('/about names the operator, funding status, and data commitments', () => {
  test('names the Oorvani Foundation as operator', () => {
    const main = renderAt('/about')
    expect(main.getAllByText(/Oorvani Foundation/i).length).toBeGreaterThan(0)
  })

  test('has a funding section explicitly marked pending, with no funders named', () => {
    const main = renderAt('/about')
    expect(main.getByRole('heading', { name: /funding/i })).toBeInTheDocument()
    expect(main.getAllByText(/open|pending|not yet decided|still (being )?decided/i).length).toBeGreaterThan(0)
  })

  test('states the data commitments: no sale/sharing, and contacts used only for election + critical updates', () => {
    const main = renderAt('/about')
    expect(main.getAllByText(/does not sell|not sell or share/i).length).toBeGreaterThan(0)
    expect(main.getAllByText(/ward.*election updates|election updates/i).length).toBeGreaterThan(0)
    expect(main.getAllByText(/critical product updates/i).length).toBeGreaterThan(0)
  })
})

test('footer links all six trust and legal pages', () => {
  const router = createMemoryRouter(routeObjects, { initialEntries: ['/'] })
  render(
    <AppProviders>
      <RouterProvider router={router} />
    </AppProviders>,
  )
  const footer = within(screen.getByRole('contentinfo'))

  const expected: { href: string; name: RegExp }[] = [
    { href: '/about', name: /about/i },
    { href: '/data', name: /^data$/i },
    { href: '/partner-with-us', name: /partner/i },
    { href: '/press', name: /^press$/i },
    { href: '/terms', name: /^terms$/i },
    { href: '/privacy', name: /^privacy$/i },
  ]

  for (const { href, name } of expected) {
    expect(footer.getByRole('link', { name })).toHaveAttribute('href', href)
  }
})
