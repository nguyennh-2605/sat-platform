const test = require('node:test');
const assert = require('node:assert/strict');

const prismaPath = require.resolve('../src/config/prisma');

const loadService = submission => {
  const calls = [];
  const prisma = {
    submission: {
      findFirst: async () => submission,
      update: async ({ data }) => {
        calls.push(data);
        return { ...submission, ...data };
      },
    },
  };
  require.cache[prismaPath] = { id: prismaPath, filename: prismaPath, loaded: true, exports: prisma };
  const servicePath = require.resolve('../src/services/exam-room.service');
  delete require.cache[servicePath];
  return { service: require(servicePath), calls };
};

const twoModuleSubmission = overrides => ({
  id: 9,
  userId: 4,
  testId: 7,
  status: 'DOING',
  currentModule: 1,
  currentQuestionIndex: 3,
  beganAt: null,
  moduleStartedAt: null,
  moduleExpiresAt: null,
  timeRemaining: 2100,
  test: {
    mode: 'PRACTICE',
    duration: 70,
    sections: [
      { order: 1, questions: Array.from({ length: 22 }, (_, id) => ({ id })) },
      { order: 2, questions: Array.from({ length: 22 }, (_, id) => ({ id: id + 22 })) },
    ],
  },
  ...overrides,
});

test('practice module two receives its own 35-minute clock and starts at its first question', async () => {
  const submission = twoModuleSubmission();
  const { service, calls } = loadService(submission);

  const result = await service.advanceModule({ userId: 4, submissionId: 9, testId: 7 });

  assert.equal(result.currentModule, 2);
  assert.equal(result.currentQuestionIndex, 22);
  assert.equal(result.timeLeft, 35 * 60);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].currentModule, 2);
  assert.equal(calls[0].moduleExpiresAt, null);
});

test('an Exam module cannot be advanced before its server deadline', async () => {
  const now = Date.now();
  const submission = twoModuleSubmission({
    beganAt: new Date(now - 60_000),
    moduleStartedAt: new Date(now - 60_000),
    moduleExpiresAt: new Date(now + 60_000),
    test: { ...twoModuleSubmission().test, mode: 'EXAM' },
  });
  const { service, calls } = loadService(submission);

  await assert.rejects(
    service.advanceModule({ userId: 4, submissionId: 9, testId: 7 }),
    error => error.statusCode === 409 && error.body.error === 'Module 1 is still in progress.',
  );
  assert.equal(calls.length, 1, 'only the authoritative time-left reconciliation is persisted');
  assert.equal(calls[0].currentModule, 1);
});

test('an exhausted delivery conflict points the client to the latest score report', async () => {
  const testRecord = {
    id: 7,
    duration: 70,
    mode: 'PRACTICE',
    authorId: 1,
    sections: [
      { order: 1, questions: [{ id: 1 }] },
      { order: 2, questions: [{ id: 2 }] },
    ],
  };
  const prisma = {
    test: { findUnique: async () => testRecord },
    testDelivery: {
      findUnique: async () => ({ id: 'delivery-1', testId: 7, maxAttempts: 1, legacyClassTestId: null }),
    },
    $transaction: async callback => callback({
      $executeRaw: async () => 0,
      submission: {
        findFirst: async () => null,
        findMany: async () => [{ id: 42, attemptNo: 1, status: 'COMPLETED' }],
      },
    }),
  };
  require.cache[prismaPath] = { id: prismaPath, filename: prismaPath, loaded: true, exports: prisma };
  const servicePath = require.resolve('../src/services/exam-room.service');
  delete require.cache[servicePath];
  const service = require(servicePath);

  await assert.rejects(
    service.startOrResumeTest({
      testId: 7,
      userId: 4,
      userRole: 'ADMIN',
      deliveryId: 'delivery-1',
    }),
    error => error.statusCode === 409
      && error.body.code === 'ATTEMPT_LIMIT_REACHED'
      && error.body.submissionId === 42,
  );
});
