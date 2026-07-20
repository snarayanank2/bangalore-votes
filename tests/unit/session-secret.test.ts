import { describe, it, expect, afterEach } from 'vitest';
import { vi } from 'vitest';

/**
 * Tests for resolveSessionSecret() fail-closed behavior (src/lib/session.ts).
 * Tests that the module throws at import time in production without SESSION_SECRET.
 *
 * This test file isolates environment manipulation (NODE_ENV, SESSION_SECRET)
 * in its own file to avoid leaking state to other tests that depend on the
 * dev/test secret and real database.
 */

describe('resolveSessionSecret() fail-closed path', () => {
  afterEach(() => {
    // Ensure cleanup after each test: restore env and clear module cache.
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('throws at module load when NODE_ENV=production and SESSION_SECRET is unset', async () => {
    // Stub environment: production, no secret
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('SESSION_SECRET', '');

    // Dynamic import: the module throws at top-level load (resolveSessionSecret() is called at module scope)
    await expect(import('../../src/lib/session')).rejects.toThrow(
      /SESSION_SECRET is not set.*production/,
    );
  });

  it('does NOT throw at module load when NODE_ENV=production and SESSION_SECRET is set', async () => {
    // Stub environment: production WITH a secret
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('SESSION_SECRET', 'test-production-secret-32-bytes-minimum-length-ok');

    // Dynamic import: should succeed
    const mod = await import('../../src/lib/session');
    expect(mod).toBeDefined();
    expect(mod.createSession).toBeDefined();
  });

  it('does NOT throw in dev/test mode (NODE_ENV unset, SESSION_SECRET unset)', async () => {
    // Stub environment: dev/test (NODE_ENV not 'production'), no secret
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('SESSION_SECRET', '');

    // Dynamic import: should succeed (falls back to dev secret with a warn)
    const mod = await import('../../src/lib/session');
    expect(mod).toBeDefined();
    expect(mod.createSession).toBeDefined();
  });
});
