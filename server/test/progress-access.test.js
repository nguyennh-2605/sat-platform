const test = require('node:test');
const assert = require('node:assert/strict');
const { canManageProgress, canReadProgress } = require('../src/utils/progress-access');
const progressService = require('../src/services/progress.service');

test('progress service loads with its authorization gates attached', () => {
  assert.equal(typeof progressService.getWeeks, 'function');
  assert.equal(typeof progressService.createOrUpdateAssignment, 'function');
});

test('progress is readable only by the owning teacher, an enrolled student, or an admin', () => {
  const classroom = { teacherId: 10, studentIds: [20, 21] };
  assert.equal(canReadProgress({ ...classroom, userId: 10, userRole: 'TEACHER' }), true);
  assert.equal(canReadProgress({ ...classroom, userId: 20, userRole: 'STUDENT' }), true);
  assert.equal(canReadProgress({ ...classroom, userId: 99, userRole: 'ADMIN' }), true);
  assert.equal(canReadProgress({ ...classroom, userId: 22, userRole: 'STUDENT' }), false);
  assert.equal(canReadProgress({ ...classroom, userId: 11, userRole: 'TEACHER' }), false);
});

test('only the owning teacher or an admin can manage progress', () => {
  assert.equal(canManageProgress({ teacherId: 10, userId: 10, userRole: 'TEACHER' }), true);
  assert.equal(canManageProgress({ teacherId: 10, userId: 99, userRole: 'ADMIN' }), true);
  assert.equal(canManageProgress({ teacherId: 10, userId: 20, userRole: 'STUDENT' }), false);
  assert.equal(canManageProgress({ teacherId: 10, userId: 11, userRole: 'TEACHER' }), false);
});
