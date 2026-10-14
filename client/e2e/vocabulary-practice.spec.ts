import { expect, test, type Page } from '@playwright/test';
import { expectViewportModal } from './helpers/modal-layout';

const token = 'eyJhbGciOiJub25lIn0.eyJleHAiOjQxMDI0NDQ4MDB9.';
const terms = [
  { id: 't1', word: 'meticulous', meaning: 'Very careful and precise', translation: 'tỉ mỉ, cẩn thận', progress: { mastery: 'LEARNING', seenCount: 2, dueAt: '2026-10-01T00:00:00Z' } },
  { id: 't2', word: 'concise', meaning: 'Expressing much in few words', translation: 'ngắn gọn, súc tích' },
  { id: 't3', word: 'infer', meaning: 'Draw a conclusion from evidence', translation: 'suy luận' },
  { id: 't4', word: 'coherent', meaning: 'Logical and consistent', translation: '' },
];
const collection = { id: 'mine', title: 'Saved words', description: 'Collection subtitle should stay hidden', autoKey: 'SAVED_WORDS', scope: 'PERSONAL', status: 'PUBLISHED', ownerId: 10, termCount: 4, studiedCount: 1, learningCount: 1, masteredCount: 0, canEdit: true, canDelete: true, version: 1, terms, createdAt: '2026-10-01T00:00:00Z', updatedAt: '2026-10-01T00:00:00Z' };

async function setup(page: Page, { mobile = false, theme = 'light', recover = false, empty = false, customCollection = false } = {}) {
  await page.setViewportSize(mobile ? { width: 390, height: 844 } : { width: 1440, height: 1000 });
  await page.addInitScript(({ token, theme }) => { localStorage.setItem('token', token); localStorage.setItem('userId', '10'); localStorage.setItem('userRole', 'STUDENT'); localStorage.setItem('userName', 'Vocabulary test'); localStorage.setItem('dashboardTheme', theme); }, { token, theme });
  const session = { id: 'daily', isDaily: true, status: 'IN_PROGRESS', totalItems: 2, answeredCount: 0, correctCount: 0, questions: [
    { id: 'q1', prompt: 'meticulous', options: terms.map(term => term.meaning), selectedMeaning: null as string | null, isCorrect: null as boolean | null, meaning: undefined as string | undefined, nextDueAt: null as string | null },
    { id: 'q2', prompt: 'concise', options: [], selectedMeaning: null as string | null, isCorrect: null as boolean | null, meaning: terms[1].meaning, nextDueAt: null as string | null },
  ] };
  let started = false;
  const saves: unknown[] = [];
  let removed = false;
  await page.route('**/api/**', async route => {
    const request = route.request(); const url = new URL(request.url()); const path = url.pathname;
    if (path === '/api/auth/refresh') return route.fulfill({ json: { accessToken: token, user: { id: 10, name: 'Vocabulary test', role: 'STUDENT' } } });
    if (path === '/api/vocabulary/practice') return route.fulfill({ json: { dueCount: empty ? 0 : 1, newCount: empty ? 0 : 3, scheduledCount: 0, studiedToday: 0, dailyReviewLimit: 20, dailyNewLimit: 10, nextDueAt: null, activeSession: started && session.status !== 'COMPLETED' ? { id: session.id, answeredCount: session.answeredCount, totalItems: 2 } : null } });
    if (path === '/api/vocabulary/practice/sessions') { started = true; return route.fulfill({ json: session }); }
    if (path === '/api/vocabulary/sessions/daily') return route.fulfill({ json: session });
    if (path.endsWith('/answer')) {
      const index = path.includes('q1') ? 0 : 1; const question = session.questions[index]; const body = request.postDataJSON();
      question.selectedMeaning = index === 0 ? body.selectedMeaning : body.mastery;
      question.isCorrect = index === 0 ? body.selectedMeaning === terms[0].meaning : body.mastery === 'KNOW';
      question.meaning = terms[index].meaning; question.nextDueAt = new Date(Date.now() + 600000).toISOString();
      session.answeredCount++; if (question.isCorrect) session.correctCount++;
      if (session.answeredCount === 2) session.status = 'COMPLETED';
      if (recover && index === 0) return route.abort('failed');
      return route.fulfill({ json: session });
    }
    if (path === '/api/vocabulary/saved-words' && request.method() === 'POST') { saves.push(request.postDataJSON()); return route.fulfill({ json: { termId: 'saved', setId: 'mine', setTitle: 'Saved words', word: 'eloquent', created: true } }); }
    if (path === '/api/vocabulary/saved-words/saved') { removed = true; return route.fulfill({ json: { removed: true } }); }
    if (path === '/api/vocabulary/sets') return route.fulfill({ json: empty ? [] : url.searchParams.get('scope') === 'MINE' ? [collection, ...(customCollection ? [{ ...collection, id: 'custom', title: 'SAT reading', autoKey: null }] : [])] : [] });
    if (path === '/api/vocabulary/sets/mine') return route.fulfill({ json: collection });
    return route.fulfill({ json: [] });
  });
  await page.goto('/dashboard/vocabulary');
  return { saves, wasRemoved: () => removed };
}

