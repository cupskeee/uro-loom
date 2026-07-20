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

  // A world card now opens the world workspace (Timeline); campaigns are one link away.
  await expect(page.getByTestId('world-detail')).toBeVisible()
  await page.getByRole('link', { name: /campaigns/ }).click()
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

test('timeline (M4): branches + commit log render; fork + marker (operator) succeed', async ({
  page,
}) => {
  await connect(page)

  // World card → the world workspace, Timeline tab by default.
  await page.getByRole('link', { name: /Ashfall/ }).click()
  await expect(page.getByTestId('world-detail')).toBeVisible()
  await expect(page.getByTestId('timeline-panel')).toBeVisible()

  // The branch tree + markers render.
  await expect(page.getByTestId('branch-row').filter({ hasText: 'main' })).toBeVisible()
  await expect(page.getByText('what-if-vel-stands')).toBeVisible()
  await expect(page.getByTestId('markers')).toContainText('pre-strike')

  // The commit log for the selected (main) branch, head→genesis.
  await expect(
    page.getByTestId('log-row').filter({ hasText: 'the meteor strikes Vel' }),
  ).toBeVisible()

  // Fork from a marker (dev-token is an operator → success).
  await page.getByTestId('toggle-fork').click()
  await page.getByTestId('fork-from').fill('pre-strike')
  await page.getByTestId('fork-name').fill('what-if-e2e')
  await page.getByTestId('fork-submit').click()
  await expect(page.getByTestId('fork-feedback')).toContainText('forked')

  // The new branch appears in the tree (queries invalidated).
  await expect(page.getByTestId('branch-row').filter({ hasText: 'what-if-e2e' })).toBeVisible()

  // Add a marker on main's head.
  await page.getByTestId('toggle-marker').click()
  await page.getByTestId('marker-name').fill('e2e-mark')
  await page.getByTestId('marker-submit').click()
  await expect(page.getByTestId('marker-feedback')).toContainText('marked at')
})

test('events (M4): operator inspects the raw log, filters, and a commit', async ({ page }) => {
  await connect(page) // dev-token → operator

  await page.goto('/worlds/wld_ashfall/events')
  await expect(page.getByTestId('events-panel')).toBeVisible()

  // The raw log renders (operator-only) — a ClaimRecorded event is present.
  await expect(page.getByTestId('event-row').filter({ hasText: 'ClaimRecorded' })).toBeVisible()

  // Filter to ClaimRecorded and confirm the omniscient truth value is in its payload.
  await page.getByTestId('ev-type').fill('ClaimRecorded')
  await page.getByTestId('ev-search').click()
  const claim = page.getByTestId('event-row').filter({ hasText: 'ClaimRecorded' })
  await expect(claim).toBeVisible()
  await claim.getByText('payload').click()
  await expect(claim.getByText(/"truth": "true"/)).toBeVisible()

  // Inspect a commit by id → its events show.
  await page.getByTestId('commit-input').fill('cmt_a3')
  await page.getByTestId('commit-lookup').click()
  await expect(page.getByTestId('commit-detail')).toContainText('cmt_a3')
  await expect(page.getByTestId('commit-detail').getByText('ClaimRecorded')).toBeVisible()
})

test('events (M4): the timeline "inspect →" deep-links into a commit', async ({ page }) => {
  await connect(page)
  await page.getByRole('link', { name: /Ashfall/ }).click()
  await expect(page.getByTestId('timeline-panel')).toBeVisible()

  // Click "inspect →" on a log row → lands on the Events tab with that commit selected.
  await page
    .getByTestId('log-row')
    .filter({ hasText: 'a warning is spoken' })
    .getByTestId('inspect-commit')
    .click()
  await expect(page.getByTestId('events-panel')).toBeVisible()
  await expect(page.getByTestId('commit-detail')).toContainText('cmt_a3')
})

test('events (M4): a player token gets the operator-required panel, not the log (D-45)', async ({
  page,
}) => {
  await page.goto('/')
  await page.getByTestId('server-url').fill(STUB_URL)
  await page.getByTestId('token').fill('player-1') // the stub treats player* as a non-operator
  await page.getByTestId('connect').click()
  await expect(page.getByTestId('health-badge')).toHaveAttribute('data-status', 'ok', {
    timeout: 10_000,
  })

  await page.goto('/worlds/wld_ashfall/events')
  await expect(page.getByTestId('operator-required')).toBeVisible()
  await expect(page.getByTestId('event-row')).toHaveCount(0)
})

