import { test, expect, Page } from '@playwright/test';

// NSE BSE INDICES DATA WITH STRAPI INTEGRATION

// -----------------------------
// Security Configuration
// -----------------------------
// ⚠️ NEVER hardcode API tokens in production code
// Set STRAPI_API_TOKEN in your environment variables:
// Windows: set STRAPI_API_TOKEN=your-token
// Linux/Mac: export STRAPI_API_TOKEN=your-token
const STRAPI_API_URL = 'https://admin.equivision.in/api/postmarkets/d99w2c4wm9yj00rwdi58ebye';
const EQUID_API_TOKEN = process.env.STRAPI_API_TOKEN || '';
// -----------------------------
// Utility: Safe wait
// -----------------------------
async function safeWait(page: Page, ms: number) {
  try {
    await page.waitForTimeout(ms);
  } catch (_) { }
}

// -----------------------------
// Utility: Convert string to number
// -----------------------------
function convertToNumber(value: string): number {
  if (!value) return 0;
  // Remove commas and whitespace, then parse
  const cleaned = value.toString().replace(/,/g, '').trim();
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

// -----------------------------
// Utility: Map Extracted Data to Strapi Format
// -----------------------------
function mapToStrapiFormat(extractedData: Array<{ [key: string]: string }>): { [key: string]: any } {
  const result: { [key: string]: any } = {};

  for (const item of extractedData) {
    const name = item['Name']?.toUpperCase().trim() || '';
    const ltp = convertToNumber(item['LTP']);
    const changePercent = convertToNumber(item['%Chg']);

    console.log(`  Mapping: ${name} -> LTP: ${ltp}, Change: ${changePercent}%`);

    // Map index names to Strapi field names
    switch (name) {
      case 'NIFTY 50':
        result.Nifty_50_Current = ltp;
        result.Nifty_50_Change = changePercent;
        break;
      case 'NIFTY BANK':
        result.Bank_Nifty_Current = ltp;
        result.Bank_Nifty_Change = changePercent;
        break;
      case 'NIFTY MIDCAP 100':
        result.Nifty_Midcap_100_Current = ltp;
        result.Nifty_Midcap_100_Change = changePercent;
        break;
      case 'NIFTY SMALLCAP 100':
        result.Nifty_Smallcap_100_Current = ltp;
        result.Nifty_Smallcap_100_Change = changePercent;
        break;
      case 'NIFTY MICROCAP 250':
        result.Nifty_Microcap_250_Current = ltp;
        result.Nifty_Microcap_250_Change = changePercent;
        break;
      case 'SENSEX':
        result.BSE_Sensex_Current = ltp;
        result.BSE_Sensex_Change = changePercent;
        break;
      case 'BSE MIDCAP':
        result.BSE_Midcap_Current = ltp;
        result.BSE_Midcap_Change = changePercent;
        break;
      case 'BSE SMALLCAP':
        result.BSE_Smallcap_Current = ltp;
        result.BSE_Smallcap_Change = changePercent;
        break;
      default:
        console.warn(`  ⚠️ Unknown index name: ${name}`);
    }
  }

  // Set current date in YYYY-MM-DD format
  // const today = new Date();
  // Note: This uses local system timezone. For IST (UTC+5:30), consider using a library like date-fns-tz
  // result.Postmarket_Date = today.toISOString().split('T')[0];

  return result;
}

// -----------------------------
// Utility: Post Data to Strapi
// -----------------------------
async function postToStrapi(data: { [key: string]: any }, apiToken: string): Promise<any> {
  try {
    console.log('\n📤 Posting data to Strapi...');
    console.log('  URL:', STRAPI_API_URL);

    const payload = { data };

    console.log('  Payload preview:', JSON.stringify(payload, null, 2).substring(0, 500) + '...');

    const response = await fetch(STRAPI_API_URL, {
      method: 'PUT', // Using PUT to update existing record
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${EQUID_API_TOKEN}`,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status} ${response.statusText}: ${errorText}`);
    }

    const result = await response.json();
    console.log('  ✅ Strapi update successful!');
    return result;
  } catch (error) {
    console.error('  ❌ Strapi update failed:', error);
    throw error;
  }
}

// -----------------------------
// Utility: Extract Table Data (with retry)
// -----------------------------
async function extractTableData(page: Page, targetIndices: string[]) {
  const maxRetries = 3;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`[extractTableData] Attempt ${attempt}/${maxRetries}`);

      const tableLocator = page.locator('#indicesTable');

      await tableLocator.waitFor({ state: 'visible', timeout: 15000 });
      await safeWait(page, 1500);

      const headers = await tableLocator.locator('thead th').allTextContents();
      const cleanedHeaders = headers.map(h => h.trim()).filter(Boolean);

      const rows = tableLocator.locator('tbody tr');
      const rowCount = await rows.count();
      console.log(`  Found ${rowCount} rows.`);

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
      console.log(`  extractTableData attempt ${attempt} failed. Retrying...`);
      await safeWait(page, 2000);

      if (attempt === maxRetries) {
        console.error("  ❌ All retries failed for extractTableData", err);
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

test('Fetch NSE + BSE indices data and post to Strapi', async ({ page }) => {
  console.log("\n====== Starting Indices Extraction & Strapi Post ======\n");

  // -----------------------------

  // Load NSE Page
  // -----------------------------

  console.log("Step 1: Loading NSE data...");
  await page.goto('https://www.moneycontrol.com/markets/indian-indices/live-markets?ex=N', {
    waitUntil: 'domcontentloaded',
    timeout: 60000
  });
  await safeWait(page, 2500);

  // Handle Modal
  const noThanksBtn = page.getByRole('button', { name: /no thanks/i });
  if (await noThanksBtn.isVisible()) {
    console.log("  Modal detected → Clicking No Thanks");
    await noThanksBtn.click().catch(() => { });
    await safeWait(page, 1500);
  } else {
    console.log("No modal detected.");
  }

  // Extract NSE Data
  const targetNSE = [
    'NIFTY 50',
    'NIFTY BANK',
    'NIFTY MIDCAP 100',
    'NIFTY SMALLCAP 100',
    'NIFTY MICROCAP 250'
  ];
  const NSEdata = await extractTableData(page, targetNSE);
  console.log("  NSE extracted:", NSEdata.length, "records");


  // -----------------------------

  // Load BSE Page
  // -----------------------------

  console.log("\nStep 2: Loading BSE data...");
  await page.goto('https://www.moneycontrol.com/markets/indian-indices/live-markets?ex=B', {
    waitUntil: 'domcontentloaded',
    timeout: 60000
  });
  await safeWait(page, 2500);

  // Handle Modal
  const noThanksBtnsecond = page.getByRole('button', { name: /no thanks/i });
  if (await noThanksBtnsecond.isVisible()) {
    console.log("  Modal detected → Clicking No Thanks");
    await noThanksBtnsecond.click().catch(() => { });
    await safeWait(page, 1500);
  }

  // Extract BSE Data
  const targetBSE = [
    'SENSEX',
    'BSE MIDCAP',
    'BSE SMALLCAP'
  ];
  const BSEdata = await extractTableData(page, targetBSE);
  console.log("  BSE extracted:", BSEdata.length, "records");


  // -----------------------------

  // Process and Post Data
  // -----------------------------

  const combined = [...NSEdata, ...BSEdata];
  console.log("\nStep 3: Combined data:", combined.length, "records");

  console.log("\n----- FINAL EXTRACTED DATA -----");
  console.log(JSON.stringify(combined, null, 2));
  console.log(`\nTotal Records: ${combined.length}`);
  console.log("--------------------------------\n");

  // Map to Strapi format
  console.log("Step 4: Mapping to Strapi format...");
  const strapiData = mapToStrapiFormat(combined);

  console.log("\n----- STRAPI FORMATTED DATA -----");
  console.log(JSON.stringify(strapiData, null, 2));
  console.log("---------------------------------\n");

  // Post to Strapi
  console.log("Step 5: Posting to Strapi...");
  
  // Validate API token
  if (!EQUID_API_TOKEN || EQUID_API_TOKEN === 'your-api-token-here') {
    console.error("  ❌ CRITICAL: Strapi API token not configured!");
    console.error("     Set STRAPI_API_TOKEN environment variable");
    console.log("\n====== Test Completed (Strapi post skipped) ======\n");
    return; // Skip posting but don't fail the test
  }

  try {
    await postToStrapi(strapiData, EQUID_API_TOKEN);
    console.log("  ✅ Strapi post completed successfully");
  } catch (error) {
    console.error("  ❌ Strapi post failed:", error.message);
    // Uncomment to fail the test on Strapi errors
    // throw error;
  }

  console.log("\n====== Extraction & Post Complete ======\n");
});