import { expect, test } from '@playwright/test';
import { apiJson, loginThroughUi, registerUser } from './helpers';

test('student overview surfaces saved goals and profile settings stay in sync', async ({ page, request }) => {
  const student = await registerUser(request, 'STUDENT', 'profile-student');
  const testDate = new Date(Date.now() + 60 * 86_400_000).toISOString();
  await apiJson(request, student, 'put', '/api/user-preferences/sat-test-date', { satTestDate: testDate });
  await apiJson(request, student, 'put', '/api/user-preferences/sat-score-goal', { currentScore: 1210, targetScore: 1450 });

  await loginThroughUi(page, student);
  const studySummary = page.getByRole('region', { name: 'Study summary' });
  await expect(studySummary.getByText('Today', { exact: true })).toBeVisible();
  await expect(studySummary.getByText('Next SAT', { exact: true })).toBeVisible();
  await expect(studySummary.getByText('Score Goal', { exact: true })).toBeVisible();
  await expect(studySummary.getByText('1210', { exact: true })).toBeVisible();
  await expect(studySummary.getByText('1450', { exact: true })).toBeVisible();
  await expect(page.getByText('This Week', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Next Step', { exact: true })).toHaveCount(0);

  await page.goto('/dashboard/profile');
  await expect(page.getByRole('heading', { name: 'Profile & settings' })).toBeVisible();
  await expect(page.getByText(student.email, { exact: true }).first()).toBeVisible();
  await expect(page.getByText('1210', { exact: true })).toBeVisible();
  await expect(page.getByText('1450', { exact: true })).toBeVisible();

  const updatedName = 'Updated Student Profile';
  await page.getByLabel('Display name').fill(updatedName);
  await page.getByRole('button', { name: 'Save profile' }).click();
  await expect(page.getByText(updatedName, { exact: true }).first()).toBeVisible();

  await page.getByRole('button', { name: 'Dark', exact: true }).click();
  await expect(page.locator('html')).toHaveClass(/dark/);
  await page.getByRole('button', { name: 'Light', exact: true }).click();
  await expect(page.locator('html')).not.toHaveClass(/dark/);
});
