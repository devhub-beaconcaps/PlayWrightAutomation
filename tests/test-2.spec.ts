import { test, expect } from '@playwright/test';

test('test', async ({ page }) => {
  await page.goto('https://ipoplatform.com/');
  await page.getByRole('button', { name: 'Anchor Investors' }).click();
  await page.getByRole('link', { name: 'SME IPO Anchor Investors List' }).click();
  await page.getByRole('link', { name: 'Rajasthan Global Securities' }).click();
  await page.getByRole('link', { name: 'Total No. of SME IPOs' }).click();

  // Wait for the initial table content to be stable
  await page.waitForLoadState('networkidle');

  // This function is fine, no changes needed here.
  const extractTableData = async (): Promise<Record<string, string>[]> => {
    // Cast the result from the page context to the expected type.
    return (await page.evaluate(() => {
      const tables = document.querySelectorAll('table');
      for (const table of tables) {
        const tableText = table.textContent;
        if (tableText && (tableText.includes('SME') || tableText.includes('IPO') || tableText.includes('Total') || tableText.includes('No.'))) {
          const headerRow = table.querySelector('thead tr') || table.querySelector('tr:nth-child(1)');
          const headerCells = headerRow ? headerRow.querySelectorAll('th, td') : [];
          const headers = Array.from(headerCells).map(cell => (cell.textContent || '').trim().replace(/\s+/g, '_').replace(/[^\w_]/g, ''));
          const allRows = table.querySelectorAll('tr');
          const dataRows = Array.from(allRows).slice(1);
          const data: Record<string, string>[] = [];
          for (const row of dataRows) {
            const cells = row.querySelectorAll('td, th');
            if (cells.length < headers.length || !cells[0].textContent.trim()) continue;
            const rowObject: Record<string, string> = {};
            headers.forEach((header, index) => {
              if (index < cells.length) {
                rowObject[header] = (cells[index].textContent || '').trim();
              }
            });
            if (Object.values(rowObject).some((value) => value.trim() !== '')) {
              data.push(rowObject);
            }
          }
          return data;
        }
      }
      return [];
    })) as Record<string, string>[];
  };
  // --- REFACTORED PAGINATION LOGIC ---
  // --- REFACTORED PAGINATION LOGIC (Robust Version) ---

  const allData: Record<string, string>[] = [];
  let currentPage = 1;
  let currentPage = 1;

  // 1. Create the locator for the "Next" button ONCE.
  const nextButton = page.getByRole('link', { name: 'Next' });

  // 2. Use a while(true) loop. We will break out of it when we can't click "Next" anymore.
  while (true) {
    console.log(`--- Extracting data from page ${currentPage} ---`);

    // Extract data from the current page
    const pageData = await extractTableData();
    allData.push(...pageData);
    console.log(`Extracted ${pageData.length} entries from page ${currentPage}`);

    try {
      // 3. Attempt to click the next button.
      // We use a shorter timeout to fail fast if the button isn't clickable.
      await nextButton.click({ timeout: 5000 });

      // 4. If the click was successful, wait for the new page to load.
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(500); // A small wait helps with dynamic tables
      currentPage++;

    } catch (error) {
      // 5. If the click fails, it means we're on the last page.
      // The error could be because the button is disabled, hidden, or not found.
      console.log("'Next' button is no longer clickable. Reached the last page.");
      break; // Exit the while loop
    }
  }

  console.log(`\n--- Extraction Complete ---`);
  console.log(`Total pages visited: ${currentPage}`);
  console.log(`Total extracted entries: ${allData.length}`);

  // Console log the results (optional)
  // console.log('Extracted table data:');
  // console.log(JSON.stringify(allData, null, 2));
  // Console log the results (optional, can be a lot of data)
  // console.log('Extracted table data:');
  // console.log(JSON.stringify(allData, null, 2));

});