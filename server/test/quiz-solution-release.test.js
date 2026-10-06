const test = require('node:test');
const assert = require('node:assert/strict');

const prismaPath = require.resolve('../src/config/prisma');
const prisma = {
  $transaction() {},
  submission: { findFirst() {}, findUnique() {}, updateMany() {}, count() {} },
  test: { findUnique() {} },
  testDelivery: { findUnique() {} },
  user: { findUnique() {} },
  answer: { deleteMany() {}, createMany() {} },
  errorLog: { findFirst() {}, findMany() {}, createMany() {} },
  $queryRaw() {},
};
require.cache[prismaPath] = { id: prismaPath, filename: prismaPath, loaded: true, exports: prisma };

const { isSubmissionSolutionLocked } = require('../src/utils/solution-access');
const { getSubmissionDetailWithDb } = require('../src/services/analytics.service');
const { submitTest } = require('../src/services/exam-room.service');
const errorLogService = require('../src/services/error-log.service');
const { _errorLogGoogleSheetsHelpers: { loadExportEntries } } = require('../src/services/error-log-google-sheets.service');
const { activeLockedQuestionIds, answerRoadmapQuestion } = require('../src/services/question-bank.service');

const delivery = (type = 'QUIZ', dueAt = new Date(Date.now() + 86_400_000)) => ({
  status: 'PUBLISHED', dueAt, activity: { activity: { type } },
});
const question = {
  id: 1, type: 'MCQ', order: 1, blocks: [], questionText: 'Which answer is correct?',
  choices: ['First', 'Second', 'Third', 'Fourth'], correctAnswer: 'A', explanation: 'First is correct.',
  section: { id: 10, name: 'Quiz', order: 1 },
};

test('all completed attempts release solutions regardless of delivery type, deadline, or status', () => {
  for (const type of ['QUIZ', 'TEST', undefined]) {
    for (const dueAt of [null, new Date(Date.now() + 86_400_000), new Date(0)]) {
      for (const status of ['PUBLISHED', 'DRAFT', 'ARCHIVED']) {
        assert.equal(isSubmissionSolutionLocked({ status: 'COMPLETED', delivery: { ...delivery(type, dueAt), status } }), false);
      }
    }
  }
  assert.equal(isSubmissionSolutionLocked({ status: 'COMPLETED', delivery: { status: 'PUBLISHED', dueAt: null } }), false);
  assert.equal(isSubmissionSolutionLocked({ status: 'COMPLETED', delivery: null }), false);
});

test('unfinished assigned attempts still do not expose solutions', () => {
  for (const type of ['QUIZ', 'TEST']) {
    for (const dueAt of [null, new Date(Date.now() + 86_400_000)]) {
      assert.equal(isSubmissionSolutionLocked({ status: 'DOING', delivery: delivery(type, dueAt) }), true);
    }
  }
  assert.equal(isSubmissionSolutionLocked({ status: 'DOING', delivery: delivery('QUIZ', new Date(0)) }), false);
});

