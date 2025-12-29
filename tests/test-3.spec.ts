import { test, expect, Page, Browser } from '@playwright/test';
import axios from 'axios';
// PREMARKET DATA(CURRENCY,COMMODITY,FII DII)
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
  priceChange: string;
  percentChange: string;
  url: string;
}

const EQUID_API_TOKEN = process.env.STRAPI_API_TOKEN || '';

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
  headless: true,
});

// Extract FII/DII data
async function extractFIIDIIActivityData(page: Page): Promise<FIIDIIActivityData> {
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
async function extractCommodityData(page: Page): Promise<CommodityRowData[]> {
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

  await page.getByRole('listitem').filter({ hasText: /^MCX$/ }).click();
  await page.getByRole('heading', { name: 'MAJOR COMMODITIES' }).click();

  const table = page.getByRole('table').first();
  await expect(table).toBeVisible({ timeout: 15000 });

  const headers = await table.locator('thead th').allInnerTexts();
  const cleanHeaders = headers.map((h: string) => h.trim());

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

// Extract currency data
async function extractCurrencyData(browser: Browser): Promise<CurrencyData[]> {
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
      console.log(`\nExtracting data from: ${url}`);

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

      // Extract price
      const priceElement = page.locator('[data-testid="qsp-price"]');
      await priceElement.waitFor({ state: 'visible', timeout: 10000 });
      const price = await priceElement.innerText();

      // Extract price change and percent change
      const priceChangeElement = page.locator('[data-testid="qsp-price-change"]');
      await priceChangeElement.waitFor({ state: 'visible', timeout: 10000 });
      const priceChange = await priceChangeElement.innerText();

      const percentChangeElement = page.locator('[data-testid="qsp-price-change-percent"]');
      await percentChangeElement.waitFor({ state: 'visible', timeout: 10000 });
      const percentChange = await percentChangeElement.innerText();

      // Extract instrument name
      let instrumentName = symbol;
      try {
        const nameElement = page.locator('h1').first();
        instrumentName = await nameElement.innerText();
      } catch (error) {
        // Fallback to symbol
      }

      const data: CurrencyData = {
        symbol: symbol,
        name: instrumentName.trim(),
        price: price.trim(),
        priceChange: priceChange.trim(),
        percentChange: percentChange.trim(),
        url: url
      };

      currencyData.push(data);

      console.log(`✓ ${instrumentName.trim()}`);
      console.log(`  Price: ${price.trim()} | Change: ${priceChange.trim()} | % Change: ${percentChange.replace(/^\(|\)$/g, '')}`);

    } catch (error: unknown) {
      console.error(error instanceof Error ? error.message : error);
    }
    finally {
      await page.close();
    }
  }

  console.log(`\nCurrency/Index Data Extraction Complete: ${currencyData.length} instruments processed.`);
  return currencyData;
}

function cleanValue(str: string): string {
  const numeric = str.replace(/[()%]/g, '').trim();

  const value = parseFloat(numeric);
  if (isNaN(value)) return '';

  return value > 0 ? `+${value}` : `${value}`;
}


function formatAllCurrencies(
  commodities: CurrencyData[]
): Record<string, string> {
  return commodities.reduce(
    (acc: Record<string, string>, item: CurrencyData) => {
      const key = item.symbol.replace(/[\^=]/g, '');
      acc[key] = `${item.price} (${parseFloat(item.priceChange) > 0 ? '+' : ''}${item.priceChange}, ${cleanValue(item.percentChange)})`;
      return acc;
    },
    {}
  );
}


