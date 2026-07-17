/**
 * The shared electoral-roll-deadline element (PRD §5.6/§5.7/§5.8, and the checklist's expiring
 * steps in §5.17) — the R1 alert reaches only registered users, so these pages are where
 * everyone else learns the one date in the funnel that cannot be recovered. Identical wherever
 * it appears, so it lives here once.
 *
 * A live countdown is impossible (Date.now() is banned project-wide) — the date is a hard-coded
 * placeholder updated by hand, mirroring Home's ELECTION_NOTICE_TARGET. "Shown until the roll
 * closes" is modelled by the ROLL_CLOSED flag (also flipped by hand); the `closed` prop exists so
 * tests can exercise the closed branch without editing the constant.
 */
export const ROLL_DEADLINE_LABEL = 'August 2026 expected'
export const ROLL_CLOSED = false

export function RollDeadlineNotice({ closed = ROLL_CLOSED }: { closed?: boolean }) {
  if (closed) return null
  return (
    <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-left text-sm text-amber-900">
      <p>
        <strong>Electoral roll deadline: {ROLL_DEADLINE_LABEL}.</strong> Enrol or transfer before
        the roll closes — this is the one date in the process that cannot be recovered. If you are
        not on the roll when it closes, you cannot vote in this election.
      </p>
      <p className="mt-1 text-xs">
        Placeholder date in this prototype — always confirm the real deadline on the official EC
        site.
      </p>
    </div>
  )
}
