import { and, eq } from 'drizzle-orm';
import { db } from '../db/client';
import { candidateFields, candidates } from '../db/schema';
import { writeAudit, type Actor, type Tx } from './audit';
import { translateFieldSoon } from './translate-runtime';

export type PublishCandidateFieldInput = {
  candidateId: number;
  fieldKey: string;
  valueEn?: string | null;
  valueKn?: string | null;
  notDeclared?: boolean;
  sourceUrl: string | null;
  sourceType: 'official' | 'curator';
  authoredLang: 'en' | 'kn';
  aiExtracted?: boolean;
};

/**
 * Tx-accepting core of the publish path: upserts the candidate_fields row
 * and writes its audit entry using the CALLER's transaction handle, so a
 * caller that must publish a field atomically alongside other writes of its
 * own (Task 31's `resolveFlag` — publish the field AND mark the flag item
 * accepted in one transaction) can do so without nesting a second top-level
 * `db.transaction()`. Returns the field's id; does NOT kick off translation
 * — that only happens once the whole transaction has actually committed
 * (see `publishCandidateField` below), otherwise a rolled-back publish
 * could still enqueue a translation for a field that was never written.
 */
export async function publishCandidateFieldTx(
  tx: Tx,
  actor: Actor,
  input: PublishCandidateFieldInput,
): Promise<number> {
  const [existing] = await tx
    .select()
    .from(candidateFields)
    .where(and(eq(candidateFields.candidateId, input.candidateId), eq(candidateFields.fieldKey, input.fieldKey)));

  const [candidate] = await tx
    .select({ wardId: candidates.wardId })
    .from(candidates)
    .where(eq(candidates.id, input.candidateId));

  if (!candidate) {
    throw new Error(`publishCandidateField: no candidate with id ${input.candidateId}`);
  }

  // AI-extracted only sticks when the actor writing it is the system
  // (extraction pipeline). Any curator/admin publish is a human
  // confirmation of the value, so it always clears the flag.
  const aiExtracted = input.aiExtracted === true && actor.role === 'system';

  const newValue = {
    valueEn: input.valueEn ?? null,
    valueKn: input.valueKn ?? null,
    notDeclared: input.notDeclared ?? false,
    sourceUrl: input.sourceUrl,
    sourceType: input.sourceType,
    authoredLang: input.authoredLang,
    aiExtracted,
  };

  const [field] = await tx
    .insert(candidateFields)
    .values({
      candidateId: input.candidateId,
      fieldKey: input.fieldKey,
      valueEn: input.valueEn ?? null,
      valueKn: input.valueKn ?? null,
      notDeclared: input.notDeclared ?? false,
      authoredLang: input.authoredLang,
      translationStatus: 'pending',
      sourceUrl: input.sourceUrl,
      sourceType: input.sourceType,
      aiExtracted,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [candidateFields.candidateId, candidateFields.fieldKey],
      set: {
        valueEn: input.valueEn ?? null,
        valueKn: input.valueKn ?? null,
        notDeclared: input.notDeclared ?? false,
        authoredLang: input.authoredLang,
        translationStatus: 'pending',
        sourceUrl: input.sourceUrl,
        sourceType: input.sourceType,
        aiExtracted,
        updatedAt: new Date(),
      },
    })
    .returning({ id: candidateFields.id });

  await writeAudit(tx, {
    actor,
    action: 'publish',
    entityType: 'candidate_field',
    entityId: `${input.candidateId}:${input.fieldKey}`,
    wardId: candidate.wardId,
    fieldKey: input.fieldKey,
    oldValue: existing
      ? {
          valueEn: existing.valueEn,
          valueKn: existing.valueKn,
          notDeclared: existing.notDeclared,
          sourceUrl: existing.sourceUrl,
          sourceType: existing.sourceType,
          authoredLang: existing.authoredLang,
          aiExtracted: existing.aiExtracted,
        }
      : null,
    newValue,
    sourceUrl: input.sourceUrl,
  });

  return field.id;
}

/**
 * The single publish path for candidate report-card fields. Upserts the
 * field and writes the audit entry in one transaction: either both land or
 * neither does. After the transaction commits, kicks off (fire-and-forget)
 * machine translation for the field — Task 40 implements the real worker.
 *
 * Thin wrapper around {@link publishCandidateFieldTx}: opens its own
 * top-level transaction and hands the tx handle down. Kept as the public
 * entry point for every caller that does NOT need to coordinate this
 * publish with other writes of its own — behavior is identical to before
 * the Task 31 tx-refactor.
 */
export async function publishCandidateField(actor: Actor, input: PublishCandidateFieldInput): Promise<void> {
  const fieldId = await db.transaction((tx) => publishCandidateFieldTx(tx, actor, input));

  translateFieldSoon({ table: 'candidate_fields', id: fieldId });
}
