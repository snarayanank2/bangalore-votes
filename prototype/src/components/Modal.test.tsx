import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { Modal } from './Modal'

/** Minimal open/close harness so these tests exercise Modal's own a11y/close behavior directly,
 * rather than incidentally through RegisterLogin/FlagMisinformation/CastIssueVote. */
function Harness() {
  const [open, setOpen] = useState(false)
  return (
    <div>
      <button onClick={() => setOpen(true)}>Open modal</button>
      <Modal open={open} onClose={() => setOpen(false)} title="Test modal">
        <button>Inside dialog</button>
      </Modal>
    </div>
  )
}

test('dialog has role="dialog", aria-modal, and is labelled by its title', async () => {
  const user = userEvent.setup()
  render(<Harness />)
  await user.click(screen.getByRole('button', { name: 'Open modal' }))

  const dialog = screen.getByRole('dialog', { name: 'Test modal' })
  expect(dialog).toHaveAttribute('aria-modal', 'true')
  expect(dialog).toHaveAccessibleName('Test modal')
})

test('Esc closes the modal', async () => {
  const user = userEvent.setup()
  render(<Harness />)
  await user.click(screen.getByRole('button', { name: 'Open modal' }))
  expect(screen.getByRole('dialog')).toBeInTheDocument()

  await user.keyboard('{Escape}')
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
})

test('backdrop click closes the modal', async () => {
  const user = userEvent.setup()
  render(<Harness />)
  await user.click(screen.getByRole('button', { name: 'Open modal' }))

  const dialog = screen.getByRole('dialog')
  const backdrop = dialog.parentElement
  expect(backdrop).not.toBeNull()
  await user.click(backdrop!)

  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
})

test('clicking inside the dialog does not close it', async () => {
  const user = userEvent.setup()
  render(<Harness />)
  await user.click(screen.getByRole('button', { name: 'Open modal' }))

  await user.click(screen.getByRole('dialog'))
  expect(screen.getByRole('dialog')).toBeInTheDocument()

  await user.click(screen.getByRole('button', { name: 'Inside dialog' }))
  expect(screen.getByRole('dialog')).toBeInTheDocument()
})

test('focus moves into the dialog on open and returns to the trigger on close', async () => {
  const user = userEvent.setup()
  render(<Harness />)
  const trigger = screen.getByRole('button', { name: 'Open modal' })

  await user.click(trigger)
  expect(screen.getByRole('dialog')).toHaveFocus()

  await user.keyboard('{Escape}')
  expect(trigger).toHaveFocus()
})

test('focus returns to the trigger after a backdrop-click dismissal too', async () => {
  const user = userEvent.setup()
  render(<Harness />)
  const trigger = screen.getByRole('button', { name: 'Open modal' })

  await user.click(trigger)
  const dialog = screen.getByRole('dialog')
  const backdrop = dialog.parentElement!
  await user.click(backdrop)

  expect(trigger).toHaveFocus()
})
