import { defineConfig, devices } from '@playwright/test';

const useExternalServer = process.env.PLAYWRIGHT_EXTERNAL_SERVER === 'true';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: 'http://127.0.0.1:4173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: useExternalServer ? undefined : {
    command: 'node ./node_modules/vite/bin/vite.js --host 127.0.0.1 --port 4173',
    url: 'http://127.0.0.1:4173/auth',
    reuseExistingServer: !process.env.CI,
    env: {
      VITE_API_URL: 'http://127.0.0.1:5000',
      VITE_GOOGLE_CLIENT_ID: 'test-client-id.apps.googleusercontent.com',
    },
  },
});