test('epistemics (M4): operator sees claims (truth) + the belief fan-out', async ({ page }) => {
  await connect(page) // dev-token → operator
  await page.goto('/campaigns/cmp_ashfall/epistemics')
  await expect(page.getByTestId('epistemics-panel')).toBeVisible()

  // A claim with its ground-truth value.
  const meteor = page.getByTestId('claim-card').filter({ hasText: 'the meteor will fall on Vel' })
  await expect(meteor).toBeVisible()
  await expect(meteor).toContainText('truth: true')

  // Its belief fan-out: two believers, one with a propagation chain.
  await expect(meteor.getByTestId('believer')).toHaveCount(2)
  await expect(meteor).toContainText('learned from')
  await expect(meteor).toContainText('actor_kestrel')

  // A false rumor nobody believes yet.
  const traitor = page.getByTestId('claim-card').filter({ hasText: 'betrayed the Gray Watch' })
  await expect(traitor).toContainText('truth: false')
  await expect(traitor).toContainText('Not yet propagated')
})

test('epistemics (M4): a player token gets the operator-required panel (D-46)', async ({
  page,
}) => {
  await page.goto('/')
  await page.getByTestId('server-url').fill(STUB_URL)
  await page.getByTestId('token').fill('player-1')
  await page.getByTestId('connect').click()
  await expect(page.getByTestId('health-badge')).toHaveAttribute('data-status', 'ok', {
    timeout: 10_000,
  })

  await page.goto('/campaigns/cmp_ashfall/epistemics')
  await expect(page.getByTestId('operator-required')).toBeVisible()
  await expect(page.getByTestId('claim-card')).toHaveCount(0)
})

test('preview (M4): consistency metric + a dry-run that commits nothing', async ({ page }) => {
  await connect(page)
  await page.goto('/campaigns/cmp_ashfall/preview')
  await expect(page.getByTestId('preview-panel')).toBeVisible()

  // The consistency proxy renders a ratio.
  await expect(page.getByTestId('consistency-card')).toContainText('92%')
  await expect(page.getByTestId('consistency-card')).toContainText('11 / 12')

  // Dry-run an intent → the would-be events appear, and it says nothing was committed.
  await page.getByTestId('dryrun-intent').fill('I challenge the warlord')
  await page.getByTestId('dryrun-submit').click()
  await expect(page.getByTestId('dryrun-feedback')).toContainText('nothing committed')
  const events = page.getByTestId('dryrun-events')
  await expect(events.getByText('BeatResolved')).toBeVisible()
  await expect(events.getByText('ClaimRecorded')).toBeVisible()
})

const PACK = { name: 'pack.zip', mimeType: 'application/zip', buffer: Buffer.from('dummy-pack') }

test('authoring (M5): operator uploads a pack → validate, backfill, probe', async ({ page }) => {
  await connect(page) // dev-token → operator
  await page.getByRole('link', { name: 'Authoring' }).click()
  await expect(page.getByTestId('authoring-page')).toBeVisible()

  await page.getByTestId('pack-file').setInputFiles(PACK)

  // Validate (any-authed) → the sufficiency grade + a conflict gap.
  await page.getByTestId('validate-run').click()
  await expect(page.getByTestId('validate-result')).toContainText('thin')
  await expect(page.getByTestId('validate-result')).toContainText('GAP')

  // Backfill (operator) → before→after grade + an ai_backfill seed.
  await page.getByTestId('backfill-run').click()
  await expect(page.getByTestId('backfill-result')).toContainText('runnable')
  await expect(page.getByTestId('backfill-result')).toContainText('ai_backfill')

  // Probe (operator) → the capability report (warn-not-fail).
  await page.getByTestId('probe-run').click()
  await expect(page.getByTestId('probe-result')).toContainText('structured_output')
  await expect(page.getByTestId('probe-result')).toContainText('warn')
})

test('authoring (M5): a player can validate but backfill needs an operator token', async ({
  page,
}) => {
  await page.goto('/')
  await page.getByTestId('server-url').fill(STUB_URL)
  await page.getByTestId('token').fill('player-1')
  await page.getByTestId('connect').click()
  await expect(page.getByTestId('health-badge')).toHaveAttribute('data-status', 'ok', {
    timeout: 10_000,
  })

  await page.goto('/authoring')
  await page.getByTestId('pack-file').setInputFiles(PACK)

  // Validate works for a player (parse-only, any-authed).
  await page.getByTestId('validate-run').click()
  await expect(page.getByTestId('validate-result')).toContainText('thin')

  // Backfill is operator-only → the feedback shows the admin-token hint (not the result).
  await page.getByTestId('backfill-run').click()
  await expect(page.getByTestId('backfill-feedback')).toContainText('Operator token required')
})
