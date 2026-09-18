const test = require('node:test');
const assert = require('node:assert/strict');
const { _testListPaginationHelpers } = require('../src/services/practice-test.service');

const { encodeTestCursor, decodeTestCursor, testCursorBoundaryWhere } = _testListPaginationHelpers;

test('test library cursors round-trip the stable value and id boundary', () => {
  const cursor = encodeTestCursor({ id: 42, value: '2026-09-18T04:30:00.000Z' });
  assert.deepEqual(decodeTestCursor(cursor), { id: 42, value: '2026-09-18T04:30:00.000Z' });
  assert.throws(() => decodeTestCursor('invalid-cursor'), error => error.statusCode === 400);
});

test('teacher cursor boundaries use updatedAt and id to traverse tied rows', () => {
  const value = '2026-09-18T04:30:00.000Z';
  assert.deepEqual(testCursorBoundaryWhere({ cursor: { id: 42, value }, cursorField: 'updatedAt', oldestFirst: false }), {
    OR: [
      { updatedAt: { lt: new Date(value) } },
      { updatedAt: new Date(value), id: { lt: 42 } },
    ],
  });
});

test('student cursor boundaries follow the id ordering in both directions', () => {
  assert.deepEqual(testCursorBoundaryWhere({ cursor: { id: 42, value: '42' }, cursorField: 'id', oldestFirst: false }), { id: { lt: 42 } });
  assert.deepEqual(testCursorBoundaryWhere({ cursor: { id: 42, value: '42' }, cursorField: 'id', oldestFirst: true }), { id: { gt: 42 } });
});
