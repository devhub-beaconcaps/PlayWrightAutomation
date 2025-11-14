import { test, expect, Page, BrowserContext } from '@playwright/test';

// Configuration
const CONFIG = {
  testTimeout: 120000,
  navigationTimeout: 60000,
  tableWaitTimeout: 20000,
  networkIdleTimeout: 5000,
  postClickDelay: 3000,
  targetRowCount: 5,
  maxRetries: 3,
} as const;

interface TableRow {
  [key: string]: string;
}

// Strapi API Configuration
const STRAPI_API_URL = 'https://admin.equivision.in/api/postmarkets/d99w2c4wm9yj00rwdi58ebye';
const EQUID_API_TOKEN = process.env.STRAPI_API_TOKEN || '';

/**
 * Robust table extraction with multiple fallback strategies
 */
async function extractTableData(
  page: Page,
  label: string = 'data'
): Promise<TableRow[]> {
  console.log(`\n🔍 Extracting ${label}...`);

  try {
    // Wait for table with multiple strategies
    await page.waitForSelector('#liveSMEkTable', { 
      state: 'visible', 
      timeout: CONFIG.tableWaitTimeout 
    }).catch(() => {
      console.log('   ⚠ Table not found via selector, trying locator...');
    });

    const table = page.locator('#liveSMEkTable');
    await table.waitFor({ state: 'visible', timeout: CONFIG.tableWaitTimeout });

    // Screenshot for debugging
    await page.screenshot({
      path: `test-results/${label}-${Date.now()}.png`,
      fullPage: true
    });

    const result = await page.evaluate(() => {
      const table = document.querySelector('#liveSMEkTable') as HTMLTableElement;
      if (!table) throw new Error('Table not found in DOM');

      const headers = Array.from(table.querySelectorAll('thead th'))
        .map(th => th.textContent?.trim() || '')
        .filter(text => text.length > 0)
        .slice(0, 30);

      const rows = table.querySelectorAll('tbody tr');
      const data: TableRow[] = [];

      for (let i = 0; i < Math.min(rows.length, 20); i++) {
        const cells = rows[i].querySelectorAll('td');
        if (cells.length < 3) continue;

        const rowData: TableRow = {};
        headers.forEach((header, idx) => {
          rowData[header] = cells[idx]?.textContent?.trim() || '';
        });

        if (rowData['Symbol']?.trim()) {
          data.push(rowData);
        }
      }

      return {
        headers,
        data,
        totalRows: rows.length,
        extracted: data.length
      };
    });

    console.log(`   ✓ ${result.extracted}/${result.totalRows} rows extracted`);
    return result.data;

  } catch (error) {
    console.error(`   ✗ Extraction failed: ${error.message}`);
    return [];
  }
}

/**
 * Parse numeric values from table strings
 */
