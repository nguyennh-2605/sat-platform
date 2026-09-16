const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeFollowUp } = require('../src/services/learning-follow-up.service');
const { deriveFollowUpStatus, followUpOutcome, parseRange } = require('../src/services/class-performance.service');

test('follow-up context keeps only the assigned classroom audience', () => {
  const normalized = normalizeFollowUp({
    actionType: 'TEST',
    assigneeIds: [1, 2],
    followUp: {
      sourceType: 'SKILL_SIGNAL',
      subject: 'RW',
      skillCode: 'SEC-BND',
      skillName: 'Boundaries',
      baselineAccuracy: 48,
      baselineAnswerCount: 25,
      studentIds: [2],
    },
  });
  assert.equal(normalized.actionType, 'TEST');
  assert.equal(normalized.sourceType, 'SKILL_SIGNAL');
  assert.deepEqual(normalized.studentIds, [2]);
  assert.equal(normalized.baselineAccuracy, 48);
});

test('follow-up context rejects students outside the activity audience', () => {
  assert.throws(() => normalizeFollowUp({
    actionType: 'HOMEWORK',
    assigneeIds: [1, 2],
    followUp: { sourceType: 'STUDENT_CHECK_IN', studentIds: [3] },
  }), /audience/);
});

test('follow-up status becomes ready only after every active assignee completes', () => {
  const base = { status: 'ASSIGNED', activities: [{ assignees: [{ status: 'COMPLETED', excusedAt: null }, { status: 'IN_PROGRESS', excusedAt: null }] }] };
  assert.equal(deriveFollowUpStatus(base), 'IN_PROGRESS');
  base.activities[0].assignees[1].status = 'COMPLETED';
  assert.equal(deriveFollowUpStatus(base), 'READY_TO_EVALUATE');
  base.status = 'RESOLVED';
  assert.equal(deriveFollowUpStatus(base), 'RESOLVED');
});

test('verification compares only answers matching the original skill', () => {
  const answers = [true, true, true, true, false, false].map((isCorrect, index) => ({
    isCorrect,
    question: { skillCode: index < 5 ? 'SEC-BND' : 'OTHER', domainCode: 'SEC' },
  }));
  const result = followUpOutcome({
    skillCode: 'SEC-BND',
    domainCode: 'SEC',
    baselineAccuracy: 40,
    targets: [{ studentId: 1 }],
    activities: [{
      test: { testDelivery: { scorePolicy: 'FIRST', assignees: [{ studentId: 1, excusedAt: null }], submissions: [{ userId: 1, attemptNo: 1, status: 'COMPLETED', score: 4, answers }] } },
    }],
  });
  assert.deepEqual(result, { correct: 4, answerCount: 5, accuracy: 80, sufficient: true, delta: 40 });
});

test('class performance range accepts only bounded reporting windows', () => {
  assert.equal(parseRange('7d'), 7);
  assert.equal(parseRange('90'), 90);
  assert.equal(parseRange('all'), 30);
});
