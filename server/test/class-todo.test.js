const test = require('node:test');
const assert = require('node:assert/strict');
const {
  firstCompletedByStudent,
  hasCompletedSubmission,
  sortTodos,
} = require('../src/services/class-todo.service');

test('a student test remains pending until any attempt is completed', () => {
  assert.equal(hasCompletedSubmission([]), false);
  assert.equal(hasCompletedSubmission([{ status: 'DOING' }]), false);
  assert.equal(hasCompletedSubmission([{ status: 'DOING' }, { status: 'COMPLETED' }]), true);
});

test('teacher To Do uses only the first completed attempt per student and delivery', () => {
  const submissions = [
    { id: 1, userId: 10, status: 'COMPLETED', attemptNo: 1 },
    { id: 2, userId: 10, status: 'COMPLETED', attemptNo: 2 },
    { id: 3, userId: 11, status: 'COMPLETED', attemptNo: 1 },
  ];
  assert.deepEqual(firstCompletedByStudent(submissions).map(item => item.id), [1, 3]);
});

test('To Do ordering prioritizes overdue and due-soon work', () => {
  const items = [
    { key: 'normal', priority: 'NORMAL', createdAt: '2026-08-22T10:00:00.000Z', dueAt: null },
    { key: 'soon', priority: 'DUE_SOON', createdAt: '2026-08-20T10:00:00.000Z', dueAt: '2026-08-23T10:00:00.000Z' },
    { key: 'overdue', priority: 'OVERDUE', createdAt: '2026-08-18T10:00:00.000Z', dueAt: '2026-08-19T10:00:00.000Z' },
  ];
  assert.deepEqual(sortTodos(items).map(item => item.key), ['overdue', 'soon', 'normal']);
});