function parseNumericValue(value: string): number {
  if (!value || value === '-') return 0;
  const cleaned = value.replace(/[%\s,]/g, '');
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

/**
 * Build dynamic payload
 */
function buildStrapiPayload(gainers: TableRow[], losers: TableRow[]) {
  const payload: { data: { [key: string]: string | number } } = { data: {} };
  
  // Process gainers
  for (let i = 0; i < Math.min(gainers.length, CONFIG.targetRowCount); i++) {
    const gainer = gainers[i];
    const num = i + 1;
    payload.data[`Gainer_${num}_Stock_Name`] = gainer['Symbol'] || 'N/A';
    payload.data[`Gainer_${num}_LTP`] = parseNumericValue(gainer['LTP']);
    payload.data[`Gainer_${num}_Change`] = parseNumericValue(gainer['%Chng']);
  }
  
  // Process losers
  for (let i = 0; i < Math.min(losers.length, CONFIG.targetRowCount); i++) {
    const loser = losers[i];
    const num = i + 1;
    payload.data[`Loser_${num}_Stock_Name`] = loser['Symbol'] || 'N/A';
    payload.data[`Loser_${num}_LTP`] = parseNumericValue(loser['LTP']);
    payload.data[`Loser_${num}_Change`] = parseNumericValue(loser['%Chng']);
  }
  
  return payload;
}

/**
 * Save to Strapi with retry logic
 */
async function saveToStrappi(payload: any, attempt = 1) {
  try {
    console.log(`\n☁️  Sending data to Strapi (attempt ${attempt})...`);
    
    const response = await fetch(STRAPI_API_URL, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${EQUID_API_TOKEN}`
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    const result = await response.json();
    console.log('   ✓ Strapi update successful!');
    return result;

  } catch (error) {
    console.error('   ✗ Strapi update failed:', error.message);
    if (attempt < 3) {
      console.log(`   Retrying in ${attempt * 2} seconds...`);
      await new Promise(r => setTimeout(r, attempt * 2000));
      return saveToStrappi(payload, attempt + 1);
    }
    throw error;
  }
}

/**
 * Main test logic with manual retry for clean context
 */
async function runTestWithRetry(context: BrowserContext, attempt: number): Promise<void> {
  const page = await context.newPage();
  
  try {
    console.log(`\n🔄 Attempt ${attempt}/${CONFIG.maxRetries + 1}`);
    
    // ✅ Apply stealth scripts
    await context.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', { 
        get: () => undefined, 
        configurable: true 
      });
      
      Object.defineProperty(navigator, 'plugins', { 
        get: () => [1, 2, 3, 4, 5], 
        configurable: true 
      });
      
      Object.defineProperty(navigator, 'permissions', { 
        get: () => ({ query: () => Promise.resolve({ state: 'granted' }) }), 
        configurable: true 
      });
      
      (window as any).chrome = {
        runtime: {},
        loadTimes: () => ({}),
        csi: () => ({})
      };
    });

    await page.setViewportSize({ width: 1920, height: 1080 });

    console.log('\n' + '='.repeat(80));
    console.log('   NSE SME Market Data Extraction & Strapi Sync');
    console.log('='.repeat(80));

    // Step 1: Navigate (✅ FIXED URL - NO TRAILING SPACE)
    console.log('\n📍 Step 1: Navigate to page');
    await page.goto('https://www.nseindia.com/market-data/sme-market', {
      waitUntil: 'networkidle',
      timeout: CONFIG.navigationTimeout
    }).catch(async (error) => {
      console.log('   ⚠ Navigation failed, waiting and retrying...');
      await page.waitForTimeout(5000);
      await page.reload({ waitUntil: 'networkidle' });
    });

    // Validate page loaded
    const pageTitle = await page.title();
    if (!pageTitle || pageTitle.includes('Access Denied')) {
      throw new Error('Page blocked or not loaded correctly');
    }
    
    console.log(`   ✓ Page loaded: ${pageTitle}`);

    // Wait for anti-bot challenges
    await page.waitForTimeout(CONFIG.networkIdleTimeout);

    // Step 2: Handle modal
    console.log('\n🗳️ Step 2: Handle consent modal');
    try {
      const modalButton = page.getByRole('button', { name: /No thanks/i });
      await modalButton.waitFor({ state: 'visible', timeout: 5000 });
      await modalButton.click();
      console.log('   ✓ Modal dismissed');
    } catch {
      console.log('   ℹ No modal present or already dismissed');
    }

    // Step 3: Extract Top Gainers
    console.log('\n📈 Step 3: Extract Top Gainers');
    const gainersData = await extractTableData(page, 'gainers');
    const topGainers = gainersData.slice(0, CONFIG.targetRowCount);

    console.log('\n   Final Top Gainers:');
    console.log('   ' + JSON.stringify(topGainers, null, 2).replace(/\n/g, '\n   '));

    // Step 4: Sort for Losers
    console.log('\n📊 Step 4: Sort table (ascending)');
    const sortHeader = page.locator('th').filter({ hasText: /%\s*chng/i }).first();

    await sortHeader.waitFor({ state: 'visible', timeout: CONFIG.tableWaitTimeout });
    await sortHeader.scrollIntoViewIfNeeded();

    await sortHeader.click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(CONFIG.postClickDelay);

    console.log('   ✓ Table sorted');

    // Step 5: Extract Top Losers
    console.log('\n📉 Step 5: Extract Top Losers');
    const losersData = await extractTableData(page, 'losers');
    const topLosers = losersData.slice(0, CONFIG.targetRowCount);

    console.log('\n   Final Top Losers:');
    console.log('   ' + JSON.stringify(topLosers, null, 2).replace(/\n/g, '\n   '));

    // Step 6-8: Build payload and save
    console.log('\n☁️ Step 6: Build dynamic Strapi payload');
    const dynamicPayload = buildStrapiPayload(topGainers, topLosers);

    console.log('\n   Generated payload keys:', Object.keys(dynamicPayload.data).length);

    console.log('\n💾 Step 7: Save to Strapi');
    await saveToStrappi(dynamicPayload);

    console.log('\n✅ Step 8: Validate results');
    expect(topGainers.length + topLosers.length).toBeGreaterThan(0);

    console.log('\n🎉 Test completed successfully!');
    console.log(`   Extracted: ${topGainers.length} gainers, ${topLosers.length} losers`);

    await page.close();
  } catch (error) {
    await page.close();
    throw error;
  }
}

// Main test with manual retry logic
test('SME Market - Top 5 Gainers and Losers', async ({ browser }) => {
  test.setTimeout(CONFIG.testTimeout);
  
  let lastError: Error;
  
  for (let attempt = 1; attempt <= CONFIG.maxRetries + 1; attempt++) {
    const context = await browser.newContext({
      // Each retry gets fresh context
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      viewport: { width: 1920, height: 1080 },
      ignoreHTTPSErrors: true,
    });
    
    try {
      await runTestWithRetry(context, attempt);
      await context.close();
      return; // Success
    } catch (error) {
      lastError = error as Error;
      console.error(`\n❌ Attempt ${attempt} failed: ${lastError.message}`);
      await context.close();
      
      if (attempt <= CONFIG.maxRetries) {
        const waitTime = attempt * 5000;
        console.log(`   Waiting ${waitTime/1000} seconds before retry...`);
        await new Promise(r => setTimeout(r, waitTime));
      }
    }
  }
  
  throw lastError!;
});