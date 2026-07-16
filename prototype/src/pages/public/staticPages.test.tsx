import { fireEvent, render, screen, within } from '@testing-library/react'
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
  // Scope queries to the page content, not the shared AppBar/Footer shell — the AppBar's
  // mandatory fictional-data banner and dev role switcher also contain words like "Prototype",
  // which would otherwise collide with this suite's own honesty assertions.
  return within(screen.getByRole('main'))
}

const PAGES: { path: string; heading: RegExp }[] = [
  { path: '/check-registration', heading: /check.*registration/i },
  { path: '/about-election', heading: /election/i },
  { path: '/voting-guide', heading: /voting guide/i },
  { path: '/voting-guide/voter-id', heading: /voter.id/i },
  { path: '/voting-guide/how-to-vote', heading: /how to vote/i },
  { path: '/voting-guide/find-booth', heading: /polling booth|find.*booth/i },
  { path: '/about', heading: /about/i },
]

test.each(PAGES)('$path renders its <h1>', ({ path, heading }) => {
  const main = renderAt(path)
  expect(main.getByRole('heading', { level: 1, name: heading })).toBeInTheDocument()
})

test('voting guide hub links to all three sub-guides', () => {
  const main = renderAt('/voting-guide')

  expect(main.getByRole('link', { name: /voter.id/i })).toHaveAttribute(
    'href',
    '/voting-guide/voter-id',
  )
  expect(main.getByRole('link', { name: /how to vote/i })).toHaveAttribute(
    'href',
    '/voting-guide/how-to-vote',
  )
  expect(main.getByRole('link', { name: /find.*(booth|polling)/i })).toHaveAttribute(
    'href',
    '/voting-guide/find-booth',
  )
})

test('how-to-vote renders a numbered step list', () => {
  const main = renderAt('/voting-guide/how-to-vote')
  expect(main.getAllByRole('listitem').length).toBeGreaterThanOrEqual(3)
})

test('voter-id renders numbered step lists', () => {
  const main = renderAt('/voting-guide/voter-id')
  expect(main.getAllByRole('listitem').length).toBeGreaterThanOrEqual(3)
})

test('check-registration: is a guided link-out, with no on-platform voter-detail form', () => {
  const main = renderAt('/check-registration')

  expect(main.queryByRole('textbox')).not.toBeInTheDocument()
  expect(main.getAllByText(/no voter details are entered or stored/i).length).toBeGreaterThan(0)
})

test('check-registration: the official EC link is an inert placeholder, never implied to work', () => {
  const main = renderAt('/check-registration')

  const ecLink = main.getByRole('link', { name: /election commission|official.*roll|ec /i })
  expect(ecLink).toHaveAttribute('href', '#')
})

test('find-booth: the lookup result is clearly labelled as a prototype demo, not a real booth lookup', () => {
  const main = renderAt('/voting-guide/find-booth')

  const input = main.getByRole('textbox', { name: /address|voter id|epic/i })
  expect(input).toBeInTheDocument()
  const button = main.getByRole('button', { name: /find|search|look ?up/i })
  fireEvent.click(button)

  expect(main.getAllByText(/prototype/i).length).toBeGreaterThan(0)
  expect(main.getAllByText(/demo|not a real|sample/i).length).toBeGreaterThan(0)
})

test('about-election: shows a fixed countdown/status target, not a live clock', () => {
  const main = renderAt('/about-election')
  // No numeric "days remaining" computed live — just asserts the page renders explanatory
  // content; the absence of Date.now() is enforced by code review / grep, not by this test.
  expect(main.getAllByText(/corporator/i).length).toBeGreaterThan(0)
})

test('about: states plainly that this is a prototype with fictional data', () => {
  const main = renderAt('/about')

  expect(main.getAllByText(/prototype/i).length).toBeGreaterThan(0)
  expect(main.getAllByText(/fictional/i).length).toBeGreaterThan(0)
})

test('about: lists primary sources as clearly-marked placeholder links, not working URLs', () => {
  const main = renderAt('/about')

  expect(main.getByRole('heading', { name: /primary sources/i })).toBeInTheDocument()
  const links = [
    main.getByRole('link', { name: /EC candidate nomination affidavits/i }),
    main.getByRole('link', { name: /official election notifications/i }),
    main.getByRole('link', { name: /GBA ward-delimitation data/i }),
  ]
  for (const link of links) {
    expect(link).toHaveAttribute('href', '#')
    expect(link.textContent).toMatch(/placeholder link in this prototype/i)
  }
})
