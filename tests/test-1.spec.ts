import { test, expect, Page } from '@playwright/test';


// -----------------------------
// Utility: Safe wait
// -----------------------------
async function safeWait(page: Page, ms: number) {
  try {
    await page.waitForTimeout(ms);
  } catch (_) {}
}


// -----------------------------
// Utility: Extract Table Data (with retry)
// -----------------------------
async function extractTableData(page: Page, targetIndices: string[]) {
  const maxRetries = 3;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`\n[extractTableData] Attempt ${attempt}/${maxRetries}`);

      const tableLocator = page.locator('#indicesTable');

      await tableLocator.waitFor({ state: 'visible', timeout: 15000 });
      await safeWait(page, 1500);

      const headers = await tableLocator.locator('thead th').allTextContents();
      const cleanedHeaders = headers.map(h => h.trim()).filter(Boolean);

      const rows = tableLocator.locator('tbody tr');
      const rowCount = await rows.count();
      console.log(`Found ${rowCount} rows.`);

      if (rowCount === 0) throw new Error("Table rows not loaded yet");

      const normalizedTargets = targetIndices.map(x => x.toUpperCase().trim());

      const result: Array<{ [key: string]: string }> = [];

      for (let i = 0; i < rowCount; i++) {
        const rowCells = rows.nth(i).locator('td');
        const cellCount = await rowCells.count();

        if (cellCount === 0) continue;

        const rowData: { [key: string]: string } = {};

        for (let j = 0; j < Math.min(cellCount, cleanedHeaders.length); j++) {
          const text = await rowCells.nth(j).innerText();
          rowData[cleanedHeaders[j]] = text.trim();
        }

        const rowName = rowData['Name']?.toUpperCase().trim() || '';

        if (normalizedTargets.includes(rowName)) {
          result.push(rowData);
        }
      }

      return result;
    } catch (err) {
      console.log(`extractTableData attempt ${attempt} failed. Retrying...`);
      await safeWait(page, 2000);

      if (attempt === maxRetries) {
        console.error("❌ All retries failed for extractTableData", err);
        return [];
      }
    }
  }

  return [];
}


// -----------------------------
// Test Configuration
// -----------------------------
test.describe.configure({ retries: 2 });

test('Fetch NSE + BSE indices data (stable version)', async ({ page }) => {

  console.log("\n====== Starting Indices Extraction ======\n");

  // -----------------------------
  // Load Page
  // -----------------------------
  await page.goto('https://www.moneycontrol.com/markets/indian-indices/', {
    waitUntil: 'domcontentloaded',
    timeout: 60000
  });

  await safeWait(page, 2500);


  // -----------------------------
  // Handle Modal (Safe)
  // -----------------------------
  const noThanksBtn = page.getByRole('button', { name: /no thanks/i });

  if (await noThanksBtn.isVisible()) {
    console.log("Modal appeared → Clicking No Thanks");
    await noThanksBtn.click().catch(() => {});
    await safeWait(page, 1500);
  } else {
    console.log("No modal detected.");
  }


  // -----------------------------
  // OPEN NSE TAB (Stable Selectors)
  // -----------------------------
  console.log("Switching to NSE tab...");

  // Navigate to NSE tab
  await page.getByRole('listitem').filter({ hasText: 'Live Markets NSE NSE BSE' }).getByRole('strong').click();
  await page.waitForTimeout(2000);
  await page.getByText('NSE').nth(5).click();
  await page.waitForTimeout(2000);


  // -----------------------------
  // Extract NSE Data
  // -----------------------------
  const targetNSE = [
    'NIFTY 50',
    'NIFTY BANK',
    'NIFTY MIDCAP 100',
    'NIFTY SMALLCAP 100',
    'NIFTY MICROCAP 250'
  ];

  const NSEdata = await extractTableData(page, targetNSE);
  console.log("\nNSE Data:", NSEdata);


  // -----------------------------
  // OPEN BSE TAB
  // -----------------------------
  console.log("Switching to BSE tab...");

  await page.getByRole('listitem').filter({ hasText: 'Live Markets NSE NSE BSE' }).getByRole('strong').click();
  await page.waitForTimeout(2000);
  await page.getByText('BSE').nth(3).click();
  await page.waitForTimeout(2000);


  // -----------------------------
  // Extract BSE Data
  // -----------------------------
  const targetBSE = [
    'SENSEX',
    'BSE MIDCAP',
    'BSE SMALLCAP'
  ];

  const BSEdata = await extractTableData(page, targetBSE);
  console.log("\nBSE Data:", BSEdata);


  // -----------------------------
  // Combined Output
  // -----------------------------
  const combined = [...NSEdata, ...BSEdata];

  console.log("\n===== FINAL COMBINED RESULT =====");
  console.log(JSON.stringify(combined, null, 2));
  console.log(`\nTotal Records Extracted: ${combined.length}`);
  console.log("\n====== Extraction Complete ======\n");

});
