import { expect, test } from '@playwright/test'

const STUB_URL = 'http://127.0.0.1:8787'

async function connect(page: import('@playwright/test').Page) {
  await page.goto('/')
  await page.getByTestId('server-url').fill(STUB_URL)
  await page.getByTestId('token').fill('dev-token')
  await page.getByTestId('connect').click()
  await expect(page.getByTestId('health-badge')).toHaveAttribute('data-status', 'ok', {
    timeout: 10_000,
  })
}

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

test('observe: browse worlds → campaign → roster / state / chronicle', async ({ page }) => {
  await connect(page)

  // Lands on the world browser.
  await expect(page.getByTestId('worlds-page')).toBeVisible()
  await page.getByRole('link', { name: /Ashfall/ }).click()

  // Filtered campaigns for that world.
  await expect(page.getByTestId('campaigns-page')).toBeVisible()
  await page.getByTestId('campaign-row').filter({ hasText: 'cmp_ashfall' }).click()

  // Campaign detail — Overview by default.
  await expect(page.getByTestId('campaign-detail')).toBeVisible()

  // State tab shows the projected actors (exact: the Overview panel also links "State — …").
  await page.getByRole('link', { name: 'State', exact: true }).click()
  await expect(page.getByTestId('state-panel')).toBeVisible()
  await expect(page.getByText('Kestrel', { exact: true })).toBeVisible()
  await expect(page.getByText('Vel', { exact: true })).toBeVisible()

  // Chronicle tab shows the narrated beats (oldest-first).
  await page.getByRole('link', { name: 'Chronicle', exact: true }).click()
  await expect(page.getByTestId('chronicle-panel')).toBeVisible()
  await expect(page.getByText(/Broken Spindle/)).toBeVisible()

  // Roster tab lists the bound PC actor id.
  await page.getByRole('link', { name: 'Roster', exact: true }).click()
  await expect(page.getByTestId('roster-panel')).toBeVisible()
  await expect(page.getByText('actor_wren')).toBeVisible()
})
