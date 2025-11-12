import { test, expect } from '@playwright/test';

test('test', async ({ page }) => {
  console.log('Recording... --- IGNORE ---');
  await page.locator('#common_header').getByRole('link', { name: 'Commodities' }).click();
  await page.getByRole('listitem').filter({ hasText: 'Spot Rates' }).click();

  // await page.goto('https://www.moneycontrol.com/');
  // await page.getByRole('button', { name: 'No thanks' }).click();
  // await page.locator('#common_header').getByRole('link', { name: 'Markets', exact: true }).click();
  // await page.goto('https://www.moneycontrol.com/stocksmarketsindia/');
  // const page1Promise = page.waitForEvent('popup');
  // await page.locator('.viewmore > a:nth-child(3)').first().click();
  // const page1 = await page1Promise;
  // await page1.locator('div').filter({ hasText: 'Cash F&O MF SEBI FII SEBI FII' }).nth(1).click();
});