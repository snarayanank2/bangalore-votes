import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Modal } from '../Modal'
import { useAuth } from '../../context/AuthContext'
import { useData } from '../../context/DataContext'
import { useI18n, type Lang } from '../../context/I18nContext'

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
}

/** The contact → OTP → ward/language wizard, shared by the modal (`RegisterLogin`) and the
 * `/login` full-page fallback (IA §7.1) so both stay in sync with exactly one implementation. */
export function RegisterLoginForm({ onDone, open = true }: RegisterLoginFormProps) {
  const { loginNew, resolvePending } = useAuth()
  const { listWards } = useData()
  const { setLang } = useI18n()

  const [step, setStep] = useState<Step>('contact')
  const [contact, setContact] = useState('')
  const [otp, setOtp] = useState('')
  const [homeWardId, setHomeWardId] = useState('')
  const [lang, setLangChoice] = useState<Lang>('en')
  const [error, setError] = useState<string | null>(null)

  // Reset the wizard every time it (re)opens, so a closed-then-reopened modal doesn't resume
  // mid-flow with stale input.
  useEffect(() => {
    if (open) {
      setStep('contact')
      setContact('')
      setOtp('')
      setHomeWardId('')
      setLangChoice('en')
      setError(null)
    }
  }, [open])

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
    loginNew(contact, homeWardId, lang)
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
      {error && (
        <p role="alert" className="rounded bg-red-50 px-3 py-2 text-sm text-red-800">
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
              className="w-full rounded border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
              placeholder="you@example.com or +91…"
            />
          </div>
          <button
            type="submit"
            className="w-full rounded bg-brand px-4 py-2 text-sm font-semibold text-white focus:outline-none focus:ring-2 focus:ring-brand"
          >
            Send OTP
          </button>
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
              maxLength={6}
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
              className="w-full rounded border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
            />
          </div>
          <button
            type="submit"
            className="w-full rounded bg-brand px-4 py-2 text-sm font-semibold text-white focus:outline-none focus:ring-2 focus:ring-brand"
          >
            Verify
          </button>
        </form>
      )}

      {step === 'ward' && (
        <form onSubmit={handleFinish} className="space-y-3">
          <div>
            <label htmlFor="rl-ward" className="mb-1 block text-sm font-medium text-ink">
              Home ward
            </label>
            <select
              id="rl-ward"
              value={homeWardId}
              onChange={(e) => setHomeWardId(e.target.value)}
              className="w-full rounded border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
            >
              <option value="">Select your ward…</option>
              {wards.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </select>
          </div>
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
          <button
            type="submit"
            className="w-full rounded bg-brand px-4 py-2 text-sm font-semibold text-white focus:outline-none focus:ring-2 focus:ring-brand"
          >
            Finish
          </button>
        </form>
      )}
    </div>
  )
}

interface RegisterLoginProps {
  open: boolean
  onClose: () => void
}

/** The Register/Login modal (IA §7.1) — the app-wide overlay ModalContext mounts. Never changes
 * the URL; `/login` (pages/public/Login.tsx) renders the same `RegisterLoginForm` full-page as a
 * fallback for deep links / no-JS, per the IA. */
export function RegisterLogin({ open, onClose }: RegisterLoginProps) {
  return (
    <Modal open={open} onClose={onClose} title="Sign in">
      <RegisterLoginForm onDone={onClose} open={open} />
    </Modal>
  )
}
