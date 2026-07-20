import { auditLog } from '../db/schema';
import type { Db } from '../db/client';

export type Actor = {
  userId: number | null;
  role: 'curator' | 'admin' | 'system' | 'citizen';
};

export type NewAuditEntry = {
  actor: Actor;
  action: string;
  entityType: string;
  entityId: string;
  wardId?: number | null;
  fieldKey?: string | null;
  oldValue?: unknown;
  newValue?: unknown;
  sourceUrl?: string | null;
};

// Pragmatic alias for the Drizzle transaction handle type: the parameter type
// of the callback passed to db.transaction(). writeAudit must always be
// called with a tx from an in-flight db.transaction() so the audit insert is
// atomic with whatever else that transaction does.
export type Tx = Parameters<Db['transaction']>[0] extends (tx: infer T) => unknown ? T : never;

/**
 * Append one row to the append-only audit_log. Must be called inside a
 * db.transaction() so the audit write commits/rolls back atomically with the
 * data change it documents.
 *
 * The DB enforces append-only via CREATE RULE (no UPDATE / no DELETE), but a
 * blocked INSERT (e.g. a misapplied rule, or any other silent-no-op path)
 * would otherwise fail open — the calling transaction would commit with the
 * data change but no audit trail. Guard against that class of bug by
 * requiring .returning() to produce a row; throw (and let the transaction
 * roll back) if it doesn't.
 */
export async function writeAudit(tx: Tx, entry: NewAuditEntry): Promise<void> {
  const [row] = await tx
    .insert(auditLog)
    .values({
      actorUserId: entry.actor.userId,
      actorRole: entry.actor.role,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId,
      wardId: entry.wardId ?? null,
      fieldKey: entry.fieldKey ?? null,
      oldValue: entry.oldValue ?? null,
      newValue: entry.newValue ?? null,
      sourceUrl: entry.sourceUrl ?? null,
    })
    .returning({ id: auditLog.id });

  if (!row) {
    throw new Error('writeAudit: audit_log insert returned no row — refusing to publish without an audit trail');
  }
}
