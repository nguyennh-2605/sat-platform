import { expect, test } from '@playwright/test';

const googleScript = `window.google = { accounts: { id: {
  initialize: options => { window.testGoogleInitializations = (window.testGoogleInitializations || 0) + 1; window.testGoogleCredential = options.callback; },
  renderButton: parent => { parent.replaceChildren(); const button = document.createElement('button'); button.textContent = 'Continue with Google'; button.onclick = () => window.testGoogleCredential({ credential: 'browser-test-credential' }); parent.appendChild(button); },
  cancel: () => {}, disableAutoSelect: () => {}
} } };`;

test.beforeEach(async ({ page }) => {
  await page.route('**/api/auth/refresh', route => route.fulfill({ status: 401, json: {} }));
  await page.route('https://accounts.google.com/gsi/client*', route => route.fulfill({ contentType: 'application/javascript', body: googleScript }));
});

test('uses one Google flow for sign-in and account creation without a password or role picker', async ({ page }) => {
  await page.goto('/auth?mode=register');
  await expect(page.getByRole('heading', { name: 'Welcome to Sonder SAT' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Continue with Google' })).toBeVisible();
  await expect(page.locator('input[type=password], input[type=email]')).toHaveCount(0);
  await expect(page.getByText('New accounts start as students.', { exact: false })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Teacher', exact: true })).toHaveCount(0);
});

test('shows a clear Google recovery state after session expiration', async ({ page }) => {
  await page.goto('/auth?reason=session-expired');
  await expect(page.getByRole('status').filter({ hasText: 'Your session has expired' })).toContainText('Sign in again to continue');
  await expect(page.getByRole('button', { name: 'Continue with Google' })).toBeVisible();
});

test('Google API failure stays on auth and allows retry without sending a role', async ({ page }) => {
  let calls = 0;
  await page.route('**/api/auth/google-login', async route => {
    expect(route.request().postDataJSON()).toEqual({ token: 'browser-test-credential' });
    calls += 1;
    await route.fulfill({ status: 503, json: { message: 'Google sign-in is temporarily unavailable.' } });
  });
  await page.goto('/auth');
  await page.getByRole('button', { name: 'Continue with Google' }).click();
  await expect(page.getByRole('alert')).toContainText('temporarily unavailable');
  await page.getByRole('button', { name: 'Continue with Google' }).click();
  await expect.poll(() => calls).toBe(2);
  await expect(page).toHaveURL(/\/auth$/);
});

test('blocked Google SDK shows loading and a recovery action', async ({ page }) => {
  await page.clock.install();
  await page.route('https://accounts.google.com/gsi/client*', route => route.abort());
  await page.goto('/auth');
  await expect(page.getByText('Loading Google sign-in…', { exact: true })).toBeVisible();
  await page.clock.fastForward(13000);
  await expect(page.getByText('Google sign-in could not load.', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'reload this page' })).toBeVisible();
});

test('resize and failed sign-in keep the same Google client and callback', async ({ page }) => {
  let calls = 0;
  await page.route('**/api/auth/google-login', route => {
    calls += 1;
    return route.fulfill({ status: 503, json: { message: 'Please try again shortly.' } });
  });
  await page.goto('/auth');
  await expect(page.getByRole('button', { name: 'Continue with Google' })).toBeVisible();
  const initializations = () => page.evaluate(() => (window as Window & { testGoogleInitializations?: number }).testGoogleInitializations);
  expect(await initializations()).toBe(1);
  await page.setViewportSize({ width: 320, height: 850 });
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBe(320);
  await page.getByRole('button', { name: 'Continue with Google' }).click();
  await expect(page.getByRole('alert')).toContainText('Please try again');
  await page.getByRole('button', { name: 'Continue with Google' }).click();
  await expect.poll(() => calls).toBe(2);
  expect(await initializations()).toBe(1);
});
