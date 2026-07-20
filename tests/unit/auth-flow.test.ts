/**
 * Direct coverage for src/lib/auth-flow.ts's `resolveOrRegister` — the
 * shared account-resolution helper behind BOTH `/api/otp/verify` and
 * `/login` (Task 27). tests/routes/otp.test.ts already covers the
 * known/unknown/consent/one-account-per-contact behavior end-to-end through
 * the API route (with `verifyOtp` mocked); this file exercises
 * `resolveOrRegister` directly against the REAL `verifyOtp`/otp_codes to
 * cover the one thing that can only be seen at that level: the
 * peek-then-consume handling of the OTP code across the two-call
 * confirm/register step (an unknown contact's first call, with no
 * `register` payload, must leave the code valid for the immediate
 * follow-up call that supplies it).
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import { eq, inArray } from 'drizzle-orm';
import * as schema from '../../src/db/schema';

// Intercept the transports so no real network call ever happens and so the
// plaintext code (never persisted anywhere but its hash) can be read back
// out of the "sent" email/WhatsApp body — same technique as
// tests/unit/otp.test.ts.
vi.mock('../../src/lib/send/sendgrid', () => ({ sendEmail: vi.fn(async () => ({ ok: true })) }));
vi.mock('../../src/lib/send/twilio', () => ({ sendWhatsAppTemplate: vi.fn(async () => ({ ok: true, status: 'sent' })) }));

import { sendEmail } from '../../src/lib/send/sendgrid';
import { resolveOrRegister } from '../../src/lib/auth-flow';
import { requestOtp } from '../../src/lib/otp';
import { SESSION_COOKIE } from '../../src/lib/session';

if (!process.env.DATABASE_URL) {
  throw new Error(
    'DATABASE_URL is not set. CI always sets this; for local runs export ' +
      'DATABASE_URL=postgres://postgres@localhost:54329/bv_test (see task brief).',
  );
}

const client = postgres(process.env.DATABASE_URL, { max: 1 });
const db = drizzle(client, { schema });

// Task-specific ward id, distinct from other suites' fixtures.
const WARD = {
  id: 98101,
  nameEn: 'Auth Flow Test Ward',
  nameKn: 'ದೃಢೀಕರಣ ಹರಿವು ಪರೀಕ್ಷಾ ವಾರ್ಡ್',
  corporation: 'south' as const,
  zone: 'Zone AF',
  boundaryRef: 'auth-flow-test-ward',
};

const KNOWN_EMAIL = 'auth-flow-known@example.com';
const NEW_EMAIL = 'auth-flow-new@example.com';
// See tests/routes/otp.test.ts's comment on this same constant:
// `app_settings.consent_wording_version` is a global singleton row shared
// across concurrently-run test files — every file that seeds it must use
// the SAME literal value.
const CONSENT_VERSION = 'shared-test-consent-wording-v1';
const FIXTURE_EMAILS = [KNOWN_EMAIL, NEW_EMAIL];

async function resetFixtures(): Promise<void> {
  const fixtureUsers = await db
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(inArray(schema.users.email, FIXTURE_EMAILS));
  const fixtureUserIds = fixtureUsers.map((u) => u.id);
  if (fixtureUserIds.length > 0) {
    await db.delete(schema.sessions).where(inArray(schema.sessions.userId, fixtureUserIds));
  }
  await db.delete(schema.users).where(inArray(schema.users.email, FIXTURE_EMAILS));
  await db.delete(schema.otpCodes).where(inArray(schema.otpCodes.destination, FIXTURE_EMAILS));
}

/** Requests a real code for `destination` and returns the plaintext (intercepted via the mocked sender). */
async function getRealCode(destination: string): Promise<string> {
  const before = vi.mocked(sendEmail).mock.calls.length;
  const status = await requestOtp(destination, 'email', 'auth');
  expect(status).toBe('sent');
  const call = vi.mocked(sendEmail).mock.calls[before]!;
  const html = call[2];
  const match = /(\d{6})/.exec(html);
  if (!match) throw new Error('no 6-digit code found in the fixture email body');
  return match[1]!;
}

