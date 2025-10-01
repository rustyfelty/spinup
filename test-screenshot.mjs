import { chromium } from 'playwright';

async function takeScreenshot() {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  try {
    console.log('Navigating to login page...');
    await page.goto('http://localhost:5173/login');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    console.log('Taking screenshot...');
    await page.screenshot({ path: 'login-page.png', fullPage: true });

    console.log('Page content:');
    const content = await page.content();
    console.log(content.substring(0, 500));

    console.log('\nLooking for buttons...');
    const buttons = await page.locator('button').all();
    console.log(`Found ${buttons.length} buttons`);

    for (let i = 0; i < buttons.length; i++) {
      const text = await buttons[i].innerText();
      console.log(`  Button ${i}: "${text}"`);
    }

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await page.waitForTimeout(2000);
    await browser.close();
  }
}

takeScreenshot();
