/**
 * `resolveOrRegister` — the single account-resolution/registration helper
 * behind BOTH auth entry points (Task 27, PRD §10):
 *   - `POST /api/otp/verify` (src/pages/api/otp/verify.ts), used by the
 *     Register/Login modal (src/islands/RegisterLoginModal.ts).
 *   - `/login`'s no-JS server-rendered fallback (src/lib/login-flow.ts,
 *     src/pages/login.astro, src/pages/kn/login.astro).
 *
 * Extracted so the two paths can never diverge on the security-critical
 * bits: case-normalized destination lookup (Task 25 review Fix 1),
 * one-account-per-contact enforcement (a DB unique-index race, not
 * read-then-write app logic), and the exact consent-evidence fields PRD §10
 * requires on registration (`consentAt`, `consentVersion`,
 * `futureToolsOptIn`, `srcAttribution`).
 *
 * PEEK-THEN-CONSUME (Task 27): the Register/Login flow calls this function
 * TWICE for a brand-new contact — once with no `register` payload (to learn
 * the contact is unknown; the OTP code must be left valid for the very next
 * call, so `verifyOtp` isn't told to consume it yet) and once moments later
 * with the `register` payload, reusing the SAME code. `consume` is only
 * `true` when this call fully resolves the flow: a KNOWN contact (login,
 * right here) or an UNKNOWN contact WITH a `register` payload (registration,
 * right here). See src/lib/otp.ts's `verifyOtp` docstring for the `consume`
 * option itself.
 */
import { eq, or } from 'drizzle-orm';
import { db } from '../db/client';
import { users } from '../db/schema';
import { normalizeDestination, verifyOtp } from './otp';
import { createSession } from './session';
import { getKnownSetting } from './settings';

export interface RegisterPayload {
  wardId: number;
  language: 'en' | 'kn';
  futureTools: boolean;
}

export type ResolveOrRegisterResult =
  | { ok: false; reason: 'expired' | 'invalid' | 'locked' }
  | { ok: false; reason: 'registration_required' }
  | { ok: true; registered: boolean; setCookie: string };

/** Fallback only when `consent_wording_version` has never been set (should not happen past initial seed). */
const DEFAULT_CONSENT_VERSION = 'v1';

/** Postgres SQLSTATE for a unique-index violation (the one-account-per-contact race). */
const PG_UNIQUE_VIOLATION = '23505';

async function findUserByContact(destination: string) {
  const [row] = await db
    .select()
    .from(users)
    .where(or(eq(users.email, destination), eq(users.phone, destination)));
  return row;
}

/**
 * Verifies `code` for `destinationRaw` and resolves the account: LOGIN for a
 * known contact, REGISTRATION for an unknown contact when `register` is
 * supplied, or `{ok:false, reason:'registration_required'}` for an unknown
 * contact with no `register` payload (the caller should re-prompt for
 * ward/language/consent and call again with the SAME code).
 */
export async function resolveOrRegister(
  destinationRaw: string,
  code: string,
  register?: RegisterPayload,
  srcAttribution?: string | null,
): Promise<ResolveOrRegisterResult> {
  const destination = normalizeDestination(destinationRaw);
  const existing = await findUserByContact(destination);

  const consume = Boolean(existing) || Boolean(register);
  const verified = await verifyOtp(destinationRaw, code, { consume });
  if (!verified.ok) return verified;

  if (existing) {
    const session = await createSession(existing.id);
    return { ok: true, registered: false, setCookie: session.setCookie };
  }

  if (!register) {
    return { ok: false, reason: 'registration_required' };
  }

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
        srcAttribution: srcAttribution ?? null,
      })
      .returning();

    const session = await createSession(created!.id);
    return { ok: true, registered: true, setCookie: session.setCookie };
  } catch (err: unknown) {
    if ((err as { code?: string })?.code === PG_UNIQUE_VIOLATION) {
      // One-account-per-contact race: another request registered this exact
      // contact between our lookup above and this insert. Resolve as a
      // login for the winner rather than a duplicate or a 500.
      const winner = await findUserByContact(destination);
      if (winner) {
        const session = await createSession(winner.id);
        return { ok: true, registered: false, setCookie: session.setCookie };
      }
    }
    throw err;
  }
}
