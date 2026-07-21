/**
 * Drives the Register/Login modal (src/components/RegisterLoginModal.astro,
 * src/islands/RegisterLoginModal.ts) to completion from an ALREADY-OPEN
 * dialog — every gated action in this app (Vote, Flag, plain "Sign in")
 * opens this exact modal itself; these helpers never click the opener, so
 * they compose with any of those entry points.
 *
 * Reads the OTP code via tests/e2e/support/otp-sink.ts (the OTP_TEST_SINK
 * table) rather than any UI affordance — there is deliberately no way to
 * read a real OTP from the page itself.
 */
import type { Page } from '@playwright/test';
import { readLatestOtpCode } from './otp-sink';

const MODAL = '[data-register-login-modal]';

/**
 * Fills step 1 (contact) and submits, then waits for step 2 (the OTP input)
 * to become visible. Call this once the modal is open (whether via
 * `[data-me-slot]`, a Vote/Flag action, or any future opener).
 */
export async function submitContact(page: Page, destination: string): Promise<void> {
  const dialog = page.locator(MODAL);
  await dialog.locator('[data-rl-form="1"] input[name="destination"]').fill(destination);
  await dialog.locator('[data-rl-form="1"] [data-rl-submit]').click();
  await dialog.locator('[data-rl-form="2"]').waitFor({ state: 'visible' });
}

/**
 * Reads the latest OTP code sent to `destination` (via the DB sink) and
 * submits step 2. Leaves the modal wherever it lands next: closed (known
 * contact — login complete) or on step 3 (unknown contact — registration
 * still needed, see `completeRegistration` below).
 */
export async function submitOtpCode(page: Page, destination: string): Promise<void> {
  const code = await readLatestOtpCode(destination);
  const dialog = page.locator(MODAL);
  await dialog.locator('[data-rl-form="2"] input[name="code"]').fill(code);
  await dialog.locator('[data-rl-form="2"] [data-rl-submit]').click();
}

/**
 * Step 3 (unknown-contact registration): fills ward (only if the field is
 * editable — a prefilled/read-only ward, e.g. from a ward page's
 * "Register for updates" slot, is left alone) + language, then submits.
 */
export async function completeRegistration(
  page: Page,
  opts: { wardId?: number; language?: 'en' | 'kn' } = {},
): Promise<void> {
  const dialog = page.locator(MODAL);
  await dialog.locator('[data-rl-form="3"]').waitFor({ state: 'visible' });

  const wardEditable = dialog.locator('[data-rl-ward-editable]');
  if (opts.wardId !== undefined && !(await wardEditable.isHidden())) {
    await dialog.locator('[data-rl-form="3"] input[name="wardId"]').fill(String(opts.wardId));
  }
  if (opts.language) {
    await dialog.locator('[data-rl-form="3"] select[name="language"]').selectOption(opts.language);
  }
  await dialog.locator('[data-rl-form="3"] [data-rl-submit]').click();
}

/**
 * Full flow for a brand-new contact, from an already-open modal (step 1)
 * through to a closed dialog (registration complete, session cookie set):
 * contact -> OTP -> ward/language -> submit. `wardId` is the citizen's home
 * ward (required unless the modal was opened with a prefilled ward, e.g.
 * a ward page's register-for-updates slot).
 */
export async function registerNewUser(
  page: Page,
  opts: { destination: string; wardId?: number; language?: 'en' | 'kn' },
): Promise<void> {
  await submitContact(page, opts.destination);
  await submitOtpCode(page, opts.destination);
  await completeRegistration(page, { wardId: opts.wardId, language: opts.language });
  await page.locator(MODAL).waitFor({ state: 'hidden' });
}

/**
 * Full flow for an ALREADY-REGISTERED contact (e.g. the seeded curator),
 * from an already-open modal through to a closed dialog: contact -> OTP.
 * No step 3 — a known contact's OTP verify resolves straight to login.
 */
export async function loginExistingUser(page: Page, destination: string): Promise<void> {
  await submitContact(page, destination);
  await submitOtpCode(page, destination);
  await page.locator(MODAL).waitFor({ state: 'hidden' });
}

/** Clicks the AppBar's "Sign in" control (`[data-me-slot]`), which opens this modal at step 1 with no prefill and no resumed action. */
export async function openSignIn(page: Page): Promise<void> {
  await page.locator('[data-me-slot]').click();
  await page.locator(MODAL).waitFor({ state: 'visible' });
}
