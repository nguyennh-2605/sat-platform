const test = require('node:test');
const assert = require('node:assert/strict');
const service = require('../src/services/teacher-access.service');

const fakeDb = () => {
  let state = {
    users: [{ id: 1, name: 'Student', email: 'student@gmail.com', role: 'STUDENT', googleSubject: 'student-sub' }, { id: 2, name: 'Admin', role: 'ADMIN' }, { id: 3, name: 'Teacher', role: 'TEACHER' }],
    requests: [], audit: [],
  };
  let queue = Promise.resolve();
  const matches = (row, where) => Object.entries(where).every(([key, value]) => {
    if (value && typeof value === 'object') return ('gt' in value ? row[key] > value.gt : row[key] !== value.not);
    return row[key] === value;
  });
  const withUser = (row, include) => row ? { ...row, ...(include ? { user: { ...state.users.find(user => user.id === row.userId) } } : {}) } : null;
  const db = {
    get state() { return state; },
    user: {
      findUnique: async ({ where }) => state.users.find(user => user.id === where.id) || null,
      updateMany: async ({ where, data }) => { const rows = state.users.filter(row => matches(row, where)); rows.forEach(row => Object.assign(row, data)); return { count: rows.length }; },
    },
    teacherAccessRequest: {
      findUnique: async ({ where, include }) => withUser(state.requests.find(row => matches(row, where)), include),
      findMany: async ({ where, take, include }) => state.requests.filter(row => matches(row, where)).sort((a, b) => a.userId - b.userId).slice(0, take).map(row => withUser(row, include)),
      create: async ({ data }) => {
        const row = { id: `request-${data.userId}`, createdAt: new Date(), updatedAt: new Date(), ...data };
        state.requests.push(row); return { ...row };
      },
      updateMany: async ({ where, data }) => { const rows = state.requests.filter(row => matches(row, where)); rows.forEach(row => Object.assign(row, data)); return { count: rows.length }; },
    },
    auditEvent: { create: async ({ data }) => { state.audit.push(data); return data; } },
    $transaction: callback => {
      const run = queue.then(async () => { const before = structuredClone(state); try { return await callback(db); } catch (error) { state = before; throw error; } });
      queue = run.catch(() => {}); return run;
    },
  };
  return db;
};

test('a student request stays student and duplicate submissions create no duplicate audit or request', async () => {
  const db = fakeDb();
  await service.submit({ userId: 1, reason: ' I teach SAT classes. ', db });
  await service.submit({ userId: 1, reason: 'Repeated request', db });
  assert.equal(db.state.users[0].role, 'STUDENT');
  assert.equal(db.state.requests.length, 1);
  assert.equal(db.state.requests[0].reason, 'I teach SAT classes.');
  assert.equal(db.state.audit.length, 1);
});

test('only an admin can approve; approval changes only the applicant and records the review', async () => {
  const db = fakeDb();
  await service.submit({ userId: 1, reason: 'I teach SAT.', db });
  for (const userId of [1, 3]) await assert.rejects(service.review({ userId, requestId: 'request-1', decision: 'APPROVED', db }), error => error.statusCode === 403);
  await service.review({ userId: 2, requestId: 'request-1', decision: 'APPROVED', reviewNote: 'Verified school role.', db });
  assert.equal(db.state.users[0].role, 'TEACHER');
  assert.equal(db.state.users[1].role, 'ADMIN');
  assert.equal(db.state.requests[0].reviewedById, 2);
  assert.equal(db.state.requests[0].reviewNote, 'Verified school role.');
  assert.equal(db.state.audit.at(-1).action, 'TEACHER_ACCESS_APPROVED');
});

test('concurrent conflicting reviews have exactly one winner', async () => {
  const db = fakeDb();
  await service.submit({ userId: 1, reason: 'SAT tutor', db });
  const results = await Promise.allSettled(['APPROVED', 'REJECTED'].map(decision => service.review({ userId: 2, requestId: 'request-1', decision, db })));
  assert.equal(results.filter(row => row.status === 'fulfilled').length, 1);
  assert.equal(results.find(row => row.status === 'rejected').reason.statusCode, 409);
  assert.equal(db.state.users[0].role, 'TEACHER');
  assert.equal(db.state.audit.length, 2);
});

test('rejection retains student role and permits a new pending explanation', async () => {
  const db = fakeDb();
  await service.submit({ userId: 1, reason: 'SAT tutor', db });
  await service.review({ userId: 2, requestId: 'request-1', decision: 'REJECTED', reviewNote: 'Please provide your school.', db });
  assert.equal(db.state.users[0].role, 'STUDENT');
  await service.submit({ userId: 1, reason: 'School SAT teacher', db });
  assert.equal(db.state.requests.length, 1);
  assert.equal(db.state.requests[0].status, 'PENDING');
  assert.equal(db.state.requests[0].reviewNote, null);
  assert.equal(db.state.requests[0].reviewedById, null);
  assert.equal(db.state.audit.length, 3);
});

test('validation and account changes cannot grant admin or teacher privileges', async () => {
  const db = fakeDb();
  for (const reason of ['', ' ', 'x'.repeat(1001), { text: 'reason' }]) await assert.rejects(service.submit({ userId: 1, reason, db }), error => error.statusCode === 400);
  await assert.rejects(service.submit({ userId: 3, reason: 'already teacher', db }), error => error.statusCode === 403);
  await service.submit({ userId: 1, reason: 'teacher', db });
  await assert.rejects(service.review({ userId: 2, requestId: 'request-1', decision: 'ADMIN', db }), error => error.statusCode === 400);
  db.state.users[0].role = 'ADMIN';
  await assert.rejects(service.review({ userId: 2, requestId: 'request-1', decision: 'APPROVED', db }), error => error.statusCode === 409);
  assert.equal(db.state.requests[0].status, 'PENDING');
  assert.equal(db.state.users[0].role, 'ADMIN');
});

test('requests require Google verification and admin lists check current database role', async () => {
  const db = fakeDb();
  db.state.users[0].googleSubject = null;
  await assert.rejects(service.submit({ userId: 1, reason: 'teacher', db }), error => error.statusCode === 409);
  await assert.rejects(service.list({ userId: 1, db }), error => error.statusCode === 403);
  db.state.users[1].role = 'STUDENT';
  await assert.rejects(service.list({ userId: 2, db }), error => error.statusCode === 403);
});

test('admin pagination is bounded and resumes by immutable user id', async () => {
  const db = fakeDb();
  db.state.requests = Array.from({ length: 27 }, (_, i) => ({ id: `request-${i + 10}`, userId: i + 10, status: 'PENDING', reason: 'teacher' }));
  const first = await service.list({ userId: 2, db });
  assert.equal(first.items.length, 25);
  assert.equal(first.nextCursor, '34');
  const second = await service.list({ userId: 2, cursor: first.nextCursor, db });
  assert.equal(second.items.length, 2);
  assert.equal(second.nextCursor, null);
  await assert.rejects(service.list({ userId: 2, cursor: '-1', db }), error => error.statusCode === 400);
});
