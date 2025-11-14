import { test, expect } from '@playwright/test';


async function extractTableData(page: any, targetIndices: string[]) {
  try {
    // Extract table data
    const tableLocator = page.locator('#indicesTable');
    await tableLocator.waitFor({ state: 'visible', timeout: 10000 });
    console.log('Table found and visible.');

    const headers = await tableLocator.locator('thead th').allTextContents();
    const cleanedHeaders = headers.map(h => h.trim()).filter(h => h.length > 0);
    console.log('Headers extracted:', cleanedHeaders);

    const rows = tableLocator.locator('tbody tr');
    const rowCount = await rows.count();
    console.log(`Found ${rowCount} rows of data.`);

    // Define target indices - case insensitive and handles extra spaces
    const normalizedTargets = targetIndices.map(name => name.toUpperCase().trim());

    const tableData: Array<{ [key: string]: string }> = [];

    for (let i = 0; i < rowCount; i++) {
      const cells = rows.nth(i).locator('td');
      const cellCount = await cells.count();

      if (cellCount > 0) {
        const rowData: { [key: string]: string } = {};
        for (let j = 0; j < Math.min(cellCount, cleanedHeaders.length); j++) {
          const cellText = await cells.nth(j).innerText();
          rowData[cleanedHeaders[j]] = cellText.trim();
        }

        // Filter logic: only include rows with matching names (case-insensitive, trimmed)
        const rowName = rowData['Name']?.toUpperCase().trim() || '';
        if (normalizedTargets.includes(rowName)) {
          tableData.push(rowData);
        }
      }
    }

    return tableData;
  } catch (error) {
    console.error('Error extracting table data:', error);
    return [];
  }
}

// Add retry configuration for this specific test
test.describe.configure({ retries: 2 });

test('fetch indices data', async ({ page }) => {
  console.log('\n--- Starting Indices Data Extraction ---');

  // Navigate to the page
  await page.goto('https://www.moneycontrol.com/markets/indian-indices/ ', {
    waitUntil: 'domcontentloaded',
    timeout: 60000
  });

  // Wait for initial page load
  await page.waitForTimeout(2000);

  // Handle potential modal
  try {
    const noThanksButton = page.getByRole('button', { name: 'No thanks' });
    await noThanksButton.waitFor({ state: 'visible', timeout: 5000 });
    await noThanksButton.click();
    console.log('Modal "No thanks" button clicked.');
  } catch (error) {
    console.log('Modal did not appear or button was not found. Continuing...');
  }

  // Navigate to NSE tab
  await page.getByRole('listitem').filter({ hasText: 'Live Markets NSE NSE BSE' }).getByRole('strong').click();
  await page.waitForTimeout(2000);
  await page.getByText('NSE').nth(5).click();
  await page.waitForTimeout(2000);


  const targetNSEIndices = ['NIFTY 50', 'NIFTY BANK', 'NIFTY Midcap 100', 'NIFTY Smallcap 100', 'Nifty Microcap 250'];
  const NSEtableData = await extractTableData(page, targetNSEIndices);
  // Log the extracted data
  // console.log('\n--- Filtered Data (First 3 rows) ---');
  // console.log(JSON.stringify(tableData.slice(0, 3), null, 2));
  // console.log(`\nTotal filtered records extracted: ${tableData.length}`);

  // Log all filtered data
  // console.log('\n--- All Filtered NSE Data ---');
  // console.log(JSON.stringify(NSEtableData, null, 2));


  await page.getByRole('listitem').filter({ hasText: 'Live Markets NSE NSE BSE' }).getByRole('strong').click();
  await page.waitForTimeout(2000);
  await page.getByText('BSE').nth(3).click();
  await page.waitForTimeout(2000);

  const targetBSEIndices = ['SENSEX', 'BSE MIDCAP', 'BSE SMALLCAP'];
  const BSEtableData = await extractTableData(page, targetBSEIndices);

  // console.log('\n--- All Filtered BSE Data ---');
  // console.log(JSON.stringify(BSEtableData, null, 2));

  const combinedData = [...NSEtableData, ...BSEtableData];
  console.log('\n--- Combined Filtered Data ---');
  console.log(JSON.stringify(combinedData, null, 2));
  console.log(`\nTotal combined records extracted: ${combinedData.length}`);


  console.log('\n--- Data Extraction Complete ---');
});