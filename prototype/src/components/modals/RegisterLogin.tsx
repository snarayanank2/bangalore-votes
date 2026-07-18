import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Modal } from '../Modal'
import { Button } from '../Button'
import { useAuth } from '../../context/AuthContext'
import { useData } from '../../context/DataContext'
import { useI18n, type Lang } from '../../context/I18nContext'
import type { LoginContext } from '../../context/ModalContext'
import { getAttributedSrc } from '../../lib/attribution'

// §7.10 forms: labels above inputs, 16px text, 44px min height, radius-sm, gray-300 border,
// forest focus border. Shared across all three steps' text inputs.
const INPUT_CLASS =
  'min-h-[44px] w-full rounded-sm border border-gray-300 px-3 py-2 text-base text-ink focus:border-forest'

type Step = 'contact' | 'otp' | 'ward'

/**
 * Deterministic "sent" 6-digit code for the simulated OTP flow — there is no real delivery and
 * no network call. Any 6-digit input is accepted at the verify step regardless of whether it
 * matches this value; the displayed code exists only to make the demo feel real. Uses a plain
 * string hash rather than Math.random()/Date.now() per the project's ban on both.
 */
function simulatedOtp(contact: string): string {
  let hash = 0
  for (let i = 0; i < contact.length; i += 1) hash = (hash * 31 + contact.charCodeAt(i)) % 1_000_000
  return String(hash).padStart(6, '0')
}

interface RegisterLoginFormProps {
  /** Called once login/registration has fully succeeded (store write + resolvePending already
   *  ran). The modal wrapper uses this to close itself; the `/login` page fallback omits it. */
  onDone?: () => void
  /** Pass the owning modal's `open` state so the wizard resets to step one each time it reopens.
   *  Defaults to true, which is correct for the `/login` page (a fresh mount already starts
   *  clean). */
  open?: boolean
  /** PRD §5.1/§10, IA §3.2/§7.1: when opened from a ward page's "Register for updates" slot, the
   *  ward the visitor is already viewing is carried in here and the ward step shows it read-only
   *  instead of asking the visitor to pick one. Omitted for every other entry point (Sign in,
   *  gated flag/vote actions, the `/login` page), which still ask the visitor to choose. */
  prefillWardId?: string
}

/** The contact → OTP → ward/language wizard, shared by the modal (`RegisterLogin`) and the
 * `/login` full-page fallback (IA §7.1) so both stay in sync with exactly one implementation.
 *
 * CONSENT (PRD §10): the final step links to Terms/Privacy and states what registering signs the
 * user up for — completing it is the affirmative opt-in, recorded by `createUser` as a stamp +
 * wording version (see `REGISTRATION_CONSENT_WORDING_VERSION` in store.ts). This is called out
 * in its own bordered block (not small print) so it isn't skimmed past as boilerplate. The links
 * are plain `<a target="_blank">` anchors, not react-router `Link`: `ModalProvider` renders this
 * modal as a SIBLING of `RouterProvider` (see ModalContext.tsx), so there is no router context
 * available when this form renders as the modal — only when it renders as the `/login` page.
 * Opening in a new tab also means checking Terms/Privacy never loses the in-progress wizard
 * state.
 *
 * FUTURE-TOOLS OPT-IN (PRD §17, deps §2.6/§7.2): a second, OPTIONAL checkbox, visually and
 * functionally separate from the mandatory consent above — leaving it unchecked never blocks
 * "Finish". Whether this belongs in the shipped release is still an open product decision; it is
 * sketched here so the mechanism (a distinct, unticked-by-default checkbox feeding its own field
 * on `User`) exists ahead of that decision, not to imply the decision has been made. See
 * `User.futureToolsConsent`. */
