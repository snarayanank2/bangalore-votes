import { useState, type FormEvent } from 'react'
import { useData } from '../../context/DataContext'
import type { InterestPath } from '../../types'

/**
 * Partner with us — recruitment funnel (PRD §5.13, IA §3.15, `/partner-with-us`). Public front
 * door for both offline-recruited roles the platform already has (curator, partner) — see
 * `docs/prd.md` §15: "Recruiting partners and curators is otherwise an offline motion... which
 * does not scale past the team's own network" (and that network is exactly where the
 * central-Bengaluru skew originates).
 *
 * ANONYMOUS BY DESIGN: the form below calls `data.submitInterest` directly — no `useAuth`,
 * no `requireAuth`, no account. Requiring registration first would filter out exactly the RWA/
 * civic-org volunteers this page depends on, and an RWA as an institution doesn't map onto a
 * citizen account with a home ward (see `submitInterest`'s doc comment in store.ts).
 *
 * NOBODY SELF-ACTIVATES: submitting here only ever queues a `pending` application. Accepting
 * (an admin-only action, `reviewInterest` — the admin review page itself is a later task) is
 * what actually provisions a partner slug/kit or hands a curation applicant into vetting; this
 * page never grants access on its own, and says so explicitly before and after submission.
 */
export default function PartnerWithUs() {
  const data = useData()
  const [path, setPath] = useState<InterestPath>('awareness')
  const [name, setName] = useState('')
  const [contact, setContact] = useState('')
  const [wardId, setWardId] = useState('')
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)

  const wards = data.listWards()

  function handleSubmit(event: FormEvent): void {
    event.preventDefault()
    if (!name.trim() || !contact.trim()) {
      setError('Enter your name and a way to reach you (email or WhatsApp).')
      return
    }
    try {
      data.submitInterest({
        path,
        name: name.trim(),
        contact: contact.trim(),
        wardId: wardId || undefined,
        note: note.trim(),
      })
      setError(null)
      setSubmitted(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not submit your application.')
    }
  }

  if (submitted) {
    return (
      <div className="mx-auto max-w-2xl space-y-4 px-4 py-8">
        <h1 className="text-2xl font-bold text-ink sm:text-3xl">Partner with us</h1>
        <div
          role="status"
          className="space-y-2 rounded-lg border border-emerald-300 bg-emerald-50 p-4 text-sm text-emerald-900"
        >
          <p className="font-semibold">Thanks — your application is pending admin review.</p>
          <p>
            Applications are not automatically approved. An admin reviews every application
            before anything is granted. If you&apos;re accepted to spread awareness, you&apos;ll
            get a partner kit page and a tagged link. If you&apos;re accepted to curate data,
            you&apos;ll be onboarded with an assigned ward scope.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl space-y-8 px-4 py-8">
      <div>
        <h1 className="text-2xl font-bold text-ink sm:text-3xl">Partner with us</h1>
        <p className="mt-2 text-sm text-ink/80">
          Bangalore Votes reaches citizens through people and organisations like you — RWAs,
          civic groups, and volunteers — not paid ads (see how we source data on{' '}
          <span className="italic">/about</span>). There are two ways to help.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <section
          aria-labelledby="awareness-heading"
          className="space-y-2 rounded-lg border border-slate-200 p-4"
        >
          <h2 id="awareness-heading" className="text-lg font-semibold text-ink">
            Spread awareness
          </h2>
          <p className="text-sm text-ink/80">
            Forward ward links to your network — an RWA WhatsApp group, a residents&apos;
            mailing list, a community page.
          </p>
          <p className="text-sm text-ink/70">
            <strong>Time commitment:</strong> a few minutes per election update — no ongoing
            work required.
          </p>
          <p className="text-sm text-ink/70">
            <strong>Vetting and neutrality expectation:</strong> forwarding is not campaigning —
            this is a neutral information link, not campaign material, and we&apos;ll give you
            the language to say so if anyone asks.
          </p>
          <p className="text-sm text-ink/70">
            <strong>In return:</strong> a partner kit page, a tagged link, and a report of what
            your forwarding achieved.
          </p>
        </section>
        <section
          aria-labelledby="curation-heading"
          className="space-y-2 rounded-lg border border-slate-200 p-4"
        >
          <h2 id="curation-heading" className="text-lg font-semibold text-ink">
            Curate data
          </h2>
          <p className="text-sm text-ink/80">
            Own the accuracy of a ward&apos;s candidate and issue data.
          </p>
          <p className="text-sm text-ink/70">
            <strong>Time commitment:</strong> ongoing through the campaign — reviewing flags and
            keeping report cards current.
          </p>
          <p className="text-sm text-ink/70">
            <strong>Vetting and neutrality expectation:</strong> a vetting conversation happens
            before you get access. Curator edits publish immediately with no second approval, so
            we need to trust you first.
          </p>
          <p className="text-sm text-ink/70">
            <strong>In return:</strong> assigned ward scope, onboarding, and publish-immediately
            trust once vetted.
          </p>
        </section>
      </div>

      <form
        onSubmit={handleSubmit}
        className="space-y-4 rounded-lg border border-slate-200 p-4"
        aria-label="Express your interest"
      >
        <h2 className="text-lg font-semibold text-ink">Express your interest</h2>
        <p className="text-sm text-ink/70">
          No account needed — this form doesn&apos;t require you to register or sign in.
          Submitting doesn&apos;t grant access to anything by itself; an admin reviews every
          application first.
        </p>

        {error && (
          <p role="alert" className="rounded bg-red-50 px-3 py-2 text-sm text-red-800">
            {error}
          </p>
        )}

        <fieldset>
          <legend className="mb-1 block text-sm font-medium text-ink">I&apos;d like to</legend>
          <div
            role="group"
            aria-label="I'd like to"
            className="flex flex-col gap-2 text-sm sm:flex-row sm:gap-4"
          >
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="pwu-path"
                value="awareness"
                checked={path === 'awareness'}
                onChange={() => setPath('awareness')}
              />
              Spread awareness
            </label>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="pwu-path"
                value="curation"
                checked={path === 'curation'}
                onChange={() => setPath('curation')}
              />
              Curate data
            </label>
          </div>
        </fieldset>

        <div>
          <label htmlFor="pwu-name" className="mb-1 block text-sm font-medium text-ink">
            Name (yours, or your organisation&apos;s)
          </label>
          <input
            id="pwu-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
          />
        </div>

        <div>
          <label htmlFor="pwu-contact" className="mb-1 block text-sm font-medium text-ink">
            Email or WhatsApp number
          </label>
          <input
            id="pwu-contact"
            type="text"
            value={contact}
            onChange={(e) => setContact(e.target.value)}
            placeholder="you@example.com or +91…"
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
          />
        </div>

        <div>
          <label htmlFor="pwu-ward" className="mb-1 block text-sm font-medium text-ink">
            Ward (optional)
          </label>
          <select
            id="pwu-ward"
            value={wardId}
            onChange={(e) => setWardId(e.target.value)}
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
          >
            <option value="">Not sure / not applicable</option>
            {wards.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="pwu-note" className="mb-1 block text-sm font-medium text-ink">
            Tell us a bit more (optional)
          </label>
          <textarea
            id="pwu-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
          />
        </div>

        <button
          type="submit"
          className="rounded bg-brand px-4 py-2 text-sm font-semibold text-white focus:outline-none focus:ring-2 focus:ring-brand"
        >
          Submit application
        </button>
      </form>
    </div>
  )
}
