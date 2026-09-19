import { expect, test } from '@playwright/test';
import { createClassWithStudent, loginThroughUi, registerUser, uniqueName } from './helpers';

test('teacher publishes an assignment and the student sees and submits it', async ({ browser, request }) => {
  const teacher = await registerUser(request, 'TEACHER', 'assignment-teacher');
  const student = await registerUser(request, 'STUDENT', 'assignment-student');
  const classroom = await createClassWithStudent(request, teacher, student);
  const assignmentTitle = uniqueName('E2E Reading Reflection');
  const responseText = 'My evidence-based response for the pilot golden path.';

  const teacherContext = await browser.newContext();
  const teacherPage = await teacherContext.newPage();
  await loginThroughUi(teacherPage, teacher);
  await teacherPage.goto(`/dashboard/class/${classroom.id}?tab=activities`);
  // Wait for the empty state so the last "Add activity" is the shortcut, not the toolbar menu.
  await expect(teacherPage.getByRole('heading', { name: 'No activities yet' })).toBeVisible();
  await teacherPage.getByRole('button', { name: 'Add activity' }).last().click();
  await expect(teacherPage.getByRole('heading', { name: 'Add assignment' })).toBeVisible();
  await teacherPage.getByLabel('Title').fill(assignmentTitle);
  await teacherPage.getByLabel('Instructions').fill('Read the prompt and write a concise response.');
  await teacherPage.getByRole('button', { name: 'Publish assignment' }).click();
  await expect(teacherPage.getByText(assignmentTitle).first()).toBeVisible();
  await teacherContext.close();

  const studentContext = await browser.newContext();
  const studentPage = await studentContext.newPage();
  await loginThroughUi(studentPage, student);
  await studentPage.goto(`/dashboard/class/${classroom.id}?tab=activities`);
  await expect(studentPage.getByText(assignmentTitle).first()).toBeVisible();
  await studentPage.getByText(assignmentTitle).first().click();
  await expect(studentPage).toHaveURL(new RegExp(`/dashboard/class/${classroom.id}/assignment/`));
  await studentPage.getByPlaceholder('Write your response…').fill(responseText);
  await expect(studentPage.getByText('Saved', { exact: true })).toBeVisible();
  await studentPage.getByRole('button', { name: 'Submit assignment' }).click();
  await expect(studentPage.getByText('Submitted', { exact: true }).first()).toBeVisible();
  await expect(studentPage.getByText(responseText)).toBeVisible();
  await studentContext.close();
});
