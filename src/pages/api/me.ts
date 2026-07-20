/**
 * GET /api/me — the single client-side personalization source (architecture
 * .md §5's cache invariant, §4). Public page HTML never varies by session:
 * every page renders the SAME anonymous markup for every visitor, and this
 * is the ONE endpoint the client-side `MeSlot` island
 * (src/islands/MeSlot.ts) calls — once per page load — to learn who's
 * signed in and swap the handful of personalized elements (Sign-in vs
 * Account control, register-for-updates slot, already-voted state)
 * client-side, in place.
 *
 * Not a publicly-cacheable route: this lives under `/api/*`, which nginx's
 * anonymous-page micro-cache never touches (architecture §5) — `no-store`
 * below is defense in depth / explicit intent, not what actually keeps this
 * off the cache.
 *
 * SHAPE:
 *   - anonymous (`Astro.locals.session` is null): `{ anonymous: true }`.
 *   - authed: `{ anonymous: false, userId, role, homeWardId, language,
 *     alreadyVotedWardId }`, where `alreadyVotedWardId` is the `wardId` of
 *     the user's ACTIVE `issue_vote_sets` row (schema.ts's `active_set_uq`
 *     guarantees at most one), or `null` if they have never cast/have no
 *     active set.
 *
 * PRIVACY: `users.email`/`users.phone` are NEVER selected here — only the
 * four fields a client-side swap actually needs. Do not widen this select.
 */
import type { APIRoute } from 'astro';
import { and, eq } from 'drizzle-orm';
import { db } from '../../db/client';
import { users, issueVoteSets } from '../../db/schema';

const JSON_HEADERS = { 'content-type': 'application/json', 'cache-control': 'no-store' } as const;

function json(body: unknown): Response {
  return new Response(JSON.stringify(body), { status: 200, headers: JSON_HEADERS });
}

export const GET: APIRoute = async ({ locals }) => {
  const session = locals.session;
  if (!session) {
    return json({ anonymous: true });
  }

  // homeWardId/language/role come from the users row (never from the
  // session cookie/locals) so this always reflects the visitor's latest
  // saved preferences, not whatever was true when the session was created.
  const [user] = await db
    .select({ homeWardId: users.homeWardId, language: users.language, role: users.role })
    .from(users)
    .where(eq(users.id, session.userId));

  const [activeSet] = await db
    .select({ wardId: issueVoteSets.wardId })
    .from(issueVoteSets)
    .where(and(eq(issueVoteSets.userId, session.userId), eq(issueVoteSets.active, true)));

  return json({
    anonymous: false,
    userId: session.userId,
    role: user?.role ?? session.role,
    homeWardId: user?.homeWardId ?? null,
    language: user?.language ?? 'en',
    alreadyVotedWardId: activeSet?.wardId ?? null,
  });
};
