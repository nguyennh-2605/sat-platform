import { expect, test, type Page } from '@playwright/test';
import { expectViewportModal } from './helpers/modal-layout';

const token = 'eyJhbGciOiJub25lIn0.eyJleHAiOjQxMDI0NDQ4MDB9.';
const classCode = 'af820784-9a80-4b5e-bab9-b790e4e1e3c3';
const classroom = { id: classCode, name: 'SAT Math', color: '#2563EB', createdAt: new Date().toISOString(), teacher: { id: 2, name: 'Alex Teacher', email: 'teacher@example.test' }, studentCount: 1, canManage: false, dueInNext7DaysCount: 0, nextActivity: null, lastContentUpdateAt: null };

async function setup(page: Page, { width = 390, theme = 'dark', role = 'STUDENT', hasClasses = false, holdJoin = false, failLoad = false } = {}) {
  await page.setViewportSize({ width, height: 844 });
  await page.addInitScript(({ token, role, theme }) => {
    localStorage.setItem('token', token); localStorage.setItem('userId', '10'); localStorage.setItem('userRole', role);
    localStorage.setItem('userName', 'New student'); localStorage.setItem('dashboardTheme', theme);
  }, { token, role, theme });
  let joined = hasClasses;
  const requests: Array<{ code: string }> = [];
  let release = () => {};
  const pending = new Promise<void>(resolve => { release = resolve; });
  await page.route('**/api/**', async route => {
    const request = route.request(); const path = new URL(request.url()).pathname;
    if (path === '/api/auth/refresh') return route.fulfill({ json: { accessToken: token, user: { id: 10, name: 'New student', role } } });
    if (path === '/api/classes/join') {
      const body = request.postDataJSON(); requests.push(body);
      if (holdJoin) await pending;
      if (body.code.toLowerCase() !== classCode) return route.fulfill({ status: 404, json: { error: 'No class matches this code. Check the code with your teacher.' } });
      const alreadyJoined = joined; joined = true;
      return route.fulfill({ json: { classroom: { id: classroom.id, name: classroom.name }, alreadyJoined } });
    }
    if (path === '/api/classes') return failLoad ? route.fulfill({ status: 503, json: { error: 'Classes are temporarily unavailable.' } }) : route.fulfill({ json: joined ? [{ ...classroom, canManage: role !== 'STUDENT' }] : [] });
    if (path === `/api/classes/${classCode}`) return route.fulfill({ json: { ...classroom, teacher: { ...classroom.teacher, createdAt: new Date().toISOString() }, students: [{ id: 10, name: 'New student', email: 'student@example.test', createdAt: new Date().toISOString() }], assignments: [] } });
    return route.fulfill({ json: [] });
  });
  await page.goto('/dashboard/classes');
  return { requests, release: () => release() };
}

for (const [width, theme] of [[320, 'light'], [390, 'dark'], [1440, 'light']] as const) {
  test(`a student joins from the empty Classroom CTA at ${width}px in ${theme}`, async ({ page }) => {
    const state = await setup(page, { width, theme });
    await expect(page.getByRole('heading', { name: 'No classes yet' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Explore practice tests' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Create class', exact: true })).toHaveCount(0);
    const action = page.getByRole('button', { name: 'Join a class', exact: true });
    await expect(action).toBeVisible();
    await page.screenshot({ path: `../tmp/classrooms-empty-${width}-${theme}.png` });
    await action.focus(); await page.keyboard.press('Enter');
    const dialog = page.getByRole('dialog', { name: 'Join a class', exact: true });
    await expect(dialog).toBeVisible();
    await expect(page.getByLabel('Class code', { exact: true })).toBeFocused();
    expect(await dialog.evaluate(element => { const box = element.getBoundingClientRect(); return Math.abs(box.left + box.width / 2 - innerWidth / 2); })).toBeLessThan(1);
    expect(await dialog.evaluate(element => element.getBoundingClientRect().right <= innerWidth)).toBe(true);
    await page.screenshot({ path: `../tmp/classrooms-join-modal-${width}-${theme}.png` });
    await page.getByLabel('Class code', { exact: true }).fill(` ${classCode.toUpperCase()} `);
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(new RegExp(`/dashboard/class/${classCode}\\?tab=lessons$`));
    await expect(page.getByRole('heading', { name: 'SAT Math', exact: true })).toBeVisible();
    expect(state.requests).toEqual([{ code: classCode.toUpperCase() }]);
    await page.goto('/dashboard/classes');
    await expect(page.getByRole('button', { name: 'Open SAT Math', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'No classes yet' })).toHaveCount(0);
  });
}

