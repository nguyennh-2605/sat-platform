const test = require('node:test');
const assert = require('node:assert/strict');
const { _assignmentReviewHelpers } = require('../src/services/assignment.service');

const { reviewState, summarizeStudentWork, validateMaxPoints } = _assignmentReviewHelpers;
const now = new Date('2026-09-04T08:00:00.000Z');

test('assignment work state distinguishes open, missing, submitted, and reviewed work', () => {
  assert.equal(reviewState(null, new Date('2026-09-05T08:00:00.000Z'), now), 'NOT_SUBMITTED');
  assert.equal(reviewState(null, new Date('2026-09-03T08:00:00.000Z'), now), 'MISSING');
  assert.equal(reviewState({ submittedAt: new Date('2026-09-04T07:00:00.000Z'), reviewedAt: null }, null, now), 'NEEDS_REVIEW');
  assert.equal(reviewState({ submittedAt: new Date('2026-09-04T07:00:00.000Z'), reviewedAt: new Date('2026-09-04T07:30:00.000Z') }, null, now), 'REVIEWED');
});

test('a resubmission after review returns to the review queue', () => {
  const submission = {
    submittedAt: new Date('2026-09-04T07:30:00.000Z'),
    reviewedAt: new Date('2026-09-04T07:00:00.000Z'),
  };
  assert.equal(reviewState(submission, null, now), 'NEEDS_REVIEW');
});

test('maximum points supports feedback-only assignments and rejects invalid ranges', () => {
  assert.equal(validateMaxPoints(undefined), undefined);
  assert.equal(validateMaxPoints(null), null);
  assert.equal(validateMaxPoints('10'), 10);
  assert.throws(() => validateMaxPoints(0), error => error.statusCode === 400);
  assert.throws(() => validateMaxPoints(10001), error => error.statusCode === 400);
});

test('student work summary keeps pending work separate from overdue missing work', () => {
  const summary = summarizeStudentWork([
    { state: 'NEEDS_REVIEW', submittedAt: now },
    { state: 'REVIEWED', submittedAt: now },
    { state: 'NOT_SUBMITTED', submittedAt: null },
    { state: 'MISSING', submittedAt: null },
  ]);
  assert.deepEqual(summary, { assigned: 4, submitted: 2, needsReview: 1, reviewed: 1, missing: 1, pending: 1 });
});
