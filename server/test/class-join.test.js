const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeClassCode, joinClassWithDb } = require('../src/services/class-join.service');

const classId = 'af820784-9a80-4b5e-bab9-b790e4e1e3c3';
const params = { userId: 7, userRole: 'STUDENT', code: classId };
function database({ role = 'STUDENT', missingClass = false, failAudit = false } = {}) {
  const state = { members: [], activityAssignments: [], deliveryAssignments: [], audits: [] };
  const activities = [
    { id: 'homework', classId, status: 'PUBLISHED', audience: 'ALL_STUDENTS', test: null },
    { id: 'all-test', classId, status: 'PUBLISHED', audience: 'ALL_STUDENTS', test: { testDeliveryId: 'all-delivery' } },
    { id: 'selected-test', classId, status: 'PUBLISHED', audience: 'SELECTED', test: { testDeliveryId: 'selected-delivery' } },
    { id: 'closed-test', classId, status: 'CLOSED', audience: 'ALL_STUDENTS', test: { testDeliveryId: 'closed-delivery' } },
    { id: 'draft', classId, status: 'DRAFT', audience: 'ALL_STUDENTS', test: null },
    { id: 'other-class', classId: 'other', status: 'PUBLISHED', audience: 'ALL_STUDENTS', test: null },
  ];
  const deliveries = [
    { id: 'all-delivery', classId, status: 'PUBLISHED', activity: {} },
    { id: 'selected-delivery', classId, status: 'PUBLISHED', activity: {} },
    { id: 'closed-delivery', classId, status: 'PUBLISHED', activity: {} },
    { id: 'legacy-delivery', classId, status: 'PUBLISHED', activity: null },
  ];
  const db = {
    user: { findUnique: async ({ where }) => where.id === 7 ? { id: 7, name: 'Alex', role } : null },
    class: {
      findUnique: async ({ where, select }) => !missingClass && where.id === classId ? { id: classId, name: 'SAT Math', students: state.members.filter(id => id === select.students.where.id).map(id => ({ id })) } : null,
      update: async ({ where, data }) => { assert.equal(where.id, classId); const id = data.students.connect.id; if (!state.members.includes(id)) state.members.push(id); return { id: classId }; },
    },
    classActivity: { findMany: async ({ where }) => activities.filter(item => item.classId === where.classId && item.status === where.status && item.audience === where.audience) },
    testDelivery: { findMany: async ({ where }) => deliveries.filter(item => item.classId === where.classId && item.status === where.status && (item.activity === where.OR[0].activity.is || where.OR[1].id.in.includes(item.id))) },
    activityAssignee: { createMany: async ({ data, skipDuplicates }) => { assert.equal(skipDuplicates, true); for (const item of data) if (!state.activityAssignments.some(old => old.activityId === item.activityId && old.studentId === item.studentId)) state.activityAssignments.push(item); } },
    deliveryAssignee: { createMany: async ({ data, skipDuplicates }) => { assert.equal(skipDuplicates, true); for (const item of data) if (!state.deliveryAssignments.some(old => old.deliveryId === item.deliveryId && old.studentId === item.studentId)) state.deliveryAssignments.push(item); } },
    auditEvent: { create: async ({ data }) => { if (failAudit) throw new Error('Audit unavailable'); state.audits.push(data); return data; } },
  };
  db.$transaction = async action => {
    const before = structuredClone(state);
    try { return await action(db); }
    catch (error) { Object.assign(state, before); throw error; }
  };
  return { db, state };
}

test('class codes accept a pasted UUID with outer whitespace and ignore letter case', () => {
  assert.equal(normalizeClassCode(` ${classId.toUpperCase()}\n`), classId);
  for (const code of [null, undefined, [], 42, '', 'a-class', `${classId}/extra`, `https://example.com/${classId}`]) assert.throws(() => normalizeClassCode(code), error => error.statusCode === 400);
});

