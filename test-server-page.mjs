import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  const consoleMessages = [];
  const pageErrors = [];

  // Collect console messages
  page.on('console', msg => {
    consoleMessages.push({ type: msg.type(), text: msg.text() });
  });

  // Collect page errors
  page.on('pageerror', error => {
    pageErrors.push(error.message);
  });

  console.log('=== Testing Server Detail Page ===\n');

  try {
    // Step 1: Go to dev login
    console.log('1. Logging in...');
    await page.goto('http://localhost:8080/api/sso/dev/login');
    await page.waitForTimeout(1000);

    // Step 2: Go to home to get orgId
    console.log('2. Navigating to dashboard...');
    await page.goto('http://localhost:5173');
    await page.waitForTimeout(2000);

    // Step 3: Navigate to the server we created
    console.log('3. Navigating to server detail page...');
    await page.goto('http://localhost:5173/server/cmg89uue60003agt88sfg9g59');

    // Wait for content to load or timeout after 5 seconds
    try {
      await page.waitForSelector('text=Test Minecraft Server', { timeout: 5000 });
      console.log('   ✅ Server name loaded successfully');
    } catch (e) {
      console.log('   ⚠️  Server name did not load within 5 seconds');
    }

    await page.waitForTimeout(3000);

    // Take screenshot
    await page.screenshot({ path: 'test-server-page.png', fullPage: true });
    console.log('   Screenshot saved: test-server-page.png');

    // Check for console errors
    console.log('\n=== Console Messages ===');
    consoleMessages.forEach(msg => {
      if (msg.type === 'error') {
        console.log(`❌ [${msg.type}] ${msg.text}`);
      } else if (msg.type === 'warning') {
        console.log(`⚠️  [${msg.type}] ${msg.text}`);
      }
    });

    if (pageErrors.length > 0) {
      console.log('\n=== Page Errors ===');
      pageErrors.forEach(error => {
        console.log(`❌ ${error}`);
      });
    }

    if (consoleMessages.filter(m => m.type === 'error').length === 0 && pageErrors.length === 0) {
      console.log('✅ No errors found!');
    }

    // Check if page is functional
    console.log('\n=== Page Status Check ===');
    const bodyText = await page.textContent('body');
    if (bodyText.includes('Test Minecraft Server')) {
      console.log('✅ Server name is displayed');
    } else {
      console.log('❌ Server name not found on page');
    }

    if (bodyText.includes('STOPPED') || bodyText.includes('RUNNING') || bodyText.includes('CREATING')) {
      console.log('✅ Server status is displayed');
    } else {
      console.log('❌ Server status not found on page');
    }

  } catch (error) {
    console.error('Error during test:', error);
  } finally {
    await page.waitForTimeout(2000);
    await browser.close();
  }

  console.log('\n=== Test Complete ===');
})();
