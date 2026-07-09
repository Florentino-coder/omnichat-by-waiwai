import { test, expect } from '@playwright/test';

const BASE_URL = process.env.SMOKE_URL || 'http://localhost:3000';

test.describe('OmniChat RBAC Slip Verification E2E Test', () => {
  test('Priority 1: OWNER role should access /app/slip-verification successfully', async ({ page }) => {
    // 1. Login as owner
    await page.goto(`${BASE_URL}/login`);
    await page.fill('input[id="email"]', 'owner');
    await page.fill('input[id="password"]', '123456789');
    await page.click('button[type="submit"]');

    // Wait for redirect to tenant-select or inbox
    await page.waitForURL(/.*\/app\/inbox.*|.*\/tenant-select.*/);
    
    // If tenant-select, select the first tenant
    if (page.url().includes('/tenant-select')) {
      const tenantLinks = page.locator('a[href*="/app/inbox"]');
      if (await tenantLinks.count() > 0) {
        await tenantLinks.first().click();
      } else {
        await page.locator('button').first().click();
      }
      await page.waitForURL(/.*\/app\/inbox.*/);
    }

    // 2. Go to /app/slip-verification
    await page.goto(`${BASE_URL}/app/slip-verification`);
    await page.waitForTimeout(2000);

    // Assert that we are still on /app/slip-verification (no redirect)
    expect(page.url()).toContain('/app/slip-verification');
    
    // Take screenshot as proof
    await page.screenshot({ path: 'playwright-owner-rbac-success.png', fullPage: true });
    console.log('Owner successfully accessed slip-verification page.');
  });

  test('Priority 2: AGENT/VIEWER role should be redirected to /app/inbox when accessing /app/slip-verification', async ({ page }) => {
    // 1. Login as viewer/agent
    await page.goto(`${BASE_URL}/login`);
    await page.fill('input[id="email"]', 'fluke');
    await page.fill('input[id="password"]', '123456789');
    await page.click('button[type="submit"]');

    // Wait for redirect to tenant-select or inbox
    await page.waitForURL(/.*\/app\/inbox.*|.*\/tenant-select.*/);
    
    // If tenant-select, select the first tenant
    if (page.url().includes('/tenant-select')) {
      const tenantLinks = page.locator('a[href*="/app/inbox"]');
      if (await tenantLinks.count() > 0) {
        await tenantLinks.first().click();
      } else {
        await page.locator('button').first().click();
      }
      await page.waitForURL(/.*\/app\/inbox.*/);
    }

    // 2. Attempt to navigate directly to /app/slip-verification
    await page.goto(`${BASE_URL}/app/slip-verification`);
    await page.waitForTimeout(2000);

    // Assert that we were redirected back to /app/inbox
    expect(page.url()).toContain('/app/inbox');
    expect(page.url()).not.toContain('/app/slip-verification');
    
    // Take screenshot as proof of redirection
    await page.screenshot({ path: 'playwright-viewer-rbac-redirect.png', fullPage: true });
    console.log('Viewer/Agent was correctly redirected back to inbox.');
  });
});
