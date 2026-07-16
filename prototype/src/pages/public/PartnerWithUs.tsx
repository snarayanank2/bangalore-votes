/**
 * Partner with us — recruitment funnel (PRD §5.13, IA §3.15, `/partner-with-us`) — MINIMAL STUB.
 *
 * This page is built out in a later task (the two paths — spread awareness / curate data — and
 * the anonymous expression-of-interest form). It exists here only so the footer link added in
 * this task doesn't 404. Keep this trivial — an <h1> and one line — so the later task can replace
 * it cleanly without untangling anything built on top of it.
 */
export default function PartnerWithUs() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="text-2xl font-bold text-ink sm:text-3xl">Partner with us</h1>
      <p className="mt-2 text-sm text-ink/80">
        Coming soon — ways to spread awareness in your network or help curate ward data.
      </p>
    </div>
  )
}
