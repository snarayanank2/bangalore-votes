import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useData, useStoreVersion } from '../../context/DataContext'
import { useI18n, type Lang } from '../../context/I18nContext'

/**
 * My account (PRD §5.1/§8, IA §4.1, `/account`). Registered-only (RoleGuard wraps this route for
 * citizen/curator/admin — see routes.tsx). Shows basic profile, the user's SAVED language
 * preference, and their registered home ward.
 *
 * Saved language vs. the AppBar's EN|ಕನ್ನಡ toggle: the AppBar toggle (`useI18n`) is a session-only
 * choice for everyone, including anonymous visitors. This page's select is the persisted per-user
 * preference (PRD §8 — it also governs the language of the user's own notifications). Changing it
 * here updates BOTH: the store (so it survives reload) and the session-wide `useI18n` toggle (so
 * the change is visible immediately, not just on the next login) — a registered user changing
 * their saved language expects the UI to actually switch, not silently record a preference that
 * only takes effect after a future visit.
 */
export default function Account() {
  const { user } = useAuth()
  const data = useData()
  const { lang, setLang } = useI18n()
  useStoreVersion() // re-render after setLanguagePref/setHomeWard mutate this user

  const wards = data.listWards()
  const homeWard = user.homeWardId ? data.getWard(user.homeWardId) : undefined

  function handleLanguageChange(value: string): void {
    const next = value as Lang
    data.setLanguagePref(user.id, next)
    setLang(next)
  }

  return (
    <div className="mx-auto max-w-2xl space-y-8 px-4 py-8">
      <div>
        <h1 className="text-2xl font-bold text-ink sm:text-3xl">My account</h1>
        <p className="mt-1 text-sm text-ink/70">
          {user.name} &middot; {user.contact}
        </p>
      </div>

      <nav aria-label="Account pages" className="flex flex-wrap gap-3 text-sm">
        <Link
          to="/account/notifications"
          className="rounded border border-slate-300 px-3 py-1.5 font-medium text-ink hover:border-brand focus:outline-none focus:ring-2 focus:ring-brand"
        >
          Notification settings
        </Link>
        <Link
          to="/account/submissions"
          className="rounded border border-slate-300 px-3 py-1.5 font-medium text-ink hover:border-brand focus:outline-none focus:ring-2 focus:ring-brand"
        >
          My submissions
        </Link>
      </nav>

      <section aria-labelledby="profile-heading" className="space-y-3 border-t border-slate-200 pt-6">
        <h2 id="profile-heading" className="text-lg font-semibold text-ink">
          Profile
        </h2>
        <dl className="space-y-2 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-ink/70">Name</dt>
            <dd className="font-medium text-ink">{user.name}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-ink/70">Email / WhatsApp</dt>
            <dd className="font-medium text-ink">{user.contact}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-ink/70">Role</dt>
            <dd className="font-medium capitalize text-ink">{user.role}</dd>
          </div>
        </dl>
      </section>

      <section aria-labelledby="language-heading" className="space-y-2 border-t border-slate-200 pt-6">
        <h2 id="language-heading" className="text-lg font-semibold text-ink">
          Language
        </h2>
        <label htmlFor="account-language" className="mb-1 block text-sm font-medium text-ink">
          Saved language preference
        </label>
        <select
          id="account-language"
          value={lang}
          onChange={(e) => handleLanguageChange(e.target.value)}
          className="w-full max-w-xs rounded border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
        >
          <option value="en">English</option>
          <option value="kn">ಕನ್ನಡ (Kannada)</option>
        </select>
        <p className="text-xs text-ink/60">
          Also used for the language of your own notifications and updates.
        </p>
      </section>

      <section aria-labelledby="ward-heading" className="space-y-2 border-t border-slate-200 pt-6">
        <h2 id="ward-heading" className="text-lg font-semibold text-ink">
          Home ward
        </h2>
        <label htmlFor="account-home-ward" className="mb-1 block text-sm font-medium text-ink">
          Home ward
        </label>
        <select
          id="account-home-ward"
          value={user.homeWardId ?? ''}
          onChange={(e) => data.setHomeWard(user.id, e.target.value, user)}
          className="w-full max-w-xs rounded border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
        >
          <option value="" disabled>
            Choose your ward
          </option>
          {wards.map((ward) => (
            <option key={ward.id} value={ward.id}>
              {ward.name}
            </option>
          ))}
        </select>
        {homeWard && (
          <p className="text-xs text-ink/60">
            You can vote on top issues in{' '}
            <Link to={`/ward/${homeWard.id}/issues`} className="text-brand underline underline-offset-2">
              {homeWard.name}
            </Link>
            .
          </p>
        )}
      </section>
    </div>
  )
}
