import { test, expect } from '@playwright/test';

test.describe('Authentication Flow', () => {
  test('should show login page when not authenticated', async ({ page }) => {
    await page.goto('/');

    // Should show welcome message
    await expect(page.getByText('Welcome to SpinUp')).toBeVisible();
    await expect(page.getByText('Please log in to continue')).toBeVisible();
  });

  test('should login with dev mode', async ({ page, context }) => {
    await page.goto('/');

    // Click dev login button
    await page.getByRole('button', { name: /quick dev login/i }).click();

    // Wait for redirect to dashboard
    await page.waitForURL(/\//, { timeout: 10000 });

    // Should show SpinUp header
    await expect(page.getByText('SpinUp')).toBeVisible();

    // Verify cookie was set
    const cookies = await context.cookies();
    const sessionCookie = cookies.find(c => c.name === 'spinup_sess');
    expect(sessionCookie).toBeDefined();
  });

  test('should show dashboard after successful login', async ({ page }) => {
    // Login first
    await page.goto('/');
    await page.getByRole('button', { name: /quick dev login/i }).click();
    await page.waitForURL(/\//, { timeout: 10000 });

    // Should see dashboard elements
    await expect(page.getByText('Total Servers')).toBeVisible();
    await expect(page.getByText('Running')).toBeVisible();
    await expect(page.getByText('Stopped')).toBeVisible();
    await expect(page.getByText('Issues')).toBeVisible();
  });

  test('should logout successfully', async ({ page, context }) => {
    // Login first
    await page.goto('/');
    await page.getByRole('button', { name: /quick dev login/i }).click();
    await page.waitForURL(/\//, { timeout: 10000 });

    // Logout via API (no UI button visible in current implementation)
    await page.evaluate(() => {
      return fetch('/api/sso/logout', {
        method: 'POST',
        credentials: 'include'
      });
    });

    // Reload page
    await page.reload();

    // Should be back to login page
    await expect(page.getByText('Welcome to SpinUp')).toBeVisible();
  });

  test('should persist session on page reload', async ({ page }) => {
    // Login
    await page.goto('/');
    await page.getByRole('button', { name: /quick dev login/i }).click();
    await page.waitForURL(/\//, { timeout: 10000 });

    // Reload page
    await page.reload();

    // Should still be logged in
    await expect(page.getByText('Total Servers')).toBeVisible();
  });
});
