/**
 * Smoke spec 1/4 (Task 64, architecture.md §12): address/ward lookup ->
 * ward page.
 *
 * Uses the PINCODE path deliberately, not the address/geocode path — the
 * geocode path (src/lib/geocode.ts) needs a Google API key this environment
 * doesn't have, and the ward-lookup UI/API always degrades a geocode
 * failure to `{result:'use_pincode'}` anyway (PRD §5.1's own documented
 * hedge). The pincode used (999001) is a SYNTHETIC key from
 * data/pincode-wards.json (see that file's own "__note" — real Indian PIN
 * codes never start with 9) that maps to 3 REAL seeded wards, read here via
 * tests/e2e/support/fixtures.ts rather than hardcoded, so this spec can
 * never drift from that table.
 */
import { test, expect } from '@playwright/test';
import { lookupFixture } from './support/fixtures';

test('pincode lookup on Home resolves to a ward shortlist, and navigating reaches that ward page', async ({ page }) => {
  await page.goto('/');
  // WardLookup.ts (the island that intercepts this form's submit and calls
  // the API instead of a full page POST) ships as an external module
  // script — wait for it to actually finish loading/executing before
  // interacting, or a fast `fill`+`click` can race ahead of the listener
  // attaching and fall through to a real cross-site-checked form POST.
  await page.waitForLoadState('networkidle');

  await page.locator('[data-ward-lookup] input[name="query"]').fill(lookupFixture.pincode);
  await page.locator('[data-ward-lookup] button[type="submit"]').click();

  const result = page.locator('[data-ward-result]');
  await expect(result.locator('a')).toHaveCount(lookupFixture.wardIds.length);

  const hrefs = await result.locator('a').evaluateAll((links) => links.map((l) => (l as HTMLAnchorElement).pathname));
  for (const wardId of lookupFixture.wardIds) {
    expect(hrefs).toContain(`/ward/${wardId}`);
  }

  // Follow the first shortlisted ward and land on its real page.
  const firstWardId = lookupFixture.wardIds[0];
  await result.locator(`a[href="/ward/${firstWardId}"]`).click();
  await expect(page).toHaveURL(new RegExp(`/ward/${firstWardId}$`));
  await expect(page.locator('h1')).toBeVisible();
});

test('an out-of-coverage pincode resolves to the out-of-coverage message, not a ward', async ({ page }) => {
  await page.goto('/');
  await page.waitForLoadState('networkidle');

  // A real-shaped (non-9xxxxx) pincode with no entry in data/pincode-wards.json.
  await page.locator('[data-ward-lookup] input[name="query"]').fill('560001');
  await page.locator('[data-ward-lookup] button[type="submit"]').click();

  const result = page.locator('[data-ward-result]');
  await expect(result.locator('a')).toHaveCount(0);
  await expect(result).not.toBeEmpty();
});
