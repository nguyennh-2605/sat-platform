import { expect, test } from '@playwright/test';

test('switches between sign-in and registration without stale form state', async ({ page }) => {
  await page.goto('/auth');

  await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
  await page.getByLabel('Email').fill('student@example.test');
  await page.getByRole('button', { name: 'Create an account' }).click();

  await expect(page.getByRole('heading', { name: 'Create your account' })).toBeVisible();
  await expect(page.getByLabel('Full name')).toBeVisible();
  await expect(page.getByLabel('Email')).toHaveValue('');
  await expect(page.getByRole('button', { name: 'Student' })).toHaveAttribute('aria-pressed', 'true');
});

test('shows a clear recovery state after session expiration', async ({ page }) => {
  await page.goto('/auth?reason=session-expired');

  await expect(page.getByRole('status').filter({ hasText: 'Your session has expired' })).toContainText('Sign in again to continue');
  await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeVisible();
});
