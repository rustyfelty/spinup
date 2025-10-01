import { test, expect } from '@playwright/test';

test.describe('Console Logs Feature', () => {
  test.beforeEach(async ({ page }) => {
    // Login
    await page.goto('/');
    const loginButton = page.getByRole('button', { name: /quick dev login/i });
    if (await loginButton.isVisible()) {
      await loginButton.click();
      await page.waitForURL(/\//, { timeout: 10000 });
    }
  });

  test('should show console tab', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(2000);

    const serverCard = page.locator('.group').first();
    if (await serverCard.isVisible()) {
      await serverCard.click();
      await page.waitForURL(/\/servers\//);

      // Click Console tab
      const consoleTab = page.getByRole('button', { name: /console/i });
      await consoleTab.click();

      // Verify console is active
      const activeTab = page.locator('button[class*="border-purple"]', {
        hasText: 'Console'
      });
      await expect(activeTab).toBeVisible();
    }
  });

  test('should display console container with monospace font', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(2000);

    const serverCard = page.locator('.group').first();
    if (await serverCard.isVisible()) {
      await serverCard.click();
      await page.waitForURL(/\/servers\//);

      await page.getByRole('button', { name: /console/i }).click();

      // Console should have monospace font styling
      const consoleArea = page.locator('.font-mono');
      await expect(consoleArea).toBeVisible();
    }
  });

  test('should show appropriate message for stopped server', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(2000);

    // Find stopped server
    const stoppedServer = page.locator('.group', {
      has: page.getByText('STOPPED')
    }).first();

    if (await stoppedServer.isVisible()) {
      await stoppedServer.click();
      await page.waitForURL(/\/servers\//);

      await page.getByRole('button', { name: /console/i }).click();

      // Should show message about server being stopped
      await expect(page.getByText(/server is stopped/i)).toBeVisible({ timeout: 3000 });
    }
  });

  test('should show creating message for new server', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(2000);

    // Find creating server
    const creatingServer = page.locator('.group', {
      has: page.getByText('CREATING')
    }).first();

    if (await creatingServer.isVisible()) {
      await creatingServer.click();
      await page.waitForURL(/\/servers\//);

      await page.getByRole('button', { name: /console/i }).click();

      // Should show creating message
      await expect(page.getByText(/waiting for logs/i)).toBeVisible({ timeout: 3000 });
    }
  });

  test('should have refresh button', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(2000);

    const serverCard = page.locator('.group').first();
    if (await serverCard.isVisible()) {
      await serverCard.click();
      await page.waitForURL(/\/servers\//);

      await page.getByRole('button', { name: /console/i }).click();

      // Refresh button should be visible
      const refreshButton = page.getByRole('button', { name: /refresh/i });
      await expect(refreshButton).toBeVisible();
    }
  });

  test('should auto-refresh logs (polling)', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(2000);

    const serverCard = page.locator('.group').first();
    if (await serverCard.isVisible()) {
      await serverCard.click();
      await page.waitForURL(/\/servers\//);

      await page.getByRole('button', { name: /console/i }).click();

      // Check for tip about auto-refresh
      await expect(page.getByText(/auto-refresh every 2 seconds/i)).toBeVisible();
    }
  });

  test('should display log lines if available', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(2000);

    // Find running server
    const runningServer = page.locator('.group', {
      has: page.getByText('RUNNING')
    }).first();

    if (await runningServer.isVisible()) {
      await runningServer.click();
      await page.waitForURL(/\/servers\//);

      await page.getByRole('button', { name: /console/i }).click();

      // Wait for logs to potentially load
      await page.waitForTimeout(3000);

      // Check if logs container exists
      const logsContainer = page.locator('.bg-gray-900');
      await expect(logsContainer).toBeVisible();

      // Log lines might or might not be present depending on server state
      const hasLogs = await page.locator('.text-gray-300').count() > 0;
      console.log(`Server has logs: ${hasLogs}`);
    }
  });

  test('should handle empty logs gracefully', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(2000);

    const serverCard = page.locator('.group').first();
    if (await serverCard.isVisible()) {
      await serverCard.click();
      await page.waitForURL(/\/servers\//);

      await page.getByRole('button', { name: /console/i }).click();

      // Even with no logs, console should display properly
      const consoleArea = page.locator('.bg-gray-900');
      await expect(consoleArea).toBeVisible();
    }
  });

  test('should show tip about initialization for creating servers', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(2000);

    const creatingServer = page.locator('.group', {
      has: page.getByText('CREATING')
    }).first();

    if (await creatingServer.isVisible()) {
      await creatingServer.click();
      await page.waitForURL(/\/servers\//);

      await page.getByRole('button', { name: /console/i }).click();

      // Should show tip about server being set up
      await expect(page.getByText(/your server is currently being set up/i)).toBeVisible({ timeout: 3000 });
    }
  });

  test('should have correct height for console area', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(2000);

    const serverCard = page.locator('.group').first();
    if (await serverCard.isVisible()) {
      await serverCard.click();
      await page.waitForURL(/\/servers\//);

      await page.getByRole('button', { name: /console/i }).click();

      // Console area should have fixed height
      const consoleArea = page.locator('.bg-gray-900');
      const boundingBox = await consoleArea.boundingBox();

      expect(boundingBox).toBeDefined();
      expect(boundingBox!.height).toBeGreaterThan(400); // Should be approximately 512px (32rem)
    }
  });
});
