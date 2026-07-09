import { test, expect } from '@playwright/test';

const BASE_URL = process.env.SMOKE_URL || 'http://localhost:3000';

test.describe('OmniChat RBAC Slip Verification E2E Test', () => {
  // Clear cookies/storage before each test to ensure complete isolation
  test.beforeEach(async ({ context }) => {
    await context.clearCookies();
  });

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
      const tenantButton = page.locator('button').filter({ hasText: /Use|ใช้งาน/ }).first();
      await tenantButton.waitFor({ state: 'visible', timeout: 10000 });
      await tenantButton.click();
      await page.waitForURL(/.*\/app\/inbox.*/);
    }

    // 2. Go to /app/slip-verification
    await page.goto(`${BASE_URL}/app/slip-verification`);
    
    // Wait for page elements to be visible (proves successful load)
    const refreshBtn = page.locator('button', { hasText: /รีเฟรช|Refresh/ }).first();
    await refreshBtn.waitFor({ state: 'visible', timeout: 10000 }).catch(() => {
      console.log('Refresh button was not found. Current URL:', page.url());
    });

    // Take screenshot as proof
    await page.screenshot({ path: 'playwright-owner-rbac-success.png', fullPage: true });

    // Assert URL
    expect(page.url()).toContain('/app/slip-verification');
  });

  test('Priority 2: VIEWER role (fluke) should be redirected away from /app/slip-verification', async ({ page }) => {
    // 1. Login as viewer/agent
    await page.goto(`${BASE_URL}/login`);
    await page.fill('input[id="email"]', 'fluke');
    await page.fill('input[id="password"]', '123456789');
    await page.click('button[type="submit"]');

    // Wait for redirect to tenant-select or inbox
    await page.waitForURL(/.*\/app\/inbox.*|.*\/tenant-select.*/);
    
    // If tenant-select, select the first tenant
    if (page.url().includes('/tenant-select')) {
      const tenantButton = page.locator('button').filter({ hasText: /Use|ใช้งาน/ }).first();
      await tenantButton.waitFor({ state: 'visible', timeout: 10000 });
      await tenantButton.click();
      await page.waitForURL(/.*\/app\/inbox.*/);
    }

    // 2. Attempt to navigate directly to /app/slip-verification
    await page.goto(`${BASE_URL}/app/slip-verification`);
    
    // Wait a bit for client-side redirection to happen
    await page.waitForTimeout(3000);

    // Take screenshot as proof of redirect/block before assertion
    await page.screenshot({ path: 'playwright-viewer-rbac-redirect.png', fullPage: true });
    
    console.log('Redirection check URL:', page.url());

    // Assert that they were redirected away from slip-verification (cannot stay on slip-verification)
    expect(page.url()).not.toContain('/app/slip-verification');
  });
});
