import { expect, test } from '@playwright/test';
import { apiJson, createClassWithStudent, createPublishedPracticeTest, loginThroughUi, registerUser } from './helpers';

test('student takes a test, saves, resumes, submits, and sees the result', async ({ page, request }) => {
  const teacher = await registerUser(request, 'TEACHER', 'test-teacher');
  const student = await registerUser(request, 'STUDENT', 'test-student');
  const classroom = await createClassWithStudent(request, teacher, student);
  const practiceTest = await createPublishedPracticeTest(request, teacher);
  const assignment = await apiJson<{ deliveries: Array<{ id: string }> }>(request, teacher, 'post', '/api/test-deliveries', {
    classIds: [classroom.id],
    testIds: [practiceTest.id],
    maxAttempts: 1,
    scorePolicy: 'FIRST',
  });
  const attemptUrl = `/test/${practiceTest.id}?deliveryId=${assignment.deliveries[0].id}`;

  await loginThroughUi(page, student);
  await page.goto(attemptUrl);
  const correctAnswer = page.getByRole('button', { pressed: false }).filter({ hasText: 'Option B' });
  await expect(correctAnswer).toBeVisible();
  await correctAnswer.click();
  await expect(correctAnswer).toHaveAttribute('aria-pressed', 'true');

  const saveResponse = page.waitForResponse(response => response.url().includes('/save-progress') && response.request().method() === 'POST');
  await page.getByRole('button', { name: /Save & Exit/i }).click();
  await expect((await saveResponse).ok()).toBeTruthy();
  await expect(page).toHaveURL(/\/dashboard\/practice-test$/);

  // Remove the browser fallback so the resumed answer must come from PostgreSQL.
  await page.evaluate(() => {
    Object.keys(localStorage)
      .filter(key => key.startsWith('answers_'))
      .forEach(key => localStorage.removeItem(key));
  });
  await page.goto(attemptUrl);
  const restoredAnswer = page.getByRole('button', { pressed: true }).filter({ hasText: 'Option B' });
  await expect(restoredAnswer).toBeVisible();

  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await page.getByRole('button', { name: 'Submit', exact: true }).click();

  await expect(page).toHaveURL(/\/dashboard\/score-report\/\d+$/);
  await expect(page.getByRole('heading', { name: 'Test Result Details' })).toBeVisible();
  await expect(page.getByText('1 of 1 correct')).toBeVisible();
});
