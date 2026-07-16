import { render, screen, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AppProviders } from '../../App'
import { useAuth } from '../../context/AuthContext'
import { useData } from '../../context/DataContext'
import { useModal, type VoteContext } from '../../context/ModalContext'

let auth: ReturnType<typeof useAuth>
let modal: ReturnType<typeof useModal>
let store: ReturnType<typeof useData>
function Probe() {
  auth = useAuth()
  modal = useModal()
  store = useData()
  return null
}

// NB: the seed already carries koramangala issue votes — u-citizen has an existing vote
// {kor-roads, kor-water} (seed-voter-1 and seed-voter-2 also vote in koramangala). This modal
// PRE-POPULATES from the citizen's prior vote (Fix 2), so it opens with road quality and water
// supply already checked — the test below asserts that, then adds one more issue to reach the
// 3-of-3 cap. Submitting always REPLACES the prior set, which is exactly what castIssueVote
// already does and what the store tests pin. Also: koramangala was extended with a 4th issue,
// `kor-lighting` (see src/data/issues.ts), specifically so the "4th selection is prevented"
// behaviour has a real unchecked box to exercise — every seed ward otherwise has exactly 3
// issues, which would make that case untestable through the real UI.
test('logged-in citizen with an existing vote sees it pre-checked; adding a 3rd hits the cap; submit updates the tally', async () => {
  const user = userEvent.setup()
  render(
    <AppProviders>
      <Probe />
    </AppProviders>,
  )
  act(() => auth.loginAs('u-citizen'))

  const ctx: VoteContext = { wardId: 'koramangala' }
  act(() => modal.openVote(ctx))

  expect(screen.getByRole('dialog', { name: /vote your top 3 issues/i })).toBeInTheDocument()

  // Pre-populated from the existing seed vote {kor-roads, kor-water} — nothing to click yet.
  expect(screen.getByLabelText(/road quality/i)).toBeChecked()
  expect(screen.getByLabelText(/water supply/i)).toBeChecked()
  expect(screen.getByText(/2 of 3 selected/i)).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /update my vote/i })).toBeInTheDocument()

  await user.click(screen.getByLabelText(/garbage collection/i))

  expect(screen.getByText(/3 of 3 selected/i)).toBeInTheDocument()
  const lightingBox = screen.getByLabelText(/street lighting/i)
  expect(lightingBox).toBeDisabled()
  expect(lightingBox).not.toBeChecked()

  await user.click(screen.getByRole('button', { name: /update my vote/i }))

  const tally = store.issueTally('koramangala')
  const roads = tally.find((r) => r.issueId === 'kor-roads')
  const water = tally.find((r) => r.issueId === 'kor-water')
  const waste = tally.find((r) => r.issueId === 'kor-waste')
  const lighting = tally.find((r) => r.issueId === 'kor-lighting')
  // Seed voters (seed-voter-1, seed-voter-2) plus u-citizen's NEW vote (replacing the old one).
  expect(roads?.count).toBe(3)
  expect(water?.count).toBe(3)
  expect(waste?.count).toBe(2)
  expect(lighting?.count).toBe(0)

  const mine = store
    .getState()
    .issueVotes.filter((v) => v.userId === 'u-citizen' && v.wardId === 'koramangala')
  expect(mine).toHaveLength(1)
  expect(new Set(mine[0].issueIds)).toEqual(new Set(['kor-roads', 'kor-water', 'kor-waste']))
})

test('unchecking a selected issue re-enables the disabled ones', async () => {
  const user = userEvent.setup()
  render(
    <AppProviders>
      <Probe />
    </AppProviders>,
  )
  act(() => auth.loginAs('u-citizen'))
  act(() => modal.openVote({ wardId: 'koramangala' }))

  // Pre-populated with {kor-roads, kor-water} (2 of 3) — one more click hits the 3-of-3 cap.
  expect(screen.getByText(/2 of 3 selected/i)).toBeInTheDocument()
  await user.click(screen.getByLabelText(/garbage collection/i))
  expect(screen.getByLabelText(/street lighting/i)).toBeDisabled()

  await user.click(screen.getByLabelText(/garbage collection/i)) // uncheck one
  expect(screen.getByLabelText(/street lighting/i)).not.toBeDisabled()
  expect(screen.getByText(/2 of 3 selected/i)).toBeInTheDocument()
})

