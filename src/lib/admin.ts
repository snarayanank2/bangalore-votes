/**
 * Business logic behind the admin console's roles & scope management
 * (Task 44, information-architecture.md §6.1/§6.2; PRD §7/§10/§11/§14).
 * Admins govern who is a curator and which wards they may edit — this
 * module IS the root of the authorization chain the rest of the app reads
 * (`src/lib/authz.ts`'s `canEditWard`, `src/lib/curator.ts`'s
 * `scopedWardIds`, both keyed off `users.role` + `curator_scopes`). Every
 * mutation here is audit-logged (PRD §11) and admin-only (PRD §7's
 * permissions matrix): `src/middleware.ts` already 403s any non-admin
 * session on the `/admin/*` route class, and each mutator below
 * re-asserts `actor.role === 'admin'` anyway — defense in depth against a
 * future non-route caller (same convention as `src/lib/authz.ts`'s
 * `canEditWard` being re-checked at multiple layers).
 *
 * ZONE SHORTCUT (PRD §10, IA §6.2): a curator's scope is stored ONLY as a
 * set of `curator_scopes` (userId, wardId) rows — there is no
 * `curator_zones` table and no "zone scope" concept anywhere in the data
 * model. "Assign a zone" is purely an ADMIN-UI convenience:
 * `expandZoneToWards` resolves a zone name to its member ward ids at the
 * moment the admin saves, and the caller (the `/admin/roles` route) folds
 * those ids into the same ward-id set `setCuratorScope` receives —
 * `setCuratorScope` itself has no notion of zones at all. A ward later
 * reassigned to a different zone does NOT retroactively change any
 * curator's stored scope (it was never zone-scoped to begin with, only
 * expanded-once) — this is a one-time expansion, not a live binding.
 *
 * UNCAPPED (PRD §14): `setCuratorScope` enforces no upper bound on ward
 * count — an admin may scope a curator across all 369 wards if that is
 * the right call for that person. The audit log + rollback (Task 47) are
 * the only backstop, by design — there is no size guard to work around.
 *
 * ORDERING: `grantRole` and `setCuratorScope` are deliberately independent
 * — `setCuratorScope` does not check or require the target user's current
 * role. The normal flow is grant-then-scope (make someone a curator, then
 * assign their wards), but nothing here enforces that order: a scope row
 * for a citizen is inert (no code path ever reads `curator_scopes` for a
 * non-curator/admin user — see `scopedWardIds`'s `role` parameter), and
 * `revokeRole` always clears scope on the way back down, so the two never
 * drift into a confusing state either way.
 */
import { eq, inArray, sql } from 'drizzle-orm';
import { db } from '../db/client';
import { curatorScopes, eoiSubmissions, users, wards } from '../db/schema';
import { writeAudit } from './audit';

/** The actor shape every mutator below requires — same session shape `src/middleware.ts` puts on `locals.session`, narrowed to admin. */
export type AdminActor = { userId: number; role: 'admin' };

/**
 * Re-asserts admin, throwing `'admin_only'` otherwise. Every exported
 * mutator calls this first, even though its TypeScript parameter type
 * already says `role: 'admin'` — that type only binds a well-typed
 * caller; a route or test could still construct/pass an object with a
 * different runtime value. See module docstring.
 */
function assertAdmin(actor: { role: string }): void {
  if (actor.role !== 'admin') {
    throw new Error('admin_only');
  }
}

/** Shared actor shape `writeAudit` (src/lib/audit.ts) expects. */
function auditActor(actor: AdminActor) {
  return { userId: actor.userId, role: 'admin' as const };
}

/**
 * Sets `targetUserId`'s role (citizen → curator/admin, or a lateral
 * curator ↔ admin move). Does NOT touch `curator_scopes` — a fresh
 * curator starts with zero wards until `setCuratorScope` is called
 * separately (see module docstring's ORDERING note); an existing
 * curator's scope rows are left as-is by a grant (e.g. curator → admin
 * doesn't retroactively matter since admin scope is the `null` sentinel
 * everywhere scope is read, but the rows themselves aren't deleted here —
 * only `revokeRole` clears them).
 *
 * Throws `'user_not_found'` for a `targetUserId` with no `users` row.
 */
