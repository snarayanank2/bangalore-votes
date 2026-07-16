import { render, screen, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AppProviders } from '../../App'
import { useAuth } from '../../context/AuthContext'
import { useModal } from '../../context/ModalContext'

let auth: ReturnType<typeof useAuth>
let modal: ReturnType<typeof useModal>
function Probe() {
  auth = useAuth()
  modal = useModal()
  return null
}

test('register/login modal: contact -> OTP -> ward, then resumes the pending action in place', async () => {
  const user = userEvent.setup()
  render(
    <AppProviders>
      <Probe />
    </AppProviders>,
  )

  let ran = false
  act(() => {
    auth.requireAuth(() => {
      ran = true
    })
  })
  act(() => {
    modal.openLogin()
  })

  expect(screen.getByRole('dialog', { name: /sign in/i })).toBeInTheDocument()

  await user.type(screen.getByLabelText(/email or whatsapp/i), 'new.citizen@example.com')
  await user.click(screen.getByRole('button', { name: /send otp/i }))

  await user.type(screen.getByLabelText(/enter the 6-digit code/i), '123456')
  await user.click(screen.getByRole('button', { name: /verify/i }))

  await user.selectOptions(screen.getByLabelText(/home ward/i), 'koramangala')
  await user.click(screen.getByRole('button', { name: /finish/i }))

  expect(auth.isAuthed).toBe(true)
  expect(ran).toBe(true) // resumed in place
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument() // modal closed, no URL change
})

// --- PRD §10 / IA §7.1: registration is the recorded consent act ------------------------------

test('the ward step links to Terms and Privacy (plain anchors — the modal sits outside the router) and finishing records consent', async () => {
  const user = userEvent.setup()
  render(
    <AppProviders>
      <Probe />
    </AppProviders>,
  )

  act(() => {
    modal.openLogin()
  })
  await user.type(screen.getByLabelText(/email or whatsapp/i), 'consenting@example.com')
  await user.click(screen.getByRole('button', { name: /send otp/i }))
  await user.type(screen.getByLabelText(/enter the 6-digit code/i), '123456')
  await user.click(screen.getByRole('button', { name: /verify/i }))

  const termsLink = screen.getByRole('link', { name: /terms/i })
  const privacyLink = screen.getByRole('link', { name: /privacy policy/i })
  expect(termsLink).toHaveAttribute('href', expect.stringContaining('terms'))
  expect(privacyLink).toHaveAttribute('href', expect.stringContaining('privacy'))
  expect(termsLink).toHaveAttribute('target', '_blank')

  await user.selectOptions(screen.getByLabelText(/home ward/i), 'koramangala')
  await user.click(screen.getByRole('button', { name: /finish/i }))

  expect(auth.user.registrationConsent?.at).toBeTruthy()
  expect(auth.user.registrationConsent?.wordingVersion).toBeTruthy()
})

// --- Fix 1: dismissing the login modal (Esc) must abandon the action it was opened for --------
// Reproduces the 4-step scenario from the code review, end to end through the real modal: (1) a
// gated tap stashes action A and opens the login modal, (2) Esc dismisses the modal WITHOUT
// logging in, (3) an unrelated gated tap stashes action B and reopens the login modal, (4) the
// user completes login. Action A must never fire; action B must.
test('Esc-dismissing the login modal abandons the pending action; a later action is not lost either', async () => {
  const user = userEvent.setup()
  render(
    <AppProviders>
      <Probe />
    </AppProviders>,
  )

  let firstRan = false
  let secondRan = false

  // 1. Gated tap A: "Flag an error" on candidate A -> action A stashed, login modal opens.
  act(() => {
    auth.requireAuth(() => {
      firstRan = true
    })
  })
  act(() => {
    modal.openLogin()
  })
  expect(screen.getByRole('dialog', { name: /sign in/i })).toBeInTheDocument()

  // 2. User dismisses with Esc, without logging in -> action A is abandoned.
  await user.keyboard('{Escape}')
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

  // 3. Gated tap B: "Vote your top 3" elsewhere -> action B stashed, login modal reopens.
  act(() => {
    auth.requireAuth(() => {
      secondRan = true
    })
  })
  act(() => {
    modal.openLogin()
  })
  expect(screen.getByRole('dialog', { name: /sign in/i })).toBeInTheDocument()

  // 4. User completes login.
  await user.type(screen.getByLabelText(/email or whatsapp/i), 'second.citizen@example.com')
  await user.click(screen.getByRole('button', { name: /send otp/i }))
  await user.type(screen.getByLabelText(/enter the 6-digit code/i), '654321')
  await user.click(screen.getByRole('button', { name: /verify/i }))
  await user.selectOptions(screen.getByLabelText(/home ward/i), 'koramangala')
  await user.click(screen.getByRole('button', { name: /finish/i }))

  expect(auth.isAuthed).toBe(true)
  expect(firstRan).toBe(false) // abandoned action A never fires
  expect(secondRan).toBe(true) // action B, stashed after the dismissal, resumes in place
})
