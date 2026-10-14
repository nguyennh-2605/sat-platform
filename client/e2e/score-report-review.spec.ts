import { expect, test, type Page } from '@playwright/test';
import type { QuestionResult, ScoreReportData } from '../src/pages/score-report/score-report.types';
import { expectViewportModal } from './helpers/modal-layout';

const token = 'eyJhbGciOiJub25lIn0.eyJleHAiOjQxMDI0NDQ4MDB9.';
const module = { id: 1, name: 'Module 1', order: 1 };
const questions: QuestionResult[] = [
  { id: 10, type: 'MCQ', questionNumber: 1, module, correctAnswer: 'B', userAnswer: 'A', isCorrect: false, isOmitted: false, blocks: [{ type: 'text', content: 'The researcher compared two experimental results.' }], questionText: 'Which conclusion best supports the evidence?', choices: [{ id: 'A', text: 'The experiment needs no further analysis.' }, { id: 'B', text: 'The results require additional investigation.' }], explanation: 'The evidence supports further investigation before drawing a conclusion.', domain: null, skill: null, activeDurationMs: 30000, errorLogId: null },
  { id: 11, type: 'MCQ', questionNumber: 2, module, correctAnswer: 'B', userAnswer: 'B', isCorrect: true, isOmitted: false, blocks: [], questionText: 'What should the researcher do next?', choices: [{ id: 'A', text: 'Discard all of the observations.' }, { id: 'B', text: 'Collect more evidence.' }], explanation: 'More evidence helps resolve the remaining uncertainty.', domain: null, skill: null, activeDurationMs: 20000, errorLogId: null },
  { id: 12, type: 'MCQ', questionNumber: 3, module, correctAnswer: 'A', userAnswer: null, isCorrect: false, isOmitted: true, blocks: [], questionText: 'Which statement is supported?', choices: [{ id: 'A', text: 'The available evidence is incomplete.' }, { id: 'B', text: 'The result is certain.' }], explanation: null, domain: null, skill: null, activeDurationMs: null, errorLogId: null },
];

async function setup(page: Page, subject: 'RW' | 'MATH' = 'RW', reviewQuestions = questions) {
  const summary = { total: reviewQuestions.length, correct: reviewQuestions.filter(question => question.isCorrect).length, incorrect: reviewQuestions.filter(question => !question.isCorrect && !question.isOmitted).length, omitted: reviewQuestions.filter(question => question.isOmitted).length, activeDurationMs: 50000, timedQuestions: 2, accuracy: 33, timingCoverage: 67 };
  const report: ScoreReportData = { submissionId: 1, examTitle: 'SAT review', subject, mode: 'PRACTICE', attemptNo: 1, date: '2026-10-14T00:00:00Z', startedAt: '2026-10-14T00:00:00Z', completedAt: '2026-10-14T00:02:00Z', duration: '2 min', elapsedDurationMs: 120000, activeDurationMs: 50000, summary, modules: [{ ...module, ...summary }], domains: [], pacing: { activeDurationMs: 50000, averageActiveDurationMs: 25000, timedQuestions: 2, totalQuestions: reviewQuestions.length, timingCoverage: 67, slowestQuestion: null }, classificationCoverage: { classified: 0, total: reviewQuestions.length, percentage: 0 }, questions: reviewQuestions };
  await page.route('**/api/**', route => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/api/auth/refresh') return route.fulfill({ json: { accessToken: token, user: { id: 10, name: 'Student', role: 'STUDENT' } } });
    if (path === '/api/study-sessions/active') return route.fulfill({ json: { session: null } });
    if (path === '/api/results-analytics/submission/1') return route.fulfill({ json: report });
    return route.fulfill({ json: [] });
  });
  await page.goto('/dashboard/score-report/1');
  await page.getByRole('button', { name: 'Review question 1', exact: true }).click();
}

