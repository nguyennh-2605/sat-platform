import { expect, test, type Page } from '@playwright/test';

const token = 'eyJhbGciOiJub25lIn0.eyJleHAiOjQxMDI0NDQ4MDB9.';
const applicant = { id: 10, name: 'SAT teacher applicant', email: 'teacher@example.test', role: 'STUDENT' };
const request = { id: 'request-1', reason: 'I teach SAT preparation at a school.', status: 'PENDING', reviewNote: null, createdAt: '2026-10-07T00:00:00Z', updatedAt: '2026-10-07T00:00:00Z', reviewedAt: null, user: applicant };

async function session(page: Page, role: 'STUDENT' | 'ADMIN') {
  await page.route('**/api/**', route => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/api/auth/refresh') return route.fulfill({ json: { accessToken: token, user: { id: role === 'ADMIN' ? 20 : 10, name: role, role } } });
    if (path === '/api/account/profile') return route.fulfill({ json: { ...applicant, role, avatar: null, loginMethod: 'GOOGLE' } });
    if (path === '/api/user-preferences/sat-test-date') return route.fulfill({ json: { satTestDate: null } });
    if (path === '/api/user-preferences/sat-score-goal') return route.fulfill({ json: { currentScore: null, targetScore: null } });
    if (path === '/api/study-sessions/active') return route.fulfill({ json: { session: null } });
    return route.fulfill({ json: [] });
  });
}

test('student submits once and stays a student while the request is pending', async ({ page }) => {
  await session(page, 'STUDENT');
  let saved: typeof request | null = null;
  let posts = 0;
  await page.route('**/api/account/teacher-access', route => {
    if (route.request().method() === 'POST') { posts += 1; saved = { ...request, reason: route.request().postDataJSON().reason }; }
    return route.fulfill({ json: { role: 'STUDENT', request: saved } });
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/dashboard/profile');
  const send = page.getByRole('button', { name: 'Request teacher access', exact: true });
  await expect(send).toBeDisabled();
  await page.getByLabel('Why do you need teacher access?').fill(request.reason);
  await send.click();
  await expect(page.getByText('Pending admin review', { exact: true })).toBeVisible();
  await expect(send).toHaveCount(0);
  await expect.poll(() => posts).toBe(1);
  expect(await page.evaluate(() => localStorage.getItem('userRole'))).toBe('STUDENT');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
});

test('student sees the admin note and can revise a rejected request', async ({ page }) => {
  await session(page, 'STUDENT');
  await page.route('**/api/account/teacher-access', route => route.fulfill({ json: { role: 'STUDENT', request: { ...request, status: 'REJECTED', reviewNote: 'Please provide the school name.' } } }));
  await page.goto('/dashboard/profile');
  await expect(page.getByText('Request declined', { exact: true })).toBeVisible();
  await expect(page.getByText('Please provide the school name.', { exact: false })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Request teacher access', exact: true })).toBeDisabled();
});

test('admin reviews a request inline and approval includes only the selected decision and note', async ({ page }) => {
  await session(page, 'ADMIN');
  let approved = false;
  await page.route(/\/api\/admin\/teacher-access/, route => {
    if (route.request().method() === 'PATCH') {
      expect(route.request().postDataJSON()).toEqual({ decision: 'APPROVED', reviewNote: 'Teaching role verified.' });
      approved = true;
      return route.fulfill({ json: { ...request, status: 'APPROVED' } });
    }
    return route.fulfill({ json: { items: approved ? [] : [request], nextCursor: null } });
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/dashboard/teacher-access');
  await page.getByRole('button', { name: 'Review request from SAT teacher applicant' }).click();
  const note = page.getByLabel('Note to applicant (optional)');
  await expect(note).toBeFocused();
  await note.fill('Teaching role verified.');
  await page.getByRole('button', { name: 'Approve', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'No pending requests' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Review teacher access' })).toHaveCount(0);
  expect(approved).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
});

test('an approved student refreshes the session and sees teaching access immediately', async ({ page }) => {
  await session(page, 'STUDENT');
  let approved = false;
  await page.route('**/api/account/teacher-access', route => route.fulfill({ json: { role: approved ? 'TEACHER' : 'STUDENT', request: { ...request, status: approved ? 'APPROVED' : 'PENDING' } } }));
  await page.route('**/api/account/profile', route => route.fulfill({ json: { ...applicant, role: approved ? 'TEACHER' : 'STUDENT', avatar: null, loginMethod: 'GOOGLE' } }));
  await page.route('**/api/auth/refresh', route => route.fulfill({ json: { accessToken: token, user: { ...applicant, role: approved ? 'TEACHER' : 'STUDENT' } } }));
  await page.goto('/dashboard/profile');
  await expect(page.getByText('Pending admin review', { exact: true })).toBeVisible();
  approved = true;
  await page.getByRole('button', { name: 'Check status', exact: true }).click();
  await expect(page.getByText('Teacher access active', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('userRole'))).toBe('TEACHER');
  await expect(page.getByRole('link', { name: 'Open teaching workspace' })).toBeVisible();
});
