const test = require('node:test');
const assert = require('node:assert/strict');
const { buildAttemptSummary } = require('../src/utils/practice-test-progress');

test('a test without a submission is shown as not started', () => {
  assert.deepEqual(buildAttemptSummary({ questionCount: 20, submission: null }), {
    progress: 0,
    isDoing: false,
    attemptStatus: 'NOT_STARTED',
    lastAttempt: null,
    lastScore: null
  });
});

test('an active submission reports progress from persisted answers', () => {
  const startedAt = new Date('2026-08-20T08:00:00.000Z');
  assert.deepEqual(buildAttemptSummary({
    questionCount: 4,
    submission: {
      status: 'DOING',
      savedAnswers: { 1: 'A', 2: '', 3: 'C' },
      startedAt,
      beganAt: null,
      endTime: null,
      score: null
    }
  }), {
    progress: 50,
    isDoing: true,
    attemptStatus: 'DOING',
    lastAttempt: startedAt,
    lastScore: null
  });
});

test('a completed submission always reports 100 percent and its score', () => {
  const endTime = new Date('2026-08-20T09:00:00.000Z');
  const summary = buildAttemptSummary({
    questionCount: 4,
    submission: {
      status: 'COMPLETED',
      savedAnswers: {},
      startedAt: new Date('2026-08-20T08:00:00.000Z'),
      beganAt: null,
      endTime,
      score: 3
    }
  });

  assert.equal(summary.progress, 100);
  assert.equal(summary.attemptStatus, 'COMPLETED');
  assert.equal(summary.lastAttempt, endTime);
  assert.equal(summary.lastScore, 3);
});
