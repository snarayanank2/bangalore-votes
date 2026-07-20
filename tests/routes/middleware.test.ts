import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import { inArray } from 'drizzle-orm';
import * as schema from '../../src/db/schema';
import { onRequest } from '../../src/middleware';
import { createSession, SESSION_COOKIE } from '../../src/lib/session';
import { issueCsrfToken } from '../../src/lib/csrf';
import { canEditWard, isSameOriginRelative } from '../../src/lib/authz';

if (!process.env.DATABASE_URL) {
  throw new Error(
    'DATABASE_URL is not set. CI always sets this; for local runs export ' +
      'DATABASE_URL=postgres://postgres@localhost:54329/bv_test (see task brief).',
  );
}

const client = postgres(process.env.DATABASE_URL, { max: 1 });
const db = drizzle(client, { schema });

const SITE_ORIGIN = 'https://bangalore-votes.opencity.in';
const SITE_URL = new URL(SITE_ORIGIN);

// High, task-specific ward ids (this file owns 99001/99002 — see task-25/26
// briefs for the numbering convention shared across route test files).
const WARD = {
  id: 99001,
  nameEn: 'Middleware Test Ward',
  nameKn: 'ಮಧ್ಯಸ್ಥಿಕೆ ಪರೀಕ್ಷಾ ವಾರ್ಡ್',
  corporation: 'south' as const,
  zone: 'Zone T',
  boundaryRef: 'middleware-test-ward',
};
const UNSCOPED_WARD_ID = 99002;

const EMAILS = {
  citizen: 'middleware-citizen@example.com',
  curator: 'middleware-curator@example.com',
  admin: 'middleware-admin@example.com',
};

let citizenId: number;
let curatorId: number;
let adminId: number;

async function upsertUser(email: string, role: 'citizen' | 'curator' | 'admin'): Promise<number> {
  const [row] = await db
    .insert(schema.users)
    .values({ email, role, status: 'active' })
    .onConflictDoUpdate({ target: schema.users.email, set: { role, status: 'active' } })
    .returning({ id: schema.users.id });
  return row!.id;
}

beforeAll(async () => {
  await migrate(db, { migrationsFolder: './drizzle' });

  await db
    .insert(schema.wards)
    .values([WARD, { ...WARD, id: UNSCOPED_WARD_ID, boundaryRef: 'middleware-test-ward-2' }])
    .onConflictDoNothing();

  citizenId = await upsertUser(EMAILS.citizen, 'citizen');
  curatorId = await upsertUser(EMAILS.curator, 'curator');
  adminId = await upsertUser(EMAILS.admin, 'admin');

  await db
    .insert(schema.curatorScopes)
    .values({ userId: curatorId, wardId: WARD.id })
    .onConflictDoNothing();
});

afterAll(async () => {
  const userIds = [citizenId, curatorId, adminId];
  await db.delete(schema.curatorScopes).where(inArray(schema.curatorScopes.userId, userIds));
  await db.delete(schema.sessions).where(inArray(schema.sessions.userId, userIds));
  await db.delete(schema.users).where(inArray(schema.users.email, Object.values(EMAILS)));
  await client.end();
});

type CtxOptions = {
  method?: string;
  path: string;
  headers?: Record<string, string>;
  cookieValue?: string;
  body?: string;
  contentType?: string;
};

function makeContext({ method = 'GET', path, headers = {}, cookieValue, body, contentType }: CtxOptions) {
  const url = new URL(path, SITE_URL);
  const reqHeaders = new Headers(headers);
  if (contentType) reqHeaders.set('content-type', contentType);

  const request = new Request(url, {
    method,
    headers: reqHeaders,
    body: method === 'GET' || method === 'HEAD' ? undefined : body,
  });

  const locals: Record<string, unknown> = {};

  return {
    request,
    url,
    site: SITE_URL,
    cookies: {
      get: (name: string) => (name === SESSION_COOKIE && cookieValue ? { value: cookieValue } : undefined),
    },
    locals,
  } as any;
}

function nextStub(status = 200) {
  return vi.fn(async () => new Response('ok', { status }));
}

async function sessionFor(userId: number) {
  return createSession(userId);
}

/**
 * `onRequest` is typed via Astro's `MiddlewareHandler` union
 * (`Promise<Response> | Response | Promise<void> | void`) because
 * `defineMiddleware`'s declared return type doesn't narrow to the specific
 * handler passed in — but src/middleware.ts always returns a `Response`
 * (never falls through to `void`), so tests call it through this thin,
 * narrowly-typed wrapper instead of casting at every call site.
 */
async function run(ctx: unknown, next: ReturnType<typeof nextStub>): Promise<Response> {
  return (await onRequest(ctx as never, next)) as Response;
}