function formatSelectedCommodities(
  commodities: CommodityRowData[]
): {
  gold: string | null;
  crudeoil: string | null;
  silver: string | null;
} {

  const formatItem = (item?: CommodityRowData | undefined): string | null => {
    if (!item) return null;
    return `${item.LTP} (${parseFloat(item.Change) > 0 ? '+' : ''}${item.Change}, ${parseFloat(item['Chg%']) > 0 ? '+' : ''}${item['Chg%']}%)`;
  };

  const cleanName = (name: string) => name.split('\n')[0].trim();


  const goldItem = commodities.find((c: CommodityRowData) => cleanName(c.Name) === "GOLD");
  const crudeoilItem = commodities.find((c: CommodityRowData) => cleanName(c.Name) === "CRUDEOIL");
  const silverItem = commodities.find((c: CommodityRowData) => cleanName(c.Name) === "SILVER");

  return {
    gold: formatItem(goldItem),
    crudeoil: formatItem(crudeoilItem),
    silver: formatItem(silverItem)
  };
}

const fetchListingTodayData = async (page: Page, url: string) => {
  try {
    await page.goto(url, {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    });

    await page.waitForSelector('#report_table');

    const tableData = await page.$$eval('#report_table tbody tr', (rows) => {
      // Read and clean headers
      const rawHeaders = Array.from(
        document.querySelectorAll('#report_table thead th')
      ).map(th => (th.textContent || '').trim());

      // Map raw headers → friendly keys
      const headerMap: Record<string, string> = {
        'Company Name▲▼': 'companyName',
        'Listing Date▲▼': 'listingDate',
        'Issue Price (Rs)▲▼': 'issuePrice',
        'Listing Day - Close Price (Rs)▲▼': 'closePrice',
        'Listing Day Gain / Loss (%)▲▼': 'listingGainPct',
        'Current Price at BSE (Rs)▲▼': 'currentPriceBSE',
        'Current Price at NSE (Rs)▲▼': 'currentPriceNSE',
        'Gain / Loss (%)▲▼': 'overallGainPct'
      };

      return Array.from(rows).map(row => {
        const cells = Array.from(row.querySelectorAll('td'));
        const obj: Record<string, string> = {};

        rawHeaders.forEach((raw, i) => {
          const key = headerMap[raw] || raw;   // fallback if header missing
          obj[key] = cells[i]?.textContent?.trim() || '';
        });

        return obj;
      });
    });

    const today = new Date();
    const twentyDaysAgo = new Date(today);
    twentyDaysAgo.setDate(today.getDate() - 20);

    // --- filter by today's date ---
    const todayFormatted = twentyDaysAgo.toLocaleDateString('en-US', {
      month: 'short',
      day: '2-digit',
      year: 'numeric',
      timeZone: 'Asia/Kolkata'
    });

    const listingToday = tableData.filter(
      row => row.listingDate?.trim() === todayFormatted
    );

    console.log('📊 Clean listing rows:', listingToday);
    return listingToday;
  } catch (error) {
    console.error('❌ Error during data extraction:', error);
    return null;
  }
};

const fetchGSecData = async (page: Page, url: string) => {
    try {
        await page.goto(url, {
            waitUntil: 'domcontentloaded',
            timeout: 60000,
        });

        console.log('✅ Page ready, test continues...');

        // Wait for the element to be available
        const priceLocator = page.locator('[data-test="instrument-price-last"]');
        await priceLocator.waitFor();

        // Get its text
        const priceText = await priceLocator.innerText();
        console.log('📊 Current price:', priceText);

        return parseFloat(priceText);

    } catch (error) {
        console.error('❌ Error during data extraction:', error);
        return 0;
    }
};

// Add retry configuration for this specific test
test.describe.configure({ retries: 2 });

