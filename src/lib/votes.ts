/**
 * Issue-vote results (PRD §5.5, §13.1 Phase 1; IA §3.6). This file is the
 * READ side only (Task 20) — the ward issues page's public results and, in
 * time, the `/data` city-wide roll-up both read through `issueResults`.
 * Task 33 EXTENDS this module with the write path (casting/replacing a
 * vote-set) — do not restructure the read query's shape without checking
 * that task's needs too.
 *
 * Share definition (PRD §5.5 "percentage shares", chosen interpretation):
 * each current ward issue's `sharePct` is that issue's selection count as a
 * percentage of the TOTAL selections cast across all of the ward's current
 * issues — i.e. "what share of all top-3 picks went to this issue", not
 * "what share of voters picked this issue" (a voter can contribute to more
 * than one issue's count by selecting up to three). This matches "ranked
 * order with percentage shares" as the simplest, most directly plottable
 * reading, and is what `<IssueBars>` renders as a set of bars each summing
 * toward the same 100%.
 *
 * Retired-set exclusion (core privacy/correctness rule, PRD §5.5): only
 * `issue_vote_sets.active = true` rows count. A citizen who changes home
 * ward, or re-casts their top-3, leaves behind an inactive set that must
 * never contribute to any ward's public aggregate again — the join below
 * filters on `active` before counting anything.
 *
 * Current-issue-list scoping (PRD §5.5 "deleting an issue removes it from
 * every vote-set... results are always computed against the current
 * list"): the query starts from `ward_issues` for this ward and only looks
 * up a count for each issue found there. A selection row whose issue was
 * since deleted is already gone via the FK's `onDelete: 'cascade'`
 * (schema.ts), and a stray selection that doesn't match any current issue
 * id is simply never consulted — there is nothing to filter out
 * defensively.
 *
 * No-raw-counts guarantee (PRD §5.5 "no raw counts on this page"): counts
 * are computed internally to derive rank/share but are NEVER placed on the
 * returned objects — the return type has no `count` field. `/data`'s
 * later, separate total-votes figure is out of scope for this function.
 */
import { and, eq, sql } from 'drizzle-orm';
import { db, type Db } from '../db/client';
import { wardIssues, issueVoteSets, issueVoteSelections } from '../db/schema';
import type { Tx } from './audit';

export interface IssueResult {
  issueId: number;
  titleEn: string | null;
  titleKn: string | null;
  rank: number;
  sharePct: number;
}

/** Rounds to one decimal place — enough precision for a percentage share. */
function roundShare(count: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((count / total) * 1000) / 10;
}

export async function issueResults(wardId: number): Promise<IssueResult[]> {
  const issues = await db
    .select({
      id: wardIssues.id,
      titleEn: wardIssues.titleEn,
      titleKn: wardIssues.titleKn,
      position: wardIssues.position,
    })
    .from(wardIssues)
    .where(eq(wardIssues.wardId, wardId));

  if (issues.length === 0) return [];

  // Selection counts, ACTIVE vote-sets only, for this ward — grouped by the
  // ward_issue they reference. Issues with no rows here simply get 0 below.
  const counted = await db
    .select({
      wardIssueId: issueVoteSelections.wardIssueId,
      count: sql<number>`count(*)::int`.as('count'),
    })
    .from(issueVoteSelections)
    .innerJoin(issueVoteSets, eq(issueVoteSelections.setId, issueVoteSets.id))
    .where(and(eq(issueVoteSets.wardId, wardId), eq(issueVoteSets.active, true)))
    .groupBy(issueVoteSelections.wardIssueId);

  const countByIssueId = new Map<number, number>();
  for (const row of counted) countByIssueId.set(row.wardIssueId, row.count);

  const withCounts = issues.map((issue) => ({
    issueId: issue.id,
    titleEn: issue.titleEn,
    titleKn: issue.titleKn,
    position: issue.position,
    count: countByIssueId.get(issue.id) ?? 0,
  }));

  const total = withCounts.reduce((sum, issue) => sum + issue.count, 0);

  // Descending by count; ties broken by curator position, then id, so the
  // zero-selections case (total === 0) falls back to position order
  // deterministically (every count is 0, so every comparison ties through
  // to position/id).
  withCounts.sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count;
    if (a.position !== b.position) return a.position - b.position;
    return a.issueId - b.issueId;
  });

  return withCounts.map((issue, index) => ({
    issueId: issue.issueId,
    titleEn: issue.titleEn,
    titleKn: issue.titleKn,
    rank: index + 1,
    sharePct: roundShare(issue.count, total),
  }));
}

/**
 * Retires `userId`'s ACTIVE issue-vote-set, if any (a no-op otherwise —
 * `schema.ts`'s `active_set_uq` guarantees at most one). Called whenever a
 * citizen changes their home ward (PRD §5.5: "changing home ward retires
 * the previous ward's vote-set" — Task 29, `src/lib/account-flow.ts`) and,
 * per Task 33, whenever they re-cast a fresh top-3 in their current ward.
 *
 * Accepts an optional `executor` (a `db.transaction()` callback's `tx`
 * handle) so a caller that must update `users.homeWardId` and retire the
 * vote-set atomically can pass its own `tx` through — e.g.
 * `db.transaction(async (tx) => { await tx.update(users)...; await
 * retireActiveSet(userId, tx); })`. Defaults to the module-level `db` for
 * every other (non-transactional) call site.
 *
 * NOT an audited action (Task 4/prototype decision, reaffirmed here): the
 * audit log records published DATA changes and moderation/admin actions,
 * never a citizen's own vote choices — so this never calls `writeAudit`.
 */
export async function retireActiveSet(userId: number, executor: Db | Tx = db): Promise<void> {
  await executor
    .update(issueVoteSets)
    .set({ active: false })
    .where(and(eq(issueVoteSets.userId, userId), eq(issueVoteSets.active, true)));
}
