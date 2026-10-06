import { expect, test, type Page } from '@playwright/test';
import type { ErrorEntry } from '../src/pages/error-log/types';

const token = 'eyJhbGciOiJub25lIn0.eyJleHAiOjQxMDI0NDQ4MDB9.';
const entryId = (index: number) => `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`;

async function mockErrorLog(page: Page, options: { count?: number; questionFailure?: boolean; legacyLocked?: boolean; manual?: boolean } = {}) {
  const entries: ErrorEntry[] = Array.from({ length: options.count ?? 3 }, (_, index) => ({
    id: entryId(index + 1), version: 1, origin: options.manual ? 'MANUAL' : 'SYSTEM_QUESTION',
    source: `Test source ${String(index + 1).padStart(3, '0')}`, sourceUrl: options.manual ? 'https://example.com/practice' : null,
    category: 'Information and Ideas', userAnswer: 'A', correctAnswer: 'B',
    whyWrong: null, whyRight: null, reviewedAt: null,
    createdAt: '2026-10-06T00:00:00.000Z', updatedAt: '2026-10-06T00:00:00.000Z',
    submissionId: 1, questionId: options.manual ? null : index + 1, solutionLocked: options.legacyLocked,
  }));
  const writes: Array<Record<string, unknown>> = [];
  const cursors: string[] = [];
  let questionFailed = false;
  await page.route('**/api/**', async route => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.pathname === '/api/auth/refresh') {
      await route.fulfill({ json: { accessToken: token, user: { id: 10, name: 'Student Preview', role: 'STUDENT' } } });
    } else if (url.pathname === '/api/error-logs/facets') {
      await route.fulfill({ json: { all: entries.length, needsReview: entries.filter(entry => !entry.reviewedAt).length, reviewed: entries.filter(entry => entry.reviewedAt).length, categories: ['Information and Ideas'] } });
    } else if (url.pathname === '/api/error-logs') {
      const offset = Number(url.searchParams.get('cursor') || 0);
      cursors.push(url.searchParams.get('cursor') || 'first');
      await route.fulfill({ json: { items: entries.slice(offset, offset + 40), nextCursor: offset + 40 < entries.length ? String(offset + 40) : null } });
    } else if (/\/api\/error-logs\/[^/]+\/question$/.test(url.pathname)) {
      if (options.questionFailure && !questionFailed) {
        questionFailed = true;
        await route.fulfill({ status: 503, json: { message: 'Unavailable' } });
      } else {
        await route.fulfill({ json: { question: {
          type: 'MCQ', blocks: [], questionText: 'Which choice best supports the conclusion?',
          choices: [{ id: 'A', text: 'First choice' }, { id: 'B', text: 'Second choice' }],
          explanation: 'The second choice supports the evidence.',
          order: 1, section: { name: 'Module 1', test: { subject: 'RW' } },
        } } });
      }
    } else if (/\/api\/error-logs\/[^/]+$/.test(url.pathname)) {
      const entry = entries.find(item => item.id === url.pathname.split('/').at(-1));
      if (request.method() === 'PATCH' && entry) {
        const body = request.postDataJSON();
        writes.push(body);
        if (body.expectedVersion !== entry.version) {
          await route.fulfill({ status: 409, json: { current: entry } });
          return;
        }
        Object.assign(entry, { ...body, version: entry.version! + 1 });
        entry.reviewedAt = entry.whyWrong && entry.whyRight ? '2026-10-06T00:01:00.000Z' : null;
      }
      await route.fulfill({ json: entry });
    } else {
      await route.fulfill({ json: [] });
    }
  });
  return { entries, writes, cursors };
}

const reflection = (page: Page, source = 'Test source 001', field = 'Why I chose wrong') => page.getByRole('button', { name: `${field} for ${source}. Add reflection.`, exact: true });
const editor = (page: Page) => page.locator('[data-reflection-editor] .ql-editor');
const savedText = (html: string | null) => html?.replaceAll('&nbsp;', ' ') ?? '';

async function expectFullReflectionSurface(page: Page) {
  const bold = await page.getByRole('button', { name: 'Bold', exact: true }).boundingBox();
  const question = await page.getByRole('button', { name: /^(View|Hide) question$/ }).boundingBox();
  const close = await page.getByRole('button', { name: 'Close reflection editor', exact: true }).boundingBox();
  expect(bold!.y + bold!.height / 2).toBeCloseTo(question!.y + question!.height / 2, 0);
  expect(bold!.y + bold!.height / 2).toBeCloseTo(close!.y + close!.height / 2, 0);
  await expect(page.locator('[data-reflection-body] [data-slot="rich-text-editor"]')).toHaveCSS('border-width', '0px');
  const body = await page.locator('[data-reflection-body]').boundingBox();
  const editable = await editor(page).boundingBox();
  expect(editable!.height).toBeGreaterThan(200);
  expect(editable!.width).toBeCloseTo(body!.width, 0);
  expect(editable!.y + editable!.height).toBeCloseTo(body!.y + body!.height, 0);
}

