/**
 * POST /api/otp/verify — completes the single OTP mechanism (architecture.md
 * §7; PRD §10). One flow handles both branches:
 *
 *  - KNOWN contact (a `users` row already has this email/phone) -> LOGIN:
 *    create a session, set the cookie, `{ok:true, registered:false}`.
 *  - UNKNOWN contact -> REGISTRATION: requires the `register` payload
 *    (wardId, language, futureTools). Missing -> `{ok:false,
 *    reason:'registration_required'}` so the client shows the confirm step
 *    and re-submits with it. Present -> creates the account, WITH THE
 *    CONSENT EVIDENCE PRD §10 requires stored on the row itself:
 *    `consentAt` (now), `consentVersion` (`app_settings['consent_wording_version']`,
 *    falling back to a default if that setting is unset), `futureToolsOptIn`,
 *    and `srcAttribution` from the `bv_src` cookie (PRD §5.12) if present.
 *    Registration *is* the consent act (PRD §10) — there is no separate
 *    consent record; the wording shown at the confirm step includes the
 *    "I am 18 or older" assertion, captured implicitly by `consentVersion`.
 *
 * ONE ACCOUNT PER CONTACT (PRD §10): enforced by the DB unique index on
 * `users.email`/`users.phone`, not read-then-write application logic. A
 * concurrent double-registration race hits that constraint on insert; this
 * handler catches exactly the unique-violation case and resolves it as a
 * login for whichever registration won, rather than surfacing a 500 or
 * silently creating a duplicate.
 *
 * `no-store` always. The Set-Cookie this endpoint sends is `bv_session`
 * (src/lib/session.ts) and NOTHING ELSE.
 *
 * READING `bv_src` HERE IS SAFE: this is a `no-store` API POST route, not a
 * publicly cached anonymous GET page — the cache-safety invariant elsewhere
 * in this codebase (never read cookies on a page nginx might cache) doesn't
 * apply to `/api/*` routes.
 */
import type { APIRoute } from 'astro';
import { z } from 'zod';
import { eq, or } from 'drizzle-orm';
import { db } from '../../../db/client';
import { users } from '../../../db/schema';
import { verifyOtp } from '../../../lib/otp';
import { createSession } from '../../../lib/session';
import { getKnownSetting } from '../../../lib/settings';

const registerSchema = z.object({
  wardId: z.number().int(),
  language: z.enum(['en', 'kn']),
  futureTools: z.boolean(),
});

const bodySchema = z.object({
  destination: z.string().trim().min(1),
  code: z.string().trim().min(1),
  register: registerSchema.optional(),
});

const JSON_HEADERS = { 'content-type': 'application/json', 'cache-control': 'no-store' } as const;

/** Fallback only when `consent_wording_version` has never been set (should not happen past initial seed). */
const DEFAULT_CONSENT_VERSION = 'v1';

function json(body: unknown, status = 200, extraHeaders?: Record<string, string>): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...JSON_HEADERS, ...extraHeaders } });
}

/** Postgres SQLSTATE for a unique-index violation (the one-account-per-contact race). */
const PG_UNIQUE_VIOLATION = '23505';

async function findUserByContact(destination: string) {
  const [row] = await db
    .select()
    .from(users)
    .where(or(eq(users.email, destination), eq(users.phone, destination)));
  return row;
}

export const POST: APIRoute = async ({ request, cookies }) => {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return json({ error: 'invalid JSON body' }, 400);
  }

  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) {
    return json({ error: 'destination and code are required' }, 400);
  }

  const { destination, code, register } = parsed.data;

  const result = await verifyOtp(destination, code);
  if (!result.ok) {
    return json({ ok: false, reason: result.reason });
  }

  const existing = await findUserByContact(destination);
  if (existing) {
    const session = await createSession(existing.id);
    return json({ ok: true, registered: false }, 200, { 'set-cookie': session.setCookie });
  }

  if (!register) {
    return json({ ok: false, reason: 'registration_required' });
  }

  const srcAttribution = cookies.get('bv_src')?.value ?? null;
  const consentVersion = (await getKnownSetting('consent_wording_version')) ?? DEFAULT_CONSENT_VERSION;
  const isEmail = destination.includes('@');

  try {
    const [created] = await db
      .insert(users)
      .values({
        email: isEmail ? destination : null,
        phone: isEmail ? null : destination,
        homeWardId: register.wardId,
        language: register.language,
        role: 'citizen',
        status: 'active',
        consentAt: new Date(),
        consentVersion,
        futureToolsOptIn: register.futureTools,
        srcAttribution,
      })
      .returning();

    const session = await createSession(created!.id);
    return json({ ok: true, registered: true }, 200, { 'set-cookie': session.setCookie });
  } catch (err: unknown) {
    if ((err as { code?: string })?.code === PG_UNIQUE_VIOLATION) {
      // One-account-per-contact race: another request registered this exact
      // contact between our lookup above and this insert. Resolve as a
      // login for the winner rather than a duplicate or a 500.
      const winner = await findUserByContact(destination);
      if (winner) {
        const session = await createSession(winner.id);
        return json({ ok: true, registered: false }, 200, { 'set-cookie': session.setCookie });
      }
    }
    throw err;
  }
};
