const test = require('node:test');
const assert = require('node:assert/strict');
const { CLASS_COLORS, normalizeClassName, normalizeAssignmentType, resolveAssignmentType, isAllowedClassColor, canManageClass } = require('../src/utils/classroom');

test('class names are trimmed and internal whitespace is normalized', () => {
  assert.equal(normalizeClassName('  SAT   Math 12A1  '), 'SAT Math 12A1');
});

test('class colors only accept the controlled accessible palette', () => {
  assert.equal(isAllowedClassColor(CLASS_COLORS[0]), true);
  assert.equal(isAllowedClassColor('#FFFFFF'), false);
  assert.equal(isAllowedClassColor('red'), false);
});

test('class posts persist a controlled notification type', () => {
  assert.equal(normalizeAssignmentType('announcement'), 'announcement');
  assert.equal(normalizeAssignmentType('assignment'), 'assignment');
  assert.equal(normalizeAssignmentType('unexpected'), 'assignment');
  assert.equal(normalizeAssignmentType(undefined), 'assignment');
});

test('a post with a deadline is always treated as an assignment', () => {
  assert.equal(resolveAssignmentType({ type: 'announcement', deadline: '2026-09-01T08:00:00.000Z' }), 'assignment');
  assert.equal(resolveAssignmentType({ type: 'announcement', deadline: null }), 'announcement');
  assert.equal(resolveAssignmentType({ type: 'assignment', deadline: null }), 'assignment');
});

test('only the owning teacher or an admin can manage a class', () => {
  assert.equal(canManageClass({ teacherId: 10, userId: 10, userRole: 'TEACHER' }), true);
  assert.equal(canManageClass({ teacherId: 10, userId: 11, userRole: 'TEACHER' }), false);
  assert.equal(canManageClass({ teacherId: 10, userId: 11, userRole: 'STUDENT' }), false);
  assert.equal(canManageClass({ teacherId: 10, userId: 11, userRole: 'ADMIN' }), true);
});
