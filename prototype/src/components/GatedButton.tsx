import type { ReactNode } from 'react'
import { useAuth } from '../context/AuthContext'
import { useModal } from '../context/ModalContext'

interface GatedButtonProps {
  onAct: () => void
  children: ReactNode
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
 */
export function GatedButton({ onAct, children, className }: GatedButtonProps) {
  const { requireAuth, isAuthed } = useAuth()
  const { openLogin } = useModal()

  function handleClick(): void {
    requireAuth(onAct)
    if (!isAuthed) openLogin()
  }

  return (
    <button type="button" onClick={handleClick} className={className}>
      {children}
    </button>
  )
}
