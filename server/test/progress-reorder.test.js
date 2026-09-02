const test = require('node:test');
const assert = require('node:assert/strict');
const progressService = require('../src/services/progress.service');

test('the owning teacher can persist a complete week order', async () => {
  const updates = [];
  const db = {
    class: { findUnique: async () => ({ id: 'class-1', teacherId: 7 }) },
    week: {
      findMany: async () => [{ id: 'week-a' }, { id: 'week-b' }, { id: 'week-c' }],
      update: ({ where, data }) => ({ where, data }),
    },
    $transaction: async operations => { updates.push(...operations); },
  };

  const result = await progressService.reorderWeeksWithDb({
    db,
    classId: 'class-1',
    orderedIds: ['week-c', 'week-a', 'week-b'],
    userId: 7,
    userRole: 'TEACHER',
  });

  assert.deepEqual(result.orderedIds, ['week-c', 'week-a', 'week-b']);
  assert.deepEqual(updates, [
    { where: { id: 'week-c' }, data: { order: 0 } },
    { where: { id: 'week-a' }, data: { order: 1 } },
    { where: { id: 'week-b' }, data: { order: 2 } },
  ]);
});

test('a partial or foreign week order is rejected before the transaction', async () => {
  let transactionCalled = false;
  const db = {
    class: { findUnique: async () => ({ id: 'class-1', teacherId: 7 }) },
    week: {
      findMany: async () => [{ id: 'week-a' }, { id: 'week-b' }],
      update: () => assert.fail('updates must not be created'),
    },
    $transaction: async () => { transactionCalled = true; },
  };

  await assert.rejects(
    progressService.reorderWeeksWithDb({ db, classId: 'class-1', orderedIds: ['week-a', 'week-foreign'], userId: 7, userRole: 'TEACHER' }),
    error => error.statusCode === 400,
  );
  assert.equal(transactionCalled, false);
});

test('a student cannot reorder lessons', async () => {
  const db = {
    week: { findUnique: async () => ({ id: 'week-1', class: { id: 'class-1', teacherId: 7 } }) },
    lesson: { findMany: async () => assert.fail('lessons must not be queried') },
    $transaction: async () => assert.fail('transaction must not run'),
  };

  await assert.rejects(
    progressService.reorderLessonsWithDb({ db, weekId: 'week-1', orderedIds: ['lesson-1'], userId: 20, userRole: 'STUDENT' }),
    error => error.statusCode === 403,
  );
});

test('lesson order is scoped to a single week', async () => {
  const updates = [];
  const db = {
    week: { findUnique: async () => ({ id: 'week-1', class: { id: 'class-1', teacherId: 7 } }) },
    lesson: {
      findMany: async ({ where }) => {
        assert.deepEqual(where, { weekId: 'week-1' });
        return [{ id: 'lesson-1' }, { id: 'lesson-2' }];
      },
      update: ({ where, data }) => ({ where, data }),
    },
    $transaction: async operations => { updates.push(...operations); },
  };

  await progressService.reorderLessonsWithDb({
    db,
    weekId: 'week-1',
    orderedIds: ['lesson-2', 'lesson-1'],
    userId: 7,
    userRole: 'TEACHER',
  });

  assert.deepEqual(updates.map(item => item.where.id), ['lesson-2', 'lesson-1']);
});