const updatePostMarket = async () => {

  const payload = {
    data: {
      Has_to_Reflect_on_PreMarket: true
    }
  }
  const postMarketUrl = 'https://admin.equivision.in/api/postmarkets/d99w2c4wm9yj00rwdi58ebye';
  try {
    const response = await fetch(postMarketUrl, {
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
    console.log('✅ postmarket update successful!');
    console.log('Update result:', result);

  } catch (error) {
    if (error instanceof Error) {
      console.error(error.message);
    } else {
      console.error(error);
    }
  }

}

// Main test
test('Extract Complete Market Data', async ({ browser }) => {
  test.setTimeout(120000);

  try {
    console.log('🚀 Starting comprehensive data extraction from all sources...');

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
    const listingTodayData = await fetchListingTodayData(mcPage, 'https://www.chittorgarh.com/report/ipo-listing-date-check-status-price-bse-nse/25/sme/');
    console.log('📊 Final listing today data:', listingTodayData);

    const priceText = await fetchGSecData(mcPage, 'https://in.investing.com/rates-bonds/india-10-year-bond-yield-historical-data');
    console.log('📊 Final price text:', priceText);
    
    await mcPage.close();

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

    const { INRX, EURINRX, GBPINRX, DJI, NDX, GDAXI, HSI, N225 } = formatAllCurrencies(currencyData);
    console.log('\nFormatted Currencies/Indices:', { INRX, EURINRX, GBPINRX, DJI, NDX, GDAXI, HSI, N225 });

    const { gold, crudeoil, silver } = formatSelectedCommodities(commodityData);
    console.log('\nFormatted Commodities:', { gold, crudeoil, silver });

    
    let BSEFormattedData = '';
    let NSEFormattedData = '';

    if (listingTodayData && listingTodayData.length > 0) {
      const BSEData = listingTodayData.filter(item => item.currentPriceBSE && item.currentPriceBSE !== '-');
      const NSEData = listingTodayData.filter(item => item.currentPriceNSE && item.currentPriceNSE !== '-');
      BSEFormattedData = `${BSEData[0].companyName} : BSE SME`;
      NSEFormattedData = `${NSEData[0].companyName} : NSE SME`;
    }
    console.log("📊 BSE Formatted Data:", BSEFormattedData, "");
    console.log("📊 NSE Formatted Data:", NSEFormattedData, "");
    const formattedListingTodsayData = `${BSEFormattedData}\n${NSEFormattedData}`;

    // Calculate current date in IST timezone
    const now = new Date();
    const istTime = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
    const year = istTime.getFullYear();
    const month = String(istTime.getMonth() + 1).padStart(2, '0');
    const day = String(istTime.getDate()).padStart(2, '0');
    const currentISODate = `${year}-${month}-${day}`;

    const payload = {
      data: {
        // Map your scraped data to Strapi fields
        Date: currentISODate, // Add current date in YYYY-MM-DD format
        USDINR: INRX || '',
        EURINR: EURINRX || '',
        GBPINR: GBPINRX || '',
        Crude: crudeoil || '',
        Gold: gold || '',
        Silver: silver || '',
        DJI: DJI || '',
        NDX: NDX || '',
        DAX: GDAXI || '',
        HSI: HSI || '',
        Nikkei: N225 || '',
        BuyValueDii: parseFloat(fiiDiiData?.GrossPurchaseDII.replace(/,/g, '')) || 0,
        SellValueDii: parseFloat(fiiDiiData?.GrossSalesDII.replace(/,/g, '')) || 0,
        BuyValueFii: parseFloat(fiiDiiData?.GrossPurchaseFII.replace(/,/g, '')) || 0,
        SellValueFii: parseFloat(fiiDiiData?.GrossSalesFII.replace(/,/g, '')) || 0,
        IpoUpdates: formattedListingTodsayData || '',
        DebtMarketHighlight: priceText.toFixed(3) || 0
      }
    };

    // Validate API token
    if (!EQUID_API_TOKEN) {
      console.error("  ❌ CRITICAL: Strapi API token not configured!");
      console.error("     Set STRAPI_API_TOKEN environment variable");
      console.log("\n====== Test Completed (Strapi post skipped) ======\n");
      return;
    }

    try {
      const response = await fetch('https://admin.equivision.in/api/pre-market-updates/nqg7p30n5zan7oyw56g6b25n', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${EQUID_API_TOKEN}`
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status} ${response.statusText}: ${errorText}`);
      }

      const result = await response.json();
      console.log('✅ Strapi update successful!');
      console.log('Update result:', result);

      await updatePostMarket();

    } catch (error: unknown) {
      console.error(error instanceof Error ? error.message : error);
    }


  } catch (error: unknown) {
    console.error(error instanceof Error ? error.message : error);
  }

});