test('join enrolls only the authenticated student and assigns published whole-class work atomically', async () => {
  const { db, state } = database();
  const result = await joinClassWithDb({ ...params, db });
  assert.deepEqual(result, { classroom: { id: classId, name: 'SAT Math' }, alreadyJoined: false });
  assert.deepEqual(state.members, [7]);
  assert.deepEqual(state.activityAssignments, [{ activityId: 'homework', studentId: 7 }, { activityId: 'all-test', studentId: 7 }]);
  assert.deepEqual(state.deliveryAssignments, [{ deliveryId: 'all-delivery', studentId: 7 }, { deliveryId: 'legacy-delivery', studentId: 7 }]);
  assert.equal(state.audits.length, 1);
  assert.equal(state.audits[0].actorUserId, 7);
  assert.equal(state.audits[0].actorRole, 'STUDENT');
});

test('joining an existing membership is idempotent and does not reset assignment progress', async () => {
  const { db, state } = database();
  state.activityAssignments.push({ activityId: 'homework', studentId: 7, status: 'COMPLETED', completedAt: '2026-10-14' });
  await joinClassWithDb({ ...params, db });
  const before = structuredClone(state);
  assert.equal((await joinClassWithDb({ ...params, db })).alreadyJoined, true);
  assert.deepEqual(state, before);
  assert.equal(state.activityAssignments[0].status, 'COMPLETED');
});

test('a nonexistent code, missing account or non-student cannot enroll', async () => {
  for (const role of ['TEACHER', 'ADMIN', undefined]) {
    const { db, state } = database();
    await assert.rejects(joinClassWithDb({ ...params, db, userRole: role }), error => error.statusCode === 403);
    assert.deepEqual(state.members, []);
  }
  await assert.rejects(joinClassWithDb({ ...params, db: database({ role: 'TEACHER' }).db }), error => error.statusCode === 403);
  await assert.rejects(joinClassWithDb({ ...params, db: database().db, userId: 8 }), error => error.statusCode === 401);
  await assert.rejects(joinClassWithDb({ ...params, db: database().db, userId: '7foo' }), error => error.statusCode === 401);
  const { db, state } = database({ missingClass: true });
  await assert.rejects(joinClassWithDb({ ...params, db }), error => error.statusCode === 404);
  assert.deepEqual(state.members, []);
});

test('failed joins roll back membership, assignments and audit together', async () => {
  const { db, state } = database({ failAudit: true });
  await assert.rejects(joinClassWithDb({ ...params, db }), /Audit unavailable/);
  assert.deepEqual(state, { members: [], activityAssignments: [], deliveryAssignments: [], audits: [] });
});

test('join HTTP route requires student authentication and ignores a forged user id or role', async t => {
  const express = require('express');
  const jwt = require('jsonwebtoken');
  const { JWT_SECRET } = require('../src/config/jwt');
  const service = require('../src/services/class-join.service');
  const original = service.joinClass;
  let received;
  service.joinClass = async input => { received = input; return { classroom: { id: classId, name: 'SAT Math' }, alreadyJoined: false }; };
  const app = express();
  app.use(express.json());
  app.use('/api/classes', require('../src/routes/class.routes'));
  const server = await new Promise(resolve => { const listener = app.listen(0, '127.0.0.1', () => resolve(listener)); });
  t.after(async () => { service.joinClass = original; await new Promise(resolve => server.close(resolve)); });
  const url = `http://127.0.0.1:${server.address().port}/api/classes/join`;
  const post = role => fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(role ? { Authorization: `Bearer ${jwt.sign({ userId: 7, role, authMethod: 'GOOGLE' }, JWT_SECRET, { expiresIn: '5m' })}` } : {}) }, body: JSON.stringify({ code: classId, userId: 999, role: 'ADMIN' }) });
  assert.equal((await post()).status, 401);
  assert.equal((await post('TEACHER')).status, 403);
  const response = await post('STUDENT');
  assert.equal(response.status, 200);
  assert.deepEqual(received, { code: classId, userId: 7, userRole: 'STUDENT' });
  assert.equal((await response.json()).classroom.id, classId);
});