test('page scrolling moves the toolbar and column headers away and loads the next cursor', async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 900 });
  const { cursors } = await mockErrorLog(page, { count: 80 });
  await page.goto('/dashboard/error-log');
  await expect(page.getByRole('columnheader', { name: 'Category', exact: true })).toBeVisible();
  await expect(page.locator('thead')).toHaveCSS('position', 'static');
  await expect(page.locator('[data-virtuoso-scroller]')).not.toHaveCSS('overflow-y', /auto|scroll/);
  await expect(page.getByRole('button', { name: 'Test source 001', exact: true })).toBeVisible();
  await expect.poll(() => page.locator('[data-error-log-scroll]').evaluate(element => element.scrollHeight)).toBeGreaterThan(1200);
  await page.locator('[data-error-log-scroll]').evaluate(element => { element.scrollTop = 1000; });
  await expect(page.getByRole('columnheader', { name: 'Category', exact: true })).not.toBeInViewport();
  await expect(page.locator('[data-error-log-toolbar]')).not.toBeInViewport();
  await page.locator('[data-error-log-scroll]').evaluate(element => { element.scrollTop = element.scrollHeight; });
  await expect.poll(() => cursors).toContain('40');
});

test('question and reflection share one editor, preserve drafts, and save both fields across reopening', async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 900 });
  const { entries, writes } = await mockErrorLog(page);
  await page.goto('/dashboard/error-log');
  await reflection(page).click();
  await expect(editor(page)).toBeVisible();
  await expectFullReflectionSurface(page);
  const editable = await editor(page).boundingBox();
  await editor(page).click({ position: { x: 40, y: editable!.height - 12 } });
  await expect(editor(page)).toBeFocused();
  await editor(page).fill('I missed the evidence.');
  await editor(page).evaluate(element => { element.setAttribute('data-editor-instance', 'original'); });
  await page.getByRole('button', { name: 'Test source 001', exact: true }).click();
  await expect(page.getByText('Which choice best supports the conclusion?', { exact: true })).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(1);
  await expect(editor(page)).toHaveAttribute('data-editor-instance', 'original');
  await expect(editor(page)).toContainText('I missed the evidence.');
  await expectFullReflectionSurface(page);
  await page.screenshot({ path: '../tmp/error-log-desktop.png' });
  await expect(page.locator('[data-reflection-editor] h2')).toHaveClass(/sr-only/);
  await expect(page.getByText(/Tab moves between reflection/)).toHaveCount(0);
  await expect(page.locator('[data-reflection-editor]')).toHaveCSS('border-radius', '0px');
  await expect(page.locator('[data-reflection-editor]')).toHaveCSS('border-width', '2px');
  const selection = await page.locator('td[data-active-reflection]').evaluate(element => {
    const style = getComputedStyle(element, '::after');
    return { top: style.top, bottom: style.bottom, width: style.borderTopWidth, radius: style.borderRadius };
  });
  expect(selection).toEqual({ top: '0px', bottom: '0px', width: '2px', radius: '0px' });
  await page.getByRole('button', { name: 'Hide question', exact: true }).click();
  await expect(editor(page)).toHaveAttribute('data-editor-instance', 'original');
  await page.getByRole('button', { name: 'View question', exact: true }).click();
  await page.getByRole('button', { name: 'Why answer is right', exact: true }).click();
  await editor(page).fill('The second choice matches the evidence.');
  await page.getByRole('button', { name: 'Close reflection editor', exact: true }).click();
  await expect.poll(() => savedText(entries[0].whyWrong)).toContain('I missed the evidence.');
  await expect.poll(() => savedText(entries[0].whyRight)).toContain('The second choice matches the evidence.');
  expect(writes.map(write => write.expectedVersion)).toEqual([1, 2]);
  await page.reload();
  await page.getByRole('button', { name: 'Test source 001', exact: true }).click();
  await expect(editor(page)).toContainText('I missed the evidence.');
  await page.getByRole('button', { name: 'Why answer is right', exact: true }).click();
  await expect(editor(page)).toContainText('The second choice matches the evidence.');
});

