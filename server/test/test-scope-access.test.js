const test = require('node:test');
const assert = require('node:assert/strict');
const { buildManageableTestWhere, buildTestListWhere } = require('../src/services/practice-test.service');

test('admin System Library is platform-owned and not scoped to the current admin', () => {
  const result = buildTestListWhere({ userId: 20, userRole: 'ADMIN', source: 'SYSTEM', status: '' });
  assert.equal(result.source, 'SYSTEM');
  assert.deepEqual(result.where, {
    scope: 'SYSTEM',
    status: { in: ['DRAFT', 'PUBLISHED'] },
  });
  assert.equal('authorId' in result.where, false);
});

test('admin management authorization is based on System scope instead of creator id', () => {
  assert.deepEqual(
    buildManageableTestWhere({ id: 41, userId: 20, userRole: 'ADMIN' }),
    { id: 41, scope: 'SYSTEM' },
  );
  assert.deepEqual(
    buildManageableTestWhere({ id: 41, userId: 8, userRole: 'TEACHER' }),
    { id: 41, scope: 'PERSONAL', authorId: 8 },
  );
});

test('admin Teacher Tests is read from teacher-owned personal content', () => {
  const result = buildTestListWhere({ userId: 20, userRole: 'ADMIN', source: 'TEACHER', status: 'ARCHIVED' });
  assert.deepEqual(result.where, {
    scope: 'PERSONAL',
    author: { role: 'TEACHER' },
    status: 'ARCHIVED',
  });
});

test('teacher My Tests remains owner-scoped personal content', () => {
  const result = buildTestListWhere({ userId: 8, userRole: 'TEACHER', source: 'MY', status: 'PUBLISHED' });
  assert.deepEqual(result.where, {
    scope: 'PERSONAL',
    authorId: 8,
    status: 'PUBLISHED',
  });
});

test('teacher System Tests includes published platform content only', () => {
  const result = buildTestListWhere({ userId: 8, userRole: 'TEACHER', source: 'SYSTEM', status: 'DRAFT' });
  assert.deepEqual(result.where, { scope: 'SYSTEM', status: 'PUBLISHED' });
});

test('a role cannot request another role\'s test collection', () => {
  assert.throws(
    () => buildTestListWhere({ userId: 8, userRole: 'TEACHER', source: 'TEACHER' }),
    error => error.statusCode === 400,
  );
});

test('student access includes published system tests and assigned personal tests', () => {
  const result = buildTestListWhere({ userId: 7, userRole: 'STUDENT' });
  assert.deepEqual(result.where.OR[0], { scope: 'SYSTEM', status: 'PUBLISHED' });
  assert.equal(result.where.OR[1].deliveries.some.assignees.some.studentId, 7);
});
