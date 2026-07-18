import { useAuth } from '../context/AuthContext'
import { useModal } from '../context/ModalContext'
import { Button } from './Button'

interface RegisterForUpdatesSlotProps {
  wardId: string
}

/**
 * The "register for updates" slot (PRD §5.1, IA §3.2/§3.3/§3.5/§3.6) — identical on the ward
 * result, candidates, compare, and issues pages, so it lives here once rather than four times.
 *
 * Three states, keyed off the CURRENT viewer, not the page they're on:
 *  - Anonymous: a "Register for updates" button that opens the Register/Login modal with THIS
 *    ward pre-filled as home ward (`openLogin({ prefillWardId })`) — no picker, no requireAuth
 *    dance, since there is no gated action to resume afterwards, just registration itself.
 *  - Registered, viewing their own home ward: a plain "Receiving updates" status, no control.
 *  - Registered, viewing any other ward: nothing. Switching home ward is deliberately NOT
 *    offered here — it lives on `/account` only (PRD §5.1: "Home-ward switching lives on
 *    /account only, not here"), so a citizen can't casually reassign their vote-bearing home
 *    ward from a page they're just browsing.
 */
export function RegisterForUpdatesSlot({ wardId }: RegisterForUpdatesSlotProps) {
  const { isAuthed, user } = useAuth()
  const { openLogin } = useModal()

  if (isAuthed) {
    if (user.homeWardId !== wardId) return null
    return (
      <p className="rounded-md bg-forest-tint px-3 py-2 text-sm text-forest">
        Receiving updates for this ward.
      </p>
    )
  }

  return (
    <Button type="button" onClick={() => openLogin({ prefillWardId: wardId })}>
      Register for updates
    </Button>
  )
}
