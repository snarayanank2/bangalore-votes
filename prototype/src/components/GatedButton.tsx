import type { ReactNode } from 'react'
import { useAuth } from '../context/AuthContext'

interface GatedButtonProps {
  onAct: () => void
  children: ReactNode
  className?: string
}

/**
 * A button for the two contribution actions (flag, issue-vote) that are
 * visible to everyone but gated at submit. Delegates to
 * `useAuth().requireAuth`: if the visitor is anonymous, `onAct` is stashed as
 * `pendingAction` instead of running immediately.
 *
 * Seam for Task 10: this component intentionally does NOT render a login
 * modal itself — a single app-wide Register/Login `Modal` (built in Task 10,
 * likely mounted in `AppBar` or the root layout) should watch
 * `useAuth().pendingAction` and, on successful OTP, call `resolvePending()`
 * to resume the action in place. Wiring that here now would mean either a
 * duplicate modal per `GatedButton` instance or a fake modal that doesn't
 * actually authenticate anyone — both worse than leaving the seam visible.
 */
export function GatedButton({ onAct, children, className }: GatedButtonProps) {
  const { requireAuth } = useAuth()

  return (
    <button type="button" onClick={() => requireAuth(onAct)} className={className}>
      {children}
    </button>
  )
}
