import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import { eq, and } from 'drizzle-orm';
import * as schema from '../../src/db/schema';
import { submitFlag, resolveFlag } from '../../src/lib/flags';
import { randomUUID } from 'node:crypto';

if (!process.env.DATABASE_URL) {
  throw new Error(
    'DATABASE_URL is not set. CI always sets this; for local runs export ' +
      'DATABASE_URL=postgres://postgres@localhost:54329/bv_test (see task brief).',
  );
}

const client = postgres(process.env.DATABASE_URL, { max: 5 });
const db = drizzle(client, { schema });

// High, task-specific ward id (Task 31 brief) — other suites own
// 94xxx-99202; this suite owns 99310.
const WARD_ID = 99310;

let candidateId: number;
let submitterAId: number;
let submitterBId: number;
let raceUserAId: number;
let raceUserBId: number;

function targetRefFor(fieldKey: string): string {
  return `candidate:${candidateId}:${fieldKey}`;
}

describe('flags.ts — deduped flag queue + transactional resolution (Task 31)', () => {
  beforeAll(async () => {
    await migrate(db, { migrationsFolder: './drizzle' });

    await db
      .insert(schema.wards)
      .values({
        id: WARD_ID,
        nameEn: 'Flags Test Ward',
        nameKn: 'ಫ್ಲ್ಯಾಗ್ ಪರೀಕ್ಷಾ ವಾರ್ಡ್',
        corporation: 'south',
        zone: 'Zone F',
        boundaryRef: 'flags-test-ward',
      })
      .onConflictDoUpdate({ target: schema.wards.id, set: { nameEn: 'Flags Test Ward' } });

    // audit_log is append-only (can't be cleaned between runs), so — like
    // tests/unit/audit.test.ts — this suite creates a fresh candidate (and
    // hence fresh targetRefs/entityIds) every run via a unique slug.
    const [candidate] = await db
      .insert(schema.candidates)
      .values({
        slug: `flags-test-candidate-${randomUUID()}`,
        wardId: WARD_ID,
        nameEn: 'Flags Test Candidate',
        partyEn: 'Independent',
      })
      .returning();
    candidateId = candidate!.id;

    const submitterA = await db
      .insert(schema.users)
      .values({ email: `flags-test-submitter-a-${randomUUID()}@example.com`, homeWardId: WARD_ID, role: 'citizen', status: 'active' })
      .returning();
    submitterAId = submitterA[0]!.id;

    const submitterB = await db
      .insert(schema.users)
      .values({ email: `flags-test-submitter-b-${randomUUID()}@example.com`, homeWardId: WARD_ID, role: 'citizen', status: 'active' })
      .returning();
    submitterBId = submitterB[0]!.id;

    const raceUserA = await db
      .insert(schema.users)
      .values({ email: `flags-test-race-a-${randomUUID()}@example.com`, homeWardId: WARD_ID, role: 'citizen', status: 'active' })
      .returning();
    raceUserAId = raceUserA[0]!.id;

    const raceUserB = await db
      .insert(schema.users)
      .values({ email: `flags-test-race-b-${randomUUID()}@example.com`, homeWardId: WARD_ID, role: 'citizen', status: 'active' })
      .returning();
    raceUserBId = raceUserB[0]!.id;
  });

  afterAll(async () => {
    await client.end();
  });

  it('two users flagging the SAME targetRef collapse onto ONE flag_item with TWO flag_submissions', async () => {
    const targetRef = targetRefFor('cases');

    const first = await submitFlag(submitterAId, {
      wardId: WARD_ID,
      targetType: 'candidate_field',
      targetRef,
      detail: 'Says no pending cases, but there is a FIR.',
      sourceUrl: 'https://example.org/fir-record',
    });

    const second = await submitFlag(submitterBId, {
      wardId: WARD_ID,
      targetType: 'candidate_field',
      targetRef,
      detail: 'Confirming — FIR #123 is public record.',
    });

    expect(second.flagItemId).toBe(first.flagItemId);

    const items = await db.select().from(schema.flagItems).where(eq(schema.flagItems.targetRef, targetRef));
    expect(items).toHaveLength(1);
    expect(items[0]!.status).toBe('pending');
    expect(items[0]!.wardId).toBe(WARD_ID);
    expect(items[0]!.targetType).toBe('candidate_field');

    const submissions = await db
      .select()
      .from(schema.flagSubmissions)
      .where(eq(schema.flagSubmissions.flagItemId, first.flagItemId));
    expect(submissions).toHaveLength(2);
    expect(submissions.map((s) => s.userId).sort()).toEqual([submitterAId, submitterBId].sort());
  });

  it('writes an audit "flag" event for every submission (moderation trail, not a publish)', async () => {
    const targetRef = targetRefFor('audit_check');

    const { flagItemId } = await submitFlag(submitterAId, {
      wardId: WARD_ID,
      targetType: 'candidate_field',
      targetRef,
      detail: 'Track record claim looks fabricated.',
    });

    const auditRows = await db
      .select()
      .from(schema.auditLog)
      .where(and(eq(schema.auditLog.entityType, 'flag'), eq(schema.auditLog.entityId, String(flagItemId))));

    expect(auditRows.length).toBeGreaterThanOrEqual(1);
    const submitRow = auditRows.find((r) => r.action === 'flag');
    expect(submitRow).toBeDefined();
    expect(submitRow!.actorRole).toBe('citizen');
    expect(submitRow!.actorUserId).toBe(submitterAId);
    expect(submitRow!.wardId).toBe(WARD_ID);
  });

  it('resolveFlag ACCEPT: publishes the candidate field AND marks the item accepted; both submitters see the same accepted status', async () => {
    const targetRef = targetRefFor('track_record');

    const first = await submitFlag(submitterAId, {
      wardId: WARD_ID,
      targetType: 'candidate_field',
      targetRef,
      detail: 'Track record is out of date.',
      suggestedValue: 'Two-term corporator, led road-repair drive.',
      sourceUrl: 'https://example.org/track-record-source',
    });
    await submitFlag(submitterBId, {
      wardId: WARD_ID,
      targetType: 'candidate_field',
      targetRef,
      detail: 'Agreed, needs updating.',
    });

    await resolveFlag(
      { userId: 4201, role: 'curator' },
      first.flagItemId,
      {
        accept: true,
        publish: {
          candidateId,
          fieldKey: 'track_record',
          valueEn: 'Two-term corporator, led road-repair drive.',
          sourceUrl: 'https://example.org/track-record-source',
          sourceType: 'curator',
          authoredLang: 'en',
        },
      },
    );

    const [field] = await db
      .select()
      .from(schema.candidateFields)
      .where(and(eq(schema.candidateFields.candidateId, candidateId), eq(schema.candidateFields.fieldKey, 'track_record')));
    expect(field).toBeDefined();
    expect(field!.valueEn).toBe('Two-term corporator, led road-repair drive.');

    const publishAuditRows = await db
      .select()
      .from(schema.auditLog)
      .where(and(eq(schema.auditLog.entityType, 'candidate_field'), eq(schema.auditLog.entityId, `${candidateId}:track_record`)));
    expect(publishAuditRows.some((r) => r.action === 'publish' && r.actorUserId === 4201)).toBe(true);

    const [item] = await db.select().from(schema.flagItems).where(eq(schema.flagItems.id, first.flagItemId));
    expect(item!.status).toBe('accepted');
    expect(item!.resolvedBy).toBe(4201);
    expect(item!.resolvedAt).not.toBeNull();

    // Both submitters' visible status is the SAME item — no per-submission
    // state to check separately, but confirm both rows still point at it.
    const submissions = await db
      .select()
      .from(schema.flagSubmissions)
      .where(eq(schema.flagSubmissions.flagItemId, first.flagItemId));
    expect(submissions).toHaveLength(2);
    for (const s of submissions) {
      const [resolvedItem] = await db.select().from(schema.flagItems).where(eq(schema.flagItems.id, s.flagItemId));
      expect(resolvedItem!.status).toBe('accepted');
    }
  });

  it('resolveFlag REJECT: marks the item rejected with a reason; no publish; both submitters see the same rejected+reason', async () => {
    const targetRef = targetRefFor('assets');

    const first = await submitFlag(submitterAId, {
      wardId: WARD_ID,
      targetType: 'candidate_field',
      targetRef,
      detail: 'Assets figure seems wrong.',
    });
    await submitFlag(submitterBId, {
      wardId: WARD_ID,
      targetType: 'candidate_field',
      targetRef,
      detail: 'Same concern here.',
    });

    await resolveFlag(
      { userId: 4202, role: 'admin' },
      first.flagItemId,
      { accept: false, reason: 'Verified against affidavit — figure is correct as published.' },
    );

    const [item] = await db.select().from(schema.flagItems).where(eq(schema.flagItems.id, first.flagItemId));
    expect(item!.status).toBe('rejected');
    expect(item!.resolutionReason).toBe('Verified against affidavit — figure is correct as published.');
    expect(item!.resolvedBy).toBe(4202);
    expect(item!.resolvedAt).not.toBeNull();

    // No candidate_fields row was ever created for this field.
    const [field] = await db
      .select()
      .from(schema.candidateFields)
      .where(and(eq(schema.candidateFields.candidateId, candidateId), eq(schema.candidateFields.fieldKey, 'assets')));
    expect(field).toBeUndefined();

    const rejectAuditRows = await db
      .select()
      .from(schema.auditLog)
      .where(and(eq(schema.auditLog.entityType, 'flag'), eq(schema.auditLog.entityId, String(first.flagItemId))));
    expect(rejectAuditRows.some((r) => r.action === 'flag_reject' && r.actorUserId === 4202)).toBe(true);

    const submissions = await db
      .select()
      .from(schema.flagSubmissions)
      .where(eq(schema.flagSubmissions.flagItemId, first.flagItemId));
    expect(submissions).toHaveLength(2);
    for (const s of submissions) {
      const [resolvedItem] = await db.select().from(schema.flagItems).where(eq(schema.flagItems.id, s.flagItemId));
      expect(resolvedItem!.status).toBe('rejected');
      expect(resolvedItem!.resolutionReason).toBe('Verified against affidavit — figure is correct as published.');
    }
  });

  it('a NEW flag on a previously-REJECTED targetRef opens a fresh pending item (partial unique index on (targetRef,status))', async () => {
    const targetRef = targetRefFor('education');

    const original = await submitFlag(submitterAId, {
      wardId: WARD_ID,
      targetType: 'candidate_field',
      targetRef,
      detail: 'Education claim disputed.',
    });

    await resolveFlag({ userId: 4203, role: 'admin' }, original.flagItemId, {
      accept: false,
      reason: 'Checked, claim stands.',
    });

    const fresh = await submitFlag(submitterBId, {
      wardId: WARD_ID,
      targetType: 'candidate_field',
      targetRef,
      detail: 'New concern raised again after rejection.',
    });

    expect(fresh.flagItemId).not.toBe(original.flagItemId);

    const items = await db
      .select()
      .from(schema.flagItems)
      .where(eq(schema.flagItems.targetRef, targetRef));
    expect(items).toHaveLength(2);

    const rejected = items.find((i) => i.id === original.flagItemId);
    const pending = items.find((i) => i.id === fresh.flagItemId);
    expect(rejected!.status).toBe('rejected');
    expect(pending!.status).toBe('pending');
  });

  it('race: pre-inserted pending item is FOUND, not duplicated (deterministic loser-path)', async () => {
    const targetRef = targetRefFor('race_predetermined');

    const [preInserted] = await db
      .insert(schema.flagItems)
      .values({ wardId: WARD_ID, targetType: 'candidate_field', targetRef, status: 'pending' })
      .returning({ id: schema.flagItems.id });

    const result = await submitFlag(raceUserAId, {
      wardId: WARD_ID,
      targetType: 'candidate_field',
      targetRef,
      detail: 'Joining an already-open item.',
    });

    expect(result.flagItemId).toBe(preInserted!.id);

    const items = await db.select().from(schema.flagItems).where(eq(schema.flagItems.targetRef, targetRef));
    expect(items).toHaveLength(1);
  });

  it('race: two CONCURRENT submitFlag calls for a brand-new targetRef still collapse onto ONE item (23505 re-select path)', async () => {
    const targetRef = targetRefFor('race_concurrent');

    const [a, b] = await Promise.all([
      submitFlag(raceUserAId, {
        wardId: WARD_ID,
        targetType: 'candidate_field',
        targetRef,
        detail: 'First concurrent submitter.',
      }),
      submitFlag(raceUserBId, {
        wardId: WARD_ID,
        targetType: 'candidate_field',
        targetRef,
        detail: 'Second concurrent submitter.',
      }),
    ]);

    expect(a.flagItemId).toBe(b.flagItemId);

    const items = await db.select().from(schema.flagItems).where(eq(schema.flagItems.targetRef, targetRef));
    expect(items).toHaveLength(1);

    const submissions = await db
      .select()
      .from(schema.flagSubmissions)
      .where(eq(schema.flagSubmissions.flagItemId, a.flagItemId));
    expect(submissions).toHaveLength(2);
  });
});
