import { describe, it, expect } from 'vitest';
import { GET } from '../../src/pages/healthz';

describe('healthz', () => {
  it('returns ok json, no-store', async () => {
    const res = await GET({} as any);
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect(await res.json()).toEqual({ ok: true });
  });
});
