import { expect, test } from '@playwright/test';

test('students without classes can start practicing from the empty state on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const token = 'eyJhbGciOiJub25lIn0.eyJleHAiOjQxMDI0NDQ4MDB9.';
  await page.addInitScript(accessToken => {
    localStorage.setItem('token', accessToken);
    localStorage.setItem('userId', '10');
    localStorage.setItem('userRole', 'STUDENT');
    localStorage.setItem('userName', 'New student');
    localStorage.setItem('dashboardTheme', 'dark');
  }, token);
  await page.route('**/api/**', async route => {
    if (new URL(route.request().url()).pathname === '/api/auth/refresh') {
      return route.fulfill({ json: { accessToken: token, user: { id: 10, name: 'New student', role: 'STUDENT' } } });
    }
    return route.fulfill({ json: [] });
  });
  await page.goto('/dashboard/classes');
  await expect(page.getByRole('heading', { name: 'No classes yet' })).toBeVisible();
  await expect(page.getByText('Ask your teacher', { exact: false })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Create class', exact: true })).toHaveCount(0);
  const action = page.getByRole('button', { name: 'Explore practice tests' });
  await expect(action).toBeVisible();
  const bounds = await action.boundingBox();
  expect(bounds!.x).toBeGreaterThanOrEqual(0);
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(390);
  await page.screenshot({ path: '../tmp/classrooms-empty-dark-mobile.png' });
  await action.focus();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/dashboard\/practice-test$/);
});
