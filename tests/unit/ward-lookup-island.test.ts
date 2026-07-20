// @vitest-environment jsdom
/**
 * Direct coverage for the JS-enhanced ward finder (src/islands/WardLookup.ts)
 * — the island most real users exercise on Home, previously verified only by
 * code reading (Task 18 review finding). Exercises:
 *  - the 6-digit-pincode-else-address classification, observed via the JSON
 *    body the island POSTs to /api/ward-lookup (mocked `fetch`);
 *  - all four `LookupResponse` render branches painted into the
 *    `[data-ward-result]` aria-live container;
 *  - the fetch-failure (network error / non-2xx) fallback to the real,
 *    no-JS `<form>` submission, so a JS-capable visitor is never trapped.
 *
 * `initWardLookup` is the module's one exported entry point (called by
 * Home.astro's inline bootstrap script — see that file's closing
 * `<script>` tag); no refactor was needed to test it; this file builds a
 * DOM fragment mirroring the exact markup/data attributes Home.astro emits
 * and drives it via jsdom.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { initWardLookup } from '../../src/islands/WardLookup';
import { t } from '../../src/i18n';

const WARD_A = { id: 5025, nameEn: 'X', nameKn: 'ಎಕ್ಸ್', corporation: 'south' };
const WARD_B = { id: 5026, nameEn: 'Y', nameKn: 'ವೈ', corporation: 'south' };

/**
 * Builds the same `[data-ward-lookup]` fragment Home.astro renders (form +
 * required text input + submit button + aria-live result container), with
 * the msg-* data attributes populated from the real i18n tables so the
 * render-branch tests assert the same strings production ships.
 */
function buildForm(lang: 'en' | 'kn' = 'en'): {
  form: HTMLFormElement;
  input: HTMLInputElement;
  result: HTMLElement;
} {
  document.body.innerHTML = `
    <form data-ward-lookup data-lang="${lang}"
      data-msg-shortlist-heading="${t(lang, 'home.result.shortlistHeading')}"
      data-msg-out-of-coverage="${t(lang, 'home.result.outOfCoverage')}"
      data-msg-use-pincode="${t(lang, 'home.result.usePincode')}">
      <input name="query" required />
      <button type="submit">Search</button>
      <div data-ward-result aria-live="polite"></div>
    </form>
  `;
  return {
    form: document.querySelector('form')!,
    input: document.querySelector('input[name="query"]')!,
    result: document.querySelector('[data-ward-result]')!,
  };
}

function submit(form: HTMLFormElement): void {
  form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
}

/**
 * Flush the microtask queue so chained `.then()`/`.catch()`/`.finally()` run
 * (the island's fetch chain is `fetch().then(ok-check+json()).then(render)
 * .catch(submit-fallback).finally(busy-clear)` — several microtask hops deep
 * once `res.json()`'s own promise is included).
 */
async function flush(): Promise<void> {
  for (let i = 0; i < 8; i++) {
    await Promise.resolve();
  }
}

