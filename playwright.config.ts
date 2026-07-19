import { defineConfig, devices } from '@playwright/test'

// Starts BOTH the dev stub server (:8787) and the Vite dev server (:5173), then
// runs the smoke suite against the app. In CI, servers are started fresh; locally
// an already-running instance is reused.
export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: 'http://127.0.0.1:5173',
    trace: 'on-first-retry',
  },
  webServer: [
    {
      command: 'node dev/stub-server/server.mjs',
      port: 8787,
      reuseExistingServer: !process.env.CI,
      stdout: 'ignore',
    },
    {
      command: 'pnpm dev',
      port: 5173,
      reuseExistingServer: !process.env.CI,
      stdout: 'pipe',
    },
  ],
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
})
