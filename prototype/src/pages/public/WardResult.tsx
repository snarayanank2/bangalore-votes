import { Link, useParams } from 'react-router-dom'
import { useData, useStoreVersion } from '../../context/DataContext'
import { RegisterForUpdatesSlot } from '../../components/RegisterForUpdatesSlot'

/**
 * Ward result / hub page (IA §3.2, `/ward/:wardId`). Anonymous-readable: shows the
 * post-delimitation ward's identity and links out to the ward's candidates, issues, and voting
 * logistics. Carries the "register for updates" slot (PRD §5.1) — home-ward SWITCHING lives on
 * `/account` only, not here; see `RegisterForUpdatesSlot`.
 */
export default function WardResult() {
  const { wardId } = useParams<{ wardId: string }>()
  const data = useData()
  useStoreVersion() // re-render after registration/setHomeWard mutates the store

  const ward = wardId ? data.getWard(wardId) : undefined

  if (!ward) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-8">
        <h1 className="text-xl font-bold text-ink">We couldn&apos;t find that ward</h1>
        <p className="mt-2 text-sm text-ink/70">
          Check the link, or{' '}
          <Link to="/" className="text-brand underline underline-offset-2">
            search for your ward by name
          </Link>
          .
        </p>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-8">
      <div>
        <p className="text-sm font-medium uppercase tracking-wide text-brand">
          Ward #{ward.number} · {ward.corporation} corporation
        </p>
        <h1 className="text-2xl font-bold text-ink sm:text-3xl">{ward.name}</h1>
      </div>

      <section aria-label="Ward boundary map">
        <div
          role="img"
          aria-label={`Illustrative placeholder — not a real map of the ${ward.name} ward boundary`}
          className="flex h-40 items-center justify-center rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 px-4 text-center text-sm text-ink/60"
        >
          Map placeholder — illustrative only, not a real ward boundary. Boundary maps are not
          yet plotted for this prototype.
        </div>
      </section>

      <RegisterForUpdatesSlot wardId={ward.id} />

      <nav aria-label="Ward pages" className="grid gap-3 sm:grid-cols-3">
        <Link
          to={`/ward/${ward.id}/candidates`}
          className="rounded-lg border border-slate-200 p-3 text-center text-sm font-medium text-ink hover:border-brand focus:outline-none focus:ring-2 focus:ring-brand"
        >
          Candidates in this ward
        </Link>
        <Link
          to={`/ward/${ward.id}/issues`}
          className="rounded-lg border border-slate-200 p-3 text-center text-sm font-medium text-ink hover:border-brand focus:outline-none focus:ring-2 focus:ring-brand"
        >
          Ward issues &amp; voting
        </Link>
        <Link
          to="/voting-guide"
          className="rounded-lg border border-slate-200 p-3 text-center text-sm font-medium text-ink hover:border-brand focus:outline-none focus:ring-2 focus:ring-brand"
        >
          Voting guide
        </Link>
      </nav>
    </div>
  )
}
