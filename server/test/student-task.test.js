const test = require('node:test');
const assert = require('node:assert/strict');
const {
  normalizedDueAt,
  normalizedTitle,
  priorityFor,
  sortTasks,
  taskSummary,
} = require('../src/services/student-task.service');

test('student task validation normalizes titles and rejects invalid dates', () => {
  assert.equal(normalizedTitle('  Review   algebra  '), 'Review algebra');
  assert.throws(() => normalizedTitle('  '), /Task title is required/);
  assert.equal(normalizedDueAt(null), null);
  assert.throws(() => normalizedDueAt('not-a-date'), /valid task date/);
});

test('student task ordering respects persisted order before urgency', () => {
  const tasks = [
    { key: 'second', completed: false, position: 2, priority: 'OVERDUE', createdAt: '2026-08-20T00:00:00Z', dueAt: '2026-08-21T00:00:00Z' },
    { key: 'first', completed: false, position: 1, priority: 'NORMAL', createdAt: '2026-08-20T00:00:00Z', dueAt: null },
    { key: 'done', completed: true, position: 0, priority: 'NORMAL', createdAt: '2026-08-20T00:00:00Z', dueAt: null },
  ];
  assert.deepEqual(sortTasks(tasks).map(item => item.key), ['first', 'second', 'done']);
});

test('student task priority distinguishes overdue and due-soon work', () => {
  assert.equal(priorityFor(new Date(Date.now() - 1_000)), 'OVERDUE');
  assert.equal(priorityFor(new Date(Date.now() + 60 * 60 * 1_000)), 'DUE_SOON');
  assert.equal(priorityFor(null), 'NORMAL');
});

test('weekly summary uses real task completion state', () => {
  const now = new Date('2026-08-27T08:00:00Z');
  const summary = taskSummary([
    { source: 'PERSONAL', type: 'PERSONAL', completed: false, dueAt: null, createdAt: now },
    { source: 'CLASSROOM', type: 'TEST', completed: true, dueAt: '2026-08-28T08:00:00Z', createdAt: now },
    { source: 'CLASSROOM', type: 'ASSIGNMENT', completed: false, dueAt: '2026-08-29T08:00:00Z', createdAt: now },
  ], now);
  assert.equal(summary.todayRemaining, 1);
  assert.equal(summary.weekCompleted, 1);
  assert.equal(summary.weekTotal, 2);
  assert.equal(summary.weekPercentage, 50);
});

