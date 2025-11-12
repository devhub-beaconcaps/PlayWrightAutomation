import { test, expect } from '@playwright/test';

// TypeScript interfaces
interface FIIDIIActivityData {
  DateOfTable: string;
  GrossPurchaseFII: string;
  GrossSalesFII: string;
  NetSalesFII: string;
  GrossPurchaseDII: string;
  GrossSalesDII: string;
  NetSalesDII: string;
}

interface CommodityRowData {
  [key: string]: string;
}

interface CurrencyData {
  symbol: string;
  name: string;
  price: string;
  url: string;
}

// Configure test
test.use({
  browserName: 'chromium',
  viewport: { width: 1920, height: 1080 },
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
  extraHTTPHeaders: {
    'Accept-Language': 'en-US,en;q=0.9',
    'Sec-Ch-Ua': '"Not A(Brand";v="99", "Google Chrome";v="121", "Chromium";v="121"',
    'Sec-Ch-Ua-Mobile': '?0',
    'Sec-Ch-Ua-Platform': '"Windows"',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'none',
    'Sec-Fetch-User': '?1',
    'Upgrade-Insecure-Requests': '1',
  },
  launchOptions: {
    slowMo: 50,
  },
  headless: false,
});

// Extract FII/DII data
async function extractFIIDIIActivityData(page): Promise<FIIDIIActivityData> {
  console.log('\n--- Starting FII/DII Data Extraction ---');
  
  await page.goto('https://www.moneycontrol.com/stocks/marketstats/fii_dii_activity/index.php', {
    waitUntil: 'domcontentloaded',
    timeout: 60000
  });

  await page.waitForTimeout(2000);

  try {
    const noThanksButton = page.getByRole('button', { name: 'No thanks' });
    await noThanksButton.waitFor({ state: 'visible', timeout: 5000 });
    await noThanksButton.click();
    console.log('Modal "No thanks" button clicked.');
  } catch (error) {
    console.log('Modal did not appear or button was not found. Continuing...');
  }

  const firstFiiLeftDiv = page.locator('.fidileft').first();
  await expect(firstFiiLeftDiv).toBeVisible({ timeout: 20000 });
  
  const secondTable = firstFiiLeftDiv.getByRole('table').nth(1);
  await expect(secondTable).toBeVisible({ timeout: 15000 });
  
  const firstRowCells = await secondTable.locator('tbody tr').first().locator('td').allInnerTexts();

  const [
    DateOfTable,
    GrossPurchaseFII,
    GrossSalesFII,
    NetSalesFII,
    GrossPurchaseDII,
    GrossSalesDII,
    NetSalesDII
  ] = firstRowCells;

  return {
    DateOfTable,
    GrossPurchaseFII,
    GrossSalesFII,
    NetSalesFII,
    GrossPurchaseDII,
    GrossSalesDII,
    NetSalesDII
  };
}

// Extract commodity data
async function extractCommodityData(page): Promise<CommodityRowData[]> {
  console.log('\n--- Starting Commodity Data Extraction ---');
  
  await page.goto('https://www.moneycontrol.com/commodity/', {
    waitUntil: 'domcontentloaded',
    timeout: 60000
  });
  
  await page.waitForTimeout(2000);

  try {
    const noThanksButton = page.getByRole('button', { name: 'No thanks' });
    await noThanksButton.waitFor({ state: 'visible', timeout: 5000 });
    await noThanksButton.click();
    console.log('Modal "No thanks" button clicked.');
  } catch (error) {
    console.log('Modal did not appear or button was not found. Continuing...');
  }

  await page.getByRole('listitem').filter({ hasText: 'Spot Rates' }).click();
  await page.getByRole('heading', { name: 'MAJOR COMMODITIES' }).click();
  
  const table = page.getByRole('table').first();
  await expect(table).toBeVisible({ timeout: 15000 });

  const headers = await table.locator('thead th').allInnerTexts();
  const cleanHeaders = headers.map(h => h.trim());

  const dataRows = await table.locator('tbody tr').all();
  console.log(`Found ${dataRows.length} data rows in the table.`);

  const tableData: CommodityRowData[] = [];

  for (const row of dataRows) {
    const cellValues = await row.locator('td').allInnerTexts();
    
    const rowData = cleanHeaders.reduce((obj: Record<string, string>, header, index) => {
      obj[header] = cellValues[index] || '';
      return obj;
    }, {} as Record<string, string>);

    tableData.push(rowData);
  }

  return tableData;
}

