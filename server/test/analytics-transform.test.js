const test = require('node:test');
const assert = require('node:assert/strict');
const { buildAnalyticsPayload } = require('../src/utils/analytics-transform');

const answer = (isCorrect, domain = null, skill = null) => ({
  isCorrect,
  question: { domain, skill },
});

const rwCraft = { code: 'RW_CRAFT_AND_STRUCTURE', name: 'Craft and Structure', subject: 'RW', sortOrder: 2 };
const rwWords = { code: 'RW_WORDS_IN_CONTEXT', name: 'Words in Context', sortOrder: 1 };
const mathAlgebra = { code: 'MATH_ALGEBRA', name: 'Algebra', subject: 'MATH', sortOrder: 1 };
const mathLinear = { code: 'MATH_LINEAR_EQUATIONS_ONE_VARIABLE', name: 'Linear Equations in One Variable', sortOrder: 1 };

test('analytics summary counts completed submissions only', () => {
  const payload = buildAnalyticsPayload([
    { id: 1, status: 'COMPLETED', startedAt: new Date('2026-08-19T08:00:00Z'), test: { id: 1, title: 'RW 1', subject: 'RW' }, answers: [answer(true, rwCraft, rwWords), answer(false, rwCraft, rwWords)] },
    { id: 2, status: 'DOING', startedAt: new Date('2026-08-20T08:00:00Z'), test: { id: 2, title: 'Math 1', subject: 'MATH' }, answers: [answer(true, mathAlgebra, mathLinear)] },
  ], { now: new Date('2026-08-20T12:00:00Z'), days: 84 });

  assert.deepEqual(payload.summary, { overallAccuracy: 50, correctAnswers: 1, questionsAttempted: 2, completedTests: 1 });
  assert.equal(payload.historyData.length, 2);
});

test('analytics separates RW and Math score history and aggregates content domains', () => {
  const payload = buildAnalyticsPayload([
    { id: 1, status: 'COMPLETED', startedAt: new Date('2026-08-18T08:00:00Z'), test: { id: 1, title: 'RW', subject: 'RW' }, answers: [answer(true, rwCraft, rwWords), answer(false, rwCraft, rwWords)] },
    { id: 2, status: 'COMPLETED', startedAt: new Date('2026-08-19T08:00:00Z'), test: { id: 2, title: 'Math', subject: 'MATH' }, answers: [answer(true, mathAlgebra, mathLinear), answer(true, mathAlgebra, mathLinear)] },
  ], { now: new Date('2026-08-20T12:00:00Z'), days: 84 });

  assert.deepEqual(payload.scoreHistory.map(item => [item.rw, item.math]), [[50, null], [null, 100]]);
  assert.deepEqual(payload.sectionPerformance.filter(item => item.attempted > 0).map(item => [item.name, item.accuracy, item.attempted]), [['Craft and Structure', 50, 2], ['Algebra', 100, 2]]);
  assert.deepEqual(payload.sectionPerformance.find(item => item.code === 'RW_CRAFT_AND_STRUCTURE').skills.filter(item => item.attempted > 0).map(item => [item.name, item.accuracy]), [['Words in Context', 50]]);
  assert.deepEqual(payload.classificationCoverage, { classified: 4, total: 4, percentage: 100, uncategorizedAttempted: 0, uncategorizedCorrect: 0 });
});

test('analytics leaves uncategorized legacy questions out of SAT domains', () => {
  const payload = buildAnalyticsPayload([
    { id: 1, status: 'COMPLETED', startedAt: new Date('2026-08-20T08:00:00Z'), test: { id: 1, title: 'Legacy', subject: 'RW' }, answers: [answer(true)] },
  ], { now: new Date('2026-08-20T12:00:00Z'), days: 7 });

  assert.equal(payload.sectionPerformance.every(item => item.attempted === 0), true);
  assert.deepEqual(payload.classificationCoverage, { classified: 0, total: 1, percentage: 0, uncategorizedAttempted: 1, uncategorizedCorrect: 1 });
});

test('analytics heatmap always returns twelve weeks and records activity', () => {
  const payload = buildAnalyticsPayload([
    { id: 1, status: 'DOING', startedAt: new Date('2026-08-20T08:00:00Z'), test: { id: 1, title: 'Test', subject: 'RW' }, answers: [] },
  ], { now: new Date('2026-08-20T12:00:00Z') });

  assert.equal(payload.heatmapData.length, 84);
  assert.equal(payload.heatmapData.at(-1).count, 1);
});
