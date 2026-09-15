const test = require('node:test');
const assert = require('node:assert/strict');
const {
  getAttemptsWithDb,
  getDataWithDb,
  getSubmissionDetailWithDb,
} = require('../src/services/analytics.service');

const now = new Date('2026-09-15T12:00:00.000Z');

test('analytics pushes the subject and date filters into the submission query', async () => {
  let submissionQuery;
  const db = {
    submission: {
      findMany: async query => {
        submissionQuery = query;
        return [];
      },
    },
    errorLog: { findMany: async () => [] },
  };

  await getDataWithDb({ db, userId: 7, range: '30', subject: 'MATH', now });

  assert.deepEqual(submissionQuery.where, {
    userId: 7,
    status: 'COMPLETED',
    startedAt: { gte: new Date('2026-08-16T00:00:00.000Z') },
    test: { subject: 'MATH' },
  });
  assert.equal(submissionQuery.select.test.select.category, undefined);
  assert.equal(submissionQuery.select.questionTimings.select.visitCount, undefined);
});

test('attempt pagination aggregates counts and timing without loading answer rows', async () => {
  let submissionQuery;
  let answerQuery;
  let timingQuery;
  const rows = [
    {
      id: 12,
      status: 'COMPLETED',
      startedAt: new Date('2026-09-14T08:00:00.000Z'),
      beganAt: new Date('2026-09-14T08:05:00.000Z'),
      endTime: new Date('2026-09-14T08:35:00.000Z'),
      assignmentId: null,
      classTestId: null,
      deliveryId: 'delivery-1',
      test: { title: 'Math Exam', subject: 'MATH', mode: 'EXAM' },
      _count: { answers: 20 },
    },
    {
      id: 11,
      status: 'COMPLETED',
      startedAt: new Date('2026-09-13T08:00:00.000Z'),
      beganAt: null,
      endTime: new Date('2026-09-13T08:30:00.000Z'),
      assignmentId: null,
      classTestId: null,
      deliveryId: null,
      test: { title: 'Extra row', subject: 'RW', mode: 'PRACTICE' },
      _count: { answers: 10 },
    },
  ];
  const db = {
    submission: { findMany: async query => { submissionQuery = query; return rows; } },
    answer: { groupBy: async query => { answerQuery = query; return [{ submissionId: 12, _count: { _all: 15 } }]; } },
    questionTiming: { groupBy: async query => { timingQuery = query; return [{ submissionId: 12, _sum: { activeDurationMs: 1_200_000 } }]; } },
  };

  const result = await getAttemptsWithDb({ db, userId: 7, query: { range: '90', limit: 1 }, now });

  assert.deepEqual(submissionQuery.select._count, { select: { answers: true } });
  assert.equal(submissionQuery.select.answers, undefined);
  assert.equal(submissionQuery.select.questionTimings, undefined);
  assert.deepEqual(answerQuery.where, { submissionId: { in: [12] }, isCorrect: true });
  assert.deepEqual(timingQuery.where, { submissionId: { in: [12] } });
  assert.deepEqual(result.items[0], {
    id: 12,
    testName: 'Math Exam',
    subject: 'MATH',
    mode: 'EXAM',
    accuracy: 75,
    correctCount: 15,
    totalQuestions: 20,
    durationMs: 1_200_000,
    durationSource: 'ACTIVE',
    source: 'CLASSROOM',
    completedAt: '2026-09-14T08:35:00.000Z',
  });
  assert.ok(result.nextCursor);
});

test('submission detail only queries completed submissions owned by the student', async () => {
  let query;
  const db = { submission: { findFirst: async value => { query = value; return null; } } };

  await assert.rejects(
    getSubmissionDetailWithDb({ db, id: '42', userId: 7 }),
    error => error.statusCode === 404,
  );

  assert.deepEqual(query.where, { id: 42, userId: 7, status: 'COMPLETED' });
  assert.equal(query.select.test.select.description, undefined);
  assert.equal(query.select.answers.select.question.select.section.select.order, true);
});

test('submission detail rejects ambiguous ids before querying the database', async () => {
  let queried = false;
  const db = { submission: { findFirst: async () => { queried = true; } } };

  await assert.rejects(
    getSubmissionDetailWithDb({ db, id: '12abc', userId: 7 }),
    error => error.statusCode === 400,
  );
  assert.equal(queried, false);
});
