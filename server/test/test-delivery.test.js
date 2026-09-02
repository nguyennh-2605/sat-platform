const test = require('node:test');
const assert = require('node:assert/strict');
const { chooseAttempt, percentageScore, createDeliveriesWithDb } = require('../src/services/test-delivery.service');

const attempts = [
  { id: 1, status: 'COMPLETED', score: 7, attemptNo: 1 },
  { id: 2, status: 'COMPLETED', score: 9, attemptNo: 2 },
  { id: 3, status: 'DOING', score: 10, attemptNo: 3 },
];

test('delivery score policy selects first, best, or latest completed attempt', () => {
  assert.equal(chooseAttempt(attempts, 'FIRST').id, 1);
  assert.equal(chooseAttempt(attempts, 'BEST').id, 2);
  assert.equal(chooseAttempt(attempts, 'LATEST').id, 2);
});

test('delivery percentage score uses the test question count', () => {
  assert.equal(percentageScore(9, 10), 90);
  assert.equal(percentageScore(null, 10), 0);
  assert.equal(percentageScore(9, 0), null);
});

test('bulk assignment creates one delivery and one canonical activity per test', async () => {
  const createdDeliveries = [];
  const createdActivities = [];
  let classTestId = 0;
  const db = fakeDeliveryDb({ createdDeliveries, createdActivities, classTestId: () => ++classTestId });
  const result = await createDeliveriesWithDb({
    db, classIds: ['class-1'], testIds: [11, 12, 13, 13], userId: 7, userRole: 'TEACHER',
    maxAttempts: 2, scorePolicy: 'BEST',
  });
  assert.equal(result.length, 3);
  assert.deepEqual(createdDeliveries.map(item => item.testId), [11, 12, 13]);
  assert.equal(createdActivities.length, 3);
  assert.ok(createdActivities.every(item => item.type === 'TEST'));
});

test('bulk assignment validates every selected test before creating delivery records', async () => {
  const createdDeliveries = [];
  const createdActivities = [];
  const db = fakeDeliveryDb({ createdDeliveries, createdActivities, classTestId: () => 1, accessibleTestIds: [11, 12] });
  await assert.rejects(() => createDeliveriesWithDb({ db, classIds: ['class-1'], testIds: [11, 12, 13], userId: 7, userRole: 'TEACHER' }), /Only your published tests/);
  assert.equal(createdDeliveries.length, 0);
  assert.equal(createdActivities.length, 0);
});

function fakeDeliveryDb({ createdDeliveries, createdActivities, classTestId, accessibleTestIds = [11, 12, 13] }) {
  const tx = {
    class: { findUnique: async () => ({ id: 'class-1', name: 'SAT Class', teacherId: 7, students: [{ id: 21 }, { id: 22 }] }) },
    test: { findMany: async ({ where }) => where.id.in.filter(id => accessibleTestIds.includes(id)).map(id => ({ id, title: `Test ${id}` })) },
    lesson: { findFirst: async () => null },
    classTest: { upsert: async () => ({ id: classTestId() }) },
    testDelivery: {
      findUnique: async () => null,
      create: async ({ data }) => {
        createdDeliveries.push(data);
        return { id: `delivery-${data.testId}`, ...data, test: { id: data.testId, title: `Test ${data.testId}`, mode: 'PRACTICE' }, class: { id: data.classId, name: 'SAT Class' } };
      },
    },
    classActivity: { create: async ({ data }) => { createdActivities.push(data); return { id: `activity-${createdActivities.length}` }; } },
    notification: { createMany: async () => ({ count: 2 }) },
    user: { findUnique: async () => ({ name: 'Teacher', role: 'TEACHER' }) },
    auditEvent: { create: async ({ data }) => data },
    $executeRaw: async () => 1,
  };
  return { $transaction: async callback => callback(tx) };
}
