import { render, screen, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AppProviders } from '../../App'
import { useAuth } from '../../context/AuthContext'
import { useData } from '../../context/DataContext'
import { useModal, type FlagContext } from '../../context/ModalContext'

let auth: ReturnType<typeof useAuth>
let modal: ReturnType<typeof useModal>
let store: ReturnType<typeof useData>
function Probe() {
  auth = useAuth()
  modal = useModal()
  store = useData()
  return null
}

// NB: the seed already carries a pending flag on koramangala/c-kor-1/assets (`sub-1`, count 2).
// This test deliberately targets `education` on that candidate — a field with no seed flag — so
// it proves the modal creates a NEW submission. The dedup-onto-existing path is covered below.
test('logged-in citizen flags a candidate field; a pending submission with count 1 is created', async () => {
  const user = userEvent.setup()
  render(
    <AppProviders>
      <Probe />
    </AppProviders>,
  )
  act(() => auth.loginAs('u-citizen'))

  const ctx: FlagContext = {
    wardId: 'koramangala',
    candidateId: 'c-kor-1',
    fields: [{ key: 'education', label: 'Education' }],
  }
  act(() => modal.openFlag(ctx))

  expect(screen.getByRole('dialog', { name: /flag misinformation/i })).toBeInTheDocument()

  await user.type(screen.getByLabelText(/detail/i), 'Degree year does not match the affidavit.')
  await user.click(screen.getByRole('button', { name: /submit/i }))

  const submission = store
    .listSubmissionsByUser('u-citizen')
    .find((s) => s.field === 'education' && s.candidateId === 'c-kor-1')
  expect(submission).toBeDefined()
  expect(submission?.count).toBe(1)
  expect(submission?.status).toBe('pending')
})

test('flagging a field that already has a pending flag dedups onto it and bumps the count', async () => {
  const user = userEvent.setup()
  render(
    <AppProviders>
      <Probe />
    </AppProviders>,
  )
  act(() => auth.loginAs('u-citizen'))

  const before = store
    .listSubmissionsByUser('u-citizen')
    .find((s) => s.field === 'assets' && s.candidateId === 'c-kor-1')
  expect(before?.count).toBe(2) // seed `sub-1`

  act(() =>
    modal.openFlag({
      wardId: 'koramangala',
      candidateId: 'c-kor-1',
      fields: [{ key: 'assets', label: 'Declared assets' }],
    }),
  )
  await user.type(screen.getByLabelText(/detail/i), 'Assets figure looks understated.')
  await user.click(screen.getByRole('button', { name: /submit/i }))

  const after = store
    .listSubmissionsByUser('u-citizen')
    .filter((s) => s.field === 'assets' && s.candidateId === 'c-kor-1')
  expect(after).toHaveLength(1) // deduped, not a second row
  expect(after[0].id).toBe(before?.id)
  expect(after[0].count).toBe(3)
})

test('anonymous flag: login modal shows first, then the flag modal reopens with context intact (resume-in-place)', async () => {
  const user = userEvent.setup()
  render(
    <AppProviders>
      <Probe />
    </AppProviders>,
  )

  const ctx: FlagContext = {
    wardId: 'malleshwaram',
    candidateId: 'c-mal-1',
    fields: [{ key: 'trackRecord', label: 'Track record' }],
  }
  act(() => {
    auth.requireAuth(() => modal.openFlag(ctx))
    modal.openLogin()
  })

  expect(screen.getByRole('dialog', { name: /sign in/i })).toBeInTheDocument()

  await user.type(screen.getByLabelText(/email or whatsapp/i), 'flagger@example.com')
  await user.click(screen.getByRole('button', { name: /send otp/i }))
  await user.type(screen.getByLabelText(/enter the 6-digit code/i), '222222')
  await user.click(screen.getByRole('button', { name: /verify/i }))
  await user.selectOptions(screen.getByLabelText(/home ward/i), 'malleshwaram')
  await user.click(screen.getByRole('button', { name: /finish/i }))

  // Login modal is gone, flag modal reopened in its place with the original context.
  expect(screen.getByRole('dialog', { name: /flag misinformation/i })).toBeInTheDocument()
  expect(screen.getByRole('option', { name: /track record/i })).toBeInTheDocument()

  await user.type(screen.getByLabelText(/detail/i), 'Track record claim is wrong.')
  await user.click(screen.getByRole('button', { name: /submit/i }))

  const newUserId = auth.user.id
  const submission = store
    .listSubmissionsByUser(newUserId)
    .find((s) => s.field === 'trackRecord' && s.candidateId === 'c-mal-1')
  expect(submission).toBeDefined()
  expect(submission?.count).toBe(1)
})
