import type { ReactNode } from 'react'
import { useAuth } from '../context/AuthContext'
import { useModal } from '../context/ModalContext'
import { Button, type ButtonVariant } from './Button'

interface GatedButtonProps {
  onAct: () => void
  children: ReactNode
  variant?: ButtonVariant
  className?: string
}

/**
 * A button for the two contribution actions (flag, issue-vote) that are
 * visible to everyone but gated at submit. Delegates to
 * `useAuth().requireAuth`: if the visitor is anonymous, `onAct` is stashed as
 * `pendingAction` instead of running immediately, and the Register/Login modal
 * (ModalContext, Task 10) is opened on top of it. On successful OTP,
 * `resolvePending()` runs the stashed `onAct` — resuming the original action
 * (e.g. reopening the Flag or Cast-issue-vote modal) in place, with no URL
 * change at any point.
 *
 * Renders via the shared `Button` (§7.3) in its full enabled style regardless of auth state — the
 * gate is the modal at tap, never a disabled look (§7.8).
 */
export function GatedButton({ onAct, children, variant = 'secondary', className }: GatedButtonProps) {
  const { requireAuth, isAuthed } = useAuth()
  const { openLogin } = useModal()

  function handleClick(): void {
    requireAuth(onAct)
    if (!isAuthed) openLogin()
  }

  return (
    <Button type="button" variant={variant} onClick={handleClick} className={className}>
      {children}
    </Button>
  )
}
