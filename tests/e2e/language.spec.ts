/**
 * Smoke spec 4/4 (Task 64, architecture.md §12): EN page -> language toggle
 * -> `/kn/` equivalence (same content STRUCTURE, `lang="kn"`, hreflang
 * alternates linking the two).
 *
 * Uses the seeded ward's hub page (`/ward/{id}`, src/features/pages/
 * Ward.astro) — a fixed, language-independent structure (1 <h1>, 2
 * <section>s, a 3-link <nav>) that this spec counts on BOTH sides rather
 * than comparing text (the Kannada side is a real translation, not the
 * same string).
 */
import { test, expect } from '@playwright/test';
import { seedFixtures } from './support/fixtures';

const wardId = seedFixtures.primaryWardId;

test('the language toggle navigates EN -> /kn/ with the same structure and correct lang/hreflang', async ({ page }) => {
  await page.goto(`/ward/${wardId}`);

  await expect(page).toHaveURL(new RegExp(`/ward/${wardId}$`));
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');

  await expect(page.locator('link[rel="alternate"][hreflang="en"]')).toHaveAttribute(
    'href',
    new RegExp(`/ward/${wardId}$`),
  );
  await expect(page.locator('link[rel="alternate"][hreflang="kn"]')).toHaveAttribute(
    'href',
    new RegExp(`/kn/ward/${wardId}$`),
  );
  await expect(page.locator('link[rel="alternate"][hreflang="x-default"]')).toHaveCount(1);

  const enH1Count = await page.locator('h1').count();
  const enSectionCount = await page.locator('section').count();
  const enNavLinkCount = await page.locator('nav.ward-links a').count();

  // The AppBar's language toggle: the OTHER language always renders as the
  // link (the current one is a non-interactive styled segment) —
  // src/components/AppBar.astro.
  await page.locator('.lang-toggle a.segment').click();

  await expect(page).toHaveURL(new RegExp(`/kn/ward/${wardId}$`));
  await expect(page.locator('html')).toHaveAttribute('lang', 'kn');

  await expect(page.locator('link[rel="alternate"][hreflang="en"]')).toHaveAttribute(
    'href',
    new RegExp(`/ward/${wardId}$`),
  );
  await expect(page.locator('link[rel="alternate"][hreflang="kn"]')).toHaveAttribute(
    'href',
    new RegExp(`/kn/ward/${wardId}$`),
  );

  // Same content STRUCTURE — not the same text (design intentionally
  // ensures the Kannada page is a real translation, not an EN copy).
  await expect(page.locator('h1')).toHaveCount(enH1Count);
  await expect(page.locator('section')).toHaveCount(enSectionCount);
  await expect(page.locator('nav.ward-links a')).toHaveCount(enNavLinkCount);

  // And the Kannada page really is translated, not the English text reused verbatim.
  const knHeading = await page.locator('h1').first().innerText();
  await page.goto(`/ward/${wardId}`);
  const enHeading = await page.locator('h1').first().innerText();
  expect(knHeading).not.toBe(enHeading);
});
