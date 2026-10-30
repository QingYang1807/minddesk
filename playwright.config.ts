import { defineConfig } from '@playwright/test'
export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 45000,
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL: process.env.MIND_DESK_URL || 'http://127.0.0.1:4319',
    viewport: { width: 1440, height: 1000 },
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  reporter: [['list'], ['html', { open: 'never' }]],
})
