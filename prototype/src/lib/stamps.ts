/**
 * Shared helpers for displaying and sorting the store's event stamps (`AuditEntry.at`,
 * `Submission.createdAt`). These fields hold TWO incompatible formats, produced by two different
 * origins of the same field:
 *
 *  - Hand-authored SEED data (src/data/audit.ts, src/data/submissions.ts) uses real ISO-8601
 *    timestamps, e.g. '2026-05-21T08:30:00.000Z'.
 *  - Anything the STORE generates live (appendAudit / submitFlag, via stamp()/nextSeq() in
 *    store.ts) uses a monotonic counter string `t${n}` — Date.now() is banned project-wide for
 *    determinism, so there is no real clock to stamp live events with.
 *
 * Do not paper over that split by inventing a fake date for a counter — that would misrepresent
 * a simulated event as a real one, which is worse than just labelling it as simulated.
 * formatStamp() below leans into the split instead: counters render as "Demo event #n", ISO
 * strings render as a readable, timezone-fixed date/time.
 */

const COUNTER_PATTERN = /^t(\d+)$/
const ISO_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/

const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
] as const

type ParsedStamp =
  | { kind: 'counter'; n: number }
  | { kind: 'iso'; iso: string }
  | { kind: 'unknown'; raw: string }

function parseStamp(stamp: string): ParsedStamp {
  const counterMatch = COUNTER_PATTERN.exec(stamp)
  if (counterMatch) return { kind: 'counter', n: Number(counterMatch[1]) }
  if (ISO_PATTERN.test(stamp)) return { kind: 'iso', iso: stamp }
  return { kind: 'unknown', raw: stamp }
}

/**
 * Renders a stamp for display.
 *  - A `t{n}` counter stamp renders honestly as a simulated event ("Demo event #n") — never as a
 *    fabricated date.
 *  - An ISO-8601 stamp renders as a readable date/time, formatted manually from UTC getters
 *    (not `Intl.DateTimeFormat`/locale-dependent formatting, and never `Date.now()`/argless
 *    `new Date()`) so the output is identical on every machine, timezone, and test run.
 *  - Anything unrecognized is returned unchanged rather than throwing.
 */
export function formatStamp(stamp: string): string {
  const parsed = parseStamp(stamp)
  if (parsed.kind === 'counter') return `Demo event #${parsed.n}`
  if (parsed.kind === 'iso') {
    const date = new Date(parsed.iso)
    const day = String(date.getUTCDate()).padStart(2, '0')
    const month = MONTHS[date.getUTCMonth()]
    const year = date.getUTCFullYear()
    const hours = String(date.getUTCHours()).padStart(2, '0')
    const minutes = String(date.getUTCMinutes()).padStart(2, '0')
    return `${day} ${month} ${year}, ${hours}:${minutes} UTC`
  }
  return parsed.raw
}

/**
 * Comparator for "newest first" ordering across both stamp formats, e.g.
 * `[...items].sort((a, b) => compareStampsNewestFirst(a.createdAt, b.createdAt))`.
 *
 * Ordering rule (deterministic, and the only correct one given how this data is produced):
 *  - Two counters: numeric — higher `n` is newer (NOT lexicographic string order, which is the
 *    bug this fixes: 't11' must sort newer than 't9').
 *  - Two ISO strings: chronological — the later timestamp is newer.
 *  - A counter vs an ISO string: the counter is ALWAYS newer. Every counter stamp is written by
 *    a live store mutation happening during this session, while every ISO stamp is hand-authored
 *    seed data representing the fixed past the app is bootstrapped from — so any counter event
 *    necessarily happened after any seed ISO event, by construction.
 *  - Anything unrecognized falls back to a plain string comparison, so ordering never throws —
 *    it just isn't guaranteed meaningful for a value neither format expects.
 */
export function compareStampsNewestFirst(a: string, b: string): number {
  const pa = parseStamp(a)
  const pb = parseStamp(b)

  if (pa.kind === 'counter' && pb.kind === 'counter') return pb.n - pa.n
  if (pa.kind === 'iso' && pb.kind === 'iso') {
    return new Date(pb.iso).getTime() - new Date(pa.iso).getTime()
  }
  if (pa.kind === 'counter' && pb.kind === 'iso') return -1
  if (pa.kind === 'iso' && pb.kind === 'counter') return 1

  const rawA = pa.kind === 'unknown' ? pa.raw : a
  const rawB = pb.kind === 'unknown' ? pb.raw : b
  return rawA.localeCompare(rawB)
}
