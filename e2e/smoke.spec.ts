import { expect, test } from '@playwright/test'

const STUB_URL = 'http://127.0.0.1:8787'

test('connect to a server and see a green health badge', async ({ page }) => {
  await page.goto('/')

  await page.getByTestId('server-url').fill(STUB_URL)
  await page.getByTestId('token').fill('dev-token')
  await page.getByTestId('connect').click()

  const badge = page.getByTestId('health-badge')
  await expect(badge).toBeVisible()
  await expect(badge).toHaveAttribute('data-status', 'ok', { timeout: 10_000 })
  // The stub advertises a version, which the badge surfaces.
  await expect(badge).toContainText('0.2.0-stub')
})

test('disconnect returns to the connection screen', async ({ page }) => {
  await page.goto('/')
  await page.getByTestId('server-url').fill(STUB_URL)
  await page.getByTestId('connect').click()
  await expect(page.getByTestId('health-badge')).toHaveAttribute('data-status', 'ok', {
    timeout: 10_000,
  })

  await page.getByTestId('disconnect').click()
  await expect(page.getByTestId('connect')).toBeVisible()
})
