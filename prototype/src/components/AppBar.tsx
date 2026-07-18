import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useI18n } from '../context/I18nContext'
import { useAuth } from '../context/AuthContext'
import { DevRoleSwitcher } from './DevRoleSwitcher'
import opencityLogo from '../assets/opencity-logo.png'

/**
 * Global app bar (present on every page): logo → home, EN | ಕನ್ನಡ language
 * toggle, Sign in / Account control, and the dev role switcher. Also carries
 * the mandatory fictional-data warning strip — see the top of this file for
 * why it lives in the shell rather than a page footnote: this prototype
 * deploys publicly against a real upcoming election, and screenshots of
 * candidate report cards can circulate without any surrounding context.
 *
 * design-system.md §7.1: white, 56px, sticky, `shadow-sticky` ONLY once scrolled (a flat
 * border-bottom otherwise — elevation is border-first per §6.3, so the bar shouldn't float over
 * content it's flush against at the top of the page).
 */
export function AppBar() {
  const { lang, setLang } = useI18n()
  const { user, isAuthed, logout } = useAuth()
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    function onScroll(): void {
      setScrolled(window.scrollY > 0)
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <header
      role="banner"
      className={`sticky top-0 z-40 bg-white ${scrolled ? 'shadow-sticky' : 'border-b border-gray-300'}`}
    >
      {/* Notice banner treatment (§7.6): ink on sun-tint, no countdown. */}
      <div className="w-full bg-sun-tint px-4 py-1.5 text-center text-xs font-medium text-ink sm:text-sm">
        Prototype — sample data is fictional. Not real candidates or election data.
      </div>
      <div className="mx-auto flex h-14 max-w-2xl flex-wrap items-center justify-between gap-3 px-4">
        <div className="flex items-center gap-2">
          <Link to="/" className="rounded-sm font-heading text-lg font-bold text-forest">
            Bangalore Votes
          </Link>
          <a
            href="https://opencity.in"
            target="_blank"
            rel="noreferrer"
            className="flex items-center rounded-sm bg-ink px-2 py-1"
          >
            <img src={opencityLogo} alt="OpenCity" className="h-4 w-auto" />
          </a>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Two-segment language control (§7.1): each label always in its own script; active
           *  segment is forest text on forest-tint. */}
          <div role="group" aria-label="Language" className="flex items-center gap-0.5 rounded-sm bg-gray-100 p-0.5 text-sm">
            <button
              type="button"
              onClick={() => setLang('en')}
              aria-pressed={lang === 'en'}
              className={`rounded-sm px-2 py-1 ${
                lang === 'en' ? 'bg-forest-tint font-semibold text-forest' : 'text-ink'
              }`}
            >
              EN
            </button>
            <button
              type="button"
              onClick={() => setLang('kn')}
              aria-pressed={lang === 'kn'}
              className={`rounded-sm px-2 py-1 ${
                lang === 'kn' ? 'bg-forest-tint font-semibold text-forest' : 'text-ink'
              }`}
            >
              ಕನ್ನಡ
            </button>
          </div>

          {isAuthed ? (
            <div className="flex items-center gap-2 text-sm">
              <Link to="/account" className="rounded-sm text-ink hover:text-forest">
                {user.name}
              </Link>
              <button type="button" onClick={logout} className="rounded-sm text-ink hover:text-forest">
                Sign out
              </button>
            </div>
          ) : (
            <Link to="/login" className="rounded-sm text-sm font-medium text-forest underline underline-offset-2">
              Sign in
            </Link>
          )}

          <DevRoleSwitcher />
        </div>
      </div>
    </header>
  )
}
