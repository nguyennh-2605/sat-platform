import { expect, test, type Locator, type Page } from '@playwright/test';
import { expectViewportModal } from './helpers/modal-layout';
import type { QuestionData } from '../src/types/quiz';

type ReviewQuestion = Pick<QuestionData, 'id' | 'type' | 'blocks' | 'questionText' | 'choices'> & { explanation: string };

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

async function setup(page: Page, options: { mode?: 'PRACTICE' | 'EXAM'; subject?: 'RW' | 'MATH'; failure?: boolean; missing?: boolean; legacyLocked?: boolean; theme?: 'light' | 'dark'; question?: ReviewQuestion } = {}) {
  const lookups: string[] = [];
  const writes: Record<string, unknown>[] = [];
  let failed = false;
  const entry = { id: '00000000-0000-4000-8000-000000000001', version: 1, origin: 'SYSTEM_QUESTION', source: 'Dictionary test', category: 'Information and Ideas', userAnswer: 'A', correctAnswer: 'B', whyWrong: null, whyRight: null, reviewedAt: null, questionId: 10, submissionId: 1, createdAt: '2026-10-07T00:00:00Z', updatedAt: '2026-10-07T00:00:00Z' };
  const mode = options.mode ?? 'PRACTICE';
  const subject = options.subject ?? 'RW';
  const content = options.question ?? question;
  await page.addInitScript(({ accessToken, theme }) => {
    localStorage.setItem('token', accessToken);
    localStorage.setItem('userId', '10');
    localStorage.setItem('userRole', 'STUDENT');
    localStorage.setItem('userName', 'Dictionary test');
    localStorage.setItem('dashboardTheme', theme);
  }, { accessToken: token, theme: options.theme ?? 'light' });
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
      return route.fulfill({ json: { submissionId: 1, examTitle: 'Dictionary review', subject, mode, solutionsLocked: options.legacyLocked, attemptNo: 1, date: '2026-10-07T00:00:00Z', startedAt: '2026-10-07T00:00:00Z', completedAt: '2026-10-07T00:01:00Z', duration: '1 min', elapsedDurationMs: 60000, activeDurationMs: 30000, summary, modules: [{ ...summary, id: 1, name: 'Module 1', order: 1 }], domains: [], pacing: { activeDurationMs: 30000, averageActiveDurationMs: 30000, timedQuestions: 1, totalQuestions: 1, timingCoverage: 100, slowestQuestion: null }, classificationCoverage: { classified: 0, total: 1, percentage: 0 }, questions: [{ ...content, questionNumber: 1, module: { id: 1, name: 'Module 1', order: 1 }, correctAnswer: 'B', userAnswer: 'A', isCorrect: false, isOmitted: false, domain: null, skill: null, activeDurationMs: 30000, errorLogId: entry.id }] } });
    }
    if (url.pathname === '/api/test/1/setup') return route.fulfill({ json: { id: 1, title: 'Dictionary practice', subject, questionCount: 2, standardDurationSeconds: 1920, standardModuleDurationSeconds: [1920], defaultMode: mode, canCustomize: false, activeAttempt: { submissionId: 1, attemptMode: mode, timingPreset: 'STANDARD', allowedDurationSeconds: 1920 } } });
    if (url.pathname === '/api/test/1/start') return route.fulfill({ json: { title: 'Dictionary practice', subject, duration: 32, mode, sections: [{ order: 1, questions: [content, { ...content, id: 11, questionText: 'A different question.' }] }], session: { submissionId: 1, attemptMode: mode, timingPreset: 'STANDARD', moduleDurationSeconds: [1920], currentModule: 1, currentQuestionIndex: 0, timeLeft: 1920, savedAnswers: {} } } });
    if (url.pathname === '/api/test/1/begin') return route.fulfill({ json: { serverTime: new Date().toISOString(), moduleExpiresAt: new Date(Date.now() + 1920000).toISOString(), timeLeft: 1920, currentQuestionIndex: 0 } });
    if (url.pathname === '/api/error-logs/facets') return route.fulfill({ json: { all: 1, needsReview: 1, reviewed: 0, categories: ['Information and Ideas'] } });
    if (url.pathname === '/api/error-logs') return route.fulfill({ json: { items: [entry], nextCursor: null } });
    if (url.pathname.endsWith('/question')) return route.fulfill({ json: { question: { ...content, section: { name: 'Module 1', test: { subject } } } } });
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
  await page.keyboard.press('Escape');
  await selectWord(reading(page, 'ambivalent'), 'ambivalent', true);
  await page.getByRole('button', { name: 'Add note', exact: true }).click();
  const note = page.getByRole('dialog', { name: 'Note', exact: true });
  await expectViewportModal(note);
  await expect(note.getByRole('textbox', { name: 'Note', exact: true })).toBeFocused();
  await note.getByRole('textbox', { name: 'Note', exact: true }).fill('Remember this context.');
  await page.keyboard.press('Escape');
  await expect(note).toHaveCount(0);
  await page.locator('.sat-note').click();
  await expect(note.getByRole('textbox', { name: 'Note', exact: true })).toHaveValue('Remember this context.');
  await note.getByRole('button', { name: 'Delete note', exact: true }).click();
  await expect(page.locator('.sat-note')).toHaveCount(0);
});

