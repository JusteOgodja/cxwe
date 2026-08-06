import { test, expect, type ConsoleMessage, type Response } from '@playwright/test';

/**
 * Public, READ-ONLY end-to-end checks. Safe to run against a Deploy Preview
 * (which shares the production Supabase): no form is submitted here, only reads.
 * Verifies rendering, no console errors, and no unexpected 4xx/5xx responses.
 */

// Collect console errors + failed responses for assertions.
function trackErrors(page: import('@playwright/test').Page) {
  const consoleErrors: string[] = [];
  const badResponses: string[] = [];
  page.on('console', (m: ConsoleMessage) => {
    if (m.type() === 'error') consoleErrors.push(m.text());
  });
  page.on('response', (r: Response) => {
    const s = r.status();
    // Ignore expected 401/403 from is_admin RPC for anon and analytics beacons.
    if (s >= 400 && !/is_admin|\/auth\/v1|favicon/.test(r.url())) {
      badResponses.push(`${s} ${r.url()}`);
    }
  });
  return { consoleErrors, badResponses };
}

test('home page renders with hero, stats and categories', async ({ page }) => {
  const { consoleErrors, badResponses } = trackErrors(page);
  await page.goto('/', { waitUntil: 'networkidle' });
  await expect(page).toHaveTitle(/Morocco Food Export|Catalogue/i);
  // Hero CTA
  await expect(page.getByRole('link', { name: /Catalogue|Proforma|devis/i }).first()).toBeVisible();
  // Category grid rendered (at least a few category links)
  await expect(page.locator('a[href^="/catalog/"], a[href^="/product/"]').first()).toBeVisible({ timeout: 10000 });
  expect(consoleErrors, `console errors: ${consoleErrors.join(' | ')}`).toHaveLength(0);
  expect(badResponses, `bad responses: ${badResponses.join(' | ')}`).toHaveLength(0);
});

test('catalog page lists categories and brands', async ({ page }) => {
  const { consoleErrors, badResponses } = trackErrors(page);
  await page.goto('/catalog', { waitUntil: 'networkidle' });
  await expect(page.getByText(/Catalogue|catégories/i).first()).toBeVisible();
  await expect(page.locator('a[href^="/catalog/"]').first()).toBeVisible({ timeout: 10000 });
  expect(consoleErrors, consoleErrors.join(' | ')).toHaveLength(0);
  expect(badResponses, badResponses.join(' | ')).toHaveLength(0);
});

test('protected category route redirects anonymous users to login', async ({ page }) => {
  // Category/product pages are behind ProtectedRoute — anonymous must be gated.
  await page.goto('/catalog', { waitUntil: 'networkidle' });
  const firstCat = page.locator('a[href^="/catalog/"]').first();
  await firstCat.click();
  await page.waitForLoadState('networkidle');
  // Either we are on a login page or a login control is shown.
  const url = page.url();
  const gated = /\/login/.test(url) || (await page.getByRole('button', { name: /connexion|login|se connecter/i }).count()) > 0
    || (await page.getByText(/mot de passe|password|connexion/i).count()) > 0;
  expect(gated, `expected auth gate after clicking a category, url=${url}`).toBeTruthy();
});

test('partner (collaboration) page renders a functional form (no submit)', async ({ page }) => {
  const { consoleErrors } = trackErrors(page);
  await page.goto('/partner', { waitUntil: 'networkidle' });
  await expect(page.getByText(/Réseau Export|Collaborer|partenariat|Rejoignez/i).first()).toBeVisible();
  // Form inputs present (we DO NOT submit — a submit would write to Supabase).
  const inputs = page.locator('form input, form textarea');
  await expect(inputs.first()).toBeVisible({ timeout: 10000 });
  expect(await inputs.count()).toBeGreaterThan(1);
  expect(consoleErrors, consoleErrors.join(' | ')).toHaveLength(0);
});

test('no horizontal overflow on mobile home', async ({ page }) => {
  await page.goto('/', { waitUntil: 'networkidle' });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow, `horizontal overflow of ${overflow}px`).toBeLessThanOrEqual(2);
});
