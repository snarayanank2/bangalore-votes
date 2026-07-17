import { render, screen, within } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { routeObjects } from '../../routes'
import { AppProviders } from '../../App'
import { seedPartners } from '../../data/partners'

function renderAt(path: string) {
  const router = createMemoryRouter(routeObjects, { initialEntries: [path] })
  render(
    <AppProviders>
      <RouterProvider router={router} />
    </AppProviders>,
  )
  return within(screen.getByRole('main'))
}

test('/partner/{slug} renders anonymously for a known partner (unlisted, not access-controlled)', () => {
  const partner = seedPartners[0]
  const main = renderAt(`/partner/${partner.slug}`)
  expect(main.getByRole('heading', { level: 1, name: new RegExp(partner.name.split(' ')[0], 'i') })).toBeInTheDocument()
})

test('an unknown partner slug degrades gracefully — no crash, a friendly message instead', () => {
  const main = renderAt('/partner/does-not-exist-at-all')
  expect(main.getByRole('heading', { level: 1, name: /not found/i })).toBeInTheDocument()
  expect(main.getByText(/don't recognise this partner link/i)).toBeInTheDocument()
})

test('the kit carries a tagged link back to the site', () => {
  const partner = seedPartners[0]
  const main = renderAt(`/partner/${partner.slug}`)
  const link = main.getByRole('textbox', { name: /tagged link/i }) as HTMLInputElement
  expect(link.value).toContain(`src=${partner.slug}`)
})

test('the kit carries ready-to-paste WhatsApp forward text in English', () => {
  const partner = seedPartners[0]
  const main = renderAt(`/partner/${partner.slug}`)
  expect(main.getAllByRole('heading', { name: /english/i }).length).toBe(2)
  expect(main.getAllByText(new RegExp(`src=${partner.slug}`)).length).toBe(2)
})

test('the Kannada forward text is honestly marked pending, not machine-invented', () => {
  const partner = seedPartners[0]
  const main = renderAt(`/partner/${partner.slug}`)
  expect(main.getByRole('heading', { name: /ಕನ್ನಡ|kannada/i })).toBeInTheDocument()
  expect(main.getByText(/not yet available|pending/i)).toBeInTheDocument()
})

test('the poster is a clearly-labelled placeholder, not a real asset', () => {
  const partner = seedPartners[0]
  const main = renderAt(`/partner/${partner.slug}`)
  expect(main.getByText(/poster placeholder/i)).toBeInTheDocument()
  expect(main.getByText(/no final artwork/i)).toBeInTheDocument()
})

test('the kit carries a neutrality statement answering the "is this campaigning" question', () => {
  const partner = seedPartners[0]
  const main = renderAt(`/partner/${partner.slug}`)
  expect(main.getAllByText(/campaign/i).length).toBeGreaterThan(0)
})

test('the kit page states the partner is a fictional demo organisation', () => {
  const partner = seedPartners[0]
  const main = renderAt(`/partner/${partner.slug}`)
  expect(main.getAllByText(/fictional/i).length).toBeGreaterThan(0)
})

test('the kit page is not linked from the footer (unlisted)', () => {
  const router = createMemoryRouter(routeObjects, { initialEntries: ['/'] })
  render(
    <AppProviders>
      <RouterProvider router={router} />
    </AppProviders>,
  )
  const footer = within(screen.getByRole('contentinfo'))
  expect(footer.queryByRole('link', { name: /partner kit/i })).not.toBeInTheDocument()
})

// --- PRD §5.12: first-time voter forward-text variant linking the /voting-guide checklist ------

test('kit carries a first-time voter WhatsApp variant whose tagged link points at the checklist', () => {
  const main = renderAt('/partner/demo-rwa-one')

  expect(main.getByRole('heading', { name: /first.time voter/i })).toBeInTheDocument()
  const ftv = main.getByText(/first Bengaluru ward election/i)
  expect(ftv.textContent).toContain(
    'https://bangalore-votes.opencity.in/voting-guide?src=demo-rwa-one',
  )
  // The general message is still there too, tagged to the home page.
  expect(main.getByText(/new GBA ward boundaries/i).textContent).toContain(
    'https://bangalore-votes.opencity.in/?src=demo-rwa-one',
  )
})