// Extract currency data with a fresh page for each URL
async function extractCurrencyData(browser): Promise<CurrencyData[]> {
  console.log('\n--- Starting Currency/Index Data Extraction ---');
  
  const currencyUrls = [
    'https://finance.yahoo.com/quote/INR=X/',
    'https://finance.yahoo.com/quote/EURINR=X/',
    'https://finance.yahoo.com/quote/GBPINR=X/',
    'https://finance.yahoo.com/quote/%5EDJI/',
    'https://finance.yahoo.com/quote/%5ENDX/',
    'https://finance.yahoo.com/quote/%5EGDAXI/',
    'https://finance.yahoo.com/quote/%5EHSI/',
    'https://finance.yahoo.com/quote/%5EN225/'
  ];

  const currencyData: CurrencyData[] = [];

  for (const url of currencyUrls) {
    const page = await browser.newPage({
      viewport: { width: 1920, height: 1080 },
      extraHTTPHeaders: {
        'Accept-Language': 'en-US,en;q=0.9',
        'Sec-Ch-Ua': '"Not A(Brand";v="99", "Google Chrome";v="121", "Chromium";v="121"',
        'Sec-Ch-Ua-Mobile': '?0',
        'Sec-Ch-Ua-Platform': '"Windows"',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-User': '?1',
        'Upgrade-Insecure-Requests': '1',
      },
    });

    try {
      console.log(`Extracting data from: ${url}`);
      
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.waitForTimeout(2000);

      // Handle Yahoo Finance consent modal
      try {
        const consentButton = page.getByTestId('qc-cmp-yes-button');
        await consentButton.waitFor({ state: 'visible', timeout: 3000 });
        await consentButton.click();
        console.log('Consent modal accepted.');
      } catch (error) {
        // No consent modal, continue
      }

      const symbol = decodeURIComponent(url.split('/').slice(-2)[0]);
      
      const priceElement = page.locator('[data-testid="qsp-price"]');
      await priceElement.waitFor({ state: 'visible', timeout: 10000 });
      const price = await priceElement.innerText();

      let instrumentName = symbol;
      try {
        const nameElement = page.locator('h1').first();
        instrumentName = await nameElement.innerText();
      } catch (error) {
        // Fallback to symbol
      }

      currencyData.push({
        symbol: symbol,
        name: instrumentName.trim(),
        price: price.trim(),
        url: url
      });

      console.log(`✓ ${instrumentName.trim()}: ${price.trim()}`);

    } catch (error) {
      console.log(`✗ Failed to extract data from ${url}: ${error.message}`);
    } finally {
      await page.close();
    }
  }

  console.log(`\nCurrency/Index Data Extraction Complete: ${currencyData.length} instruments processed.`);
  return currencyData;
}

// Main test
test('Extract Complete Market Data', async ({ browser }) => {
  test.setTimeout(120000); // Increase timeout to 120 seconds
  
  try {
    console.log('🚀 Starting comprehensive data extraction from all sources...');

    // Create page for Moneycontrol data
    const mcPage = await browser.newPage({
      viewport: { width: 1920, height: 1080 },
      extraHTTPHeaders: {
        'Accept-Language': 'en-US,en;q=0.9',
        'Sec-Ch-Ua': '"Not A(Brand";v="99", "Google Chrome";v="121", "Chromium";v="121"',
        'Sec-Ch-Ua-Mobile': '?0',
        'Sec-Ch-Ua-Platform': '"Windows"',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-User': '?1',
        'Upgrade-Insecure-Requests': '1',
      },
    });

    const fiiDiiData = await extractFIIDIIActivityData(mcPage);
    const commodityData = await extractCommodityData(mcPage);
    await mcPage.close();

    // Extract Currency data using fresh pages for each URL
    const currencyData = await extractCurrencyData(browser);

    console.log('\n\n========== COMPLETE MARKET DATA ==========\n');
    console.log('1. FII/DII ACTIVITY DATA:', JSON.stringify(fiiDiiData, null, 2));
    console.log('\n2. MAJOR COMMODITIES DATA:', JSON.stringify(commodityData, null, 2));
    console.log('\n3. CURRENCY & INDEX DATA:', JSON.stringify(currencyData, null, 2));
    console.log('\n========== END OF DATA ==========');

    expect(fiiDiiData.DateOfTable).toBeTruthy();
    expect(fiiDiiData.GrossPurchaseFII).toBeTruthy();
    expect(commodityData.length).toBeGreaterThan(0);
    expect(currencyData.length).toBeGreaterThan(0);

    console.log('\n📊 DATA EXTRACTION SUMMARY:');
    console.log(`- FII/DII: ${Object.keys(fiiDiiData).length} fields extracted`);
    console.log(`- Commodities: ${commodityData.length} rows extracted`);
    console.log(`- Currencies/Indices: ${currencyData.length} instruments extracted`);
    console.log('\n✅ All data extracted successfully!');

  } catch (error) {
    console.error('\n❌ Test failed with error:', error.message);
    console.error('Stack trace:', error.stack);
    throw error;
  }
});