export async function grantRole(actor: AdminActor, targetUserId: number, role: 'curator' | 'admin'): Promise<void> {
  assertAdmin(actor);

  await db.transaction(async (tx) => {
    const [existing] = await tx.select({ role: users.role }).from(users).where(eq(users.id, targetUserId));
    if (!existing) {
      throw new Error('user_not_found');
    }

    await tx.update(users).set({ role }).where(eq(users.id, targetUserId));

    await writeAudit(tx, {
      actor: auditActor(actor),
      action: 'grant_role',
      entityType: 'user',
      entityId: String(targetUserId),
      oldValue: existing.role,
      newValue: role,
    });
  });
}

/**
 * Demotes `targetUserId` to `'citizen'` AND removes every `curator_scopes`
 * row for them — a demoted curator has no scope (a stale scope row for a
 * citizen would be inert everywhere it's read, per module docstring, but
 * leaving it around would be a silent trap for a future re-grant that
 * expects to start from zero). Both the role update and the scope wipe
 * happen in one transaction with the audit write.
 *
 * Throws `'user_not_found'` for a `targetUserId` with no `users` row.
 */
export async function revokeRole(actor: AdminActor, targetUserId: number): Promise<void> {
  assertAdmin(actor);

  await db.transaction(async (tx) => {
    const [existing] = await tx.select({ role: users.role }).from(users).where(eq(users.id, targetUserId));
    if (!existing) {
      throw new Error('user_not_found');
    }

    await tx.update(users).set({ role: 'citizen' }).where(eq(users.id, targetUserId));
    await tx.delete(curatorScopes).where(eq(curatorScopes.userId, targetUserId));

    await writeAudit(tx, {
      actor: auditActor(actor),
      action: 'revoke_role',
      entityType: 'user',
      entityId: String(targetUserId),
      oldValue: existing.role,
      newValue: 'citizen',
    });
  });
}

/**
 * REPLACES `targetUserId`'s entire `curator_scopes` set with exactly
 * `wardIds` (deduped) — existing rows are deleted and the new set
 * inserted in one transaction, so a reader never observes a
 * partially-updated scope. Every id is validated against `wards` FIRST
 * (before any delete), so an invalid id throws `'invalid_ward_id'` and
 * leaves the existing scope completely untouched. No upper bound on
 * `wardIds.length` — see module docstring's UNCAPPED note.
 *
 * Does not check or require the target's current role (see module
 * docstring's ORDERING note) — this function only ever touches
 * `curator_scopes`.
 */
export async function setCuratorScope(actor: AdminActor, targetUserId: number, wardIds: number[]): Promise<void> {
  assertAdmin(actor);
  const uniqueWardIds = [...new Set(wardIds)];

  await db.transaction(async (tx) => {
    if (uniqueWardIds.length > 0) {
      const validRows = await tx.select({ id: wards.id }).from(wards).where(inArray(wards.id, uniqueWardIds));
      if (validRows.length !== uniqueWardIds.length) {
        throw new Error('invalid_ward_id');
      }
    }

    const existingRows = await tx
      .select({ wardId: curatorScopes.wardId })
      .from(curatorScopes)
      .where(eq(curatorScopes.userId, targetUserId));

    await tx.delete(curatorScopes).where(eq(curatorScopes.userId, targetUserId));
    if (uniqueWardIds.length > 0) {
      await tx.insert(curatorScopes).values(uniqueWardIds.map((wardId) => ({ userId: targetUserId, wardId })));
    }

    await writeAudit(tx, {
      actor: auditActor(actor),
      action: 'set_scope',
      entityType: 'user',
      entityId: String(targetUserId),
      oldValue: existingRows.map((r) => r.wardId),
      newValue: uniqueWardIds,
    });
  });
}

/**
 * The ZONE SHORTCUT (see module docstring): every ward id whose
 * `wards.zone` exactly equals `zone`. Read-only — never writes anything
 * itself; the caller (the `/admin/roles` route) folds the result into
 * the ward-id set it passes to `setCuratorScope`. An unknown zone simply
 * returns `[]` (no distinct "zone not found" error — a typo'd zone name
 * is indistinguishable from "this zone currently has no wards", and both
 * mean "nothing to add").
 */
