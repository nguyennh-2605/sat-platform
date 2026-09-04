const test = require('node:test');
const assert = require('node:assert/strict');
const {
  buildAttention,
  buildCheckIns,
  buildInsights,
  buildUpcoming,
  chooseAttempt,
  getOverviewWithDb,
} = require('../src/services/teacher-overview.service');

const now = new Date('2026-08-28T08:00:00.000Z');

const activity = (overrides = {}) => ({
  id: 'activity-1',
  type: 'TEST',
  title: 'SAT Practice Test 4',
  classId: 'class-1',
  class: { id: 'class-1', name: 'SAT 1500A' },
  availableAt: null,
  dueAt: '2026-08-27T08:00:00.000Z',
  createdAt: '2026-08-20T08:00:00.000Z',
  test: { testDeliveryId: 'delivery-1' },
  homework: null,
  assignees: [
    { studentId: 1, status: 'COMPLETED', assignedAt: '2026-08-20T08:00:00.000Z', completedAt: '2026-08-26T08:00:00.000Z', startedAt: null, bestScore: 80, excusedAt: null },
    { studentId: 2, status: 'ASSIGNED', assignedAt: '2026-08-20T08:00:00.000Z', completedAt: null, startedAt: null, bestScore: null, excusedAt: null },
    { studentId: 3, status: 'ASSIGNED', assignedAt: '2026-08-20T08:00:00.000Z', completedAt: null, startedAt: null, bestScore: null, excusedAt: now },
  ],
  ...overrides,
});

test('teacher attention aggregates an activity and excludes excused students', () => {
  const result = buildAttention([activity()], now);
  assert.equal(result.length, 1);
  assert.equal(result[0].reason, 'OVERDUE');
  assert.deepEqual(result[0].stats, { assigned: 2, completed: 1, inProgress: 0, incomplete: 1, missing: 1 });
  assert.equal(result[0].href, '/dashboard/class/class-1?tab=activities&deliveryId=delivery-1');
});

test('teacher attention only includes unresolved overdue or due-soon work', () => {
  const completed = activity({ assignees: activity().assignees.map(item => ({ ...item, status: 'COMPLETED', excusedAt: null })) });
  const later = activity({ id: 'later', dueAt: '2026-09-15T08:00:00.000Z' });
  assert.deepEqual(buildAttention([completed, later], now), []);
});

test('teacher upcoming combines availability, deadlines, and scheduled lessons chronologically', () => {
  const activities = [activity({ availableAt: '2026-08-29T08:00:00.000Z', dueAt: '2026-08-31T08:00:00.000Z' })];
  const lessons = [{ id: 'lesson-1', title: 'Advanced Algebra', scheduledAt: '2026-08-30T08:00:00.000Z', week: { class: { id: 'class-1', name: 'SAT 1500A' } } }];
  assert.deepEqual(buildUpcoming(activities, lessons, now).map(item => item.eventType), ['AVAILABLE', 'LESSON', 'DUE']);
});

test('attempt selection respects first, latest, and best score policies', () => {
  const attempts = [
    { attemptNo: 1, status: 'COMPLETED', score: 20, delivery: { scorePolicy: 'FIRST' } },
    { attemptNo: 2, status: 'COMPLETED', score: 30, delivery: { scorePolicy: 'FIRST' } },
  ];
  assert.equal(chooseAttempt(attempts).attemptNo, 1);
  assert.equal(chooseAttempt(attempts.map(item => ({ ...item, delivery: { scorePolicy: 'LATEST' } }))).attemptNo, 2);
  assert.equal(chooseAttempt(attempts.map(item => ({ ...item, delivery: { scorePolicy: 'BEST' } }))).score, 30);
});

test('learning insights require classification coverage and enough students', () => {
  const submissions = [1, 2, 3].map(userId => ({
    userId,
    deliveryId: `delivery-${userId}`,
    attemptNo: 1,
    status: 'COMPLETED',
    delivery: { scorePolicy: 'FIRST' },
    answers: Array.from({ length: 10 }, (_, index) => ({
      isCorrect: index < 6,
      question: {
        domain: { code: 'ALG', name: 'Algebra', subject: 'MATH' },
        skill: { code: 'ALG-LIN', name: 'Linear equations' },
      },
    })),
  }));
  const result = buildInsights({ submissions, now });
  assert.equal(result.sufficient, true);
  assert.deepEqual(result.classificationCoverage, { classified: 30, total: 30, percentage: 100 });
  assert.equal(result.domains[0].accuracy, 60);
  assert.equal(result.domains[0].studentCount, 3);
});

test('check-in reasons prefer concrete overdue work and explain it', () => {
  const classes = [{ id: 'class-1', name: 'SAT 1500A', students: [{ id: 2, name: 'Minh Nguyen', email: 'minh@example.com' }] }];
  const result = buildCheckIns({ classes, activities: [activity()], submissions: [], now });
  assert.equal(result.length, 1);
  assert.equal(result[0].reason, 'OVERDUE');
  assert.equal(result[0].reasonLabel, '1 overdue activity');
});

test('check-in signals prolonged inactivity only when work is outstanding', () => {
  const classes = [{ id: 'class-1', name: 'SAT 1500A', students: [{ id: 2, name: 'Minh Nguyen', email: 'minh@example.com' }] }];
  const pending = activity({
    dueAt: '2026-09-15T08:00:00.000Z',
    assignees: [{ studentId: 2, status: 'ASSIGNED', assignedAt: '2026-08-01T08:00:00.000Z', completedAt: null, startedAt: null, bestScore: null, excusedAt: null }],
  });
  const result = buildCheckIns({ classes, activities: [pending], submissions: [], now });
  assert.equal(result[0].reason, 'INACTIVE');
  assert.match(result[0].reasonLabel, /8 days/);
});

test('check-in detects a sustained three-test score decline', () => {
  const classes = [{ id: 'class-1', name: 'SAT 1500A', students: [{ id: 2, name: 'Minh Nguyen', email: 'minh@example.com' }] }];
  const submissions = [
    { deliveryId: 'delivery-1', score: 18, endTime: '2026-08-10T08:00:00.000Z' },
    { deliveryId: 'delivery-2', score: 15, endTime: '2026-08-18T08:00:00.000Z' },
    { deliveryId: 'delivery-3', score: 12, endTime: '2026-08-26T08:00:00.000Z' },
  ].map(item => ({
    ...item,
    userId: 2,
    attemptNo: 1,
    status: 'COMPLETED',
    startedAt: item.endTime,
    delivery: { classId: 'class-1', scorePolicy: 'FIRST' },
    test: { sections: [{ _count: { questions: 20 } }] },
  }));
  const result = buildCheckIns({ classes, activities: [], submissions, now });
  assert.equal(result[0].reason, 'DECLINING_SCORE');
  assert.equal(result[0].reasonLabel, 'Score dropped 30 points across the last 3 tests');
});

test('teacher overview rejects class scopes the teacher does not own', async () => {
  const db = { class: { findMany: async () => [{ id: 'owned', name: 'Owned class', color: '#000', students: [] }] } };
  await assert.rejects(() => getOverviewWithDb({ db, userId: 4, classId: 'another-class', now }), error => error.statusCode === 403);
});
