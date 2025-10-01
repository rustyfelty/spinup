import { chromium } from 'playwright';

async function checkConsole() {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  const errors = [];
  const logs = [];

  page.on('console', msg => {
    const text = msg.text();
    if (msg.type() === 'error') {
      errors.push(text);
      console.log('❌ ERROR:', text);
    } else {
      logs.push(text);
    }
  });

  page.on('pageerror', error => {
    console.log('❌ PAGE ERROR:', error.message);
    errors.push(error.message);
  });

  try {
    console.log('Navigating to login page...');
    await page.goto('http://localhost:5173/login', { waitUntil: 'networkidle' });

    console.log('\nWaiting 5 seconds for page to load...');
    await page.waitForTimeout(5000);

    console.log(`\nFound ${errors.length} errors`);
    console.log(`Found ${logs.length} console logs`);

    if (logs.length > 0) {
      console.log('\nRecent logs:');
      logs.slice(-5).forEach(log => console.log('  ', log));
    }

  } catch (error) {
    console.error('Test error:', error.message);
  } finally {
    await browser.close();
  }
}

checkConsole();