describe('WardLookup island (src/islands/WardLookup.ts)', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    document.body.innerHTML = '';
  });

  it('does nothing (does not throw) when no [data-ward-lookup] form is present', () => {
    document.body.innerHTML = '<p>no form here</p>';
    expect(() => initWardLookup()).not.toThrow();
  });

  describe('query classification (6-digit pincode vs. address)', () => {
    // The island has no separately-exported classifier — the heuristic
    // (a bare 6-digit string is a pincode, everything else is an address;
    // same rule as Home.astro's server-side POST branch and
    // src/pages/api/ward-lookup.ts) is only observable via the JSON body
    // posted to /api/ward-lookup, so these assert on `fetchMock`'s call.
    it.each([
      ['560001', { pincode: '560001' }],
      ['  560001  ', { pincode: '560001' }], // trimmed before classifying
      ['12345', { address: '12345' }], // 5 digits — not a pincode
      ['1234567', { address: '1234567' }], // 7 digits — not a pincode
      ['abc', { address: 'abc' }],
      ['MG Road', { address: 'MG Road' }],
    ])('query %j -> POST body %j', async (query, expectedBody) => {
      fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ result: 'out_of_coverage' }) });
      const { form, input } = buildForm();
      initWardLookup();
      input.value = query;

      submit(form);
      await flush();

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toBe('/api/ward-lookup');
      expect(init.method).toBe('POST');
      expect(JSON.parse(init.body)).toEqual(expectedBody);
    });

    it('does not fetch and leaves the event un-prevented for an empty query (native `required` handles it)', () => {
      const { form, input } = buildForm();
      initWardLookup();
      input.value = '';

      const event = new Event('submit', { bubbles: true, cancelable: true });
      form.dispatchEvent(event);

      expect(fetchMock).not.toHaveBeenCalled();
      expect(event.defaultPrevented).toBe(false);
    });
  });

  describe('render branches', () => {
    it('ward result: renders a link to /ward/{id} (en) / /kn/ward/{id} (kn)', async () => {
      for (const lang of ['en', 'kn'] as const) {
        fetchMock.mockResolvedValueOnce({
          ok: true,
          json: async () => ({ result: 'ward', ward: WARD_A }),
        });
        const { form, input, result } = buildForm(lang);
        initWardLookup();
        input.value = '560001';

        submit(form);
        await flush();

        expect(result.getAttribute('aria-live')).toBe('polite');
        const link = result.querySelector('a');
        expect(link).not.toBeNull();
        expect(link!.getAttribute('href')).toBe(lang === 'kn' ? '/kn/ward/5025' : '/ward/5025');
        expect(link!.textContent).toBe(lang === 'kn' ? WARD_A.nameKn : WARD_A.nameEn);
      }
    });

    it('shortlist result: renders a link for every candidate ward', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ result: 'shortlist', wards: [WARD_A, WARD_B] }),
      });
      const { form, input, result } = buildForm('en');
      initWardLookup();
      input.value = '560001';

      submit(form);
      await flush();

      expect(result.textContent).toContain(t('en', 'home.result.shortlistHeading'));
      const links = [...result.querySelectorAll('a')];
      expect(links).toHaveLength(2);
      expect(links.map((a) => a.getAttribute('href'))).toEqual(['/ward/5025', '/ward/5026']);
      expect(links.map((a) => a.textContent)).toEqual([WARD_A.nameEn, WARD_B.nameEn]);
    });

    it('out_of_coverage result: renders the explicit not-in-GBA message (home.result.outOfCoverage)', async () => {
      fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ result: 'out_of_coverage' }) });
      const { form, input, result } = buildForm('en');
      initWardLookup();
      input.value = 'Nowhere at all';

      submit(form);
      await flush();

      expect(result.textContent).toBe(t('en', 'home.result.outOfCoverage'));
      expect(result.querySelector('a')).toBeNull();
    });

    it('use_pincode result: renders the try-pincode prompt (home.result.usePincode)', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ result: 'use_pincode', reason: 'ambiguous' }),
      });
      const { form, input, result } = buildForm('en');
      initWardLookup();
      input.value = 'Some ambiguous address';

      submit(form);
      await flush();

      expect(result.textContent).toBe(t('en', 'home.result.usePincode'));
      expect(result.querySelector('a')).toBeNull();
    });
  });

  describe('fetch-failure -> native submit fallback (visitor never trapped)', () => {
    it('a rejected fetch (network error) falls back to the real form submission', async () => {
      fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'));
      const { form, input, result } = buildForm('en');
      initWardLookup();
      input.value = 'MG Road';
      const submitSpy = vi.spyOn(form, 'submit').mockImplementation(() => {});

      submit(form);
      await flush();

      expect(submitSpy).toHaveBeenCalledTimes(1);
      // No partial/broken render was left behind, and the busy state was
      // cleared rather than leaving the visitor stuck with a spinner.
      expect(result.hasAttribute('aria-busy')).toBe(false);
    });

    it('a non-2xx response also falls back to the real form submission', async () => {
      fetchMock.mockResolvedValueOnce({ ok: false, status: 500, json: async () => ({}) });
      const { form, input, result } = buildForm('en');
      initWardLookup();
      input.value = 'MG Road';
      const submitSpy = vi.spyOn(form, 'submit').mockImplementation(() => {});

      submit(form);
      await flush();

      expect(submitSpy).toHaveBeenCalledTimes(1);
      expect(result.hasAttribute('aria-busy')).toBe(false);
    });
  });

  describe('busy state and re-entrancy guard', () => {
    it('sets aria-busy and disables the submit button while the request is in flight', async () => {
      let resolveFetch!: (value: unknown) => void;
      fetchMock.mockReturnValueOnce(new Promise((resolve) => (resolveFetch = resolve)));
      const { form, input, result } = buildForm('en');
      initWardLookup();
      input.value = '560001';
      const button = form.querySelector('button[type="submit"]') as HTMLButtonElement;

      submit(form);
      await flush();

      expect(result.getAttribute('aria-busy')).toBe('true');
      expect(button.disabled).toBe(true);

      resolveFetch({ ok: true, json: async () => ({ result: 'out_of_coverage' }) });
      await flush();

      expect(result.hasAttribute('aria-busy')).toBe(false);
      expect(button.disabled).toBe(false);
    });
  });
});
