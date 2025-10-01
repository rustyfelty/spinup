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

  console.log('Navigating to http://localhost:5173...');
  await page.goto('http://localhost:5173');

  // Wait a moment for any JS to load
  await page.waitForTimeout(3000);

  // Print collected errors
  console.log('\n=== CONSOLE MESSAGES ===');
  consoleMessages.forEach(msg => console.log(`[${msg.type}]`, msg.text));

  console.log('\n=== PAGE ERRORS ===');
  pageErrors.forEach(err => console.log('ERROR:', err));

  // Take a screenshot
  await page.screenshot({ path: 'screenshot.png', fullPage: true });
  console.log('\nScreenshot saved to screenshot.png');

  // Get page title
  const title = await page.title();
  console.log('Page title:', title);

  // Get body text content
  const bodyText = await page.textContent('body');
  console.log('Body text:', bodyText);

  // Get HTML content
  const html = await page.content();
  console.log('HTML length:', html.length);

  // Check if React root div exists and has content
  const rootDiv = await page.locator('#root');
  const rootHTML = await rootDiv.innerHTML();
  console.log('Root div HTML:', rootHTML);

  // Wait to see the page
  await page.waitForTimeout(5000);

  await browser.close();
})();
