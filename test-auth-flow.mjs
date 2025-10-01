import { chromium } from 'playwright';

async function testAuthFlow() {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    console.log('1. Navigating to login page...');
    await page.goto('http://localhost:5173/login');
    await page.waitForLoadState('networkidle');

    console.log('2. Looking for Dev Login button...');
    const devLoginButton = page.locator('button:has-text("Dev Login")');
    await devLoginButton.waitFor({ timeout: 5000 });

    console.log('3. Clicking Dev Login button...');
    await devLoginButton.click();

    console.log('4. Waiting for navigation to servers page...');
    await page.waitForURL(/\/orgs\/.*\/servers/, { timeout: 10000 });
    console.log('✓ Successfully navigated to:', page.url());

    console.log('5. Waiting for servers list to load...');
    await page.waitForTimeout(2000);

    console.log('6. Looking for a server to click...');
    const serverCard = page.locator('[class*="cursor-pointer"]').first();
    const hasServer = await serverCard.count() > 0;

    if (hasServer) {
      console.log('7. Clicking on first server...');
      await serverCard.click();

      console.log('8. Waiting for server detail page...');
      await page.waitForURL(/\/servers\//, { timeout: 5000 });
      console.log('✓ Navigated to server detail:', page.url());

      console.log('9. Waiting for page content to load...');
      await page.waitForTimeout(3000);

      console.log('10. Checking for errors in console...');
      const logs = [];
      page.on('console', msg => {
        if (msg.type() === 'error') {
          logs.push(`ERROR: ${msg.text()}`);
        }
      });

      await page.waitForTimeout(5000);

      if (logs.length > 0) {
        console.log('\n❌ Console errors found:');
        logs.forEach(log => console.log(log));
      } else {
        console.log('\n✅ No console errors found!');
      }

      // Check network requests
      console.log('\n11. Checking network requests...');
      const responses = [];
      page.on('response', response => {
        if (response.url().includes('/api/')) {
          responses.push({
            url: response.url(),
            status: response.status()
          });
        }
      });

      await page.waitForTimeout(3000);

      const unauthorized = responses.filter(r => r.status === 401);
      if (unauthorized.length > 0) {
        console.log('\n❌ 401 Unauthorized responses found:');
        unauthorized.forEach(r => console.log(`  ${r.status} ${r.url}`));
      } else {
        console.log('\n✅ No 401 errors!');
      }

    } else {
      console.log('No servers found - creating one would be next step');
    }

  } catch (error) {
    console.error('Test failed:', error.message);
  } finally {
    await page.waitForTimeout(3000);
    await browser.close();
  }
}

testAuthFlow();