export async function expandZoneToWards(zone: string): Promise<number[]> {
  const rows = await db.select({ id: wards.id }).from(wards).where(eq(wards.zone, zone));
  return rows.map((r) => r.id);
}

/** Every distinct zone name across `wards` — populates the Roles page's zone-shortcut `<select>`. */
export async function listZones(): Promise<string[]> {
  const rows = await db.selectDistinct({ zone: wards.zone }).from(wards).orderBy(wards.zone);
  return rows.map((r) => r.zone);
}

export interface CuratorScopeWard {
  id: number;
  nameEn: string;
}

export interface CuratorScopeRow {
  id: number;
  email: string | null;
  role: 'curator' | 'admin';
  status: string;
  /** Scoped wards, sorted by name for stable display — empty for an admin (city-wide, PRD §7/§10, never stored per-ward). */
  wards: CuratorScopeWard[];
}

/**
 * Every curator/admin user, each with their current scope (empty for an
 * admin — city-wide is the `null` sentinel everywhere scope is read, not
 * a stored row set). Feeds the Roles page's list (IA §6.2).
 */
export async function listCuratorsAndScopes(): Promise<CuratorScopeRow[]> {
  const userRows = await db
    .select({ id: users.id, email: users.email, role: users.role, status: users.status })
    .from(users)
    .where(inArray(users.role, ['curator', 'admin']))
    .orderBy(users.id);

  const userIds = userRows.map((r) => r.id);
  const scopeRows = userIds.length
    ? await db
        .select({ userId: curatorScopes.userId, wardId: curatorScopes.wardId, nameEn: wards.nameEn })
        .from(curatorScopes)
        .innerJoin(wards, eq(wards.id, curatorScopes.wardId))
        .where(inArray(curatorScopes.userId, userIds))
    : [];

  const byUser = new Map<number, CuratorScopeWard[]>();
  for (const row of scopeRows) {
    const list = byUser.get(row.userId) ?? [];
    list.push({ id: row.wardId, nameEn: row.nameEn });
    byUser.set(row.userId, list);
  }

  return userRows
    .filter((row): row is typeof row & { role: 'curator' | 'admin' } => row.role === 'curator' || row.role === 'admin')
    .map((row) => ({
      id: row.id,
      email: row.email,
      role: row.role,
      status: row.status,
      wards: (byUser.get(row.id) ?? []).sort((a, b) => a.nameEn.localeCompare(b.nameEn)),
    }));
}

export interface ConsoleStats {
  curatorCount: number;
  adminCount: number;
  pendingEoiCount: number;
}

/** The `/admin` console home's small overview line (IA §6.1) — deliberately just three counts; the console is mostly navigation, not a dashboard. */
export async function loadConsoleStats(): Promise<ConsoleStats> {
  const [roleCounts, [eoiRow]] = await Promise.all([
    db
      .select({ role: users.role, count: sql<number>`count(*)::int` })
      .from(users)
      .where(inArray(users.role, ['curator', 'admin']))
      .groupBy(users.role),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(eoiSubmissions)
      .where(eq(eoiSubmissions.status, 'new')),
  ]);

  const curatorCount = roleCounts.find((r) => r.role === 'curator')?.count ?? 0;
  const adminCount = roleCounts.find((r) => r.role === 'admin')?.count ?? 0;

  return { curatorCount: Number(curatorCount), adminCount: Number(adminCount), pendingEoiCount: Number(eoiRow?.count ?? 0) };
}

/**
 * Resolves the Roles page's "user by id or email" lookup field to a user
 * id, or `null` when nothing matches. Tried as a bare-integer id first
 * (an email never parses as `^\d+$`), then as an exact, case-insensitive
 * email match — `users.email` is stored lowercase (see
 * `scripts/seed-admin.ts`), so the lookup is lowercased before comparing.
 */
export async function findUserIdByLookup(lookup: string): Promise<number | null> {
  const trimmed = lookup.trim();
  if (!trimmed) return null;

  if (/^\d+$/.test(trimmed)) {
    const [row] = await db.select({ id: users.id }).from(users).where(eq(users.id, Number(trimmed)));
    if (row) return row.id;
    return null;
  }

  const [row] = await db.select({ id: users.id }).from(users).where(eq(users.email, trimmed.toLowerCase()));
  return row?.id ?? null;
}
