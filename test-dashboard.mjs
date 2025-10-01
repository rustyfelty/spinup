import { chromium } from 'playwright';

async function testDashboard() {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  // Capture console logs and errors
  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.log('❌ CONSOLE ERROR:', msg.text());
    }
  });

  page.on('pageerror', error => {
    console.log('❌ PAGE ERROR:', error.message);
  });

  // Capture network responses
  const responses = [];
  page.on('response', async response => {
    if (response.url().includes('/api/')) {
      const status = response.status();
      const url = response.url();
      responses.push({ status, url });

      if (status !== 200 && status !== 201) {
        console.log(`⚠️  ${status} ${url}`);
        try {
          const body = await response.text();
          console.log('   Response:', body.substring(0, 200));
        } catch (e) {}
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
    console.log('✓ On servers page:', page.url());

    console.log('\n4. Waiting for content to load...');
    await page.waitForTimeout(3000);

    console.log('\n5. Taking screenshot...');
    await page.screenshot({ path: 'dashboard.png', fullPage: true });

    console.log('\n6. Checking page content...');
    const headings = await page.locator('h1, h2, h3').allTextContents();
    console.log('Headings found:', headings);

    const buttons = await page.locator('button').allTextContents();
    console.log('Buttons found:', buttons.slice(0, 5));

    const links = await page.locator('a[href*="/servers/"]').count();
    console.log('Server links found:', links);

    const cards = await page.locator('[class*="cursor-pointer"]').count();
    console.log('Clickable cards found:', cards);

    console.log('\n7. Checking API responses:');
    const serverRequests = responses.filter(r => r.url.includes('/api/servers'));
    serverRequests.forEach(r => {
      console.log(`  ${r.status} ${r.url}`);
    });

    if (links === 0 && cards === 0) {
      console.log('\n❌ NO SERVERS DISPLAYED');
      console.log('Checking for error messages on page...');
      const bodyText = await page.locator('body').innerText();
      console.log('Page text:', bodyText.substring(0, 500));
    } else {
      console.log('\n✅ Servers are being displayed');
    }

  } catch (error) {
    console.error('Test failed:', error.message);
  } finally {
    await page.waitForTimeout(3000);
    await browser.close();
  }
}

testDashboard();
