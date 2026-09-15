const test = require('node:test');
const assert = require('node:assert/strict');
const {
  buildStudentAnalyticsPayload,
  confidenceOf,
  isTimingEligible,
  sourceOf,
  trendOf,
} = require('../src/utils/analytics-transform');

const domain = { code: 'MATH_ADVANCED_MATH', name: 'Advanced Math', subject: 'MATH', sortOrder: 2 };
const skill = { code: 'MATH_NONLINEAR_EQUATIONS', name: 'Nonlinear Equations', sortOrder: 2 };

const makeAnswers = (correctCount, total, timed = true) => Array.from({ length: total }, (_, index) => ({
  isCorrect: index < correctCount,
  question: { id: index + 1, domain, skill },
  duration: timed ? (index % 3 === 0 ? 150000 : 60000) : null,
}));

const makeSubmission = ({ id = 1, correct = 6, total = 10, subject = 'MATH', status = 'COMPLETED', classroom = false, mode = 'EXAM' } = {}) => {
  const answers = makeAnswers(correct, total);
  return {
    id,
    status,
    startedAt: new Date(`2026-08-${String(10 + id).padStart(2, '0')}T08:00:00Z`),
    endTime: new Date(`2026-08-${String(10 + id).padStart(2, '0')}T09:00:00Z`),
    deliveryId: classroom ? `delivery-${id}` : null,
    assignmentId: null,
    classTestId: null,
    test: { id, title: `Test ${id}`, subject, mode },
    answers: answers.map(({ duration, ...answer }) => answer),
    questionTimings: answers.map(answer => ({ questionId: answer.question.id, activeDurationMs: answer.duration })),
  };
};

test('student analytics excludes incomplete attempts and exposes diagnostic sections', () => {
  const completed = makeSubmission();
  const doing = makeSubmission({ id: 2, status: 'DOING', correct: 10 });
  const errorLogs = [
    { category: skill.name, reviewedAt: null, question: { domain: { code: domain.code }, skill: { code: skill.code }, section: { test: { subject: 'MATH' } } } },
    { category: skill.name, reviewedAt: new Date(), question: { domain: { code: domain.code }, skill: { code: skill.code }, section: { test: { subject: 'MATH' } } } },
  ];

  const payload = buildStudentAnalyticsPayload([completed, doing], errorLogs, { range: '90', subject: 'MATH', now: new Date('2026-08-25T00:00:00Z') });

  assert.equal(payload.snapshot.completedTests, 1);
  assert.equal(payload.snapshot.mathAccuracy, 60);
  assert.equal(payload.snapshot.rwAccuracy, null);
  assert.equal(payload.accuracyTrend.length, 1);
  assert.equal(payload.mistakeReview.needsReview, 1);
  assert.equal(payload.focusAreas[0].name, skill.name);
  assert.equal(payload.focusAreas[0].action, 'REVIEW_MISTAKES');
  assert.equal(payload.pacing.timedQuestions, 10);
  assert.equal(payload.pacing.slowQuestions, 4);
  assert.equal(payload.meta.classificationCoverage.percentage, 100);
});

test('student analytics does not rank skills with a small sample', () => {
  const payload = buildStudentAnalyticsPayload([
    makeSubmission({ total: 4, correct: 0 }),
  ], [], { subject: 'MATH' });

  const advancedMath = payload.skillPerformance.find(item => item.code === domain.code);
  const nonlinear = advancedMath.skills.find(item => item.code === skill.code);
  assert.equal(nonlinear.confidence, 'NOT_ENOUGH_DATA');
  assert.deepEqual(payload.focusAreas, []);
});

test('confidence, trend, and source rules remain deterministic', () => {
  assert.equal(confidenceOf(4), 'NOT_ENOUGH_DATA');
  assert.equal(confidenceOf(5), 'EARLY_SIGNAL');
  assert.equal(confidenceOf(10), 'RANKABLE');
  assert.equal(trendOf([
    ...Array.from({ length: 5 }, (_, index) => ({ correct: true, date: new Date(2026, 0, index + 1) })),
    ...Array.from({ length: 5 }, (_, index) => ({ correct: index < 2, date: new Date(2026, 0, index + 6) })),
  ]), -60);
  assert.equal(sourceOf(makeSubmission({ classroom: true })), 'CLASSROOM');
  assert.equal(sourceOf(makeSubmission()), 'SELF_STUDY');
});

test('pacing ignores partial timings from ineligible Practice attempts', () => {
  const practice = makeSubmission({ mode: 'PRACTICE' });
  const payload = buildStudentAnalyticsPayload([practice], [], { subject: 'MATH' });

  assert.equal(isTimingEligible(practice), false);
  assert.equal(payload.pacing.available, false);
  assert.equal(payload.pacing.timedQuestions, 0);
  assert.equal(payload.meta.timingCoverage.answeredQuestions, 0);
  assert.equal(payload.skillPerformance.find(item => item.code === domain.code).avgTimeMs, null);
});
