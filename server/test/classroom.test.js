const test = require('node:test');
const assert = require('node:assert/strict');
const { CLASS_COLORS, normalizeClassName, normalizeAssignmentType, resolveAssignmentType, isAllowedClassColor, canManageClass } = require('../src/utils/classroom');
const { enrichClassSummaries } = require('../src/services/class.service');

test('class names are trimmed and internal whitespace is normalized', () => {
  assert.equal(normalizeClassName('  SAT   Math 12A1  '), 'SAT Math 12A1');
  assert.equal(normalizeClassName('  reading   class  '), 'Reading class');
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

test('class summaries expose real upcoming work and the latest content update', () => {
  const earlierDueAt = new Date('2026-09-01T08:00:00.000Z');
  const laterDueAt = new Date('2026-09-03T08:00:00.000Z');
  const result = enrichClassSummaries({
    summaries: [{ id: 'class-1', name: 'SAT Math' }, { id: 'class-2', name: 'SAT Reading' }],
    dueActivities: [
      { id: 'activity-1', classId: 'class-1', type: 'HOMEWORK', title: 'Linear equations', dueAt: earlierDueAt },
      { id: 'activity-2', classId: 'class-1', type: 'TEST', title: 'Unit test', dueAt: laterDueAt },
    ],
    activityUpdates: [{ classId: 'class-1', _max: { updatedAt: new Date('2026-08-28T08:00:00.000Z') } }],
    announcementUpdates: [{ classId: 'class-1', _max: { updatedAt: new Date('2026-08-29T08:00:00.000Z') } }],
  });

  assert.equal(result[0].dueInNext7DaysCount, 2);
  assert.deepEqual(result[0].nextActivity, {
    id: 'activity-1',
    type: 'HOMEWORK',
    title: 'Linear equations',
    dueAt: earlierDueAt,
  });
  assert.equal(result[0].lastContentUpdateAt.toISOString(), '2026-08-29T08:00:00.000Z');
  assert.equal(result[1].dueInNext7DaysCount, 0);
  assert.equal(result[1].nextActivity, null);
  assert.equal(result[1].lastContentUpdateAt, null);
});
