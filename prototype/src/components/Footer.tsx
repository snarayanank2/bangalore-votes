import { Link } from 'react-router-dom'
import oorvaniLogo from '../assets/oorvani-logo.png'

/**
 * Global footer (present on every page). Per PRD §13 / IA §1, the trust and legal pages
 * (`/about`, `/data`, `/partner-with-us`, `/press`, `/terms`, `/privacy`) are reached only from
 * here, not the app bar — none of them earn top-level space, but all must be one click from
 * anywhere, since the moment a citizen doubts the platform is the moment they go looking.
 */
const LINK_CLASS = 'rounded-sm text-white hover:text-lime'

/** design-system.md §7.2: forest background, white and lime text — the one dark surface in the
 *  system. `.footer-surface` swaps the global focus ring to sun so it's visible against forest
 *  (see index.css). */
export function Footer() {
  return (
    <footer role="contentinfo" className="footer-surface mt-12 bg-forest px-4 py-6">
      <nav aria-label="Footer" className="mx-auto flex max-w-2xl flex-wrap gap-x-6 gap-y-2 text-sm">
        <Link to="/about" className={LINK_CLASS}>
          About &amp; how we source data
        </Link>
        <Link to="/voting-guide" className={LINK_CLASS}>
          Voting guide
        </Link>
        <Link to="/data" className={LINK_CLASS}>
          Data
        </Link>
        <Link to="/partner-with-us" className={LINK_CLASS}>
          Partner with us
        </Link>
        <Link to="/press" className={LINK_CLASS}>
          Press
        </Link>
        <Link to="/terms" className={LINK_CLASS}>
          Terms
        </Link>
        <Link to="/privacy" className={LINK_CLASS}>
          Privacy
        </Link>
      </nav>

      <a
        href="https://opencity.in"
        target="_blank"
        rel="noreferrer"
        className="mx-auto mt-4 flex max-w-2xl items-center gap-2 rounded-sm"
      >
        <span className="text-sm text-white/80">A program by</span>
        <img src={oorvaniLogo} alt="Oorvani Foundation" className="h-4 w-auto" />
      </a>
    </footer>
  )
}
