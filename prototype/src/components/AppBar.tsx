import { Link } from 'react-router-dom'
import { useI18n } from '../context/I18nContext'
import { useAuth } from '../context/AuthContext'
import { DevRoleSwitcher } from './DevRoleSwitcher'

/**
 * Global app bar (present on every page): logo → home, EN | ಕನ್ನಡ language
 * toggle, Sign in / Account control, and the dev role switcher. Also carries
 * the mandatory fictional-data warning strip — see the top of this file for
 * why it lives in the shell rather than a page footnote: this prototype
 * deploys publicly against a real upcoming election, and screenshots of
 * candidate report cards can circulate without any surrounding context.
 */
export function AppBar() {
  const { lang, setLang } = useI18n()
  const { user, isAuthed, logout } = useAuth()

  return (
    <header role="banner" className="sticky top-0 z-40 bg-white shadow-sm">
      <div className="w-full border-b border-amber-300 bg-amber-100 px-4 py-1.5 text-center text-xs font-medium text-amber-900 sm:text-sm">
        Prototype — sample data is fictional. Not real candidates or election data.
      </div>
      <div className="mx-auto flex max-w-2xl flex-wrap items-center justify-between gap-3 px-4 py-3">
        <Link
          to="/"
          className="rounded text-lg font-bold text-brand focus:outline-none focus:ring-2 focus:ring-brand"
        >
          Bangalore Votes
        </Link>

        <div className="flex flex-wrap items-center gap-3">
          <div role="group" aria-label="Language" className="flex items-center gap-1 text-sm">
            <button
              type="button"
              onClick={() => setLang('en')}
              aria-pressed={lang === 'en'}
              className={`rounded px-1.5 py-0.5 focus:outline-none focus:ring-2 focus:ring-brand ${
                lang === 'en' ? 'font-semibold text-brand' : 'text-ink'
              }`}
            >
              EN
            </button>
            <span aria-hidden="true" className="text-slate-300">
              |
            </span>
            <button
              type="button"
              onClick={() => setLang('kn')}
              aria-pressed={lang === 'kn'}
              className={`rounded px-1.5 py-0.5 focus:outline-none focus:ring-2 focus:ring-brand ${
                lang === 'kn' ? 'font-semibold text-brand' : 'text-ink'
              }`}
            >
              ಕನ್ನಡ
            </button>
          </div>

          {isAuthed ? (
            <div className="flex items-center gap-2 text-sm">
              <Link to="/account" className="text-ink hover:text-brand focus:outline-none focus:ring-2 focus:ring-brand rounded">
                {user.name}
              </Link>
              <button
                type="button"
                onClick={logout}
                className="rounded text-ink hover:text-brand focus:outline-none focus:ring-2 focus:ring-brand"
              >
                Sign out
              </button>
            </div>
          ) : (
            <Link
              to="/login"
              className="rounded text-sm font-medium text-brand hover:underline focus:outline-none focus:ring-2 focus:ring-brand"
            >
              Sign in
            </Link>
          )}

          <DevRoleSwitcher />
        </div>
      </div>
    </header>
  )
}
