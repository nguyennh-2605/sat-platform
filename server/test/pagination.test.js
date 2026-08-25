const test = require('node:test');
const assert = require('node:assert/strict');
const { parsePagination, paginationMeta } = require('../src/utils/pagination');

test('pagination normalizes invalid values and calculates a stable offset', () => {
  assert.deepEqual(parsePagination({ page: '3', pageSize: '20' }), { page: 3, pageSize: 20, skip: 40 });
  assert.deepEqual(parsePagination({ page: '-2', pageSize: 'invalid' }), { page: 1, pageSize: 20, skip: 0 });
});

test('pagination caps page size and keeps one empty-result page', () => {
  assert.deepEqual(parsePagination({ page: 1, pageSize: 500 }, { defaultPageSize: 10, maxPageSize: 40 }), { page: 1, pageSize: 40, skip: 0 });
  assert.deepEqual(paginationMeta({ page: 1, pageSize: 10, total: 0 }), { page: 1, pageSize: 10, total: 0, totalPages: 1 });
});