describe('src/lib/auth-flow.ts resolveOrRegister', () => {
  beforeAll(async () => {
    await migrate(db, { migrationsFolder: './drizzle' });

    await db
      .insert(schema.wards)
      .values(WARD)
      .onConflictDoUpdate({ target: schema.wards.id, set: WARD });

    await db
      .insert(schema.appSettings)
      .values({ key: 'consent_wording_version', value: CONSENT_VERSION })
      .onConflictDoUpdate({ target: schema.appSettings.key, set: { value: CONSENT_VERSION } });
  });

  afterAll(async () => {
    await resetFixtures();
    await client.end();
  });

  beforeEach(async () => {
    await resetFixtures();
  });

  it('known contact -> {ok:true, registered:false, setCookie} without touching consent fields', async () => {
    const [existing] = await db
      .insert(schema.users)
      .values({ email: KNOWN_EMAIL, homeWardId: WARD.id, role: 'citizen', status: 'active' })
      .returning();

    const code = await getRealCode(KNOWN_EMAIL);
    const result = await resolveOrRegister(KNOWN_EMAIL, code);

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('unreachable');
    expect(result.registered).toBe(false);
    expect(result.setCookie).toContain(`${SESSION_COOKIE}=`);

    const [row] = await db.select().from(schema.users).where(eq(schema.users.id, existing!.id));
    expect(row!.consentAt).toBeNull();
  });

  it('unknown contact, no register payload -> {ok:false, reason:"registration_required"}, no user created, and the code STAYS VALID for the immediate follow-up call', async () => {
    const code = await getRealCode(NEW_EMAIL);

    const peek = await resolveOrRegister(NEW_EMAIL, code);
    expect(peek).toEqual({ ok: false, reason: 'registration_required' });

    const rows = await db.select().from(schema.users).where(eq(schema.users.email, NEW_EMAIL));
    expect(rows).toHaveLength(0);

    // The SAME code, now with the register payload — this is exactly what
    // the Register/Login modal's step 3 (and /login's step 3) submits.
    const final = await resolveOrRegister(NEW_EMAIL, code, { wardId: WARD.id, language: 'en', futureTools: true });
    expect(final.ok).toBe(true);
    if (!final.ok) throw new Error('unreachable');
    expect(final.registered).toBe(true);
    expect(final.setCookie).toContain(`${SESSION_COOKIE}=`);

    const [row] = await db.select().from(schema.users).where(eq(schema.users.email, NEW_EMAIL));
    expect(row).toBeDefined();
    expect(row!.homeWardId).toBe(WARD.id);
    expect(row!.futureToolsOptIn).toBe(true);
    expect(row!.consentVersion).toBe(CONSENT_VERSION);
    expect(row!.consentAt).not.toBeNull();
  });

  it('a THIRD call with the same code, after registration already consumed it, fails as invalid (no replay)', async () => {
    const code = await getRealCode(NEW_EMAIL);
    await resolveOrRegister(NEW_EMAIL, code); // registration_required peek
    await resolveOrRegister(NEW_EMAIL, code, { wardId: WARD.id, language: 'en', futureTools: false }); // consumes it

    const replay = await resolveOrRegister(NEW_EMAIL, code, { wardId: WARD.id, language: 'en', futureTools: false });
    expect(replay).toEqual({ ok: false, reason: 'invalid' });

    const rows = await db.select().from(schema.users).where(eq(schema.users.email, NEW_EMAIL));
    expect(rows).toHaveLength(1); // still exactly one account
  });

  it('an expired code -> {ok:false, reason:"expired"}, passed straight through', async () => {
    await db.insert(schema.otpCodes).values({
      destination: NEW_EMAIL,
      channel: 'email',
      purpose: 'auth',
      codeHash: 'irrelevant-since-expiry-is-checked-first',
      attempts: 0,
      createdAt: new Date(Date.now() - 20 * 60 * 1000),
      expiresAt: new Date(Date.now() - 10 * 60 * 1000),
    });

    const result = await resolveOrRegister(NEW_EMAIL, '000000');
    expect(result).toEqual({ ok: false, reason: 'expired' });
  });

  it('srcAttribution passthrough: null when not provided', async () => {
    const code = await getRealCode(NEW_EMAIL);
    await resolveOrRegister(NEW_EMAIL, code); // peek
    await resolveOrRegister(NEW_EMAIL, code, { wardId: WARD.id, language: 'kn', futureTools: false });

    const [row] = await db.select().from(schema.users).where(eq(schema.users.email, NEW_EMAIL));
    expect(row!.srcAttribution).toBeNull();
    expect(row!.language).toBe('kn');
  });
});
