import { test, expect } from '@playwright/test';

// Function to extract FII/DII table data
async function extractFIIDIIActivityData(page) {
  // Navigate to the page
  await page.goto('https://www.moneycontrol.com/stocks/marketstats/fii_dii_activity/index.php', {
    waitUntil: 'networkidle'
  });

  // Handle modal if it appears
  try {
    await page.waitForSelector('button:has-text("No thanks")', { timeout: 5000 });
    await page.getByRole('button', { name: 'No thanks' }).click();
    console.log('Modal "No thanks" button clicked.');
  } catch (error) {
    console.log('Modal did not appear or button was not found. Continuing...');
  }

  // Locate the first .fidileft div
  const firstFiiLeftDiv = page.locator('.fidileft').first();
  await expect(firstFiiLeftDiv).toBeVisible({ timeout: 20000 });
  console.log('Successfully located the first .fidileft div.');

  // Locate the SECOND table
  const secondTable = firstFiiLeftDiv.getByRole('table').nth(1);
  await expect(secondTable).toBeVisible({ timeout: 15000 });
  console.log('Successfully located the second table inside .fidileft.');

  // Get the array of cell values from the first data row
  const firstRowCells = await secondTable.locator('tbody tr').first().locator('td').allInnerTexts();

  // Use Array Destructuring to assign values to named variables
  const [
    DateOfTable,
    GrossPurchaseFII,
    GrossSalesFII,
    NetSalesFII,
    GrossPurchaseDII,
    GrossSalesDII,
    NetSalesDII
  ] = firstRowCells;

  // Return the extracted data as an object
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

const extractCommodityData = async (page) => {
  await page.goto('https://www.moneycontrol.com/commodity/');
  try {
    await page.waitForSelector('button:has-text("No thanks")', { timeout: 5000 });
    await page.getByRole('button', { name: 'No thanks' }).click();
    console.log('Modal "No thanks" button clicked.');
  } catch (error) {
    console.log('Modal did not appear or button was not found. Continuing...');
  }

  await page.getByRole('listitem').filter({ hasText: 'Spot Rates' }).click();
  await page.getByRole('heading', { name: 'MAJOR COMMODITIES' }).click();
  const table = page.getByRole('table').first();
  await expect(table).toBeVisible({ timeout: 15000 });
  console.log('Successfully located the tables.');

  // --- Step 1: Extract Table Headers ---
  // Get the text from all <th> elements within the <thead>
  const headers = await table.locator('thead th').allInnerTexts();
  // Clean up header names to be used as object keys (e.g., remove extra spaces)
  const cleanHeaders = headers.map(h => h.trim());

  // --- Step 2: Extract All Data Rows ---
  // Get all <tr> elements from the <tbody>
  const dataRows = await table.locator('tbody tr').all();
  console.log(`Found ${dataRows.length} data rows in the table.`);

  const tableData: Record<string, string>[] = [];

  // --- Step 3: Process Each Row ---
  for (const row of dataRows) {
    // Get all <td> cells for the current row
    const cellValues = await row.locator('td').allInnerTexts();

    // Create an object for the row by mapping headers to cell values
    const rowData = cleanHeaders.reduce((obj: Record<string, string>, header, index) => {
      obj[header] = cellValues[index];
      return obj;
    }, {} as Record<string, string>);

    tableData.push(rowData);
  }
  return tableData;
}


// Test that uses the function
test('currency test', async ({ page }) => {

  const currencyUrls = [
    'https://finance.yahoo.com/quote/INR=X/',
    'https://finance.yahoo.com/quote/EURINR=X/',
    'https://finance.yahoo.com/quote/GBPINR=X/',
    'https://finance.yahoo.com/quote/%5EDJI/',
    'https://finance.yahoo.com/quote/%5ENDX/',
    'https://finance.yahoo.com/quote/%5EGDAXI/',
    'https://finance.yahoo.com/quote/%5EHSI/',
    'https://finance.yahoo.com/quote/%5EN225/',
  ];


  for(const row of currencyUrls){
    await page.goto(row, { waitUntil: 'commit', timeout: 60000 });
    const price = await page.getByTestId('price-statistic').innerText();
    console.log(`Current ${row} exchange rate: ${price}`);
  }
 
});

test('commodity test',async({page})=>{
  const tableData = await extractCommodityData(page);

  console.log('\n--- Extracted Major Commodities Data ---');
  console.log(JSON.stringify(tableData, null, 2));
  console.log('---------------------------------------');
})

test('FII DII test',async({page})=>{
  const fiiDiiData = await extractFIIDIIActivityData(page);

  console.log('\n--- Values from the first row of the second table ---');
  console.log(fiiDiiData.DateOfTable);
  console.log(fiiDiiData.GrossPurchaseFII);
  console.log(fiiDiiData.GrossSalesFII);
  console.log(fiiDiiData.NetSalesFII);
  console.log(fiiDiiData.GrossPurchaseDII);
  console.log(fiiDiiData.GrossSalesDII);
  console.log(fiiDiiData.NetSalesDII);
  console.log('-----------------------------------------------------');
})

