/**
 * WardLookup — progressive enhancement over the Home page's ward-search
 * `<form>` (PRD §5.1, IA §3.1).
 *
 * The form is a real `<form method="post">` that works with zero JS: a
 * plain submit POSTs to `/` and `Home.astro` server-renders the result
 * (see that file's `Astro.request.method === 'POST'` branch). This module
 * intercepts the submit, calls `POST /api/ward-lookup` instead, and paints
 * the same four result states inline so a JS-capable visitor never leaves
 * the page. `/api/ward-lookup` itself decides address vs pincode the same
 * way this module does (a bare 6-digit string is a pincode, anything else
 * is an address — see src/pages/api/ward-lookup.ts).
 *
 * On any failure to fetch/parse — network error, non-2xx, bad JSON — this
 * lets the native form submission proceed rather than trap the visitor
 * behind a broken island: that's what the no-JS server path exists for.
 *
 * Kept deliberately framework-free and small: no i18n table is imported
 * client-side (that would pull both locale JSON files into the bundle for
 * a handful of strings) — the handful of localized messages/labels this
 * script needs are read off `data-msg-*` attributes the server already
 * rendered in the visitor's language, and the ward link path is built with
 * the same rule as `localePath()` (src/i18n/index.ts) without importing it.
 */

interface WardRow {
  id: number;
  nameEn: string;
  nameKn: string;
  corporation: string;
}

type LookupResponse =
  | { result: 'ward'; ward: WardRow }
  | { result: 'shortlist'; wards: WardRow[] }
  | { result: 'out_of_coverage' }
  | { result: 'use_pincode'; reason?: string };

const PINCODE_RE = /^\d{6}$/;

function wardHref(lang: string, id: number): string {
  return lang === 'kn' ? `/kn/ward/${id}` : `/ward/${id}`;
}

function wardName(lang: string, ward: WardRow): string {
  return lang === 'kn' ? ward.nameKn : ward.nameEn;
}

function renderWard(container: HTMLElement, lang: string, ward: WardRow): void {
  const link = document.createElement('a');
  link.href = wardHref(lang, ward.id);
  link.textContent = wardName(lang, ward);
  container.replaceChildren(link);
}

function renderShortlist(container: HTMLElement, lang: string, heading: string, wards: WardRow[]): void {
  const headingEl = document.createElement('p');
  headingEl.textContent = heading;

  const list = document.createElement('ul');
  for (const ward of wards) {
    const item = document.createElement('li');
    const link = document.createElement('a');
    link.href = wardHref(lang, ward.id);
    link.textContent = wardName(lang, ward);
    item.appendChild(link);
    list.appendChild(item);
  }

  container.replaceChildren(headingEl, list);
}

function renderMessage(container: HTMLElement, message: string): void {
  const p = document.createElement('p');
  p.textContent = message;
  container.replaceChildren(p);
}

function renderResult(container: HTMLElement, lang: string, msgs: Record<string, string>, data: LookupResponse): void {
  switch (data.result) {
    case 'ward':
      renderWard(container, lang, data.ward);
      return;
    case 'shortlist':
      renderShortlist(container, lang, msgs.shortlistHeading ?? '', data.wards);
      return;
    case 'out_of_coverage':
      renderMessage(container, msgs.outOfCoverage ?? '');
      return;
    case 'use_pincode':
      renderMessage(container, msgs.usePincode ?? '');
      return;
  }
}

/**
 * Wires up every `[data-ward-lookup]` form under `root` (defaults to the
 * whole document — there is exactly one on the Home page, but scoping to a
 * root keeps this testable against a fragment). Safe to call when the form
 * is absent (does nothing).
 */
export function initWardLookup(root: ParentNode = document): void {
  const form = root.querySelector<HTMLFormElement>('[data-ward-lookup]');
  if (!form) return;

  const input = form.querySelector<HTMLInputElement>('input[name="query"]');
  const result = form.querySelector<HTMLElement>('[data-ward-result]');
  const submitButton = form.querySelector<HTMLButtonElement>('button[type="submit"]');
  if (!input || !result) return;

  const lang = form.dataset.lang ?? 'en';
  const msgs = {
    shortlistHeading: form.dataset.msgShortlistHeading ?? '',
    outOfCoverage: form.dataset.msgOutOfCoverage ?? '',
    usePincode: form.dataset.msgUsePincode ?? '',
  };

  form.addEventListener('submit', (event) => {
    const value = input.value.trim();
    if (!value) return; // native `required` validation handles this

    event.preventDefault();
    if (submitButton) submitButton.disabled = true;
    result.setAttribute('aria-busy', 'true');

    const body = PINCODE_RE.test(value) ? { pincode: value } : { address: value };

    fetch('/api/ward-lookup', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    })
      .then((res) => {
        if (!res.ok) throw new Error(`ward-lookup: ${res.status}`);
        return res.json() as Promise<LookupResponse>;
      })
      .then((data) => {
        renderResult(result, lang, msgs, data);
      })
      .catch(() => {
        // Fetch/parse failed — degrade to the real no-JS submission rather
        // than leave the visitor stuck with a spinner.
        form.submit();
      })
      .finally(() => {
        if (submitButton) submitButton.disabled = false;
        result.removeAttribute('aria-busy');
      });
  });
}
