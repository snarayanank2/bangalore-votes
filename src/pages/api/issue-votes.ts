/**
 * PUT /api/issue-votes — the citizen issue-voting write path (PRD §5.5;
 * architecture §7). Session-gated (anonymous tap opens Register/Login and
 * resumes here — PRD's core-concept #2, IA §3.6, src/islands/VoteModal.ts).
 *
 * Body: `{wardId, issueIds}`. Validation/home-ward/re-cast-replace logic all
 * lives in {@link castVoteSet} (src/lib/votes.ts) — this route only does
 * HTTP-shape concerns: auth, JSON/zod parsing, the per-account rate limit
 * (`checkDefaultLimit(userId, 'vote')` — 20 re-casts/day,
 * src/lib/rate-limit.ts), and mapping `castVoteSet`'s thrown error codes to
 * status codes.
 *
 * Success returns `{ok:true, results}` — FRESH `issueResults(wardId)` (PRD
 * §5.5 ranked %, no raw counts) computed AFTER the cast commits, so the
 * caller (VoteModal) can splice the up-to-date bars into the ward-issues
 * page in place without a full reload.
 *
 * PRIVACY: never logs the citizen's specific `issueIds` — only the
 * resulting `wardId`/`userId` (both already-known identifiers, not the free
 * choice itself). Mirrors src/pages/api/flags.ts's privacy note and
 * src/lib/votes.ts's NO-AUDIT decision for the same underlying reason: an
 * individual's issue picks are aggregated-public data, never a per-citizen
 * record anyone (including an admin reading logs) should be able to read
 * back out.
 *
 * Also exports GET (`?wardId=`) — the small read this route's own write
 * needs a counterpart for: the Cast-issue-vote modal pre-checks a
 * RETURNING voter's current picks for the ward it's opened against (PRD
 * §5.5 "changeable"). Session-gated the same way as PUT (this route is
 * never called while anonymous — VoteModal always confirms auth via
 * `/api/me` first); an authed request for a ward the visitor has no ACTIVE
 * set in (including any ward that isn't their current home ward, since at
 * most one active set can ever exist) simply gets `{issueIds: []}`.
 *
 * Not a form route (no synchronizer CSRF token) — like every other
 * `/api/*` JSON endpoint, relies on the middleware's Origin/Sec-Fetch-Site
 * check plus the session cookie (src/middleware.ts).
 */
import type { APIRoute } from 'astro';
import { z } from 'zod';
import { and, eq } from 'drizzle-orm';
import { db } from '../../db/client';
import { issueVoteSets, issueVoteSelections } from '../../db/schema';
import { castVoteSet, issueResults, type CastVoteErrorCode } from '../../lib/votes';
import { checkDefaultLimit } from '../../lib/rate-limit';
import { logEvent } from '../../lib/log';

const JSON_HEADERS = { 'content-type': 'application/json', 'cache-control': 'no-store' } as const;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

const bodySchema = z.object({
  wardId: z.number().int().positive(),
  issueIds: z.array(z.number().int().positive()),
});

/** Maps a {@link CastVoteErrorCode} to its HTTP status — the one place that mapping lives. */
function statusForCastError(code: CastVoteErrorCode): number {
  if (code === 'wrong_ward') return 403;
  return 400; // invalid_selection_count | issue_not_in_ward
}

function isCastVoteErrorCode(message: string): message is CastVoteErrorCode {
  return message === 'invalid_selection_count' || message === 'issue_not_in_ward' || message === 'wrong_ward';
}

export const PUT: APIRoute = async ({ request, locals }) => {
  const session = locals.session;
  if (!session) {
    return json({ error: 'authentication required' }, 401);
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return json({ error: 'invalid JSON body' }, 400);
  }

  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) {
    return json({ error: 'invalid vote payload' }, 400);
  }

  const underLimit = await checkDefaultLimit(session.userId, 'vote');
  if (!underLimit) {
    return json({ error: 'rate limit exceeded' }, 429);
  }

  const { wardId, issueIds } = parsed.data;

  try {
    await castVoteSet(session.userId, wardId, issueIds);
  } catch (err) {
    const message = err instanceof Error ? err.message : '';
    if (isCastVoteErrorCode(message)) {
      return json({ error: message }, statusForCastError(message));
    }
    throw err;
  }

  // PRIVACY: log only the ward/user identifiers — never the chosen issueIds
  // (see this file's header docstring).
  logEvent('vote_cast', { wardId, userId: session.userId });

  const results = await issueResults(wardId);
  return json({ ok: true, results });
};

const wardIdParamSchema = z.coerce.number().int().positive();

export const GET: APIRoute = async ({ url, locals }) => {
  const session = locals.session;
  if (!session) {
    return json({ error: 'authentication required' }, 401);
  }

  const parsedWardId = wardIdParamSchema.safeParse(url.searchParams.get('wardId'));
  if (!parsedWardId.success) {
    return json({ error: 'invalid wardId' }, 400);
  }
  const wardId = parsedWardId.data;

  const [activeSet] = await db
    .select({ id: issueVoteSets.id })
    .from(issueVoteSets)
    .where(and(eq(issueVoteSets.userId, session.userId), eq(issueVoteSets.wardId, wardId), eq(issueVoteSets.active, true)));

  if (!activeSet) {
    return json({ issueIds: [] });
  }

  const selections = await db
    .select({ wardIssueId: issueVoteSelections.wardIssueId })
    .from(issueVoteSelections)
    .where(eq(issueVoteSelections.setId, activeSet.id));

  return json({ issueIds: selections.map((s) => s.wardIssueId) });
};
