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

test('operate: create a world, then mint a token and time-skip a campaign', async ({ page }) => {
  await connect(page)

  // Create a world → it appears in the browser.
  await page.getByTestId('new-world').click()
  await page.getByTestId('world-name').fill('Testrealm')
  await page.getByTestId('world-create-submit').click()
  await expect(page.getByTestId('world-create-feedback')).toContainText('created')
  await expect(page.getByText('Testrealm', { exact: true })).toBeVisible()

  // Campaign management ops on an existing campaign.
  await page.goto('/campaigns/cmp_ashfall/manage')
  await expect(page.getByTestId('manage-panel')).toBeVisible()

  await page.getByTestId('mint-participant').fill('player-9')
  await page.getByTestId('mint-submit').click()
  await expect(page.getByTestId('mint-feedback')).toContainText('token')

  await page.getByTestId('timeskip-submit').click()
  await expect(page.getByTestId('timeskip-feedback')).toContainText('done')
})

test('play: an intent streams a beat; table-talk stays on the non-canon lane', async ({ page }) => {
  await connect(page)
  await page.goto('/campaigns/cmp_ashfall/play')

  await expect(page.getByTestId('play-panel')).toBeVisible()
  // The socket opens → the intent box enables.
  await expect(page.getByTestId('intent-input')).toBeEnabled({ timeout: 10_000 })

  // Send an intent → a beat entry appears and its narration streams to completion.
  await page.getByTestId('intent-input').fill('look around the tavern')
  await page.getByTestId('intent-send').click()
  await expect(page.getByTestId('beat-entry')).toBeVisible()
  await expect(page.getByText(/Shadows lengthen/)).toBeVisible({ timeout: 10_000 })

  // Table-talk lands on the non-canon lane (a talk entry), never as a beat.
  await page.getByTestId('talk-input').fill('meta: brb')
  await page.getByTestId('talk-send').click()
  const talk = page.getByTestId('talk-entry')
  await expect(talk).toBeVisible()
  await expect(talk).toContainText('meta: brb')
})