export function RegisterLoginForm({ onDone, open = true, prefillWardId }: RegisterLoginFormProps) {
  const { loginNew, resolvePending } = useAuth()
  const { listWards, getWard } = useData()
  const { setLang } = useI18n()

  const [step, setStep] = useState<Step>('contact')
  const [contact, setContact] = useState('')
  const [otp, setOtp] = useState('')
  const [homeWardId, setHomeWardId] = useState('')
  const [lang, setLangChoice] = useState<Lang>('en')
  const [futureToolsConsent, setFutureToolsConsent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Reset the wizard every time it (re)opens, so a closed-then-reopened modal doesn't resume
  // mid-flow with stale input. homeWardId starts pre-filled when this open came from a ward
  // page's "Register for updates" slot (see prefillWardId above); otherwise it starts blank,
  // same as always.
  useEffect(() => {
    if (open) {
      setStep('contact')
      setContact('')
      setOtp('')
      setHomeWardId(prefillWardId ?? '')
      setLangChoice('en')
      setFutureToolsConsent(false)
      setError(null)
    }
  }, [open, prefillWardId])

  const sentCode = useMemo(() => simulatedOtp(contact), [contact])
  const wards = listWards()

  function handleSendOtp(event: FormEvent) {
    event.preventDefault()
    if (!contact.trim()) {
      setError('Enter an email or WhatsApp number.')
      return
    }
    setError(null)
    setStep('otp')
  }

  function handleVerifyOtp(event: FormEvent) {
    event.preventDefault()
    if (!/^\d{6}$/.test(otp)) {
      setError('Enter the 6-digit code shown above.')
      return
    }
    setError(null)
    setStep('ward')
  }

  function handleFinish(event: FormEvent) {
    event.preventDefault()
    if (!homeWardId) {
      setError('Select your home ward.')
      return
    }
    setError(null)
    // ?src= partner attribution (PRD §5.12): whatever was captured earlier this visit (possibly
    // on a completely different page — see lib/attribution.ts) is applied here, at the moment
    // registration actually happens, regardless of what page this modal was opened from.
    loginNew(contact, homeWardId, lang, getAttributedSrc(), futureToolsConsent)
    setLang(lang)
    // Order matters: ModalContext holds a single tagged-union state, so whichever setState call
    // lands last inside this synchronous handler wins the resulting UI. `onDone` (close) must run
    // BEFORE `resolvePending`, so that if the resumed action itself opens another modal (e.g. the
    // Flag or Cast-issue-vote modal reopening in place), that later state wins over this modal's
    // own close — the login overlay is replaced by the resumed one instead of both collapsing to
    // "none". When there is no pending action, `resolvePending` is a no-op and this modal simply
    // closes, same as before.
    onDone?.()
    resolvePending()
  }

  return (
    <div className="space-y-4">
      {/* Error banner (§7.6): brick text on brick-tint. */}
      {error && (
        <p role="alert" className="rounded-md bg-brick-tint px-3 py-2 text-sm text-brick">
          {error}
        </p>
      )}

      {step === 'contact' && (
        <form onSubmit={handleSendOtp} className="space-y-3">
          <div>
            <label htmlFor="rl-contact" className="mb-1 block text-sm font-medium text-ink">
              Email or WhatsApp number
            </label>
            <input
              id="rl-contact"
              type="text"
              value={contact}
              onChange={(e) => setContact(e.target.value)}
              className={INPUT_CLASS}
              placeholder="you@example.com or +91…"
            />
          </div>
          <Button type="submit" fullWidth>
            Send OTP
          </Button>
        </form>
      )}

      {step === 'otp' && (
        <form onSubmit={handleVerifyOtp} className="space-y-3">
          <p className="text-sm text-ink">
            We sent a 6-digit code to <strong>{contact}</strong>. This is a prototype — no real
            message was sent. Demo code: <strong>{sentCode}</strong>
          </p>
          <div>
            <label htmlFor="rl-otp" className="mb-1 block text-sm font-medium text-ink">
              Enter the 6-digit code
            </label>
            <input
              id="rl-otp"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
              className={INPUT_CLASS}
            />
          </div>
          <Button type="submit" fullWidth>
            Verify
          </Button>
        </form>
      )}

      {step === 'ward' && (
        <form onSubmit={handleFinish} className="space-y-3">
          {prefillWardId ? (
            <div>
              <p className="mb-1 block text-sm font-medium text-ink">Home ward</p>
              <p className="w-full rounded-sm border border-gray-300 bg-gray-100 px-3 py-2 text-base text-ink">
                {getWard(prefillWardId)?.name ?? prefillWardId}
              </p>
              <p className="mt-1 text-xs text-ink/60">
                Set from the ward page you registered from. You can change it later on your
                account page.
              </p>
            </div>
          ) : (
            <div>
              <label htmlFor="rl-ward" className="mb-1 block text-sm font-medium text-ink">
                Home ward
              </label>
              <select
                id="rl-ward"
                value={homeWardId}
                onChange={(e) => setHomeWardId(e.target.value)}
                className={INPUT_CLASS}
              >
                <option value="">Select your ward…</option>
                {wards.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          <fieldset>
            <legend className="mb-1 block text-sm font-medium text-ink">Language</legend>
            <div role="group" aria-label="Language" className="flex gap-4 text-sm">
              <label className="flex items-center gap-1">
                <input
                  type="radio"
                  name="rl-lang"
                  value="en"
                  checked={lang === 'en'}
                  onChange={() => setLangChoice('en')}
                />
                English
              </label>
              <label className="flex items-center gap-1">
                <input
                  type="radio"
                  name="rl-lang"
                  value="kn"
                  checked={lang === 'kn'}
                  onChange={() => setLangChoice('kn')}
                />
                ಕನ್ನಡ
              </label>
            </div>
          </fieldset>
          <div className="rounded-md bg-forest-tint p-3 text-sm text-ink">
            <p>
              By finishing registration, you&apos;re signing up for{' '}
              <strong>ward election updates</strong> on your chosen channels, in your chosen
              language. Read our{' '}
              <a
                href={`${import.meta.env.BASE_URL}terms`}
                target="_blank"
                rel="noreferrer"
                className="font-medium text-forest underline underline-offset-2"
              >
                Terms
              </a>{' '}
              and{' '}
              <a
                href={`${import.meta.env.BASE_URL}privacy`}
                target="_blank"
                rel="noreferrer"
                className="font-medium text-forest underline underline-offset-2"
              >
                Privacy Policy
              </a>
              {' '}(open in a new tab — your registration progress here is kept).
            </p>
          </div>
          <label className="flex items-start gap-2 text-sm text-ink/80">
            <input
              type="checkbox"
              checked={futureToolsConsent}
              onChange={(e) => setFutureToolsConsent(e.target.checked)}
              className="mt-0.5"
            />
            <span>
              Optional: also tell me about future Oorvani civic tools beyond this election. Leaving
              this unchecked doesn&apos;t affect your registration.
            </span>
          </label>
          <Button type="submit" fullWidth>
            Finish
          </Button>
        </form>
      )}
    </div>
  )
}

interface RegisterLoginProps {
  open: boolean
  ctx: LoginContext | null
  onClose: () => void
}

/** The Register/Login modal (IA §7.1) — the app-wide overlay ModalContext mounts. Never changes
 * the URL; `/login` (pages/public/Login.tsx) renders the same `RegisterLoginForm` full-page as a
 * fallback for deep links / no-JS, per the IA. */
export function RegisterLogin({ open, ctx, onClose }: RegisterLoginProps) {
  const { cancelPending } = useAuth()

  // Dismissing WITHOUT completing auth (Esc, backdrop click, or the explicit "X" — all three
  // route through Modal's onClose) means the user abandoned whatever gated action opened this
  // modal, so the stash must be cleared here. The success path (RegisterLoginForm.handleFinish)
  // calls `onDone` = `onClose` directly, bypassing this handler, then resolvePending() — so a
  // completed login still runs the stashed action.
  function handleDismiss(): void {
    cancelPending()
    onClose()
  }

  return (
    <Modal open={open} onClose={handleDismiss} title="Sign in">
      <RegisterLoginForm onDone={onClose} open={open} prefillWardId={ctx?.prefillWardId} />
    </Modal>
  )
}
