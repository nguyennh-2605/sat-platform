import { expect, test, type Page } from '@playwright/test';

const token = 'eyJhbGciOiJub25lIn0.eyJleHAiOjQxMDI0NDQ4MDB9.';
const tests = Array.from({ length: 7 }, (_, index) => ({
  id: index + 1,
  title: `SAT Practice Test ${index + 1}`,
  description: index % 2 === 0 ? 'Reading and Writing - Full Test' : 'Math - Full Test',
  duration: index % 2 === 0 ? 64 : 70,
  subject: index % 2 === 0 ? 'RW' : 'MATH',
  category: index === 0 ? 'REAL' : 'PRACTICE',
  testDate: index === 0 ? '10' : null,
  mode: 'PRACTICE',
  status: index % 3 === 0 ? 'DRAFT' : 'PUBLISHED',
  questionCount: index % 2 === 0 ? 54 : 44,
  progress: index === 0 ? 100 : index === 1 ? 42 : 0,
  attemptStatus: index === 0 ? 'COMPLETED' : index === 1 ? 'DOING' : 'NOT_STARTED',
  lastAttempt: index < 2 ? new Date(Date.now() - (index + 1) * 3_600_000).toISOString() : null,
  lastScore: index === 0 ? 91 : null,
  updatedAt: new Date(Date.now() - index * 3_600_000).toISOString(),
  author: { id: 1, name: 'SAT Platform', role: 'ADMIN' },
  classTests: [],
  deliveries: [],
}));

async function mockLibrary(page: Page, role: 'STUDENT' | 'TEACHER') {
  await page.route('**/api/**', async route => {
    const url = new URL(route.request().url());
    if (url.pathname === '/api/auth/refresh') {
      await route.fulfill({ json: { accessToken: token, user: { id: role === 'STUDENT' ? 10 : 20, name: role === 'STUDENT' ? 'Student Preview' : 'Teacher Preview', role } } });
      return;
    }
    if (url.pathname === '/api/tests/classes') {
      await route.fulfill({ json: [] });
      return;
    }
    if (url.pathname === '/api/tests') {
      await route.fulfill({ json: { items: tests, total: tests.length, nextCursor: null, sourceCounts: { my: 7, system: 7 } } });
      return;
    }
    await route.fulfill({ json: [] });
  });
}

test('student and teacher libraries use page-level scrolling and compact list rows', async ({ browser }) => {
  for (const role of ['STUDENT', 'TEACHER'] as const) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    await mockLibrary(page, role);
    await page.goto('/dashboard/practice-test');
    await expect(page.getByText(role === 'STUDENT' ? 'Practice Center' : 'Test Library', { exact: true })).toBeVisible();
    await expect(page.getByText('SAT Practice Test 1', { exact: true })).toBeVisible();
    await expect(page.locator('[data-virtuoso-scroller]')).not.toHaveCSS('overflow-y', /auto|scroll/);
    await page.screenshot({ path: `test-results/${role.toLowerCase()}-library-grid.png`, fullPage: true });

    await page.getByRole('button', { name: 'List view' }).click();
    await expect(page.getByText('SAT Practice Test 7', { exact: true })).toBeVisible();
    await expect(page.getByText('Questions', { exact: true })).toHaveCount(0);
    await page.screenshot({ path: `test-results/${role.toLowerCase()}-library-list.png`, fullPage: true });
    await context.close();
  }
});

test('library layouts do not overflow on mobile', async ({ browser }) => {
  for (const role of ['STUDENT', 'TEACHER'] as const) {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await context.newPage();
    await mockLibrary(page, role);
    await page.goto('/dashboard/practice-test');
    await expect(page.getByText('SAT Practice Test 1', { exact: true })).toBeVisible();
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
    await page.getByRole('button', { name: 'List view' }).click();
    await expect(page.getByText('SAT Practice Test 1', { exact: true })).toBeVisible();
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
    await page.screenshot({ path: `test-results/${role.toLowerCase()}-library-mobile-list.png` });
    await context.close();
  }
});
