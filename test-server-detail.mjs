import { chromium } from 'playwright';

async function testServerDetail() {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  // Capture console logs and errors
  const errors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      errors.push(msg.text());
      console.log('❌ CONSOLE ERROR:', msg.text());
    }
  });

  page.on('pageerror', error => {
    errors.push(error.message);
    console.log('❌ PAGE ERROR:', error.message);
  });

  // Capture network responses
  const apiResponses = [];
  page.on('response', async response => {
    if (response.url().includes('/api/')) {
      const status = response.status();
      const url = response.url();
      apiResponses.push({ status, url });

      if (status !== 200 && status !== 201) {
        console.log(`⚠️  ${status} ${url}`);
      }
    }
  });

  try {
    console.log('1. Navigating to login page...');
    await page.goto('http://localhost:5173/login');
    await page.waitForLoadState('networkidle');

    console.log('2. Clicking Dev Login...');
    await page.locator('button:has-text("Dev Login")').click();

    console.log('3. Waiting for servers page...');
    await page.waitForURL(/\/orgs\/.*\/servers/, { timeout: 10000 });

    console.log('4. Waiting for server cards to load...');
    await page.waitForTimeout(2000);

    console.log('5. Clicking first server card...');
    const firstCard = page.locator('[class*="cursor-pointer"]').first();
    await firstCard.click();

    console.log('6. Waiting for server detail page...');
    await page.waitForURL(/\/servers\//, { timeout: 10000 });
    console.log('✓ On server detail page:', page.url());

    console.log('\n7. Waiting for content to load...');
    await page.waitForTimeout(3000);

    console.log('\n8. Taking screenshot...');
    await page.screenshot({ path: 'server-detail.png', fullPage: true });

    console.log('\n9. Checking page content...');
    const headings = await page.locator('h1, h2, h3').allTextContents();
    console.log('Headings found:', headings);

    const tabs = await page.locator('[role="tab"], button').allTextContents();
    console.log('Tabs/buttons found:', tabs.slice(0, 10));

    const bodyText = await page.locator('body').innerText();
    console.log('\nPage contains "Server not found"?', bodyText.includes('Server not found'));
    console.log('Page contains "Error"?', bodyText.includes('Error'));
    console.log('Page contains "Loading"?', bodyText.includes('Loading'));

    console.log('\n10. API Responses:');
    const serverDetailRequests = apiResponses.filter(r =>
      r.url.match(/\/api\/servers\/[a-z0-9]+$/) && !r.url.includes('?')
    );
    console.log('Server detail requests:');
    serverDetailRequests.forEach(r => console.log(`  ${r.status} ${r.url}`));

    const unauthorized = apiResponses.filter(r => r.status === 401);
    if (unauthorized.length > 0) {
      console.log('\n❌ 401 Unauthorized requests:');
      unauthorized.forEach(r => console.log(`  ${r.url}`));
    }

    console.log('\n11. Summary:');
    if (errors.length > 0) {
      console.log('❌ Errors found:', errors.length);
    }
    if (bodyText.includes('Server not found')) {
      console.log('❌ "Server not found" message displayed');
    }
    if (unauthorized.length > 0) {
      console.log('❌ Authentication issues detected');
    }

    if (errors.length === 0 && !bodyText.includes('Server not found') && unauthorized.length === 0) {
      console.log('✅ Server detail page loaded successfully!');
    }

  } catch (error) {
    console.error('Test failed:', error.message);
  } finally {
    await page.waitForTimeout(3000);
    await browser.close();
  }
}

testServerDetail();
