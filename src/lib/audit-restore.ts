/**
 * Audit log viewer + forward-write rollback (Task 47;
 * information-architecture.md §6.5; architecture.md §7 "Audit ROLLBACK",
 * §13 "audit append-only"; PRD §11 "immutable audit; rollback").
 *
 * FORWARD-WRITE ROLLBACK: "restore" is NEVER an edit of history —
 * `audit_log` is append-only (the CREATE RULE guards from Task 5 already
 * block UPDATE/DELETE at the DB level; `src/lib/audit.ts`'s `writeAudit` is
 * the only sanctioned way to add a row, and it only ever INSERTs).
 * `restoreAuditEntry` republishes the entry's OLD value through the exact
 * same publish path (`publishCandidateFieldTx`, `src/lib/publish.ts`) any
 * other curator/admin edit uses:
 *
 *   1. The field is upserted back to the OLD value — `decideTranslationStatus`
 *      runs exactly as it would for any other publish, so a genuine content
 *      change (the common case: the old value differs from what's live now)
 *      comes back `'pending'` and gets machine-retranslated after commit,
 *      same as any fresh edit.
 *   2. `publishCandidateFieldTx` writes its own normal `'publish'` audit
 *      row (oldValue = what was live just before the restore, newValue =
 *      the restored value) — restore does not suppress or replace that.
 *   3. ONE MORE row is appended, in the SAME transaction, action
 *      `'restore'`, whose `newValue` carries `restoredFromAuditId` — the id
 *      of the audit_log entry being restored — so a reader of the log can
 *      trace a restore back to the entry it reverted.
 *
 * Both new rows are appends. The entry being restored FROM, and every
 * other existing row, are never touched — not even read-modify-written;
 * `restoreAuditEntry` only ever SELECTs the target row and INSERTs two new
 * ones (one via `publishCandidateFieldTx`, one via `writeAudit` directly).
 *
 * RESTORABLE ENTITY TYPES: only `'candidate_field'`, and only when the
 * entry's `oldValue` is non-null (a directly re-publishable prior field
 * value — see `publishCandidateFieldTx`'s audit `oldValue` shape). Every
 * other entity type this codebase's audit log records —
 * `'candidate'` (core name/party/photo/status), `'candidate_stance'`,
 * `'ward_readiness'` (sign-off/clear), `'user'` (grant_role / revoke_role /
 * set_scope / ban / erase) — is NOT restorable through this path: their
 * `oldValue` either isn't a directly re-publishable field value (a role
 * string, a ward-id array, a sign-off timestamp pair, a status enum with
 * its own side effects) or "restoring" it would mean re-running a
 * DIFFERENT business action that already has its own dedicated, audited
 * mutator elsewhere (`src/lib/admin.ts`, `src/lib/erasure.ts`) — you can't
 * "restore" a ban by republishing a value, you un-ban through
 * `reactivateUser`. "Restore" here is deliberately narrow — a value
 * rollback, not a generic undo — rather than trying to interpret every
 * action's `oldValue` generically. An entry whose entityType isn't in
 * {@link RESTORABLE_ENTITY_TYPES}, or whose `oldValue` is `null` (the
 * entry recorded the field's FIRST-EVER publish — there is no prior value
 * to restore to; "un-publish" isn't a supported action here), throws
 * `'not_restorable'` — nothing is published, no new row is written.
 */
import { and, desc, eq, sql } from 'drizzle-orm';
import { db } from '../db/client';
import { auditLog, candidateFields } from '../db/schema';
import { writeAudit } from './audit';
import { publishCandidateFieldTx, type PublishCandidateFieldInput } from './publish';
import { translateFieldSoon } from './translate-runtime';

/** The actor shape `restoreAuditEntry` requires — an already-authenticated admin session. */
export type AuditActor = { userId: number; role: 'admin' };

/**
 * Re-asserts admin, throwing `'admin_only'` otherwise — same defense-in-depth
 * convention every other `src/lib/*.ts` admin mutator uses (see
 * `src/lib/admin.ts`'s module docstring): `src/middleware.ts` already
 * 403s any non-admin session on `/admin/*` before this ever runs, but a
 * non-route caller (or a test) could still construct an actor with a
 * different runtime `role`.
 */
function assertAdmin(actor: { role: string }): void {
  if (actor.role !== 'admin') {
    throw new Error('admin_only');
  }
}

/** Entity types whose audit `oldValue` is a directly re-publishable field value — see module docstring. */
const RESTORABLE_ENTITY_TYPES = new Set(['candidate_field']);

type CandidateFieldValue = {
  valueEn: string | null;
  valueKn: string | null;
  notDeclared?: boolean;
  sourceUrl: string | null;
  sourceType: 'official' | 'curator';
  authoredLang: 'en' | 'kn';
  aiExtracted?: boolean;
};

/**
 * Restores audit_log entry `auditId` — republishes its OLD value forward
 * as a NEW publish, plus a `'restore'` audit row referencing `auditId` (see
 * module docstring). Re-triggers `translateFieldSoon` after commit exactly
 * like any other candidate-field publish, when the restored value is a
 * genuine content change.
 *
 * Throws (nothing is published, no row is appended, on any of these):
 *   - `'admin_only'` — actor isn't an admin.
 *   - `'audit_entry_not_found'` — no `audit_log` row with id `auditId`.
 *   - `'not_restorable'` — entry's `entityType` isn't restorable, its
 *     `entityId` isn't the expected `{candidateId}:{fieldKey}` shape, or its
 *     `oldValue` is `null` (a first-ever publish — see module docstring).
 */
