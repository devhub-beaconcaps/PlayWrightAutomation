import { test } from '@playwright/test';

test('check stealth', async ({ page }) => {
  await page.goto('https://bot.sannysoft.com');
  await page.waitForTimeout(5000); // Wait longer for all checks
  await page.screenshot({ path: 'test-results/stealth-check.png', fullPage: true });
});