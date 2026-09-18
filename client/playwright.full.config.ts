import { defineConfig, devices } from '@playwright/test';

const databaseUrl = process.env.E2E_DATABASE_URL || process.env.DATABASE_URL || '';
const apiUrl = process.env.E2E_API_URL || 'http://127.0.0.1:5000';
const appUrl = process.env.E2E_APP_URL || 'http://127.0.0.1:4173';
const appPort = new URL(appUrl).port || '4173';

const assertTestDatabase = (value: string) => {
  if (!value) throw new Error('E2E_DATABASE_URL is required for full-stack browser tests.');
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error('E2E_DATABASE_URL must be a valid PostgreSQL URL.');
  }
  const databaseName = decodeURIComponent(parsed.pathname.replace(/^\//, ''));
  if (!/test/i.test(databaseName)) {
    throw new Error('Full-stack browser tests refuse to use a database whose name does not contain "test".');
  }
};

assertTestDatabase(databaseUrl);

export default defineConfig({
  testDir: './e2e/full-stack',
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: appUrl,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: [
    {
      command: 'npm --prefix ../server start',
      url: `${apiUrl}/ready`,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      env: {
        DATABASE_URL: databaseUrl,
        TEST_DATABASE_URL: databaseUrl,
        JWT_SECRET: process.env.JWT_SECRET || 'e2e-only-secret-with-sufficient-entropy-do-not-use-in-production',
        NODE_ENV: 'test',
        CORS_ORIGINS: appUrl,
        PORT: new URL(apiUrl).port || '5000',
        LOG_LEVEL: 'silent',
      },
    },
    {
      command: `node ./node_modules/vite/bin/vite.js --host 127.0.0.1 --port ${appPort}`,
      url: `${appUrl}/auth`,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      env: {
        VITE_API_URL: apiUrl,
        VITE_GOOGLE_CLIENT_ID: 'test-client-id.apps.googleusercontent.com',
      },
    },
  ],
});
