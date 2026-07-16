import { useState, type FormEvent } from 'react'

/**
 * Check registration / eligibility (PRD §5.6, IA §3.7, `/check-registration`). Anonymous,
 * available months before candidate data exists — this is one of the earliest things citizens
 * look for.
 *
 * HONESTY: this static prototype has no connection to the real GBA electoral roll. The lookup
 * below always returns the same fixed, clearly-labelled DEMO result — it must never be mistaken
 * for a genuine roll check, because a citizen acting on a fabricated result is real-world harm.
 * The actual roll check is the Election Commission's own tool; we link out to it (as an inert
 * `href="#"` placeholder in this prototype) rather than pretend to replicate it.
 */
export default function CheckRegistration() {
  const [voterId, setVoterId] = useState('')
  const [checked, setChecked] = useState(false)

  function handleSubmit(event: FormEvent): void {
    event.preventDefault()
    setChecked(true)
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-8">
      <div>
        <h1 className="text-2xl font-bold text-ink sm:text-3xl">Check your registration</h1>
        <p className="mt-2 text-sm text-ink/80">
          Confirm whether you&apos;re on the GBA electoral roll before election day. Roll lookup
          tools like this are useful months in advance — well before candidate lists are
          published — so you have time to fix a problem if you find one.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3 rounded-lg border border-slate-200 p-4">
        <label htmlFor="voter-id-lookup" className="block text-sm font-medium text-ink">
          Voter ID (EPIC number) or full name
        </label>
        <input
          id="voter-id-lookup"
          type="text"
          value={voterId}
          onChange={(event) => setVoterId(event.target.value)}
          placeholder="e.g. ABC1234567"
          autoComplete="off"
          className="w-full rounded border border-slate-300 px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-brand"
        />
        <button
          type="submit"
          className="rounded bg-brand px-4 py-2 text-sm font-semibold text-white focus:outline-none focus:ring-2 focus:ring-brand"
        >
          Check my registration
        </button>
      </form>

      {checked && (
        <div
          role="status"
          className="space-y-2 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900"
        >
          <p className="font-semibold uppercase tracking-wide">
            Prototype demo result — not a real lookup
          </p>
          <p>
            This is a sample result for demonstration only. This prototype isn&apos;t connected
            to the real electoral roll, so no actual record was checked — this isn&apos;t a real
            registration status.
          </p>
          <p className="text-ink/80">
            In the real tool, this space would show whether you&apos;re registered and, if so,
            your assigned polling booth.
          </p>
        </div>
      )}

      <div className="rounded-lg border border-slate-200 p-4">
        <h2 className="text-sm font-semibold text-ink">
          Prefer to check directly with the Election Commission?
        </h2>
        <p className="mt-1 text-sm text-ink/70">
          The Election Commission of India runs the official electoral roll and search tool.
        </p>
        <a
          href="#"
          className="mt-2 inline-block text-sm font-medium text-brand underline underline-offset-2 hover:no-underline"
        >
          Open the official EC electoral roll search (placeholder link in this prototype)
        </a>
      </div>
    </div>
  )
}
