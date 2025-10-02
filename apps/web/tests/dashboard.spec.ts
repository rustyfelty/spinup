import { test, expect } from '@playwright/test'

test('dashboard loads after login', async ({ page }) => {
  // Navigate to login
  await page.goto('http://localhost:5173')

  // Log in
  await page.fill('input[type="email"]', 'test@example.com')
  await page.click('button:has-text("Sign in with Email")')

  // Wait for redirect to dashboard
  await page.waitForURL('**/dashboard', { timeout: 5000 })

  // Check if dashboard is visible
  await expect(page.locator('text=SpinUp Dashboard')).toBeVisible({ timeout: 5000 })

  // Take screenshot
  await page.screenshot({ path: '/tmp/dashboard.png', fullPage: true })

  console.log('Dashboard loaded successfully')
})
