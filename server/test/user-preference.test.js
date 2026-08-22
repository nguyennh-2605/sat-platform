const test = require('node:test');
const assert = require('node:assert/strict');
const { DASHBOARD_BACKGROUNDS, parseFutureDate } = require('../src/services/user-preference.service');

test('SAT preference accepts a future ISO date', () => {
  const future = new Date(Date.now() + 86_400_000).toISOString();
  assert.equal(parseFutureDate(future).toISOString(), future);
});

test('SAT preference rejects invalid and past dates', () => {
  assert.throws(() => parseFutureDate('not-a-date'), /valid SAT test date/);
  assert.throws(() => parseFutureDate('2020-01-01T07:45:00.000Z'), /must be in the future/);
});

test('dashboard background allowlist contains only controlled presets', () => {
  assert.equal(DASHBOARD_BACKGROUNDS.has('default'), true);
  assert.equal(DASHBOARD_BACKGROUNDS.has('misty-hills'), true);
  assert.equal(DASHBOARD_BACKGROUNDS.has('https://example.com/image.jpg'), false);
});
