/**
 * Authorization helpers used by src/middleware.ts (route-class guards) and
 * by the curator/admin write actions themselves (Task 34/36/39, PRD §7/§10)
 * for per-ward scope checks the middleware can't make on its own — the
 * middleware only knows the route CLASS (`/curator/*`), not the ward id
 * embedded in a specific edit's payload/params.
 */
import { and, eq } from 'drizzle-orm';
import { db } from '../db/client';
import { curatorScopes } from '../db/schema';
import type { Role } from './session';

/**
 * Whether `userId` (with `role`) may edit ward `wardId`'s data. Admin: always
 * true (city-wide, PRD §7/§10). Curator: true iff a `curator_scopes` row
 * (userId, wardId) exists — a curator's edits are scoped to their assigned
 * wards/zone. Citizen: always false (citizens never edit ward/candidate
 * data at all).
 */
export async function canEditWard(userId: number, role: Role, wardId: number): Promise<boolean> {
  if (role === 'admin') return true;
  if (role !== 'curator') return false;

  const [row] = await db
    .select()
    .from(curatorScopes)
    .where(and(eq(curatorScopes.userId, userId), eq(curatorScopes.wardId, wardId)));
  return row !== undefined;
}

/**
 * Validates a post-login (or any other) return-target as a same-origin
 * RELATIVE path (architecture.md §7: "the `/login` fallback's post-login
 * return target is validated as a same-origin relative path — a
 * user-supplied absolute URL is discarded in favour of `/`" — closing the
 * open-redirect vector). Returns `next` unchanged only when it is a bare
 * root-relative path: starts with exactly one `/`, never `//` (a
 * protocol-relative URL — `//evil.example` is parsed by browsers as
 * `https://evil.example`), never a backslash (some browsers normalize a
 * leading `\` to `/`, so `\\evil.example` / `/\evil.example` are also
 * treated as protocol-relative and must be rejected). Anything else —
 * absolute URLs (`https://evil.example`), scheme-relative URLs, malformed
 * input — falls back to `/`.
 */
export function isSameOriginRelative(next: unknown): string {
  if (typeof next !== 'string' || next.length === 0) return '/';
  if (!next.startsWith('/')) return '/';
  if (next.startsWith('//')) return '/';
  if (next.startsWith('/\\') || next.startsWith('\\')) return '/';
  return next;
}
