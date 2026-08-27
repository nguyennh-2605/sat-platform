const test = require('node:test');
const assert = require('node:assert/strict');
const ApiError = require('../src/utils/ApiError');
const {
  AUDIT_ACTIONS,
  decodeCursor,
  getRecentActivityWithDb,
  recordAuditEvent,
  sanitizeMetadata,
} = require('../src/services/audit-event.service');

test('audit metadata keeps only action-specific safe fields', () => {
  assert.deepEqual(sanitizeMetadata(AUDIT_ACTIONS.TEST_ASSIGNED, {
    testTitle: 'Practice Test',
    testCount: 2,
    assigneeCount: 12,
    accessToken: 'must-not-be-persisted',
  }), {
    testTitle: 'Practice Test',
    testCount: 2,
    assigneeCount: 12,
  });
});

test('recordAuditEvent snapshots actor and entity labels without email data', async () => {
  let createArgs;
  const db = {
    user: {
      findUnique: async () => ({ name: 'Teacher One', role: 'TEACHER' }),
    },
    auditEvent: {
      create: async args => {
        createArgs = args;
        return args.data;
      },
    },
  };

  await recordAuditEvent(db, {
    action: AUDIT_ACTIONS.CLASS_CREATED,
    actorUserId: 4,
    entityType: 'CLASS',
    entityId: 'class-1',
    entityLabel: 'SAT Morning',
  });

  assert.equal(createArgs.data.category, 'CLASSROOM');
  assert.equal(createArgs.data.actorLabel, 'Teacher One');
  assert.equal(createArgs.data.actorRole, 'TEACHER');
  assert.equal(createArgs.data.entityLabel, 'SAT Morning');
  assert.equal(JSON.stringify(createArgs.data).includes('@'), false);
});

test('recent activity returns safe display rows and a stable composite cursor', async () => {
  const first = {
    id: 'event-b',
    action: AUDIT_ACTIONS.TEST_ASSIGNED,
    category: 'DELIVERY',
    actorUserId: 4,
    actorLabel: 'Teacher One',
    actorRole: 'TEACHER',
    entityType: 'CLASS',
    entityId: 'class-1',
    entityLabel: 'SAT Morning',
    metadata: { testTitle: 'Practice Test', testCount: 1, assigneeCount: 10, secret: 'hidden' },
    createdAt: new Date('2026-08-27T08:00:00.000Z'),
  };
  const second = { ...first, id: 'event-a', action: AUDIT_ACTIONS.CLASS_CREATED, category: 'CLASSROOM' };
  let query;
  const db = { auditEvent: { findMany: async args => { query = args; return [first, second]; } } };
  const result = await getRecentActivityWithDb({ db, limit: 1 });

  assert.equal(result.items.length, 1);
  assert.equal(result.items[0].detail, 'Practice Test · SAT Morning');
  assert.equal(Object.hasOwn(result.items[0], 'metadata'), false);
  assert.equal(result.items[0].href, '/dashboard/class/class-1?tab=activities');
  assert.equal(query.take, 2);
  assert.deepEqual(decodeCursor(result.nextCursor), { id: first.id, createdAt: first.createdAt });
});

test('recent activity rejects malformed cursors', () => {
  assert.throws(
    () => decodeCursor('not-a-valid-cursor'),
    error => error instanceof ApiError && error.statusCode === 400,
  );
});