for (const { type, dueAt, deadlineLabel } of ['QUIZ', 'TEST'].flatMap(type => [
  { type, dueAt: null, deadlineLabel: 'no deadline' },
  { type, dueAt: new Date(Date.now() + 86_400_000), deadlineLabel: 'future deadline' },
])) {
  for (const initialStatus of ['DOING', 'COMPLETED']) {
    test(`${type} submit response releases the committed submission (${initialStatus}, ${deadlineLabel})`, async t => {
      const submission = {
        id: 42, userId: 7, testId: 5, status: initialStatus, deliveryId: 'delivery-1',
        attemptNo: 1, savedAnswers: { 1: 'B' }, violationCount: 0,
      };
      const completed = { ...submission, status: 'COMPLETED', endTime: new Date() };
      t.mock.method(prisma.submission, 'findFirst', async query => {
        assert.equal(query.where.userId, 7);
        return submission;
      });
      t.mock.method(prisma.submission, 'findUnique', async () => completed);
      t.mock.method(prisma.submission, 'updateMany', async () => ({ count: initialStatus === 'DOING' ? 1 : 0 }));
      t.mock.method(prisma.submission, 'count', async () => 0);
      t.mock.method(prisma.test, 'findUnique', async () => ({
        id: 5, title: 'Assigned Quiz', subject: 'RW', mode: 'PRACTICE',
        sections: [{ name: 'Quiz', order: 1, questions: [question] }],
      }));
      t.mock.method(prisma.testDelivery, 'findUnique', async () => delivery(type, dueAt));
      t.mock.method(prisma.user, 'findUnique', async () => ({ name: 'Student' }));
      t.mock.method(prisma, '$transaction', async callback => callback(prisma));
      t.mock.method(prisma, '$queryRaw', async () => []);
      t.mock.method(prisma.answer, 'deleteMany', async () => ({ count: 0 }));
      t.mock.method(prisma.answer, 'createMany', async () => ({ count: 1 }));
      t.mock.method(prisma.errorLog, 'createMany', async () => ({ count: 1 }));

      const result = await submitTest({ userId: 7, submissionId: 42, testId: 5, answers: { 1: 'B' } });

      assert.equal(result.solutionsLocked, false);
      assert.equal(result.details[0].correctOption, 'A');
      assert.equal(result.details[0].isCorrect, false);
      assert.equal(result.solutionAvailableAt, null);
    });
  }

  test(`${type} completed Score Report releases solutions (${deadlineLabel})`, async () => {
    const db = { submission: { findFirst: async query => {
      assert.deepEqual(query.where, { id: 42, userId: 7, status: 'COMPLETED' });
      assert.equal(query.select.delivery.select.activity.select.activity.select.type, true);
      return {
        id: 42, attemptNo: 1, startedAt: new Date(), endTime: new Date(),
        test: { title: 'Assigned Quiz', subject: 'RW', mode: 'PRACTICE' },
        delivery: delivery(type, dueAt), answers: [{ selectedChoice: 'B', isCorrect: false, question }],
        questionTimings: [], errorLogs: [],
      };
    } } };
    const result = await getSubmissionDetailWithDb({ db, id: 42, userId: 7 });
    assert.equal(result.solutionsLocked, false);
    assert.equal(result.questions[0].correctAnswer, 'A');
    assert.equal(result.questions[0].explanation, question.explanation);
    assert.equal(result.solutionAvailableAt, null);
  });

  test(`${type} Error Log reads and exports release solutions (${deadlineLabel})`, async t => {
    const entry = {
      id: '00000000-0000-4000-8000-000000000001', correctAnswer: 'A',
      questionSnapshot: question, submission: { status: 'COMPLETED', delivery: delivery(type, dueAt) },
    };
    t.mock.method(prisma.errorLog, 'findFirst', async query => {
      assert.equal(query.where.userId, 7);
      assert.equal(query.select.submission.select.status, true);
      return entry;
    });
    t.mock.method(prisma.errorLog, 'findMany', async query => {
      assert.equal(query.where.userId, 7);
      assert.equal(query.select.submission.select.status, true);
      return [entry];
    });

    const row = await errorLogService.getErrorLog({ id: entry.id, userId: 7 });
    const review = await errorLogService.getErrorLogQuestion({ id: entry.id, userId: 7 });
    const [exportRow] = await loadExportEntries(7);
    assert.equal(row.correctAnswer, 'A');
    assert.equal(review.question.explanation, question.explanation);
    assert.equal(exportRow.correctAnswer, 'A');
    assert.equal(row.submission, undefined);
    assert.equal(exportRow.submission, undefined);
  });
}

test('bank availability ignores every delivery completed by the requesting student', async () => {
  const db = { question: { findMany: async query => {
    const openDelivery = query.where.section.test.deliveries.some;
    assert.equal(openDelivery.status, 'PUBLISHED');
    assert.deepEqual(openDelivery.assignees, { some: { studentId: 7, excusedAt: null } });
    assert.deepEqual(openDelivery.NOT, {
      submissions: { some: { userId: 7, status: 'COMPLETED' } },
    });
    return [{ sourceBankQuestionId: 'question-still-used-in-open-test' }];
  } } };
  const locked = await activeLockedQuestionIds({ db, userId: 7, questionIds: ['question-still-used-in-open-test'] });
  assert.equal(locked.has('question-still-used-in-open-test'), true);
});

test('checking a practice question returns feedback even when another assigned delivery uses it', async t => {
  let embargoReads = 0;
  const version = { id: 'version-1', choices: [{ id: 'A', text: 'First' }, { id: 'B', text: 'Second' }], correctAnswer: 'A', explanation: 'First is correct.' };
  const tx = {
    roadmapMilestone: {
      findFirst: async () => ({ id: 'milestone-1', skills: [{ skillCode: 'RW_INFERENCES' }] }),
      findUnique: async () => ({ requiredQuestionCount: 2 }),
    },
    questionBankItem: { findFirst: async () => ({ id: 'bank-1', type: 'MCQ', versions: [version] }) },
    bankQuestionAttempt: { create: async () => ({}), groupBy: async () => [{ questionId: 'bank-1' }] },
    studentBankQuestionProgress: { upsert: async () => ({}) },
    studentMilestoneProgress: { upsert: async () => ({}) },
    question: { findMany: async () => { embargoReads++; return [{ sourceBankQuestionId: 'bank-1' }]; } },
  };
  t.mock.method(prisma, '$transaction', async callback => callback(tx));
  const result = await answerRoadmapQuestion({ userId: 7, milestoneId: 'milestone-1', questionId: 'bank-1', selectedChoice: 'B' });
  assert.equal(result.solutionLocked, false);
  assert.equal(result.isCorrect, false);
  assert.equal(result.correctAnswer, 'A');
  assert.equal(result.explanation, version.explanation);
  assert.equal(result.completed, false);
  assert.equal(embargoReads, 0);
});
