import { test, expect, Page } from '@playwright/test';

// Configuration
const CONFIG = {
  testTimeout: 120000,
  navigationTimeout: 60000,
  tableWaitTimeout: 20000,
  networkIdleTimeout: 5000,
  postClickDelay: 3000,
  targetRowCount: 5,
} as const;

interface TableRow {
  [key: string]: string;
}

// Strapi API Configuration
const STRAPI_API_URL = 'https://admin.equivision.in/api/postmarkets/d99w2c4wm9yj00rwdi58ebye';
const EQUID_API_TOKEN = 'd6391becdaf54eb9a3352f3e4d0cc56772f1e178f3fd6702482edb419d172113acd018c5d1a5e5899fcd5bcd40e6ffbb8e79f3c7871a1e72b27dbaec953f063dadd3c95c6c0ca767079516ac7f122e2a5aadcf9c9caa067898349e0dfc9c7b49c95082ef5185ed7e5411cf81e38174534d941ce77d99910bd6aecc2d0687f9ab';

/**
 * Robust table extraction using page.evaluate for maximum reliability
 */
async function extractTableData(
  page: Page,
  label: string = 'data'
): Promise<TableRow[]> {
  console.log(`\n🔍 Extracting ${label}...`);

  try {
    const table = page.locator('#liveSMEkTable');
    await table.waitFor({
      state: 'visible',
      timeout: CONFIG.tableWaitTimeout
    });

    // Screenshot for debugging
    await page.screenshot({
      path: `test-results/${label}-${Date.now()}.png`,
      fullPage: true
    });

    const result = await page.evaluate(() => {
      const table = document.querySelector('#liveSMEkTable') as HTMLTableElement;
      if (!table) throw new Error('Table not found');

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
 * Helper to parse numeric values from table strings
 */
function parseNumericValue(value: string): number {
  if (!value) return 0;
  const cleaned = value.replace(/[%\s,]/g, ''); // Remove %, commas, spaces
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

/**
 * Builds dynamic payload from extracted gainers/losers
 */
function buildStrapiPayload(gainers: TableRow[], losers: TableRow[]) {
  const payload: { data: { [key: string]: string | number } } = { data: {} };
  
  // Process gainers
  for (let i = 0; i < Math.min(gainers.length, CONFIG.targetRowCount); i++) {
    const gainer = gainers[i];
    const num = i + 1;
    
    payload.data[`Gainer_${num}_Stock_Name`] = gainer['Symbol'] || '';
    payload.data[`Gainer_${num}_LTP`] = parseNumericValue(gainer['LTP']);
    payload.data[`Gainer_${num}_Change`] = parseNumericValue(gainer['%Chng']);
  }
  
  // Process losers
  for (let i = 0; i < Math.min(losers.length, CONFIG.targetRowCount); i++) {
    const loser = losers[i];
    const num = i + 1;
    
    payload.data[`Loser_${num}_Stock_Name`] = loser['Symbol'] || '';
    payload.data[`Loser_${num}_LTP`] = parseNumericValue(loser['LTP']);
    payload.data[`Loser_${num}_Change`] = parseNumericValue(loser['%Chng']);
  }
  
  return payload;
}

/**
 * Saves data to Strapi API
 */
async function saveToStrappi(payload: any) {
  try {
    console.log('\n☁️  Sending data to Strapi...');
    console.log('   Payload preview:', JSON.stringify(payload, null, 2).substring(0, 200) + '...');
    
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
    throw error;
  }
}

test('SME Market - Top 5 Gainers and Losers', async ({ page }) => {
  test.setTimeout(CONFIG.testTimeout);

  console.log('\n' + '='.repeat(80));
  console.log('   NSE SME Market Data Extraction & Strapi Sync');
  console.log('='.repeat(80));

  // Step 1: Navigate
  console.log('\n📍 Step 1: Navigate to page');
  await page.goto('https://www.nseindia.com/market-data/sme-market', {
    waitUntil: 'domcontentloaded',
    timeout: CONFIG.navigationTimeout
  });
  
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(CONFIG.networkIdleTimeout);

  // Step 2: Handle modal
  console.log('\n🗳️ Step 2: Handle consent modal');
  try {
    const modalButton = page.getByRole('button', { name: /No thanks/i });
    await modalButton.waitFor({ state: 'visible', timeout: 5000 });
    await modalButton.click();
    console.log('   ✓ Modal dismissed');
  } catch {
    console.log('   ℹ No modal present');
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
  
  // Double-click to ensure ascending order
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

  // Step 6: Build and send dynamic payload
  console.log('\n☁️ Step 6: Build dynamic Strapi payload');
  const dynamicPayload = buildStrapiPayload(topGainers, topLosers);
  
  console.log('\n   Generated payload keys:', Object.keys(dynamicPayload.data).length);
  console.log('   Sample data:');
  if (topGainers.length > 0) {
    console.log(`   - Gainer 1: ${dynamicPayload.data.Gainer_1_Stock_Name} (₹${dynamicPayload.data.Gainer_1_LTP}, ${dynamicPayload.data.Gainer_1_Change}%)`);
  }
  if (topLosers.length > 0) {
    console.log(`   - Loser 1: ${dynamicPayload.data.Loser_1_Stock_Name} (₹${dynamicPayload.data.Loser_1_LTP}, ${dynamicPayload.data.Loser_1_Change}%)`);
  }

  // Step 7: Save to Strapi
  console.log('\n💾 Step 7: Save to Strapi');
  await saveToStrappi(dynamicPayload);

  // Step 8: Validation
  console.log('\n✅ Step 8: Validate results');
  expect(topGainers.length + topLosers.length).toBeGreaterThan(0);

  console.log('\n🎉 Test completed successfully!');
  console.log(`   Extracted: ${topGainers.length} gainers, ${topLosers.length} losers`);
});