test('an invalid class code stays in the dialog and the student can correct it', async ({ page }) => {
  await setup(page);
  await page.getByRole('button', { name: 'Join a class', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Join class', exact: true })).toBeDisabled();
  await page.getByLabel('Class code', { exact: true }).fill('wrong-code');
  await page.getByRole('button', { name: 'Join class', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('No class matches this code');
  await expect(page.getByLabel('Class code', { exact: true })).toHaveValue('wrong-code');
  await expect(page.getByRole('heading', { name: 'No classes yet' })).toBeVisible();
  await page.getByLabel('Class code', { exact: true }).fill(classCode);
  await page.getByRole('button', { name: 'Join class', exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/dashboard/class/${classCode}`));
});

test('students with a class can join another or reopen an existing membership', async ({ page }) => {
  const state = await setup(page, { hasClasses: true });
  await expect(page.getByRole('button', { name: 'Open SAT Math', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Join a class', exact: true }).click();
  await page.getByLabel('Class code', { exact: true }).fill(classCode);
  await page.getByRole('button', { name: 'Join class', exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/dashboard/class/${classCode}`));
  await expect(page.getByText('You are already in SAT Math.', { exact: true })).toBeVisible();
  expect(state.requests).toHaveLength(1);
});

test('joining is protected against duplicate submits and dismissal until the response arrives', async ({ page }) => {
  const state = await setup(page, { holdJoin: true });
  await page.getByRole('button', { name: 'Join a class', exact: true }).click();
  await page.getByLabel('Class code', { exact: true }).fill(classCode);
  await page.getByRole('button', { name: 'Join class', exact: true }).click();
  await expect.poll(() => state.requests.length).toBe(1);
  await expect(page.getByLabel('Class code', { exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Joining…', exact: true })).toBeDisabled();
  await page.keyboard.press('Escape'); await page.mouse.click(4, 100);
  await expect(page.getByRole('dialog')).toBeVisible();
  state.release();
  await expect(page).toHaveURL(new RegExp(`/dashboard/class/${classCode}`));
  expect(state.requests).toHaveLength(1);
});

test('join dialogs dismiss outside or with Escape and restore focus', async ({ page }) => {
  await setup(page, { width: 1440, theme: 'light' });
  const trigger = page.getByRole('button', { name: 'Join a class', exact: true });
  await trigger.click();
  await expect(page.getByLabel('Class code', { exact: true })).toBeFocused();
  await page.mouse.click(4, 100);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(trigger).toBeFocused();
  await trigger.click(); await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('teachers retain Create class and do not get the student join action', async ({ page }) => {
  await setup(page, { role: 'TEACHER', width: 1440 });
  const trigger = page.getByRole('button', { name: 'Create class', exact: true });
  await expect(trigger).toBeVisible();
  await expect(page.getByRole('button', { name: 'Join a class', exact: true })).toHaveCount(0);
  await trigger.click();
  const dialog = page.getByRole('dialog', { name: 'Create class', exact: true });
  await expectViewportModal(dialog);
  await page.setViewportSize({ width: 320, height: 640 });
  await expectViewportModal(dialog);
  await page.mouse.click(4, 200);
  await expect(dialog).toHaveCount(0);
  await expect(trigger).toBeFocused();
});

test('a class-load error remains a retry state instead of claiming the student has no classes', async ({ page }) => {
  await setup(page, { failLoad: true });
  await expect(page.getByRole('heading', { name: 'Classes could not be loaded' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Try again', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Join a class', exact: true })).toHaveCount(0);
});