test('daily practice generates a quiz and recall flow, persists answers and schedules reviews', async ({ page }) => {
  await setup(page);
  await expect(page.getByText("Today's practice", { exact: true })).toBeVisible();
  await page.screenshot({ path: '../tmp/vocabulary-home-desktop.png' });
  await page.getByRole('button', { name: 'Start daily practice' }).click();
  await expect(page.getByRole('heading', { name: 'meticulous', exact: true })).toBeVisible();
  await page.getByRole('button', { name: /Very careful and precise/ }).click();
  await expect(page.getByRole('button', { name: /Very careful and precise/ })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByText('Next review:', { exact: false })).toHaveCount(0);
  await page.screenshot({ path: '../tmp/vocabulary-daily-question-desktop.png' });
  await page.getByRole('button', { name: 'Check answer' }).click();
  await expect(page.getByText('Next review:', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: 'Next word' }).click();
  await page.getByRole('button', { name: /Reveal meaning/ }).click();
  await expect(page.getByText('Expressing much in few words', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: /Forgot/ }).click();
  await page.getByRole('button', { name: 'Finish practice' }).click();
  await expect(page.getByRole('heading', { name: 'Practice complete' })).toBeVisible();
  await expect(page.getByText('You practised 2 words.', { exact: false })).toBeVisible();
});