test('voting in a ward that is not the citizen home ward is blocked with a clear message', async () => {
  render(
    <AppProviders>
      <Probe />
    </AppProviders>,
  )
  act(() => auth.loginAs('u-citizen')) // home ward: koramangala

  act(() => modal.openVote({ wardId: 'indiranagar' }))

  expect(screen.getByRole('dialog', { name: /vote your top 3 issues/i })).toBeInTheDocument()
  const alert = screen.getByRole('alert')
  expect(alert).toHaveTextContent(/you can only vote in your home ward/i)
  expect(alert).toHaveTextContent(/koramangala/i)
  // No submit affordance / checkboxes when the ward doesn't match — nothing to cast a vote with.
  expect(screen.queryByRole('button', { name: /submit/i })).not.toBeInTheDocument()
  expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
})

test('anonymous vote: login modal shows first, then the vote modal reopens with context intact (resume-in-place)', async () => {
  const user = userEvent.setup()
  render(
    <AppProviders>
      <Probe />
    </AppProviders>,
  )

  const ctx: VoteContext = { wardId: 'indiranagar' }
  act(() => {
    auth.requireAuth(() => modal.openVote(ctx))
    modal.openLogin()
  })

  expect(screen.getByRole('dialog', { name: /sign in/i })).toBeInTheDocument()

  await user.type(screen.getByLabelText(/email or whatsapp/i), 'voter@example.com')
  await user.click(screen.getByRole('button', { name: /send otp/i }))
  await user.type(screen.getByLabelText(/enter the 6-digit code/i), '333333')
  await user.click(screen.getByRole('button', { name: /verify/i }))
  await user.selectOptions(screen.getByLabelText(/home ward/i), 'indiranagar')
  await user.click(screen.getByRole('button', { name: /finish/i }))

  // Login modal is gone, vote modal reopened in its place with the original ward context.
  expect(screen.getByRole('dialog', { name: /vote your top 3 issues/i })).toBeInTheDocument()
  expect(screen.getByLabelText(/traffic congestion/i)).toBeInTheDocument()

  await user.click(screen.getByLabelText(/traffic congestion/i))
  await user.click(screen.getByRole('button', { name: /submit/i }))

  const newUserId = auth.user.id
  const mine = store
    .getState()
    .issueVotes.filter((v) => v.userId === newUserId && v.wardId === 'indiranagar')
  expect(mine).toHaveLength(1)
  expect(mine[0].issueIds).toEqual(['ind-traffic'])
})

// --- Fix 2: reopening the modal pre-populates the citizen's own current vote-set, so a returning
// voter can see and edit their picks instead of the form silently resetting blank and risking an
// unintentionally smaller/different replacement set on submit.
test('closing and reopening the vote modal shows the picks just submitted, not the stale seed set', async () => {
  const user = userEvent.setup()
  render(
    <AppProviders>
      <Probe />
    </AppProviders>,
  )
  act(() => auth.loginAs('u-citizen')) // home ward: koramangala

  act(() => modal.openVote({ wardId: 'koramangala' }))
  // Seed vote {kor-roads, kor-water} is pre-checked.
  expect(screen.getByLabelText(/road quality/i)).toBeChecked()
  expect(screen.getByLabelText(/water supply/i)).toBeChecked()
  expect(screen.getByLabelText(/garbage collection/i)).not.toBeChecked()
  expect(screen.getByLabelText(/street lighting/i)).not.toBeChecked()

  // Change the vote: drop water supply, add garbage collection and street lighting.
  await user.click(screen.getByLabelText(/water supply/i))
  await user.click(screen.getByLabelText(/garbage collection/i))
  await user.click(screen.getByLabelText(/street lighting/i))
  await user.click(screen.getByRole('button', { name: /update my vote/i }))
  expect(screen.getByText(/recorded/i)).toBeInTheDocument()

  act(() => modal.close())
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

  act(() => modal.openVote({ wardId: 'koramangala' }))
  expect(screen.getByRole('dialog', { name: /vote your top 3 issues/i })).toBeInTheDocument()

  // Reopened form shows the vote just submitted, not the original seed set.
  expect(screen.getByLabelText(/road quality/i)).toBeChecked()
  expect(screen.getByLabelText(/water supply/i)).not.toBeChecked()
  expect(screen.getByLabelText(/garbage collection/i)).toBeChecked()
  expect(screen.getByLabelText(/street lighting/i)).toBeChecked()
  expect(screen.getByText(/3 of 3 selected/i)).toBeInTheDocument()
})
