const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeQuestionTimingSnapshot, timingRowsFromSnapshot } = require('../src/utils/question-timing');

test('question timing keeps only test questions and caps total active time', () => {
  const result = normalizeQuestionTimingSnapshot({
    snapshot: {
      10: { activeDurationMs: 4000, visitCount: 2 },
      11: { activeDurationMs: 9000, visitCount: 3 },
      99: { activeDurationMs: 2000, visitCount: 1 },
    },
    questionIds: [10, 11],
    maxTotalMs: 10000,
  });

  assert.deepEqual(result, {
    10: { activeDurationMs: 4000, visitCount: 2 },
    11: { activeDurationMs: 6000, visitCount: 3 },
  });
});

test('question timing snapshot converts to idempotent final rows', () => {
  assert.deepEqual(timingRowsFromSnapshot({
    submissionId: 7,
    snapshot: { 10: { activeDurationMs: 1200, visitCount: 1 } },
  }), [{ submissionId: 7, questionId: 10, activeDurationMs: 1200, visitCount: 1 }]);
});
