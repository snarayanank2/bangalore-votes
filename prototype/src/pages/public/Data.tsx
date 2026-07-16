/**
 * Public data & key metrics (PRD §5.14, IA §3.14, `/data`) — MINIMAL STUB.
 *
 * This page is built out in a later task (Phase 2: coverage, integrity, and citizen-signal
 * figures, each with an "as of" timestamp). It exists here only so the footer link added in this
 * task doesn't 404. Keep this trivial — an <h1> and one line — so the later task can replace it
 * cleanly without untangling anything built on top of it.
 */
export default function Data() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="text-2xl font-bold text-ink sm:text-3xl">Data &amp; key metrics</h1>
      <p className="mt-2 text-sm text-ink/80">
        Coming soon — coverage, integrity, and citizen-signal figures for the platform.
      </p>
    </div>
  )
}
