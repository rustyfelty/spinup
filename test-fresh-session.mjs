import { chromium } from 'playwright';

async function testFreshSession() {
  // Use a completely fresh browser context
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    // Clear all storage
    storageState: undefined
  });
  const page = await context.newPage();

  try {
    console.log('1. Navigating to login page (fresh session)...');
    await page.goto('http://localhost:5173/login');
    await page.waitForLoadState('networkidle');

    console.log('2. Clicking Dev Login...');
    await page.locator('button:has-text("Dev Login")').click();

    console.log('3. Waiting for servers page...');
    await page.waitForURL(/\/orgs\/.*\/servers/, { timeout: 10000 });

    console.log('4. Waiting for server cards...');
    await page.waitForTimeout(2000);

    console.log('5. Clicking first server...');
    const firstCard = page.locator('[class*="cursor-pointer"]').first();
    await firstCard.click();

    console.log('6. Waiting for server detail page...');
    await page.waitForURL(/\/servers\//, { timeout: 10000 });
    const url = page.url();
    console.log('✓ On server detail page:', url);

    console.log('\n7. Waiting for page to load...');
    await page.waitForTimeout(5000);

    console.log('\n8. Checking page content...');
    const bodyText = await page.locator('body').innerText();

    if (bodyText.includes('Server not found')) {
      console.log('❌ "Server not found" is displayed');
      console.log('\nDebugging info:');
      console.log('- URL:', url);
      console.log('- Page text sample:', bodyText.substring(0, 200));
    } else {
      console.log('✅ Server detail page loaded successfully!');
      console.log('- Page contains server info');

      const headings = await page.locator('h1, h2, h3').allTextContents();
      console.log('- Headings:', headings.slice(0, 5));
    }

    console.log('\n9. Taking screenshot...');
    await page.screenshot({ path: 'server-detail-fresh.png', fullPage: true });

  } catch (error) {
    console.error('Test failed:', error.message);
  } finally {
    await page.waitForTimeout(2000);
    await browser.close();
  }
}

testFreshSession();