export async function restoreAuditEntry(actor: AuditActor, auditId: number): Promise<void> {
  assertAdmin(actor);

  const { fieldId, translationStatus } = await db.transaction(async (tx) => {
    const [entry] = await tx.select().from(auditLog).where(eq(auditLog.id, auditId));
    if (!entry) {
      throw new Error('audit_entry_not_found');
    }

    if (!RESTORABLE_ENTITY_TYPES.has(entry.entityType) || entry.oldValue === null || entry.oldValue === undefined) {
      throw new Error('not_restorable');
    }

    const sepIdx = entry.entityId.indexOf(':');
    const candidateId = sepIdx > 0 ? Number(entry.entityId.slice(0, sepIdx)) : NaN;
    const fieldKey = sepIdx > 0 ? entry.entityId.slice(sepIdx + 1) : '';
    if (!Number.isInteger(candidateId) || !fieldKey) {
      throw new Error('not_restorable');
    }

    const old = entry.oldValue as CandidateFieldValue;

    // The candidate_fields row as it stands RIGHT NOW, before this restore
    // — used only for the 'restore' entry's own oldValue below (the true
    // prior-live value, whatever it is, regardless of whether `entry` is
    // the most recent audit row for this field). publishCandidateFieldTx
    // independently re-reads the same row inside this same transaction to
    // build ITS OWN 'publish' audit entry — reading it twice here is a
    // consistent snapshot, not a race.
    const [current] = await tx
      .select()
      .from(candidateFields)
      .where(and(eq(candidateFields.candidateId, candidateId), eq(candidateFields.fieldKey, fieldKey)));

    const input: PublishCandidateFieldInput = {
      candidateId,
      fieldKey,
      valueEn: old.valueEn,
      valueKn: old.valueKn,
      notDeclared: old.notDeclared ?? false,
      sourceUrl: old.sourceUrl,
      sourceType: old.sourceType,
      authoredLang: old.authoredLang,
    };

    const { id, translationStatus } = await publishCandidateFieldTx(tx, actor, input);

    await writeAudit(tx, {
      actor,
      action: 'restore',
      entityType: entry.entityType,
      entityId: entry.entityId,
      wardId: entry.wardId,
      fieldKey: entry.fieldKey,
      oldValue: current
        ? {
            valueEn: current.valueEn,
            valueKn: current.valueKn,
            notDeclared: current.notDeclared,
            sourceUrl: current.sourceUrl,
            sourceType: current.sourceType,
            authoredLang: current.authoredLang,
            aiExtracted: current.aiExtracted,
          }
        : null,
      newValue: { ...old, restoredFromAuditId: auditId },
      sourceUrl: old.sourceUrl,
    });

    return { fieldId: id, translationStatus };
  });

  if (translationStatus === 'pending') {
    translateFieldSoon({ table: 'candidate_fields', id: fieldId });
  }
}

export type AuditEntryRow = typeof auditLog.$inferSelect;

export type AuditFilters = {
  entityType?: string;
  entityId?: string;
  wardId?: number;
  actorUserId?: number;
  limit?: number;
  offset?: number;
};

const DEFAULT_LIMIT = 50;

/**
 * Paginated, filterable read of `audit_log` for the `/admin/audit` viewer —
 * ordered newest-first (`createdAt` desc, `id` desc as a tiebreak for two
 * rows landing in the same transaction). Every filter is AND-ed together;
 * an omitted filter matches every row. `limit`/`offset` default to 50/0.
 */
export async function listAuditEntries(filters: AuditFilters = {}): Promise<{ entries: AuditEntryRow[]; total: number }> {
  const conditions = [];
  if (filters.entityType) conditions.push(eq(auditLog.entityType, filters.entityType));
  if (filters.entityId) conditions.push(eq(auditLog.entityId, filters.entityId));
  if (filters.wardId !== undefined) conditions.push(eq(auditLog.wardId, filters.wardId));
  if (filters.actorUserId !== undefined) conditions.push(eq(auditLog.actorUserId, filters.actorUserId));

  const where = conditions.length > 0 ? and(...conditions) : undefined;
  const limit = filters.limit ?? DEFAULT_LIMIT;
  const offset = filters.offset ?? 0;

  const [entries, totalRows] = await Promise.all([
    db
      .select()
      .from(auditLog)
      .where(where)
      .orderBy(desc(auditLog.createdAt), desc(auditLog.id))
      .limit(limit)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(auditLog)
      .where(where),
  ]);

  return { entries, total: Number(totalRows[0]?.count ?? 0) };
}

/** Whether `entry` is eligible for the viewer's "Restore this value" action — see module docstring. */
export function isRestorable(entry: Pick<AuditEntryRow, 'entityType' | 'oldValue'>): boolean {
  return RESTORABLE_ENTITY_TYPES.has(entry.entityType) && entry.oldValue !== null && entry.oldValue !== undefined;
}
