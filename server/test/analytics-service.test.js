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

test('submission detail returns deterministic attempt, module, domain, pacing, and explanation data', async () => {
  const db = {
    submission: {
      findFirst: async () => ({
        id: 42,
        attemptNo: 2,
        startedAt: new Date('2026-09-15T08:00:00.000Z'),
        beganAt: new Date('2026-09-15T08:05:00.000Z'),
        endTime: new Date('2026-09-15T08:35:00.000Z'),
        test: { title: 'Math Check', subject: 'MATH', mode: 'EXAM' },
        answers: [
          {
            selectedChoice: 'A',
            isCorrect: true,
            question: {
              id: 1,
              type: 'MCQ',
              order: 1,
              blocks: [],
              questionText: 'Correct question',
              choices: ['One', 'Two'],
              correctAnswer: 'A',
              explanation: 'Because A is correct.',
              domainCode: 'MATH_ALGEBRA',
              skillCode: 'MATH_LINEAR_FUNCTIONS',
              section: { id: 10, name: 'First Module', order: 1 },
            },
          },
          {
            selectedChoice: null,
            isCorrect: false,
            question: {
              id: 2,
              type: 'SPR',
              order: 1,
              blocks: [],
              questionText: 'Omitted question',
              choices: [],
              correctAnswer: '12',
              explanation: null,
              domainCode: null,
              skillCode: null,
              section: { id: 20, name: '', order: 2 },
            },
          },
          {
            selectedChoice: 'B',
            isCorrect: false,
            question: {
              id: 3,
              type: 'MCQ',
              order: 2,
              blocks: [],
              questionText: 'Incorrect question',
              choices: [{ id: 'A', text: 'One' }, { id: 'B', text: 'Two' }],
              correctAnswer: 'A',
              explanation: 'Use the slope formula.',
              domainCode: 'MATH_ALGEBRA',
              skillCode: 'MATH_LINEAR_FUNCTIONS',
              section: { id: 10, name: 'First Module', order: 1 },
            },
          },
        ],
        questionTimings: [
          { questionId: 1, activeDurationMs: 60_000 },
          { questionId: 2, activeDurationMs: 120_000 },
          { questionId: 3, activeDurationMs: 180_000 },
        ],
        errorLogs: [
          { id: '00000000-0000-4000-8000-000000000003', questionId: 3 },
          { id: '00000000-0000-4000-8000-000000000002', questionId: 2 },
        ],
      }),
    },
  };

  const report = await getSubmissionDetailWithDb({ db, id: 42, userId: 7 });

  assert.deepEqual(report.summary, {
    total: 3,
    correct: 1,
    incorrect: 1,
    omitted: 1,
    activeDurationMs: 360_000,
    timedQuestions: 3,
    accuracy: 33.3,
    timingCoverage: 100,
  });
  assert.deepEqual(report.modules.map(module => [module.order, module.total, module.correct, module.omitted]), [
    [1, 2, 1, 0],
    [2, 1, 0, 1],
  ]);
  assert.deepEqual(report.domains.map(domain => [domain.code, domain.total]), [
    ['MATH_ALGEBRA', 2],
    ['MATH_ADVANCED_MATH', 0],
    ['MATH_PROBLEM_SOLVING_AND_DATA_ANALYSIS', 0],
    ['MATH_GEOMETRY_AND_TRIGONOMETRY', 0],
    ['UNCLASSIFIED', 1],
  ]);
  assert.equal(report.domains[0].skills[0].name, 'Linear Functions');
  assert.equal(report.questions[1].errorLogId, '00000000-0000-4000-8000-000000000003');
  assert.equal(report.questions[1].explanation, 'Use the slope formula.');
  assert.equal(report.questions[2].isOmitted, true);
  assert.deepEqual(report.questions[0].choices, [{ id: 'A', text: 'One' }, { id: 'B', text: 'Two' }]);
  assert.deepEqual(report.pacing.slowestQuestion, {
    id: 3,
    questionNumber: 2,
    moduleOrder: 1,
    activeDurationMs: 180_000,
  });
  assert.equal(report.elapsedDurationMs, 1_800_000);
  assert.equal(report.duration, '30:00');
});
