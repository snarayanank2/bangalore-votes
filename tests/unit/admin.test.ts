/**
 * Task 44 — src/lib/admin.ts: the admin-only role/scope-management engine
 * behind the `/admin/roles` route (information-architecture.md §6.2;
 * PRD §7/§10/§11/§14). Exercises the lib functions directly against a real
 * DB (no HTTP/middleware layer — that's tests/routes/admin-roles.test.ts).
 *
 * COVERAGE MAP:
 *   - ZONE EXPANSION: `expandZoneToWards` returns exactly a zone's ward
 *     ids; `setCuratorScope` fed a zone-expanded list stores exactly those
 *     `curator_scopes` rows (PRD §10 — the shortcut expands to per-ward
 *     rows AT SAVE TIME, there is no stored zone concept).
 *   - grantRole: citizen -> curator role update, audited.
 *   - revokeRole: a scoped curator -> role 'citizen' AND every
 *     curator_scopes row removed, audited.
 *   - setCuratorScope: REPLACES the scope set atomically (old rows gone,
 *     new rows present); an unknown ward id is rejected and leaves the
 *     existing scope untouched; uncapped (100 wards accepted, no size
 *     guard).
 *   - ADMIN-ONLY: every mutator rejects a non-admin actor before touching
 *     the DB.
 *   - listCuratorsAndScopes / findUserIdByLookup / listZones: the small
 *     read helpers the Roles page renders from.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import { and, eq, inArray } from 'drizzle-orm';
import * as schema from '../../src/db/schema';

if (!process.env.DATABASE_URL) {
  throw new Error(
    'DATABASE_URL is not set. CI always sets this; for local runs export ' +
      'DATABASE_URL=postgres://postgres@localhost:54329/bv_test (see task brief).',
  );
}

import {
  grantRole,
  revokeRole,
  setCuratorScope,
  expandZoneToWards,
  listZones,
  listCuratorsAndScopes,
  findUserIdByLookup,
  type AdminActor,
} from '../../src/lib/admin';

const client = postgres(process.env.DATABASE_URL, { max: 1 });
const db = drizzle(client, { schema });

// High, task-specific ward ids (Task 44 brief: "use high dedicated ids").
// tests/unit/translate-runtime.test.ts owns up to 99500; this suite owns
// 99600-99609 (small fixed set) and 99700-99799 (the 100-ward uncapped
// block) — tests/routes/admin-roles.test.ts owns 99610-99619.
const ZONE_ALPHA = 'Admin Lib Test Zone Alpha';
const ZONE_BETA = 'Admin Lib Test Zone Beta';
const ZONE_PLAIN = 'Admin Lib Test Zone Plain';
const ZONE_BULK = 'Admin Lib Test Zone Bulk';

const WARD_A1 = { id: 99600, nameEn: 'Admin Lib Test Ward A1', nameKn: 'ಎ೧', corporation: 'south' as const, zone: ZONE_ALPHA, boundaryRef: 'admin-lib-test-a1' };
const WARD_A2 = { id: 99601, nameEn: 'Admin Lib Test Ward A2', nameKn: 'ಎ೨', corporation: 'south' as const, zone: ZONE_ALPHA, boundaryRef: 'admin-lib-test-a2' };
const WARD_A3 = { id: 99602, nameEn: 'Admin Lib Test Ward A3', nameKn: 'ಎ೩', corporation: 'south' as const, zone: ZONE_ALPHA, boundaryRef: 'admin-lib-test-a3' };
const WARD_B1 = { id: 99603, nameEn: 'Admin Lib Test Ward B1', nameKn: 'ಬಿ೧', corporation: 'south' as const, zone: ZONE_BETA, boundaryRef: 'admin-lib-test-b1' };
const WARD_PLAIN = { id: 99604, nameEn: 'Admin Lib Test Ward Plain', nameKn: 'ಪಿ', corporation: 'south' as const, zone: ZONE_PLAIN, boundaryRef: 'admin-lib-test-plain' };

const SMALL_WARDS = [WARD_A1, WARD_A2, WARD_A3, WARD_B1, WARD_PLAIN];

const BULK_WARDS = Array.from({ length: 100 }, (_, i) => ({
  id: 99700 + i,
  nameEn: `Admin Lib Test Bulk Ward ${i}`,
  nameKn: `ಬ${i}`,
  corporation: 'south' as const,
  zone: ZONE_BULK,
  boundaryRef: `admin-lib-test-bulk-${i}`,
}));
const BULK_WARD_IDS = BULK_WARDS.map((w) => w.id);

const ALL_WARD_IDS = [...SMALL_WARDS.map((w) => w.id), ...BULK_WARD_IDS];

const EMAILS = {
  admin: 'admin-lib-test-admin@example.com',
  citizen: 'admin-lib-test-citizen@example.com',
  // A second, never-promoted citizen — `citizen` above IS promoted to
  // curator by the grantRole test, so it can't also serve as "still a
  // citizen" fixture for the listCuratorsAndScopes exclusion check below.
  plainCitizen: 'admin-lib-test-plain-citizen@example.com',
  scopedCurator: 'admin-lib-test-scoped-curator@example.com',
  zoneCurator: 'admin-lib-test-zone-curator@example.com',
  bulkCurator: 'admin-lib-test-bulk-curator@example.com',
  lookupCurator: 'Admin-Lib-Test-Lookup-Curator@Example.com',
};

async function upsertUser(email: string, role: 'citizen' | 'curator' | 'admin'): Promise<number> {
  const [row] = await db
    .insert(schema.users)
    .values({ email: email.toLowerCase(), role, status: 'active' })
    .onConflictDoUpdate({ target: schema.users.email, set: { role, status: 'active' } })
    .returning({ id: schema.users.id });
  return row!.id;
}

function auditEntityIdIn(userIds: number[]) {
  return inArray(schema.auditLog.entityId, userIds.map(String));
}

let adminId: number;
let citizenId: number;
let plainCitizenId: number;
let scopedCuratorId: number;
let zoneCuratorId: number;
let bulkCuratorId: number;
let lookupCuratorId: number;
let admin: AdminActor;

describe('src/lib/admin.ts (Task 44)', () => {
  beforeAll(async () => {
    await migrate(db, { migrationsFolder: './drizzle' });

    for (const ward of [...SMALL_WARDS, ...BULK_WARDS]) {
      await db.insert(schema.wards).values(ward).onConflictDoUpdate({ target: schema.wards.id, set: ward });
    }

    adminId = await upsertUser(EMAILS.admin, 'admin');
    citizenId = await upsertUser(EMAILS.citizen, 'citizen');
    plainCitizenId = await upsertUser(EMAILS.plainCitizen, 'citizen');
    scopedCuratorId = await upsertUser(EMAILS.scopedCurator, 'curator');
    zoneCuratorId = await upsertUser(EMAILS.zoneCurator, 'curator');
    bulkCuratorId = await upsertUser(EMAILS.bulkCurator, 'curator');
    lookupCuratorId = await upsertUser(EMAILS.lookupCurator, 'curator');

    admin = { userId: adminId, role: 'admin' };
  });

  afterAll(async () => {
    const userIds = [citizenId, plainCitizenId, scopedCuratorId, zoneCuratorId, bulkCuratorId, lookupCuratorId];
    await db.delete(schema.curatorScopes).where(inArray(schema.curatorScopes.userId, userIds));
    await db.delete(schema.auditLog).where(auditEntityIdIn(userIds)); // no-op: audit_log is append-only (DO INSTEAD NOTHING rules)
    await db.delete(schema.users).where(inArray(schema.users.id, [adminId, ...userIds]));
    await db.delete(schema.wards).where(inArray(schema.wards.id, ALL_WARD_IDS));
    await client.end();
  });

  describe('zone expansion', () => {
    it('expandZoneToWards returns exactly the ward ids in that zone, nothing from another zone', async () => {
      const result = await expandZoneToWards(ZONE_ALPHA);
      expect(result.slice().sort((a, b) => a - b)).toEqual([WARD_A1.id, WARD_A2.id, WARD_A3.id]);
    });

    it('returns [] for a zone with no wards (no distinct "not found" error)', async () => {
      expect(await expandZoneToWards('Admin Lib Test Zone Does Not Exist')).toEqual([]);
    });

    it('listZones includes every distinct zone seeded above', async () => {
      const zones = await listZones();
      expect(zones).toEqual(expect.arrayContaining([ZONE_ALPHA, ZONE_BETA, ZONE_PLAIN, ZONE_BULK]));
    });

    it('setCuratorScope fed a zone-expanded list stores exactly those ward rows', async () => {
      const wardIds = await expandZoneToWards(ZONE_ALPHA);
      await setCuratorScope(admin, zoneCuratorId, wardIds);

      const rows = await db.select().from(schema.curatorScopes).where(eq(schema.curatorScopes.userId, zoneCuratorId));
      expect(rows.map((r) => r.wardId).sort((a, b) => a - b)).toEqual([WARD_A1.id, WARD_A2.id, WARD_A3.id]);
    });
  });

  describe('grantRole', () => {
    it('promotes a citizen to curator and writes an audit row', async () => {
      await grantRole(admin, citizenId, 'curator');

      const [row] = await db.select({ role: schema.users.role }).from(schema.users).where(eq(schema.users.id, citizenId));
      expect(row?.role).toBe('curator');

      const [audit] = await db
        .select()
        .from(schema.auditLog)
        .where(and(eq(schema.auditLog.action, 'grant_role'), eq(schema.auditLog.entityId, String(citizenId))));
      expect(audit).toBeDefined();
      expect(audit!.entityType).toBe('user');
      expect(audit!.actorUserId).toBe(adminId);
      expect(audit!.actorRole).toBe('admin');
      expect(audit!.newValue).toBe('curator');
    });

    it('rejects a non-admin actor without touching the DB', async () => {
      const before = await db.select({ role: schema.users.role }).from(schema.users).where(eq(schema.users.id, citizenId));
      const curatorActor = { userId: scopedCuratorId, role: 'curator' } as unknown as AdminActor;
      await expect(grantRole(curatorActor, citizenId, 'admin')).rejects.toThrow();
      const after = await db.select({ role: schema.users.role }).from(schema.users).where(eq(schema.users.id, citizenId));
      expect(after[0]?.role).toBe(before[0]?.role);
    });
  });

  describe('revokeRole', () => {
    it('demotes a scoped curator to citizen AND removes every curator_scopes row, audited', async () => {
      await setCuratorScope(admin, scopedCuratorId, [WARD_PLAIN.id]);
      const before = await db.select().from(schema.curatorScopes).where(eq(schema.curatorScopes.userId, scopedCuratorId));
      expect(before.length).toBe(1);

      await revokeRole(admin, scopedCuratorId);

      const [row] = await db.select({ role: schema.users.role }).from(schema.users).where(eq(schema.users.id, scopedCuratorId));
      expect(row?.role).toBe('citizen');

      const scopeRows = await db.select().from(schema.curatorScopes).where(eq(schema.curatorScopes.userId, scopedCuratorId));
      expect(scopeRows).toEqual([]);

      const [audit] = await db
        .select()
        .from(schema.auditLog)
        .where(and(eq(schema.auditLog.action, 'revoke_role'), eq(schema.auditLog.entityId, String(scopedCuratorId))));
      expect(audit).toBeDefined();
      expect(audit!.newValue).toBe('citizen');
    });
  });

  describe('setCuratorScope', () => {
    it('REPLACES the existing scope set (old rows gone, new set present) in one transaction', async () => {
      await setCuratorScope(admin, zoneCuratorId, [WARD_A1.id]);
      let rows = await db.select().from(schema.curatorScopes).where(eq(schema.curatorScopes.userId, zoneCuratorId));
      expect(rows.map((r) => r.wardId)).toEqual([WARD_A1.id]);

      await setCuratorScope(admin, zoneCuratorId, [WARD_B1.id, WARD_PLAIN.id]);
      rows = await db.select().from(schema.curatorScopes).where(eq(schema.curatorScopes.userId, zoneCuratorId));
      expect(rows.map((r) => r.wardId).sort((a, b) => a - b)).toEqual([WARD_B1.id, WARD_PLAIN.id].sort((a, b) => a - b));
    });

    it('rejects a non-existent ward id and leaves the existing scope untouched', async () => {
      await setCuratorScope(admin, zoneCuratorId, [WARD_A1.id]);

      await expect(setCuratorScope(admin, zoneCuratorId, [WARD_A1.id, 999999999])).rejects.toThrow();

      const rows = await db.select().from(schema.curatorScopes).where(eq(schema.curatorScopes.userId, zoneCuratorId));
      expect(rows.map((r) => r.wardId)).toEqual([WARD_A1.id]);
    });

    it('is uncapped: a 100-ward set is accepted with no size-limit error', async () => {
      await setCuratorScope(admin, bulkCuratorId, BULK_WARD_IDS);
      const rows = await db.select().from(schema.curatorScopes).where(eq(schema.curatorScopes.userId, bulkCuratorId));
      expect(rows.length).toBe(100);
      expect(rows.map((r) => r.wardId).sort((a, b) => a - b)).toEqual(BULK_WARD_IDS.slice().sort((a, b) => a - b));
    });

    it('writes a set_scope audit row', async () => {
      await setCuratorScope(admin, zoneCuratorId, [WARD_PLAIN.id]);
      const [audit] = await db
        .select()
        .from(schema.auditLog)
        .where(and(eq(schema.auditLog.action, 'set_scope'), eq(schema.auditLog.entityId, String(zoneCuratorId))))
        .orderBy(schema.auditLog.id);
      expect(audit).toBeDefined();
      expect(audit!.actorRole).toBe('admin');
    });

    it('rejects a non-admin actor', async () => {
      const citizenActor = { userId: citizenId, role: 'citizen' } as unknown as AdminActor;
      await expect(setCuratorScope(citizenActor, bulkCuratorId, [WARD_A1.id])).rejects.toThrow();
    });
  });

  describe('read helpers', () => {
    it('listCuratorsAndScopes includes curator/admin users with their scope wards, excludes citizens', async () => {
      await setCuratorScope(admin, zoneCuratorId, [WARD_A1.id, WARD_A2.id]);
      const rows = await listCuratorsAndScopes();

      const zoneRow = rows.find((r) => r.id === zoneCuratorId);
      expect(zoneRow).toBeDefined();
      expect(zoneRow!.role).toBe('curator');
      expect(zoneRow!.wards.map((w) => w.id).sort((a, b) => a - b)).toEqual([WARD_A1.id, WARD_A2.id]);

      expect(rows.some((r) => r.id === plainCitizenId)).toBe(false);
    });

    it('findUserIdByLookup resolves by numeric id', async () => {
      expect(await findUserIdByLookup(String(lookupCuratorId))).toBe(lookupCuratorId);
    });

    it('findUserIdByLookup resolves by email, case-insensitively', async () => {
      expect(await findUserIdByLookup(EMAILS.lookupCurator.toUpperCase())).toBe(lookupCuratorId);
    });

    it('findUserIdByLookup returns null for no match', async () => {
      expect(await findUserIdByLookup('nobody-admin-lib-test@example.com')).toBeNull();
      expect(await findUserIdByLookup('404404404')).toBeNull();
    });
  });
});