for (const width of [320, 1024, 1600]) {
  test(`Score Report and search dialogs center on the viewport at ${width}px, after resizing and sidebar changes`, async ({ page }) => {
    await page.setViewportSize({ width, height: 640 });
    await setup(page);
    await page.goto('/dashboard/score-report/1');
    const trigger = page.getByRole('button', { name: 'Review question 1', exact: true });
    const dialog = page.getByRole('dialog', { name: 'Question 1', exact: true });
    await trigger.click();
    await expectViewportModal(dialog);
    await page.screenshot({ path: `../tmp/score-result-modal-${width}.png`, animations: 'disabled' });
    await page.setViewportSize({ width: width === 320 ? 390 : width - 100, height: 760 });
    await expectViewportModal(dialog);
    await page.mouse.click(4, 200);
    await expect(dialog).toHaveCount(0);
    await expect(trigger).toBeFocused();
    if (width >= 1024) {
      const inset = page.locator('[data-slot="sidebar-inset"]');
      const before = await inset.evaluate(element => element.getBoundingClientRect().left);
      expect(before).toBeGreaterThan(100);
      await page.locator('[data-sidebar="trigger"]:visible').click();
      await expect.poll(() => inset.evaluate(element => element.getBoundingClientRect().left)).toBeLessThan(before);
    }
    await trigger.click();
    await expectViewportModal(dialog);
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await page.getByRole('button', { name: 'Search workspace', exact: true }).click();
    await expectViewportModal(page.getByRole('dialog', { name: 'Search workspace', exact: true }));
    await page.keyboard.press('Escape');
    await expect(page.getByRole('button', { name: 'Search workspace', exact: true })).toBeFocused();
  });
}

test('Practice saves a looked-up word without copying its passage or selecting an answer', async ({ page }) => {
  await setup(page);
  let saved: unknown;
  await page.route('**/api/vocabulary/saved-words', async route => {
    saved = route.request().postDataJSON();
    return route.fulfill({ json: { termId: 'saved', setId: 'mine', setTitle: 'Saved words', word: 'ambivalent', created: true } });
  });
  await page.goto('/test/1');
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await selectWord(reading(page, 'ambivalent'), 'ambivalent');
  await page.getByRole('button', { name: 'Look up', exact: true }).click();
  await lookup(page).getByRole('button', { name: 'Save word', exact: true }).click();
  await expect(lookup(page)).toContainText('Added to Saved words.');
  expect(saved).toEqual({ word: 'ambivalent' });
  await expect(page.locator('button[aria-pressed="true"]').filter({ hasText: 'ambiguous' })).toHaveCount(0);
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

// Check the colors the browser actually paints, including translucent panels.
async function expectReadable(locator: Locator, pseudoElement?: string) {
  const contrast = await locator.evaluate((element, pseudo) => {
    const context = document.createElement('canvas').getContext('2d')!;
    const rgba = (color: string) => {
      context.clearRect(0, 0, 1, 1);
      context.fillStyle = color;
      context.fillRect(0, 0, 1, 1);
      return Array.from(context.getImageData(0, 0, 1, 1).data);
    };
    let background = [255, 255, 255];
    const ancestors: Element[] = [];
    for (let node: Element | null = element; node; node = node.parentElement) ancestors.unshift(node);
    for (const node of ancestors) {
      const color = rgba(getComputedStyle(node).backgroundColor);
      const alpha = color[3] / 255;
      background = background.map((value, index) => color[index] * alpha + value * (1 - alpha));
    }
    const luminance = (color: number[]) => color.slice(0, 3).map(value => {
      const channel = value / 255;
      return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
    }).reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index], 0);
    const foregroundLuminance = luminance(rgba(getComputedStyle(element, pseudo).color));
    const backgroundLuminance = luminance(background);
    return (Math.max(foregroundLuminance, backgroundLuminance) + 0.05) / (Math.min(foregroundLuminance, backgroundLuminance) + 0.05);
  }, pseudoElement);
  expect(contrast, `Text contrast: ${await locator.textContent()}`).toBeGreaterThanOrEqual(4.5);
}

