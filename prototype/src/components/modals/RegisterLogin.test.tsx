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