test('question failure and retry do not block typing or keyboard navigation and outside closing flushes the draft', async ({ page }) => {
  const { entries } = await mockErrorLog(page, { questionFailure: true });
  await page.goto('/dashboard/error-log');
  await page.getByRole('button', { name: 'Test source 001', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Unable to load the question.');
  await editor(page).fill('Draft while question is unavailable.');
  await page.getByRole('button', { name: 'Retry', exact: true }).click();
  await expect(page.getByText('Which choice best supports the conclusion?', { exact: true })).toBeVisible();
  await expect(editor(page)).toContainText('Draft while question is unavailable.');
  await editor(page).press('Tab');
  await expect(page.getByRole('button', { name: 'Why answer is right', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await editor(page).fill('Draft of correct reasoning.');
  await page.getByRole('button', { name: 'Use dark theme', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect.poll(() => savedText(entries[0].whyRight)).toContain('Draft of correct reasoning.');
});

test('completed question solutions are visible even with a legacy lock flag', async ({ page }) => {
  await mockErrorLog(page, { legacyLocked: true });
  await page.goto('/dashboard/error-log');
  await page.getByRole('button', { name: 'Test source 001', exact: true }).click();
  await expect(page.locator('[data-question-context]')).not.toContainText('locked');
  await expect(page.locator('[data-question-context]').getByLabel('Correct answer', { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Explanation', exact: true })).toBeVisible();
  await editor(page).fill('My reflection on the question.');
  await editor(page).press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('mobile keeps question and reflection available without overflowing the viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const { entries } = await mockErrorLog(page);
  await page.goto('/dashboard/error-log');
  await expect(page.locator('[data-virtuoso-scroller]')).not.toHaveCSS('overflow-y', /auto|scroll/);
  await reflection(page).click();
  await editor(page).fill('Mobile draft.');
  await page.getByRole('button', { name: 'View question', exact: true }).click();
  await expect(page.getByText('Which choice best supports the conclusion?', { exact: true })).toBeVisible();
  await expect(editor(page)).toBeVisible();
  await expect(editor(page)).toContainText('Mobile draft.');
  await expectFullReflectionSurface(page);
  const bounds = await page.locator('[data-reflection-editor]').boundingBox();
  expect(bounds!.x).toBeGreaterThanOrEqual(0);
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(390);
  expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(844);
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  await page.screenshot({ path: '../tmp/error-log-mobile.png' });
  await editor(page).press('Control+Enter');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect.poll(() => savedText(entries[0].whyWrong)).toContain('Mobile draft.');
});

test('manual source links open externally without offering unavailable question context', async ({ page }) => {
  await mockErrorLog(page, { manual: true });
  await page.goto('/dashboard/error-log');
  await reflection(page).click();
  await expect(editor(page)).toBeVisible();
  await expect(page.getByRole('button', { name: 'View question', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Close reflection editor', exact: true }).click();
  await page.context().route('https://example.com/practice', route => route.fulfill({ body: 'External practice' }));
  const popup = page.waitForEvent('popup');
  await page.getByRole('button', { name: 'Test source 001', exact: true }).click();
  await expect(await popup).toHaveURL('https://example.com/practice');
});

test('formatting and link shortcuts stay with the editor when question context is expanded', async ({ page }) => {
  await mockErrorLog(page);
  await page.goto('/dashboard/error-log');
  await reflection(page).click();
  await editor(page).press('Control+b');
  await editor(page).pressSequentially('phân tích');
  await page.getByRole('button', { name: 'View question', exact: true }).click();
  await editor(page).pressSequentially(' evidence');
  await expect(editor(page).locator('strong')).toContainText('phân tích evidence');
  await editor(page).press('Control+a');
  await editor(page).press('Control+k');
  await expect(page.getByRole('group', { name: 'Edit reflection link', exact: true })).toBeVisible();
  await page.getByRole('textbox', { name: 'Link', exact: true }).press('Escape');
  await expect(page.getByRole('group', { name: 'Edit reflection link', exact: true })).toHaveCount(0);
  await expect(editor(page)).toBeVisible();
  await editor(page).press('Control+k');
  await page.getByRole('textbox', { name: 'Link', exact: true }).fill('https://example.com/evidence');
  await page.getByRole('button', { name: 'Apply', exact: true }).click();
  await expect(editor(page).locator('a')).toHaveAttribute('href', 'https://example.com/evidence');
  await page.getByRole('button', { name: 'Why answer is right', exact: true }).click();
  await editor(page).press('Control+k');
  await expect(page.getByRole('group', { name: 'Edit reflection link', exact: true })).toBeVisible();
});

test('the editor stays in the viewport when its virtual row scrolls away and restores focus on keyboard close', async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 900 });
  const { entries } = await mockErrorLog(page, { count: 80 });
  await page.goto('/dashboard/error-log');
  await reflection(page).click();
  await editor(page).fill('Draft survives scrolling.');
  const before = await page.locator('[data-reflection-editor]').boundingBox();
  await page.locator('[data-error-log-scroll]').evaluate(element => { element.scrollTop = element.scrollHeight; });
  await expect(reflection(page)).toHaveCount(0);
  await expect(editor(page)).toContainText('Draft survives scrolling.');
  const after = await page.locator('[data-reflection-editor]').boundingBox();
  expect(after!.y).toBe(before!.y);
  await editor(page).press('Control+Enter');
  await expect(page.getByRole('button', { name: 'Why I chose wrong for Test source 001. Press Enter to edit.', exact: true })).toBeFocused();
  await expect.poll(() => savedText(entries[0].whyWrong)).toContain('Draft survives scrolling.');
});