test('mobile dark vocabulary removes quick save and keeps learning and collections usable', async ({ page }) => {
  await setup(page, { mobile: true, theme: 'dark' });
  await expect(page.getByText('A word to remember', { exact: true })).toHaveCount(0);
  await expect(page.getByLabel('English word', { exact: true })).toHaveCount(0);
  const search = await page.getByRole('searchbox', { name: 'Search collections' }).boundingBox();
  const create = await page.getByRole('button', { name: 'New collection', exact: true }).boundingBox();
  expect(Math.abs(search!.y - create!.y)).toBeLessThan(5);
  expect(await page.locator('main').last().evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
  await page.screenshot({ path: '../tmp/vocabulary-home-mobile-dark.png' });
  const word = page.getByRole('button', { name: 'View meticulous' });
  await word.scrollIntoViewIfNeeded();
  await expect(word.getByText('Vietnamese meaning', { exact: true })).toBeVisible();
  await expect(word.getByText('English definition', { exact: true })).toBeVisible();
  await page.screenshot({ path: '../tmp/vocabulary-words-mobile-dark.png' });
  await page.getByRole('button', { name: 'Start daily practice' }).click();
  await page.screenshot({ path: '../tmp/vocabulary-practice-mobile-dark.png' });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('a lost answer response is recovered and practice resumes after leaving', async ({ page }) => {
  await setup(page, { recover: true });
  await page.getByRole('button', { name: 'Start daily practice' }).click();
  await page.getByRole('button', { name: /Very careful and precise/ }).click();
  await page.getByRole('button', { name: 'Check answer' }).click();
  await expect(page.getByRole('button', { name: 'Next word' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Vocabulary', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await page.getByRole('button', { name: 'Resume practice' }).click();
  await expect(page.getByRole('heading', { name: 'concise', exact: true })).toBeVisible();
});

test('practice options retain focused review sessions without adding competing buttons', async ({ page }) => {
  await setup(page);
  await page.getByRole('button', { name: 'Practice options' }).click();
  const request = page.waitForRequest(request => new URL(request.url()).pathname === '/api/vocabulary/practice/sessions' && request.method() === 'POST');
  await page.getByRole('menuitem', { name: 'Review due words only' }).click();
  expect((await request).postDataJSON()).toEqual({ focus: 'REVIEW' });
  await expect(page.getByRole('heading', { name: 'meticulous', exact: true })).toBeVisible();
});

test('empty vocabulary allows creating a collection without starting an empty quiz', async ({ page }) => {
  await setup(page, { empty: true });
  await expect(page.getByRole('button', { name: 'Start daily practice' })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'New set', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'No vocabulary sets available' })).toBeVisible();
});

test('collection details and four word columns share one surface with a clear selected collection', async ({ page }) => {
  await setup(page);
  const surface = page.getByRole('region', { name: 'Saved words collection words' });
  await expect(surface.getByRole('heading', { name: 'Saved words', exact: true })).toBeVisible();
  await expect(page.getByText('Collection subtitle should stay hidden', { exact: true })).toHaveCount(0);
  await expect(surface.getByText('Vietnamese meaning', { exact: true }).first()).toBeVisible();
  await expect(surface.getByText('English definition', { exact: true }).first()).toBeVisible();
  await expect(surface.getByRole('button', { name: 'View meticulous' })).toContainText('tỉ mỉ, cẩn thận');
  await expect(page.getByRole('button', { name: 'Select Saved words' })).toHaveAttribute('aria-pressed', 'true');
  const row = surface.getByRole('button', { name: 'View meticulous' });
  await expect(row).toHaveCSS('border-radius', '0px');
  await expect(row.locator('..')).toHaveCSS('border-bottom-width', '1px');
  await row.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog').getByText('Very careful and precise', { exact: true })).toBeVisible();
  await expect(page.locator('[data-slot="sheet-overlay"]')).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
  await expect(page.locator('[data-slot="sheet-overlay"]')).toHaveCSS('backdrop-filter', 'none');
  await expect(page.getByRole('dialog')).toHaveCSS('box-shadow', /^(none|(?:rgba\(0, 0, 0, 0\) 0px 0px 0px 0px(?:, )?)+)$/);
  await page.locator('[data-slot="sheet-overlay"]').click({ position: { x: 5, y: 80 } });
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await row.click();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await surface.getByRole('searchbox', { name: 'Search words' }).fill('ngắn gọn');
  await expect(surface.getByRole('button', { name: 'View concise' })).toBeVisible();
  await expect(surface.getByRole('button', { name: 'View meticulous' })).toHaveCount(0);
});

for (const [width, theme] of [[320, 'light'], [1024, 'dark']] as const) {
  test(`vocabulary and practice stay within a ${width}px ${theme} viewport`, async ({ page }) => {
    await setup(page, { theme });
    await page.setViewportSize({ width, height: 900 });
    await expect(page.getByText("Today's practice", { exact: true })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'All', exact: true })).toBeVisible();
    expect(await page.locator('main').last().evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
    await page.screenshot({ path: `../tmp/vocabulary-home-${width}-${theme}.png` });
    await page.getByRole('button', { name: 'Start daily practice' }).click();
    await expect(page.getByRole('heading', { name: 'meticulous', exact: true })).toBeVisible();
    expect(await page.locator('main').last().evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
    await page.getByRole('button', { name: /Very careful and precise/ }).click();
  await page.getByRole('button', { name: 'Check answer' }).click();
    await expect(page.getByRole('button', { name: 'Next word' })).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('heading', { name: 'concise', exact: true })).toBeVisible();
  });
}

for (const [mobile, theme] of [[false, 'light'], [true, 'dark']] as const) {
  test(`collection quiz uses the shared question interface in ${theme} mode`, async ({ page }) => {
    await setup(page, { mobile, theme });
    const question = { id: 'q1', prompt: 'meticulous', options: terms.map(term => term.meaning), selectedMeaning: null as string | null, isCorrect: null as boolean | null, meaning: undefined as string | undefined, translation: undefined as string | undefined, nextDueAt: null as string | null };
    const quiz = { id: 'quiz', mode: 'QUIZ', status: 'IN_PROGRESS', totalItems: 2, answeredCount: 0, correctCount: 0, score: 0, questions: [question, { ...question, id: 'q2', prompt: 'concise' }] };
    await page.route('**/api/vocabulary/sets/mine/sessions', route => route.fulfill({ json: quiz }));
    await page.route('**/api/vocabulary/sessions/quiz/questions/q1/answer', route => {
      question.selectedMeaning = route.request().postDataJSON().selectedMeaning;
      question.isCorrect = question.selectedMeaning === terms[0].meaning;
      question.meaning = terms[0].meaning;
      question.translation = terms[0].translation;
      question.nextDueAt = '2026-10-10T00:00:00Z';
      quiz.answeredCount = 1;
      return route.fulfill({ json: quiz });
    });
    await page.getByRole('button', { name: 'Take quiz', exact: true }).click();
    await expectViewportModal(page.getByRole('dialog', { name: 'Set up your quiz', exact: true }));
    await page.getByRole('button', { name: 'Start quiz', exact: true }).click();
    await expect(page.getByText('Which meaning best matches this word?', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Check answer' })).toBeDisabled();
    await page.getByRole('button', { name: /Expressing much in few words/ }).click();
    await page.getByRole('button', { name: 'Check answer' }).click();
    await expect(page.getByText('Not quite — review the correct meaning.', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: /Very careful and precise/ })).toBeDisabled();
    await expect(page.getByText('Next review:', { exact: false })).toBeVisible();
    expect(await page.locator('main').last().evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
    await page.screenshot({ path: `../tmp/vocabulary-quiz-${theme}.png` });
    await page.getByRole('button', { name: 'Next question', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'concise', exact: true })).toBeVisible();
  });
}
