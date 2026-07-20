import { describe, it, expect } from 'vitest';
import { issueCsrfToken, checkCsrfToken } from '../../src/lib/csrf';

describe('src/lib/csrf.ts', () => {
  describe('cross-session token rejection (Task 26 review, Minor)', () => {
    it('a token issued for session A does not validate for session B', () => {
      const tokenA = issueCsrfToken('session-A-id');
      expect(checkCsrfToken('session-B-id', tokenA)).toBe(false);
    });

    it('the same token still validates for the session it was issued for', () => {
      const tokenA = issueCsrfToken('session-A-id');
      expect(checkCsrfToken('session-A-id', tokenA)).toBe(true);
    });
  });

  describe('checkCsrfToken edge cases', () => {
    it('rejects a missing token', () => {
      expect(checkCsrfToken('session-A-id', undefined)).toBe(false);
      expect(checkCsrfToken('session-A-id', null)).toBe(false);
    });

    it('rejects an empty-string token', () => {
      expect(checkCsrfToken('session-A-id', '')).toBe(false);
    });

    it('rejects a token that is not valid hex', () => {
      expect(checkCsrfToken('session-A-id', 'not-hex-!!')).toBe(false);
    });

    it('rejects a valid-hex token of the wrong length', () => {
      expect(checkCsrfToken('session-A-id', 'ab')).toBe(false);
    });
  });
});
