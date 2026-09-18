import { expect, test } from '@playwright/test';
import { apiJson, loginThroughUi, registerUser, uniqueName } from './helpers';

const structuredQuestion = `=== MODULE 1 ===

QUESTION 1
Domain: Information and Ideas
Skill: Inferences

[TEXT]
Bird populations declined after a construction project began.

Which conclusion is best supported by the text?
A. Bird populations increased.
B. Construction may be related to the decline.
C. The project was cancelled.
D. Birds moved to another planet.
Answer: B
Explanation: The text supports a cautious inference.`;

test('teacher imports and previews a test, saves a draft, then publishes it', async ({ page, request }) => {
  const teacher = await registerUser(request, 'TEACHER', 'authoring-teacher');
  const title = uniqueName('E2E Imported Test');

  await loginThroughUi(page, teacher);
  await page.goto('/dashboard/practice-test/create');
  await page.getByLabel('Test name').fill(title);
  await page.getByLabel('Duration').fill('10');
  await page.getByRole('tab', { name: 'Import questions' }).click();
  await page.getByLabel('Structured test content').fill(structuredQuestion);
  await page.getByRole('button', { name: 'Update preview' }).click();
  await expect(page.getByText('1 questions')).toBeVisible();
  await expect(page.getByText('0 errors')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Question preview' })).toBeVisible();
  await page.getByRole('button', { name: /Continue to review/ }).click();

  const createResponsePromise = page.waitForResponse(response => response.url().endsWith('/api/tests/create') && response.request().method() === 'POST');
  await page.getByRole('button', { name: 'Save draft' }).click();
  const createResponse = await createResponsePromise;
  expect(createResponse.ok(), await createResponse.text()).toBeTruthy();
  const created = await createResponse.json() as { id: number };
  await expect(page).toHaveURL(/\/dashboard\/practice-test$/);

  const draft = await apiJson<{ id: number; status: string }>(request, teacher, 'get', `/api/tests/${created.id}/edit`);
  expect(draft.status).toBe('DRAFT');

  await page.goto(`/dashboard/practice-test/create?edit=${created.id}`);
  await expect(page.getByRole('heading', { name: 'Edit Test' })).toBeVisible();
  await expect(page.getByLabel('Structured test content')).toHaveValue(/Which conclusion is best supported/);
  await page.getByRole('button', { name: /Continue to review/ }).click();
  await expect(page.getByRole('button', { name: 'Publish test' })).toBeVisible();
  const publishResponsePromise = page.waitForResponse(response => response.url().endsWith(`/api/tests/${created.id}`) && response.request().method() === 'PUT');
  await page.getByRole('button', { name: 'Publish test' }).click();
  expect((await publishResponsePromise).ok()).toBeTruthy();
  await expect(page).toHaveURL(/\/dashboard\/practice-test$/);

  const published = await apiJson<{ id: number; status: string }>(request, teacher, 'get', `/api/tests/${created.id}/edit`);
  expect(published.status).toBe('PUBLISHED');
});
