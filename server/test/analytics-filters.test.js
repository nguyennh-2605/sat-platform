const test = require('node:test');
const assert = require('node:assert/strict');
const ApiError = require('../src/utils/ApiError');
const { normalizeAnalyticsFilters } = require('../src/services/analytics.service');

test('analytics filters support 30, 90, all, and legacy days', () => {
  const now = new Date('2026-09-15T12:00:00Z');
  assert.equal(normalizeAnalyticsFilters({ range: '30', subject: 'rw', now }).cutoff.toISOString(), '2026-08-16T00:00:00.000Z');
  assert.equal(normalizeAnalyticsFilters({ range: 'all', now }).cutoff, null);
  assert.equal(normalizeAnalyticsFilters({ days: '84', now }).range, '84');
  assert.equal(normalizeAnalyticsFilters({ range: '90', subject: 'math', now }).subject, 'MATH');
});

test('analytics filters reject unsupported values', () => {
  assert.throws(() => normalizeAnalyticsFilters({ range: '365' }), ApiError);
  assert.throws(() => normalizeAnalyticsFilters({ range: '90', subject: 'SCIENCE' }), ApiError);
});