test('question review starts collapsed, opens explanation on the right, and resets on navigation and reopening', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await setup(page);
  let dialog = page.getByRole('dialog', { name: 'Question 1', exact: true });
  await expectViewportModal(dialog);
  await expect(dialog.getByRole('region', { name: 'Explanation', exact: true })).toHaveCount(0);
  await expect(dialog.getByText('Your answer', { exact: true })).toHaveCount(0);
  await expect(dialog.getByText('Correct answer', { exact: true })).toHaveCount(0);
  await expect(dialog.getByRole('group', { name: 'Choice A, your answer', exact: true })).toHaveClass(/bg-danger-soft/);
  await expect(dialog.getByRole('group', { name: 'Choice B, correct answer', exact: true })).toHaveClass(/bg-success-soft/);
  const collapsedWidth = (await dialog.boundingBox())!.width;
  await page.screenshot({ path: '../tmp/result-question-collapsed.png' });
  await dialog.getByRole('button', { name: 'Show explanation', exact: true }).focus();
  await page.keyboard.press('Enter');
  await expect(dialog.getByRole('button', { name: 'Hide explanation', exact: true })).toHaveAttribute('aria-expanded', 'true');
  const explanation = dialog.getByRole('region', { name: 'Explanation', exact: true });
  await expect(explanation).toContainText(questions[0].explanation!);
  expect((await dialog.boundingBox())!.width).toBeGreaterThan(collapsedWidth);
  const questionBounds = (await dialog.getByRole('region', { name: 'Question and answers', exact: true }).boundingBox())!;
  expect((await explanation.boundingBox())!.x).toBeGreaterThan(questionBounds.x + questionBounds.width);
  await expectViewportModal(dialog);
  await page.screenshot({ path: '../tmp/result-question-expanded.png' });
  await dialog.getByRole('button', { name: 'Hide explanation', exact: true }).click();
  await expect(explanation).toHaveCount(0);
  await dialog.getByRole('button', { name: 'Show explanation', exact: true }).click();
  await dialog.getByRole('button', { name: 'Next', exact: true }).click();
  dialog = page.getByRole('dialog', { name: 'Question 2', exact: true });
  await expect(dialog.getByRole('region', { name: 'Explanation', exact: true })).toHaveCount(0);
  await expect(dialog.getByRole('group', { name: 'Choice B, your answer, correct answer', exact: true })).toHaveClass(/bg-success-soft/);
  await dialog.getByRole('button', { name: 'Show explanation', exact: true }).click();
  await expect(dialog.getByRole('region', { name: 'Explanation', exact: true })).toContainText(questions[1].explanation!);
  await page.mouse.click(4, 200);
  await expect(dialog).toHaveCount(0);
  await page.getByRole('button', { name: 'Review question 2', exact: true }).click();
  await expect(dialog.getByRole('button', { name: 'Show explanation', exact: true })).toHaveAttribute('aria-expanded', 'false');
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
});

test('omitted answers and missing explanations remain clear on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await setup(page);
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Question 3', exact: true });
  await expectViewportModal(dialog);
  await expect(dialog.getByText('Omitted', { exact: true })).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Next', exact: true })).toBeDisabled();
  await expect(dialog.getByRole('group', { name: 'Choice A, correct answer', exact: true })).toHaveClass(/bg-success-soft/);
  await dialog.getByRole('button', { name: 'Show explanation', exact: true }).click();
  const explanation = dialog.getByRole('region', { name: 'Explanation', exact: true });
  await expect(explanation).toContainText('No explanation was provided for this question.');
  const questionBounds = (await dialog.getByRole('region', { name: 'Question and answers', exact: true }).boundingBox())!;
  expect((await explanation.boundingBox())!.y).toBeGreaterThanOrEqual(questionBounds.y + questionBounds.height);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
  await page.screenshot({ path: '../tmp/result-question-mobile.png' });
});

test('Math entered responses retain colored values without repeated answer summaries', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const numericQuestions = questions.map((question, index): QuestionResult => ({ ...question, type: 'SPR', questionText: 'x+2=4.\\text{ Find }x.', choices: [], blocks: [], userAnswer: index === 0 ? '3' : index === 1 ? '2' : '', correctAnswer: '2', explanation: '\\text{Subtract 2 from both sides: }x=2.' }));
  await setup(page, 'MATH', numericQuestions);
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByLabel('Your answer: 3', { exact: true })).toHaveClass(/bg-danger-soft/);
  await expect(dialog.getByLabel('Correct answer: 2', { exact: true })).toHaveClass(/bg-success-soft/);
  await expect(dialog.getByText('Your answer', { exact: true })).toHaveCount(0);
  await expect(dialog.getByText('Correct answer', { exact: true })).toHaveCount(0);
  await dialog.getByRole('button', { name: 'Show explanation', exact: true }).click();
  await expect(dialog.getByRole('region', { name: 'Explanation', exact: true }).locator('.katex')).toBeVisible();
  await dialog.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(dialog.getByLabel('Your answer: 2', { exact: true })).toHaveClass(/bg-success-soft/);
  await expect(dialog.getByLabel('Correct answer: 2', { exact: true })).toHaveCount(0);
  await dialog.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(dialog.getByLabel('Your answer: Omitted', { exact: true })).toHaveClass(/bg-warning-soft/);
  await expect(dialog.getByLabel('Correct answer: 2', { exact: true })).toHaveClass(/bg-success-soft/);
});
