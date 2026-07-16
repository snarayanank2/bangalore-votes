import { Link } from 'react-router-dom'

/** Global footer (present on every page): About + voting-guide links. */
export function Footer() {
  return (
    <footer role="contentinfo" className="mt-12 border-t border-slate-200 bg-slate-50 px-4 py-6">
      <nav aria-label="Footer" className="mx-auto flex max-w-5xl flex-wrap gap-x-6 gap-y-2 text-sm">
        <Link to="/about" className="text-ink hover:text-brand focus:outline-none focus:ring-2 focus:ring-brand rounded">
          About &amp; how we source data
        </Link>
        <Link to="/voting-guide" className="text-ink hover:text-brand focus:outline-none focus:ring-2 focus:ring-brand rounded">
          Voting guide
        </Link>
      </nav>
    </footer>
  )
}
