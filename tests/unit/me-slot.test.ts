// @vitest-environment jsdom
/**
 * Direct coverage for the MeSlot island (src/islands/MeSlot.ts) — Task 28.
 * Builds a DOM fixture mirroring the exact markup src/components/AppBar.astro
 * and src/features/pages/Ward.astro/WardIssues.astro render (`data-me-slot`/
 * `data-msg-account`, `data-register-slot`/`data-ward-id`/
 * `data-msg-receiving-updates`, `data-vote-action`/`data-ward-id`), and
 * drives it with a mocked `fetch('/api/me')`.
 *
 * MODULE STATE: the island caches the single `/api/me` promise at module
 * scope (`mePromise` — see that file's header for why). Each test below
 * resets modules (`vi.resetModules()` + a fresh dynamic import) so no test
 * inherits a previous test's cached response.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

type MeSlotModule = typeof import('../../src/islands/MeSlot');

const ACCOUNT_LABEL = 'My account';
const RECEIVING_UPDATES_LABEL = "You're receiving updates";
const HOME_WARD_ID = 42;
const OTHER_WARD_ID = 57;

function fixtureHtml(wardId: number): string {
  return `
    <a href="/login" data-me-slot data-msg-account="${ACCOUNT_LABEL}">Sign in</a>
    <a
      href="/login"
      data-register-slot
      data-ward-id="${wardId}"
      data-msg-receiving-updates="${RECEIVING_UPDATES_LABEL}"
    >Register for updates</a>
    <a href="/login" data-vote-action data-ward-id="${wardId}">Vote your top 3</a>
  `;
}

function jsonResponse(body: unknown): { ok: true; json: () => Promise<unknown> } {
  return { ok: true, json: async () => body };
}

describe('MeSlot island (src/islands/MeSlot.ts)', () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  let initMeSlot: MeSlotModule['initMeSlot'];

  beforeEach(async () => {
    document.documentElement.lang = 'en';
    document.body.innerHTML = fixtureHtml(HOME_WARD_ID);
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    vi.resetModules();
    ({ initMeSlot } = await import('../../src/islands/MeSlot'));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('anonymous: app bar stays "Sign in", register slot unchanged', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ anonymous: true }));

    await initMeSlot();

    const meSlot = document.querySelector('[data-me-slot]') as HTMLAnchorElement;
    expect(meSlot.textContent).toBe('Sign in');
    expect(meSlot.getAttribute('href')).toBe('/login');

    const registerSlot = document.querySelector('[data-register-slot]') as HTMLAnchorElement;
    expect(registerSlot.textContent).toBe('Register for updates');
    expect(registerSlot.getAttribute('data-ward-id')).toBe(String(HOME_WARD_ID));
  });

  it('authed with homeWardId === this ward: app bar becomes an Account link, register slot becomes "Receiving updates"', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        anonymous: false,
        userId: 1,
        role: 'citizen',
        homeWardId: HOME_WARD_ID,
        language: 'en',
        alreadyVotedWardId: null,
      }),
    );

    await initMeSlot();

    const meSlot = document.querySelector('[data-me-slot]');
    expect(meSlot).toBeNull(); // swapped out entirely (cloneNode + replaceWith)
    const accountLink = document.querySelector('a:not([data-register-slot]):not([data-vote-action])') as HTMLAnchorElement;
    expect(accountLink.textContent).toBe(ACCOUNT_LABEL);
    expect(accountLink.getAttribute('href')).toBe('/account');
    expect(accountLink.hasAttribute('data-me-slot')).toBe(false);

    const registerSlot = document.querySelector('[data-register-slot]');
    expect(registerSlot).toBeNull();
    // The wrapped status text should still be present (own home ward), and
    // no longer a link to /login (it's a plain, non-interactive status now
    // — the vote-action element elsewhere on the page keeps its own href,
    // untouched by this swap).
    expect(document.body.textContent).toContain(RECEIVING_UPDATES_LABEL);
    const statusEl = Array.from(document.querySelectorAll('a')).find((a) => a.textContent === RECEIVING_UPDATES_LABEL);
    expect(statusEl?.getAttribute('href')).toBeNull();
  });

  it('kn page: the Account link points at /kn/account', async () => {
    document.documentElement.lang = 'kn';
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        anonymous: false,
        userId: 1,
        role: 'citizen',
        homeWardId: HOME_WARD_ID,
        language: 'kn',
        alreadyVotedWardId: null,
      }),
    );

    await initMeSlot();

    const accountLink = document.querySelector('a:not([data-vote-action])') as HTMLAnchorElement;
    expect(accountLink.getAttribute('href')).toBe('/kn/account');
  });

  it('authed with homeWardId !== this ward: register slot is removed (hidden) entirely', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        anonymous: false,
        userId: 1,
        role: 'citizen',
        homeWardId: OTHER_WARD_ID,
        language: 'en',
        alreadyVotedWardId: null,
      }),
    );

    await initMeSlot();

    expect(document.querySelector('[data-register-slot]')).toBeNull();
    expect(document.body.textContent).not.toContain('Register for updates');
    expect(document.body.textContent).not.toContain(RECEIVING_UPDATES_LABEL);
  });

  it('already-voted hint: marks [data-vote-action] with data-already-voted when this ward matches alreadyVotedWardId', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        anonymous: false,
        userId: 1,
        role: 'citizen',
        homeWardId: OTHER_WARD_ID,
        language: 'en',
        alreadyVotedWardId: HOME_WARD_ID,
      }),
    );

    await initMeSlot();

    const voteAction = document.querySelector('[data-vote-action]') as HTMLElement;
    expect(voteAction.getAttribute('data-already-voted')).toBe('true');
  });

  it('does not mark [data-vote-action] when alreadyVotedWardId is a different ward', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        anonymous: false,
        userId: 1,
        role: 'citizen',
        homeWardId: OTHER_WARD_ID,
        language: 'en',
        alreadyVotedWardId: OTHER_WARD_ID,
      }),
    );

    await initMeSlot();

    const voteAction = document.querySelector('[data-vote-action]') as HTMLElement;
    expect(voteAction.hasAttribute('data-already-voted')).toBe(false);
  });

  it('makes exactly ONE fetch call even with multiple personalized slots present', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ anonymous: true }));

    await initMeSlot();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith('/api/me');
  });

  it('graceful failure: a rejected fetch leaves every element unchanged (still the anonymous server markup)', async () => {
    fetchMock.mockRejectedValueOnce(new Error('network down'));

    await initMeSlot();

    const meSlot = document.querySelector('[data-me-slot]') as HTMLAnchorElement;
    expect(meSlot.textContent).toBe('Sign in');
    const registerSlot = document.querySelector('[data-register-slot]') as HTMLAnchorElement;
    expect(registerSlot.textContent).toBe('Register for updates');
    const voteAction = document.querySelector('[data-vote-action]') as HTMLElement;
    expect(voteAction.hasAttribute('data-already-voted')).toBe(false);
  });

  it('graceful failure: a non-2xx response leaves every element unchanged', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, json: async () => ({}) });

    await initMeSlot();

    const meSlot = document.querySelector('[data-me-slot]') as HTMLAnchorElement;
    expect(meSlot.textContent).toBe('Sign in');
  });

  it('is a safe no-op when none of the personalized elements are present', async () => {
    document.body.innerHTML = '<p>nothing personalized here</p>';
    fetchMock.mockResolvedValueOnce(jsonResponse({ anonymous: true }));

    await initMeSlot();

    expect(fetchMock).not.toHaveBeenCalled();
  });
});
