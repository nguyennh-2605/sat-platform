import { expect, test, type Locator, type Page } from '@playwright/test';

const token = 'eyJhbGciOiJub25lIn0.eyJleHAiOjQxMDI0NDQ4MDB9.';
const question = { id: 10, type: 'MCQ', blocks: [{ type: 'text', content: 'The ambivalent researcher considered the evidence.' }], questionText: 'Which conclusion is plausible?', choices: [{ id: 'A', text: 'An ambiguous result' }, { id: 'B', text: 'A clear result' }], explanation: 'The evidence is compelling.' };
const definition = (word: string) => ({ success: true, data: { word, found: true, entries: [{ partOfSpeech: 'adjective', pronunciations: ['/test/'], senses: Array.from({ length: 6 }, (_, index) => ({ definition: `Meaning ${index + 1} of ${word}.`, examples: [], synonyms: [], tags: [] })) }], sourceUrl: `https://en.wiktionary.org/wiki/${word}`, licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/' } });

async function selectWord(locator: Locator, word: string, mouseUp = false) {
  // Move focus/scroll exactly as a student selecting question text would.
  if (!await locator.evaluate(element => Boolean(element.closest('button')))) await locator.click();
  await locator.evaluate((element, selectedWord) => {
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const node = walker.currentNode;
      const offset = node.textContent?.indexOf(selectedWord) ?? -1;
      if (offset < 0) continue;
      const range = document.createRange();
      range.setStart(node, offset);
      range.setEnd(node, offset + selectedWord.length);
      const selection = window.getSelection()!;
      selection.removeAllRanges();
      selection.addRange(range);
      document.dispatchEvent(new Event('selectionchange'));
      return;
    }
    throw new Error(`Word ${selectedWord} was not found`);
  }, word);
  if (mouseUp) await locator.dispatchEvent('mouseup');
}

async function setup(page: Page, options: { mode?: 'PRACTICE' | 'EXAM'; subject?: 'RW' | 'MATH'; failure?: boolean; missing?: boolean; legacyLocked?: boolean } = {}) {
  const lookups: string[] = [];
  const writes: Record<string, unknown>[] = [];
  let failed = false;
  const entry = { id: '00000000-0000-4000-8000-000000000001', version: 1, origin: 'SYSTEM_QUESTION', source: 'Dictionary test', category: 'Information and Ideas', userAnswer: 'A', correctAnswer: 'B', whyWrong: null, whyRight: null, reviewedAt: null, questionId: 10, submissionId: 1, createdAt: '2026-10-07T00:00:00Z', updatedAt: '2026-10-07T00:00:00Z' };
  const mode = options.mode ?? 'PRACTICE';
  const subject = options.subject ?? 'RW';
  await page.addInitScript(accessToken => {
    localStorage.setItem('token', accessToken);
    localStorage.setItem('userId', '10');
    localStorage.setItem('userRole', 'STUDENT');
    localStorage.setItem('userName', 'Dictionary test');
  }, token);
  await page.route('**/api/**', async route => {
    const url = new URL(route.request().url());
    if (url.pathname.includes('/dictionary/en/')) {
      const word = decodeURIComponent(url.pathname.split('/').at(-1)!);
      lookups.push(word);
      if (options.failure && !failed) { failed = true; return route.fulfill({ status: 503, json: { code: 'DICTIONARY_UNAVAILABLE' } }); }
      return route.fulfill({ json: options.missing ? { success: true, data: { ...definition(word).data, found: false, entries: [] } } : definition(word) });
    }
    if (url.pathname === '/api/auth/refresh') return route.fulfill({ json: { accessToken: token, user: { id: 10, name: 'Dictionary test', role: 'STUDENT' } } });
    if (url.pathname === '/api/results-analytics/submission/1') {
      const summary = { total: 1, correct: 0, incorrect: 1, omitted: 0, activeDurationMs: 30000, timedQuestions: 1, accuracy: 0, timingCoverage: 100 };
      return route.fulfill({ json: { submissionId: 1, examTitle: 'Dictionary review', subject, mode, solutionsLocked: options.legacyLocked, attemptNo: 1, date: '2026-10-07T00:00:00Z', startedAt: '2026-10-07T00:00:00Z', completedAt: '2026-10-07T00:01:00Z', duration: '1 min', elapsedDurationMs: 60000, activeDurationMs: 30000, summary, modules: [{ ...summary, id: 1, name: 'Module 1', order: 1 }], domains: [], pacing: { activeDurationMs: 30000, averageActiveDurationMs: 30000, timedQuestions: 1, totalQuestions: 1, timingCoverage: 100, slowestQuestion: null }, classificationCoverage: { classified: 0, total: 1, percentage: 0 }, questions: [{ ...question, questionNumber: 1, module: { id: 1, name: 'Module 1', order: 1 }, correctAnswer: 'B', userAnswer: 'A', isCorrect: false, isOmitted: false, domain: null, skill: null, activeDurationMs: 30000, errorLogId: entry.id }] } });
    }
    if (url.pathname === '/api/test/1/setup') return route.fulfill({ json: { id: 1, title: 'Dictionary practice', subject, questionCount: 2, standardDurationSeconds: 1920, standardModuleDurationSeconds: [1920], defaultMode: mode, canCustomize: false, activeAttempt: { submissionId: 1, attemptMode: mode, timingPreset: 'STANDARD', allowedDurationSeconds: 1920 } } });
    if (url.pathname === '/api/test/1/start') return route.fulfill({ json: { title: 'Dictionary practice', subject, duration: 32, mode, sections: [{ order: 1, questions: [question, { ...question, id: 11, questionText: 'A different question.' }] }], session: { submissionId: 1, attemptMode: mode, timingPreset: 'STANDARD', moduleDurationSeconds: [1920], currentModule: 1, currentQuestionIndex: 0, timeLeft: 1920, savedAnswers: {} } } });
    if (url.pathname === '/api/test/1/begin') return route.fulfill({ json: { serverTime: new Date().toISOString(), moduleExpiresAt: new Date(Date.now() + 1920000).toISOString(), timeLeft: 1920, currentQuestionIndex: 0 } });
    if (url.pathname === '/api/error-logs/facets') return route.fulfill({ json: { all: 1, needsReview: 1, reviewed: 0, categories: ['Information and Ideas'] } });
    if (url.pathname === '/api/error-logs') return route.fulfill({ json: { items: [entry], nextCursor: null } });
    if (url.pathname.endsWith('/question')) return route.fulfill({ json: { question: { ...question, section: { name: 'Module 1', test: { subject } } } } });
    if (url.pathname.includes('/api/error-logs/')) {
      if (route.request().method() === 'PATCH') {
        const body = route.request().postDataJSON();
        writes.push(body);
        Object.assign(entry, { ...body, version: entry.version + 1 });
      }
      return route.fulfill({ json: entry });
    }
    return route.fulfill({ json: [] });
  });
  return { lookups, writes };
}

const lookup = (page: Page) => page.locator('[data-dictionary-lookup]');
const reading = (page: Page, text: string) => page.locator('[data-dictionary-text]').filter({ hasText: text }).first();

test('Practice looks up passage and choice text without changing answers; highlight tools still work', async ({ page }) => {
  const { lookups } = await setup(page);
  await page.goto('/test/1');
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await selectWord(reading(page, 'ambivalent'), 'ambivalent');
  await page.getByRole('button', { name: 'Look up', exact: true }).click();
  await expect(lookup(page)).toContainText('Meaning 1 of ambivalent.');
  await expect(lookup(page)).not.toContainText('Meaning 5');
  await lookup(page).getByRole('button', { name: 'Show more' }).click();
  await expect(lookup(page)).toContainText('Meaning 6');
  await page.keyboard.press('Escape');
  await expect(lookup(page)).toHaveCount(0);
  const choice = reading(page, 'ambiguous');
  await selectWord(choice, 'ambiguous', true);
  await choice.dispatchEvent('click');
  await expect(page.locator('button[aria-pressed="true"]').filter({ hasText: 'ambiguous' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Look up', exact: true }).click();
  await expect(lookup(page)).toContainText('Meaning 1 of ambiguous.');
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Highlights & Notes' }).click();
  await selectWord(reading(page, 'ambivalent'), 'ambivalent', true);
  await expect(page.getByRole('button', { name: 'Highlight yellow' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Look up', exact: true })).toHaveCount(1);
  await page.getByRole('button', { name: 'Look up', exact: true }).click();
  await expect(lookup(page)).toContainText('Meaning 1 of ambivalent.');
  expect(lookups).toEqual(['ambivalent', 'ambiguous', 'ambivalent']);
});

test('Error Log keeps reflection mounted and saves its draft while looking up a question', async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 900 });
  const { writes } = await setup(page);
  await page.goto('/dashboard/error-log');
  await page.getByRole('button', { name: 'Dictionary test', exact: true }).click();
  const editor = page.locator('[data-reflection-editor] .ql-editor');
  await editor.click();
  await page.keyboard.type('Keep my reflection');
  await selectWord(reading(page, 'ambivalent'), 'ambivalent');
  await page.getByRole('button', { name: 'Look up', exact: true }).click();
  await expect(lookup(page)).toContainText('Meaning 1');
  await expect(editor).toContainText('Keep my reflection');
  await page.keyboard.press('Escape');
  await expect(lookup(page)).toHaveCount(0);
  await expect(editor).toBeVisible();
  await editor.click();
  await page.keyboard.press('End');
  await page.keyboard.type(' after lookup');
  await expect.poll(() => writes.some(body => String(body.whyWrong).replaceAll('&nbsp;', ' ').includes('after lookup'))).toBe(true);
});

test('mobile selection changes show Look up without a mouseup and stay within the viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await setup(page);
  await page.goto('/dashboard/error-log');
  await page.getByRole('button', { name: 'Dictionary test', exact: true }).click();
  await selectWord(reading(page, 'plausible'), 'plausible');
  await page.getByRole('button', { name: 'Look up', exact: true }).click();
  await expect(lookup(page)).toContainText('Meaning 1');
  await page.screenshot({ path: '../tmp/dictionary-mobile.png' });
  const bounds = await lookup(page).boundingBox();
  expect(bounds!.x).toBeGreaterThanOrEqual(0);
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(390);
  await page.getByRole('button', { name: 'Close definition' }).click();
  await expect(page.locator('[data-reflection-editor]')).toBeVisible();
});

test('lookup retries network errors and shows a real empty result', async ({ page }) => {
  await setup(page, { failure: true });
  await page.goto('/dashboard/error-log');
  await page.getByRole('button', { name: 'Dictionary test', exact: true }).click();
  await selectWord(reading(page, 'ambivalent'), 'ambivalent');
  await page.getByRole('button', { name: 'Look up', exact: true }).click();
  await expect(lookup(page)).toContainText('Unable to load');
  await lookup(page).getByRole('button', { name: 'Retry' }).click();
  await expect(lookup(page)).toContainText('Meaning 1');
});

test('multi-word selections are ignored; misses retain attribution and outside dismissal', async ({ page }) => {
  await setup(page, { missing: true });
  await page.goto('/dashboard/error-log');
  await page.getByRole('button', { name: 'Dictionary test', exact: true }).click();
  await selectWord(reading(page, 'ambivalent'), 'ambivalent researcher');
  await expect(page.getByRole('button', { name: 'Look up', exact: true })).toHaveCount(0);
  await selectWord(reading(page, 'ambivalent'), 'ambivalent');
  await page.getByRole('button', { name: 'Look up', exact: true }).click();
  await expect(lookup(page)).toContainText('No definition found.');
  await expect(lookup(page).getByRole('link', { name: 'Wiktionary', exact: true })).toHaveAttribute('href', /wiktionary/);
  await page.locator('[data-reflection-editor] .ql-editor').click();
  await expect(lookup(page)).toHaveCount(0);
  await expect(page.locator('[data-reflection-editor]')).toBeVisible();
});

test('Exam simulation does not expose Look up', async ({ page }) => {
  const { lookups } = await setup(page, { mode: 'EXAM' });
  await page.goto('/test/1');
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(reading(page, 'ambivalent')).toBeVisible();
  await selectWord(reading(page, 'ambivalent'), 'ambivalent', true);
  await expect(page.getByRole('button', { name: 'Look up', exact: true })).toHaveCount(0);
  expect(lookups).toEqual([]);
});

test('completed Score Report ignores legacy lock flags and supports keyboard lookup', async ({ page }) => {
  await setup(page, { legacyLocked: true });
  await page.goto('/dashboard/score-report/1');
  await page.getByRole('button', { name: 'Review question 1', exact: true }).click();
  await selectWord(reading(page, 'compelling'), 'compelling');
  await page.getByRole('button', { name: 'Look up', exact: true }).focus();
  await page.keyboard.press('Enter');
  await expect(lookup(page)).toContainText('Meaning 1 of compelling.');
  await page.screenshot({ path: '../tmp/dictionary-review.png' });
  await page.keyboard.press('Escape');
  await expect(lookup(page)).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Question 1', exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('heading', { name: 'Question 1', exact: true })).toHaveCount(0);
});

test('Math question review does not offer word lookup', async ({ page }) => {
  const { lookups } = await setup(page, { subject: 'MATH' });
  await page.goto('/dashboard/error-log');
  await page.getByRole('button', { name: 'Dictionary test', exact: true }).click();
  await expect(page.locator('[data-question-context]')).toBeVisible();
  await selectWord(page.locator('[data-question-context]'), 'plausible');
  await expect(page.getByRole('button', { name: 'Look up', exact: true })).toHaveCount(0);
  expect(lookups).toEqual([]);
});
