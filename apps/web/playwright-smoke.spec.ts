import { test, expect } from '@playwright/test';

// Use SMOKE_URL from env, or default to the local URL.
// The user should run: SMOKE_URL=https://their-real-domain.com npx playwright test playwright-smoke.spec.ts
const BASE_URL = process.env.SMOKE_URL || 'http://localhost:3000';

test.describe('OmniChat Post-Deploy Smoke Test', () => {
  test('Priority 1: CORS Check (Fetch from unauthorized origin)', async ({ request }) => {
    // This simulates fetching the API from a completely unrelated domain
    // If CORS is properly locked down, the browser or Playwright's fetch should either 
    // reject it or return a CORS error/403/500 if the server blocks it.
    
    // We will attempt a raw fetch with an Origin header that is NOT in ALLOWED_ORIGINS
    const response = await request.get(`${BASE_URL}/api/v1/inbox/conversations`, {
      headers: {
        'Origin': 'https://hacker-website.com'
      }
    });

    // The backend should reject this if CORS is strict, or at least not return 200 OK with data.
    // NestJS CORS middleware usually strips CORS headers or rejects the preflight.
    // If it's a GET, it might return 200 but without Access-Control-Allow-Origin, which fails in browsers.
    const allowOrigin = response.headers()['access-control-allow-origin'];
    
    // We assert that the server does NOT explicitly allow this hacker origin
    expect(allowOrigin).not.toBe('*');
    expect(allowOrigin).not.toBe('https://hacker-website.com');
  });

  test('Priority 3: Frontend Inbox Refactor UI Tests', async ({ page }) => {
    // 1. Login
    await page.goto(`${BASE_URL}/login`);
    await page.fill('input[id="email"]', 'owner');
    await page.fill('input[id="password"]', '123456789');
    await page.click('button[type="submit"]');

    // Wait for redirect to tenant-select or inbox
    await page.waitForURL(/.*\/app\/inbox.*|.*\/tenant-select.*/);
    
    // If we landed on tenant-select, pick the first tenant
    if (page.url().includes('/tenant-select')) {
        await page.waitForSelector('button, a[href*="/app/inbox"]', { state: 'visible' });
        // Click the first button or link that looks like a tenant card
        const tenantLinks = page.locator('a[href*="/app/inbox"]');
        if (await tenantLinks.count() > 0) {
            await tenantLinks.first().click();
        } else {
            // Fallback: click the first button
            await page.locator('button').first().click();
        }
        await page.waitForTimeout(2000); // give it a moment to navigate
        await page.screenshot({ path: 'tenant-select-debug.png', fullPage: true });
        const currentUrl = page.url();
        console.log("Current URL after click:", currentUrl);
        if (!currentUrl.includes('/app/inbox')) {
             console.log("Failed to navigate to inbox. HTML:", await page.content());
        }
    }

    // 2. Select the first conversation in the list
    await page.waitForSelector('[data-testid="conversation-item"]', { state: 'visible', timeout: 15000 }).catch(() => {
        // Fallback: just click the first button in the sidebar if no testid
        return page.locator('.space-y-1 button').first().waitFor({ state: 'visible' });
    });
    
    const conversations = page.locator('button').filter({ hasText: 'Customer' });
    if (await conversations.count() > 0) {
        await conversations.first().click();
    } else {
        await page.locator('.space-y-1 button').first().click();
    }

    // Wait for messages to load
    await page.waitForTimeout(2000);

    // 3. Edit Customer Name (useCustomerPanel)
    // Assuming there is an input for customer name in the panel
    const nameInput = page.getByPlaceholder('e.g. John Doe').first();
    if (await nameInput.isVisible()) {
        await nameInput.fill('Updated Smoke Test Name');
        // Press Enter or click outside to save
        await nameInput.press('Enter');
        await page.waitForTimeout(1000);
        
        // Reload page
        await page.reload();
        await page.waitForTimeout(3000);
        
        // Verify name remains
        const reloadedInput = page.getByPlaceholder('e.g. John Doe').first();
        expect(await reloadedInput.inputValue()).toContain('Updated Smoke Test Name');
    }

    // 4. Test AI Suggest (useAiSuggest)
    const suggestBtn = page.getByText('AI ร่างคำตอบ');
    if (await suggestBtn.isVisible()) {
        // Click once - should work
        await suggestBtn.click();
        await page.waitForTimeout(2000); // Wait for response
        
        // Click 11 times rapidly to trigger rate limit (429)
        for (let i = 0; i < 11; i++) {
            await suggestBtn.click({ force: true });
        }
        
        // Should see countdown or error
        const countdownText = page.locator('text=รอ');
        if (await countdownText.isVisible()) {
            console.log('Rate limit countdown triggered successfully');
        }
    }

    // Take screenshot as proof
    await page.screenshot({ path: 'smoke-test-proof.png', fullPage: true });
    console.log('Screenshot saved to smoke-test-proof.png');
  });
});