describe('src/middleware.ts', () => {
  describe('Origin / Sec-Fetch-Site same-origin check on unsafe methods', () => {
    it('cross-origin Origin header on POST /account/... -> 403', async () => {
      const ctx = makeContext({
        method: 'POST',
        path: '/account/notifications',
        headers: { origin: 'https://evil.example' },
      });
      const res = await run(ctx, nextStub());
      expect(res.status).toBe(403);
    });

    it('same-origin Origin header + valid session + valid csrf token -> passes through to next()', async () => {
      const { id, cookieValue } = await sessionFor(citizenId);
      const token = issueCsrfToken(id);
      const next = nextStub(200);

      const ctx = makeContext({
        method: 'POST',
        path: '/account/notifications',
        headers: { origin: SITE_ORIGIN },
        cookieValue,
        contentType: 'application/x-www-form-urlencoded',
        body: new URLSearchParams({ csrf_token: token }).toString(),
      });

      const res = await run(ctx, next);
      expect(next).toHaveBeenCalled();
      expect(res.status).toBe(200);
    });

    it('Sec-Fetch-Site: same-origin passes (no Origin header needed)', async () => {
      const { id, cookieValue } = await sessionFor(citizenId);
      const token = issueCsrfToken(id);
      const next = nextStub(200);

      const ctx = makeContext({
        method: 'POST',
        path: '/account/notifications',
        headers: { 'sec-fetch-site': 'same-origin' },
        cookieValue,
        contentType: 'application/x-www-form-urlencoded',
        body: new URLSearchParams({ csrf_token: token }).toString(),
      });

      const res = await run(ctx, next);
      expect(next).toHaveBeenCalled();
      expect(res.status).toBe(200);
    });

    it('Sec-Fetch-Site: cross-site -> 403 even with a same-origin Origin header', async () => {
      const ctx = makeContext({
        method: 'POST',
        path: '/account/notifications',
        headers: { 'sec-fetch-site': 'cross-site', origin: SITE_ORIGIN },
      });
      const res = await run(ctx, nextStub());
      expect(res.status).toBe(403);
    });

    it('neither Origin nor Sec-Fetch-Site present -> 403 (fail closed)', async () => {
      const ctx = makeContext({ method: 'POST', path: '/account/notifications' });
      const res = await run(ctx, nextStub());
      expect(res.status).toBe(403);
    });
  });

  describe('route guards', () => {
    it('unauthenticated GET /account/... -> redirect to /login?next=<validated relative path>', async () => {
      const ctx = makeContext({ path: '/account/submissions?x=1' });
      const res = await run(ctx, nextStub());
      expect(res.status).toBe(302);
      expect(res.headers.get('location')).toBe(`/login?next=${encodeURIComponent('/account/submissions?x=1')}`);
    });

    it('unauthenticated GET /curator -> redirect to /login', async () => {
      const ctx = makeContext({ path: '/curator' });
      const res = await run(ctx, nextStub());
      expect(res.status).toBe(302);
      expect(res.headers.get('location')).toBe(`/login?next=${encodeURIComponent('/curator')}`);
    });

    it('citizen GET /curator -> 403', async () => {
      const { cookieValue } = await sessionFor(citizenId);
      const ctx = makeContext({ path: '/curator', cookieValue });
      const res = await run(ctx, nextStub());
      expect(res.status).toBe(403);
    });

    it('curator GET /curator -> passes through', async () => {
      const { cookieValue } = await sessionFor(curatorId);
      const next = nextStub(200);
      const ctx = makeContext({ path: '/curator', cookieValue });
      const res = await run(ctx, next);
      expect(next).toHaveBeenCalled();
      expect(res.status).toBe(200);
    });

    it('curator GET /admin -> 403', async () => {
      const { cookieValue } = await sessionFor(curatorId);
      const ctx = makeContext({ path: '/admin', cookieValue });
      const res = await run(ctx, nextStub());
      expect(res.status).toBe(403);
    });

    it('admin GET /curator -> passes through', async () => {
      const { cookieValue } = await sessionFor(adminId);
      const next = nextStub(200);
      const ctx = makeContext({ path: '/curator', cookieValue });
      const res = await run(ctx, next);
      expect(next).toHaveBeenCalled();
      expect(res.status).toBe(200);
    });

    it('admin GET /admin -> passes through', async () => {
      const { cookieValue } = await sessionFor(adminId);
      const next = nextStub(200);
      const ctx = makeContext({ path: '/admin', cookieValue });
      const res = await run(ctx, next);
      expect(next).toHaveBeenCalled();
      expect(res.status).toBe(200);
    });
  });

  describe('open-redirect defense (isSameOriginRelative)', () => {
    it('an absolute cross-origin URL collapses to /', () => {
      expect(isSameOriginRelative('https://evil.example')).toBe('/');
    });

    it('a protocol-relative URL collapses to /', () => {
      expect(isSameOriginRelative('//evil.example')).toBe('/');
    });

    it('a backslash-based protocol-relative trick collapses to /', () => {
      expect(isSameOriginRelative('/\\evil.example')).toBe('/');
      expect(isSameOriginRelative('\\\\evil.example')).toBe('/');
    });

    it('a same-origin relative path (with query) passes through unchanged', () => {
      expect(isSameOriginRelative('/account/submissions?x=1')).toBe('/account/submissions?x=1');
    });

    it('non-string / empty input collapses to /', () => {
      expect(isSameOriginRelative(undefined)).toBe('/');
      expect(isSameOriginRelative('')).toBe('/');
    });
  });

  describe('canEditWard', () => {
    it('admin: true for any ward', async () => {
      expect(await canEditWard(adminId, 'admin', WARD.id)).toBe(true);
      expect(await canEditWard(adminId, 'admin', UNSCOPED_WARD_ID)).toBe(true);
    });

    it('curator: true for a scoped ward', async () => {
      expect(await canEditWard(curatorId, 'curator', WARD.id)).toBe(true);
    });

    it('curator: false for an unscoped ward', async () => {
      expect(await canEditWard(curatorId, 'curator', UNSCOPED_WARD_ID)).toBe(false);
    });

    it('citizen: always false', async () => {
      expect(await canEditWard(citizenId, 'citizen', WARD.id)).toBe(false);
    });
  });

  describe('cache safety: public GETs', () => {
    it("GET / passes through and the response carries no Set-Cookie", async () => {
      const next = nextStub(200);
      const ctx = makeContext({ path: '/' });
      const res = await run(ctx, next);
      expect(next).toHaveBeenCalled();
      expect(res.status).toBe(200);
      expect(res.headers.get('set-cookie')).toBeNull();
    });

    it('a public GET with no session cookie resolves locals.session to null and is not blocked', async () => {
      const ctx = makeContext({ path: '/ward/1' });
      await run(ctx, nextStub(200));
      expect(ctx.locals.session).toBeNull();
    });
  });

  describe('synchronizer CSRF token', () => {
    it('/account POST without a valid token -> 403', async () => {
      const { cookieValue } = await sessionFor(citizenId);
      const ctx = makeContext({
        method: 'POST',
        path: '/account/notifications',
        headers: { origin: SITE_ORIGIN },
        cookieValue,
        contentType: 'application/x-www-form-urlencoded',
        body: new URLSearchParams({ csrf_token: 'not-the-right-token' }).toString(),
      });
      const res = await run(ctx, nextStub());
      expect(res.status).toBe(403);
    });

    it('/account POST with no token field at all -> 403', async () => {
      const { cookieValue } = await sessionFor(citizenId);
      const ctx = makeContext({
        method: 'POST',
        path: '/account/notifications',
        headers: { origin: SITE_ORIGIN },
        cookieValue,
        contentType: 'application/x-www-form-urlencoded',
        body: new URLSearchParams({}).toString(),
      });
      const res = await run(ctx, nextStub());
      expect(res.status).toBe(403);
    });

    it('/account POST with a valid issueCsrfToken(sessionId) -> passes the csrf check', async () => {
      const { id, cookieValue } = await sessionFor(citizenId);
      const next = nextStub(200);
      const ctx = makeContext({
        method: 'POST',
        path: '/account/notifications',
        headers: { origin: SITE_ORIGIN },
        cookieValue,
        contentType: 'application/x-www-form-urlencoded',
        body: new URLSearchParams({ csrf_token: issueCsrfToken(id) }).toString(),
      });
      const res = await run(ctx, next);
      expect(next).toHaveBeenCalled();
      expect(res.status).toBe(200);
    });

    it('/api/otp/request POST with a good Origin but no csrf field is NOT rejected by the CSRF rule', async () => {
      const next = nextStub(200);
      const ctx = makeContext({
        method: 'POST',
        path: '/api/otp/request',
        headers: { origin: SITE_ORIGIN, 'content-type': 'application/json' },
        body: JSON.stringify({ destination: 'x@example.com' }),
        contentType: 'application/json',
      });
      const res = await run(ctx, next);
      expect(next).toHaveBeenCalled();
      expect(res.status).toBe(200);
    });
  });

  describe('/api/webhooks/* exemption', () => {
    it('cross-origin POST with no Origin/Sec-Fetch-Site and no session is let through (not 403)', async () => {
      const next = nextStub(200);
      const ctx = makeContext({
        method: 'POST',
        path: '/api/webhooks/sendgrid',
        body: JSON.stringify([{ event: 'bounce' }]),
        contentType: 'application/json',
      });
      const res = await run(ctx, next);
      expect(next).toHaveBeenCalled();
      expect(res.status).toBe(200);
    });
  });

  describe('X-Robots-Tag: noindex', () => {
    it.each(['/account', '/curator', '/admin', '/login', '/partner/some-slug'])(
      '%s carries X-Robots-Tag: noindex',
      async (path) => {
        const ctx = makeContext({ path });
        const res = await run(ctx, nextStub(200));
        expect(res.headers.get('x-robots-tag')).toBe('noindex');
      },
    );

    it('a normal public page does NOT carry X-Robots-Tag', async () => {
      const ctx = makeContext({ path: '/ward/1' });
      const res = await run(ctx, nextStub(200));
      expect(res.headers.get('x-robots-tag')).toBeNull();
    });

    it('/partner-with-us (not /partner/*) does NOT carry X-Robots-Tag', async () => {
      const ctx = makeContext({ path: '/partner-with-us' });
      const res = await run(ctx, nextStub(200));
      expect(res.headers.get('x-robots-tag')).toBeNull();
    });
  });
});
