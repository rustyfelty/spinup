import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  console.log('=== Testing SpinUp Authentication & Server Creation ===\n');

  try {
    // Step 1: Navigate to site
    console.log('1. Navigating to http://localhost:5173');
    await page.goto('http://localhost:5173');
    await page.waitForTimeout(2000);

    // Step 2: Try dev login
    console.log('2. Attempting dev login...');

    // Make dev login API call
    const loginResponse = await page.evaluate(async () => {
      const response = await fetch('http://localhost:8080/api/sso/dev/login', {
        method: 'POST',
        credentials: 'include'
      });
      return response.json();
    });

    console.log('   Login response:', loginResponse);

    if (loginResponse.success) {
      console.log('   ✅ Dev login successful');
      console.log(`   User: ${loginResponse.user.displayName}`);
      console.log(`   Org: ${loginResponse.org.name} (${loginResponse.org.id})`);
    }

    // Step 3: Refresh page to pick up session
    console.log('3. Refreshing page to load dashboard...');
    await page.reload();
    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'test-dashboard.png', fullPage: true });
    console.log('   Screenshot saved: test-dashboard.png');

    // Step 4: Create a Minecraft server
    console.log('4. Creating Minecraft server via API...');
    const createResponse = await page.evaluate(async (orgId) => {
      const response = await fetch('http://localhost:8080/api/servers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          orgId: orgId,
          name: 'Test Minecraft Server',
          gameKey: 'minecraft-java'
        })
      });
      const data = await response.json();
      return { status: response.status, data };
    }, loginResponse.org.id);

    console.log(`   Create server response (${createResponse.status}):`, createResponse.data);

    if (createResponse.status === 201) {
      console.log('   ✅ Server creation initiated');
      const serverId = createResponse.data.id;
      console.log(`   Server ID: ${serverId}`);

      // Step 5: Navigate to server detail page
      console.log('5. Navigating to server detail page...');
      await page.goto(`http://localhost:5173/server/${serverId}`);
      await page.waitForTimeout(3000);
      await page.screenshot({ path: 'test-server-detail.png', fullPage: true });
      console.log('   Screenshot saved: test-server-detail.png');

      // Step 6: Monitor server status
      console.log('6. Monitoring server creation progress...');
      for (let i = 0; i < 10; i++) {
        await page.waitForTimeout(2000);
        const serverStatus = await page.evaluate(async (sid) => {
          const response = await fetch(`http://localhost:8080/api/servers/${sid}`, {
            credentials: 'include'
          });
          const data = await response.json();
          return data.status;
        }, serverId);

        console.log(`   [${i + 1}/10] Status: ${serverStatus}`);

        if (serverStatus === 'STOPPED' || serverStatus === 'RUNNING') {
          console.log('   ✅ Server created successfully!');
          break;
        }
        if (serverStatus === 'ERROR') {
          console.log('   ❌ Server creation failed');
          break;
        }
      }
    } else {
      console.log('   ❌ Server creation failed');
      if (createResponse.status === 401) {
        console.log('   Reason: Authentication required (this is expected with new auth middleware)');
      }
    }

    console.log('\n=== Test Complete ===');

  } catch (error) {
    console.error('Error during test:', error);
  } finally {
    await page.waitForTimeout(2000);
    await browser.close();
  }
})();
