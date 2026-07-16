import { createContext, useContext, useState, type ReactNode } from 'react'
import { RegisterLogin } from '../components/modals/RegisterLogin'

/** A field the citizen can flag as wrong, shown as a choice in the Flag modal. */
export interface FlagField {
  key: string
  label: string
}

/** Context passed to `openFlag` — which ward/candidate/field-set the Flag modal targets.
 * Flagging works across ANY ward, not just the visitor's home ward (IA §7.2). */
export interface FlagContext {
  wardId: string
  candidateId?: string
  fields: FlagField[]
}

/** Context passed to `openVote` — which ward's issue list the Cast-issue-vote modal targets.
 * Voting is restricted to the user's registered home ward (enforced in the modal + the store). */
export interface VoteContext {
  wardId: string
}

type ModalState =
  | { kind: 'none' }
  | { kind: 'login' }
  | { kind: 'flag'; ctx: FlagContext }
  | { kind: 'vote'; ctx: VoteContext }

interface ModalValue {
  openLogin: () => void
  openFlag: (ctx: FlagContext) => void
  openVote: (ctx: VoteContext) => void
  close: () => void
}

const ModalContext = createContext<ModalValue | null>(null)

/**
 * Single app-wide modal host for the three overlays defined in the IA (§7): Register/Login, Flag
 * misinformation, Cast issue vote. `ModalState` is one tagged union rather than three independent
 * booleans, so exactly one of the three can ever be open at a time — matching the product rule
 * that these are page-blocking overlays, never stacked.
 *
 * Mounted once in App.tsx, inside the Auth/I18n/Data provider tree, so the modal components it
 * renders (RegisterLogin here; FlagMisinformation/CastIssueVote added by Tasks 11/12) can call
 * useAuth()/useData()/useI18n() themselves. Never touches the URL/router — see Modal.tsx.
 */
export function ModalProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ModalState>({ kind: 'none' })

  const value: ModalValue = {
    openLogin: () => setState({ kind: 'login' }),
    openFlag: (ctx) => setState({ kind: 'flag', ctx }),
    openVote: (ctx) => setState({ kind: 'vote', ctx }),
    close: () => setState({ kind: 'none' }),
  }

  return (
    <ModalContext.Provider value={value}>
      {children}
      <RegisterLogin open={state.kind === 'login'} onClose={value.close} />
    </ModalContext.Provider>
  )
}

export function useModal(): ModalValue {
  const ctx = useContext(ModalContext)
  if (!ctx) throw new Error('useModal must be used within ModalProvider')
  return ctx
}
