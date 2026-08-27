const test = require('node:test');
const assert = require('node:assert/strict');
const {
  recommendedWeakSubject,
  selectFocus,
  subjectPerformance,
} = require('../src/services/student-overview.service');

const baseFocusInput = {
  todos: [],
  doingSubmission: null,
  vocabularySession: null,
  completedTests: 1,
  savedMistakeCount: 0,
  weakSubject: null,
  practice: [],
};

test('student focus prioritizes urgent classroom work over self-study work', () => {
  const focus = selectFocus({
    ...baseFocusInput,
    savedMistakeCount: 8,
    todos: [{
      key: 'student-test:one', type: 'TEST', priority: 'OVERDUE', classId: 'class-1', className: 'SAT Cohort',
      title: 'Module Check', dueAt: '2026-08-20T00:00:00.000Z', testId: 12, deliveryId: 'delivery-1',
    }],
  });
  assert.equal(focus.type, 'CLASSROOM');
  assert.equal(focus.todoKey, 'student-test:one');
  assert.equal(focus.href, '/test/12?deliveryId=delivery-1');
});

test('student focus continues an in-progress test before suggesting review', () => {
  const focus = selectFocus({
    ...baseFocusInput,
    savedMistakeCount: 4,
    doingSubmission: {
      status: 'DOING', deliveryId: null, savedAnswers: { 1: 'A' },
      test: { id: 7, title: 'Math Practice', subject: 'MATH', duration: 35, sections: [{ _count: { questions: 4 } }] },
    },
  });
  assert.equal(focus.type, 'TEST');
  assert.equal(focus.progress, 25);
  assert.equal(focus.href, '/test/7');
});

test('student focus uses the first available practice to build a baseline', () => {
  const focus = selectFocus({
    ...baseFocusInput,
    completedTests: 0,
    practice: [{ id: 4, title: 'System Test 1', subject: 'RW', duration: 64, questionCount: 54, attemptStatus: 'NOT_STARTED' }],
  });
  assert.equal(focus.type, 'BASELINE');
  assert.equal(focus.testId, 4);
});

test('weak-subject recommendation requires enough classified evidence', () => {
  const performance = subjectPerformance([
    { subject: 'RW', totalQuestions: 12, correctCount: 6 },
    { subject: 'MATH', totalQuestions: 12, correctCount: 10 },
  ]);
  assert.equal(recommendedWeakSubject(performance, {
    summary: { questionsAttempted: 24 },
    classificationCoverage: { percentage: 80 },
  }), 'RW');
  assert.equal(recommendedWeakSubject(performance, {
    summary: { questionsAttempted: 24 },
    classificationCoverage: { percentage: 60 },
  }), null);
});

