import { Link } from 'react-router-dom'
import oorvaniLogo from '../assets/oorvani-logo.png'

/**
 * Global footer (present on every page). Per PRD §13 / IA §1, the trust and legal pages
 * (`/about`, `/data`, `/partner-with-us`, `/press`, `/terms`, `/privacy`) are reached only from
 * here, not the app bar — none of them earn top-level space, but all must be one click from
 * anywhere, since the moment a citizen doubts the platform is the moment they go looking.
 */
export function Footer() {
  return (
    <footer role="contentinfo" className="mt-12 border-t border-slate-200 bg-slate-50 px-4 py-6">
      <nav aria-label="Footer" className="mx-auto flex max-w-2xl flex-wrap gap-x-6 gap-y-2 text-sm">
        <Link to="/about" className="text-ink hover:text-brand focus:outline-none focus:ring-2 focus:ring-brand rounded">
          About &amp; how we source data
        </Link>
        <Link to="/voting-guide" className="text-ink hover:text-brand focus:outline-none focus:ring-2 focus:ring-brand rounded">
          Voting guide
        </Link>
        <Link to="/data" className="text-ink hover:text-brand focus:outline-none focus:ring-2 focus:ring-brand rounded">
          Data
        </Link>
        <Link to="/partner-with-us" className="text-ink hover:text-brand focus:outline-none focus:ring-2 focus:ring-brand rounded">
          Partner with us
        </Link>
        <Link to="/press" className="text-ink hover:text-brand focus:outline-none focus:ring-2 focus:ring-brand rounded">
          Press
        </Link>
        <Link to="/terms" className="text-ink hover:text-brand focus:outline-none focus:ring-2 focus:ring-brand rounded">
          Terms
        </Link>
        <Link to="/privacy" className="text-ink hover:text-brand focus:outline-none focus:ring-2 focus:ring-brand rounded">
          Privacy
        </Link>
      </nav>

      <a
        href="https://opencity.in"
        target="_blank"
        rel="noreferrer"
        className="mx-auto mt-4 flex max-w-2xl items-center gap-2 rounded focus:outline-none focus:ring-2 focus:ring-brand"
      >
        <span className="text-sm text-ink/70">A program by</span>
        <img src={oorvaniLogo} alt="Oorvani Foundation" className="h-4 w-auto" />
      </a>
    </footer>
  )
}
