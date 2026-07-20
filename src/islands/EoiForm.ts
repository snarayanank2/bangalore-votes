/**
 * Partner-with-us expression-of-interest form's client-side half (Task 50,
 * IA §3.15, PRD §5.13). Unlike the Flag/Vote modals, this is a real,
 * always-visible page `<form>` — not a dialog, no auth gating (this is the
 * one anonymous write path; there is nothing to resume after login because
 * there is no login).
 *
 * RECAPTCHA V3 TOKEN: obtained lazily, right before submit, via
 * `grecaptcha.execute(siteKey, {action:'eoi'})` — never at page load (v3
 * tokens are short-lived and single-use-ish; fetching one per submit is the
 * documented pattern). `siteKey` comes from this form's own
 * `data-recaptcha-site-key` attribute, rendered server-side from
 * `process.env.RECAPTCHA_SITE_KEY` (PartnerWithUs.astro) — absent in this
 * repo's dev/CI env. When it's absent (or `window.grecaptcha` never loaded,
 * e.g. blocked by an ad-blocker), this code still submits, with an EMPTY
 * token string. The server (src/lib/recaptcha.ts) accepts that in dev/test
 * (no secret configured -> dev-accept) and would reject it for real in
 * production (a real secret + an empty token fails verification). See the
 * module's own "NO-JS" note below for the zero-JS case, which this same
 * empty-token path also covers.
 *
 * NO-JS: this <form> has no `action`/`method` (see PartnerWithUs.astro), so
 * a no-JS submit does nothing harmful (the browser's default GET-to-current-
 * URL is a no-op re-render) rather than hitting the JSON API with
 * form-encoded data. With JS, THIS island intercepts submit entirely. A
 * no-JS visitor simply cannot submit this form — acceptable per the task
 * brief: reCAPTCHA v3 requires JS, and the EOI is a low-frequency
 * deliberate action (unlike the ward finder, which must work no-JS).
 */

declare global {
  interface Window {
    grecaptcha?: {
      ready: (cb: () => void) => void;
      execute: (siteKey: string, opts: { action: string }) => Promise<string>;
    };
  }
}

interface Elements {
  form: HTMLFormElement;
  submitButton: HTMLButtonElement;
  successMessage: HTMLElement;
  errorMessage: HTMLElement;
  msgGenericError: string;
  msgRecaptchaFailed: string;
  msgInvalid: string;
  msgSuccess: string;
  siteKey: string;
}

function text(root: ParentNode, selector: string): string {
  return root.querySelector(selector)?.textContent ?? '';
}

function findElements(root: ParentNode): Elements | null {
  const form = root.querySelector<HTMLFormElement>('[data-eoi-form]');
  const submitButton = form?.querySelector<HTMLButtonElement>('[data-eoi-submit]');
  const successMessage = form?.querySelector<HTMLElement>('[data-eoi-success]');
  const errorMessage = form?.querySelector<HTMLElement>('[data-eoi-error]');

  if (!form || !submitButton || !successMessage || !errorMessage) {
    return null;
  }

  return {
    form,
    submitButton,
    successMessage,
    errorMessage,
    msgGenericError: text(form, '[data-msg-generic-error]'),
    msgRecaptchaFailed: text(form, '[data-msg-recaptcha-failed]'),
    msgInvalid: text(form, '[data-msg-invalid]'),
    msgSuccess: text(form, '[data-msg-success]'),
    siteKey: form.dataset.recaptchaSiteKey ?? '',
  };
}

function clearMessages(e: Elements): void {
  e.successMessage.hidden = true;
  e.successMessage.textContent = '';
  e.errorMessage.hidden = true;
  e.errorMessage.textContent = '';
}

function showError(e: Elements, message: string): void {
  e.errorMessage.hidden = false;
  e.errorMessage.textContent = message;
}

function showSuccess(e: Elements): void {
  e.successMessage.hidden = false;
  e.successMessage.textContent = e.msgSuccess;
}

/**
 * Resolves to a reCAPTCHA v3 token, or `''` if no site key is configured or
 * `grecaptcha` never became available (see module docstring — the server
 * handles an empty token gracefully in dev/test, and fails a real
 * production request for real).
 */
async function getRecaptchaToken(siteKey: string): Promise<string> {
  if (!siteKey || typeof window === 'undefined' || !window.grecaptcha) {
    return '';
  }
  try {
    return await new Promise<string>((resolve, reject) => {
      window.grecaptcha!.ready(() => {
        window
          .grecaptcha!.execute(siteKey, { action: 'eoi' })
          .then(resolve)
          .catch(reject);
      });
    });
  } catch {
    return '';
  }
}

function fieldValue(form: HTMLFormElement, name: string): string {
  const el = form.elements.namedItem(name);
  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) {
    return el.value.trim();
  }
  return '';
}

async function onSubmit(event: SubmitEvent, e: Elements): Promise<void> {
  event.preventDefault();
  clearMessages(e);
  e.submitButton.disabled = true;

  try {
    const recaptchaToken = await getRecaptchaToken(e.siteKey);

    const body = {
      path: fieldValue(e.form, 'path'),
      name: fieldValue(e.form, 'name'),
      organisation: fieldValue(e.form, 'organisation') || null,
      contact: fieldValue(e.form, 'contact'),
      wardsText: fieldValue(e.form, 'wardsText') || null,
      message: fieldValue(e.form, 'message') || null,
      recaptchaToken,
    };

    let res: Response;
    try {
      res = await fetch('/api/eoi', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
    } catch {
      showError(e, e.msgGenericError);
      return;
    }

    if (res.ok) {
      showSuccess(e);
      e.form.reset();
      return;
    }

    if (res.status === 403 || res.status === 400) {
      const parsed = await res.json().catch(() => null);
      if (parsed?.error === 'recaptcha_failed') {
        showError(e, e.msgRecaptchaFailed);
      } else {
        showError(e, e.msgInvalid);
      }
      return;
    }

    showError(e, e.msgGenericError);
  } finally {
    e.submitButton.disabled = false;
  }
}

/** Wires the EOI form found via `[data-eoi-form]` on this page. Safe no-op if the markup isn't present (this island is only ever imported from PartnerWithUs.astro). */
export function initEoiForm(root: ParentNode = document): void {
  const e = findElements(root);
  if (!e) return;

  e.form.addEventListener('submit', (event) => {
    void onSubmit(event, e);
  });
}
