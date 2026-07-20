/**
 * The deduped flag queue (PRD §6.1-§6.3; architecture §7) — the citizen
 * misinformation-flagging path and the curator correction loop's front
 * door.
 *
 * DEDUPE (PRD §6.3): "multiple flags on the same field collapse into ONE
 * queue item with a count; resolving resolves every collapsed flag at
 * once, same outcome + reason". The schema encodes this as a partial
 * unique index, `flag_dedupe_uq` on `(target_ref, status)` — at most one
 * PENDING `flag_items` row per `target_ref` at any time. Every citizen
 * submission for the same `targetRef` finds-or-creates that one pending
 * item and appends its own `flag_submissions` row; the item's submission
 * count IS the "count" the queue UI shows. Because the unique index is
 * scoped to `(target_ref, status)` rather than `target_ref` alone, a fresh
 * flag on a target whose prior item was already resolved (accepted or
 * rejected) opens a brand-new pending item — the resolved item and the
 * new pending one coexist; resolution history is never overwritten.
 *
 * RACE (two submitters flagging the same never-before-flagged target at
 * the same instant): both find no pending row and both attempt to INSERT
 * one; the unique index lets exactly one succeed, and the loser gets a
 * 23505. A failed statement aborts the enclosing Postgres transaction for
 * every subsequent statement UNTIL a ROLLBACK (or a ROLLBACK TO SAVEPOINT)
 * — so the insert attempt below runs inside a NESTED transaction
 * (`tx.transaction(...)`, which drizzle-orm's postgres-js driver
 * implements as a SAVEPOINT, see node_modules/drizzle-orm/postgres-js).
 * When the insert fails, only that savepoint rolls back; the outer
 * transaction (still open) can then re-SELECT the winner's row and
 * proceed with the submission + audit as normal.
 */
import { and, eq } from 'drizzle-orm';
import { db } from '../db/client';
import { flagItems, flagSubmissions } from '../db/schema';
import { writeAudit, type Tx } from './audit';
import { isUniqueViolation } from './db-errors';
import { publishCandidateFieldTx, type PublishCandidateFieldInput } from './publish';

export type FlagTargetType = 'candidate_field' | 'ward_field' | 'ward_issue';

export interface SubmitFlagInput {
  wardId: number;
  targetType: FlagTargetType;
  targetRef: string;
  detail: string;
  suggestedValue?: string | null;
  sourceUrl?: string | null;
}

export type ResolveFlagResolution =
  | { accept: true; publish: PublishCandidateFieldInput }
  | { accept: false; reason: string };

/** Finds the current PENDING flag_items row for `targetRef`, if any. */
async function selectPending(tx: Tx, targetRef: string): Promise<{ id: number } | undefined> {
  const [row] = await tx
    .select({ id: flagItems.id })
    .from(flagItems)
    .where(and(eq(flagItems.targetRef, targetRef), eq(flagItems.status, 'pending')));
  return row;
}

/**
 * Finds or creates the PENDING flag_items row for `input.targetRef`,
 * inside `tx`. See the module docstring for the race/savepoint handling.
 */
async function findOrCreatePendingItem(tx: Tx, input: SubmitFlagInput): Promise<number> {
  const existing = await selectPending(tx, input.targetRef);
  if (existing) return existing.id;

  try {
    // Nested transaction (SAVEPOINT): if the insert below loses the unique-
    // index race, only this savepoint rolls back — the outer `tx` stays
    // usable for the re-select and everything submitFlag does after this.
    return await tx.transaction(async (tx2) => {
      const [created] = await tx2
        .insert(flagItems)
        .values({
          wardId: input.wardId,
          targetType: input.targetType,
          targetRef: input.targetRef,
          status: 'pending',
        })
        .returning({ id: flagItems.id });
      return created!.id;
    });
  } catch (err) {
    if (isUniqueViolation(err)) {
      const winner = await selectPending(tx, input.targetRef);
      if (winner) return winner.id;
    }
    throw err;
  }
}

/**
 * Submits a citizen's misinformation flag against `targetRef` (PRD §6.1,
 * §6.2). Finds-or-creates the pending queue item for `targetRef`, appends
 * this submitter's `flag_submissions` row, and writes an audit entry
 * recording the flag event (NOT a published-data change — the moderation
 * trail, PRD §11) — all in one transaction.
 */
export async function submitFlag(userId: number, input: SubmitFlagInput): Promise<{ flagItemId: number }> {
  const flagItemId = await db.transaction(async (tx) => {
    const itemId = await findOrCreatePendingItem(tx, input);

    await tx.insert(flagSubmissions).values({
      flagItemId: itemId,
      userId,
      detail: input.detail,
      suggestedValue: input.suggestedValue ?? null,
      sourceUrl: input.sourceUrl ?? null,
    });

    await writeAudit(tx, {
      actor: { userId, role: 'citizen' },
      action: 'flag',
      entityType: 'flag',
      entityId: String(itemId),
      wardId: input.wardId,
      sourceUrl: input.sourceUrl ?? null,
    });

    return itemId;
  });

  return { flagItemId };
}

/**
 * Resolves a queue item (curator/admin only — PRD §6.1; the caller, e.g.
 * Task 34's curator route, is responsible for the per-ward `canEditWard`
 * scope check BEFORE calling this — this function only asserts the actor's
 * ROLE, not their ward scope, since it has no ward-scope context of its
 * own for a `ward_field`/`ward_issue` target).
 *
 * ACCEPT (candidate_field targets only, for now — ward_field/ward_issue
 * accept-publish paths land in Tasks 34/39): publishes the field via
 * {@link publishCandidateFieldTx} and marks the item `accepted` in the
 * SAME transaction, so a publish can never land without its flag item
 * being marked resolved (or vice versa).
 *
 * REJECT: marks the item `rejected` with `reason`; never publishes
 * anything.
 *
 * Either way, resolving the ITEM resolves every collapsed submission at
 * once (PRD §6.3) — the outcome/reason lives on `flag_items`, and every
 * `flag_submissions` row for this item points at it, so there is no
 * per-submission update to make.
 */
export async function resolveFlag(
  actor: { userId: number; role: 'curator' | 'admin' },
  flagItemId: number,
  resolution: ResolveFlagResolution,
): Promise<void> {
  await db.transaction(async (tx) => {
    if (resolution.accept) {
      // Task 31 scope: accept only supports candidate_field targets, via
      // the shared publish core. ward_field/ward_issue accept-publish
      // paths are added by Tasks 34/39 (a discriminated union over
      // resolution.publish's target type, once those publish helpers
      // exist) — this is not a runtime branch yet because there is only
      // one publish path to call.
      await publishCandidateFieldTx(tx, actor, resolution.publish);

      await tx
        .update(flagItems)
        .set({
          status: 'accepted',
          resolutionReason: null,
          resolvedBy: actor.userId,
          resolvedAt: new Date(),
        })
        .where(eq(flagItems.id, flagItemId));
    } else {
      const [item] = await tx.select().from(flagItems).where(eq(flagItems.id, flagItemId));

      await tx
        .update(flagItems)
        .set({
          status: 'rejected',
          resolutionReason: resolution.reason,
          resolvedBy: actor.userId,
          resolvedAt: new Date(),
        })
        .where(eq(flagItems.id, flagItemId));

      await writeAudit(tx, {
        actor,
        action: 'flag_reject',
        entityType: 'flag',
        entityId: String(flagItemId),
        wardId: item?.wardId ?? null,
        oldValue: item ? { status: item.status } : null,
        newValue: { status: 'rejected', reason: resolution.reason },
      });
    }
  });
}