const themedQuestion = (subject: 'RW' | 'MATH'): ReviewQuestion => {
  const text = (value: string) => subject === 'MATH' ? `\\text{${value}}` : value;
  return {
    ...question,
    questionText: subject === 'MATH' ? '\\text{Solve } x^2=4.' : 'Which conclusion is plausible?',
    blocks: [
      { type: 'text', content: text('The ambivalent researcher considered the evidence.') },
      { type: 'table', title: text('Observations'), headers: [text('Group'), text('Score')], rows: [[text('Research group'), '42']], note: text('Scores are rounded.') },
      { type: 'poem', title: text('Morning'), lines: [text('A quiet morning follows.')], author: text('Sample author') },
      { type: 'note', lines: [text('Research notes:'), text('The researcher recorded a result.')] },
    ],
    choices: [{ id: 'A', text: text('An ambiguous result') }, { id: 'B', text: text('A clear result') }],
    explanation: subject === 'MATH' ? '\\text{The evidence is compelling: } x=2.' : question.explanation,
  };
};

for (const theme of ['light', 'dark'] as const) {
  for (const subject of ['RW', 'MATH'] as const) {
    for (const view of ['Score Report', 'Error Log'] as const) {
      test(`${view} ${subject} content stays readable in ${theme} mode`, async ({ page }) => {
        await page.setViewportSize({ width: 1600, height: 1000 });
        await setup(page, { theme, subject, question: themedQuestion(subject) });
        if (view === 'Score Report') {
          await page.goto('/dashboard/score-report/1');
          await page.getByRole('button', { name: 'Review question 1', exact: true }).click();
          await expectViewportModal(page.getByRole('dialog'));
        } else {
          await page.goto('/dashboard/error-log');
          await page.getByRole('button', { name: 'Dictionary test', exact: true }).click();
        }
        const context = view === 'Score Report' ? page.getByRole('dialog') : page.locator('[data-question-context]');
        await expect(context.getByText('Research group', { exact: true })).toBeVisible();
        for (const text of ['ambivalent researcher', 'Observations', 'Group', 'Research group', 'Scores are rounded', 'A quiet morning', 'Sample author', 'researcher recorded', subject === 'MATH' ? 'Solve' : 'Which conclusion', 'ambiguous result', 'clear result', 'evidence is compelling']) {
          await expectReadable(context.getByText(text, { exact: false }).last());
        }
        if (subject === 'MATH') await expectReadable(context.locator('.katex').last());
        if (view === 'Error Log') await expectReadable(page.locator('[data-reflection-editor] .ql-editor'), '::before');
        if (theme === 'dark' && subject === 'RW') await page.screenshot({ path: `../tmp/${view.replaceAll(' ', '-').toLowerCase()}-dark.png` });
      });
    }
  }
}

for (const subject of ['RW', 'MATH'] as const) {
  test(`Practice ${subject} retains readable paper colors with a dark dashboard theme`, async ({ page }) => {
    await setup(page, { theme: 'dark', subject, question: themedQuestion(subject) });
    await page.goto('/test/1');
    await page.getByRole('button', { name: 'Continue', exact: true }).click();
    await expect(page.getByText('Research group', { exact: true })).toBeVisible();
    for (const text of ['ambivalent researcher', 'Research group', 'A quiet morning', 'researcher recorded', 'ambiguous result']) {
      await expectReadable(page.getByText(text, { exact: false }).last());
    }
  });
}
