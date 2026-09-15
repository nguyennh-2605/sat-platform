const test = require('node:test');
const assert = require('node:assert/strict');
const {
  MIN_DURATION_MS,
  MAX_DURATION_MS,
  normalizeStartInput,
  normalizeExpectedVersion,
  getElapsedMs,
  getAutomaticEndAt,
} = require('../src/utils/study-session-state');

test('normalizes a valid focus clock payload', () => {
  assert.deepEqual(normalizeStartInput({
    plannedDurationMs: 25 * 60 * 1000,
    activityType: 'PRACTICE',
    resourceType: 'TEST',
    resourceId: ' 42 ',
    label: '  Practice test  ',
    clientMutationId: 'start-1',
  }), {
    plannedDurationMs: 25 * 60 * 1000,
    activityType: 'PRACTICE',
    resourceType: 'TEST',
    resourceId: '42',
    label: 'Practice test',
    clientMutationId: 'start-1',
  });
});

test('rejects durations outside the supported bounds', () => {
  assert.throws(() => normalizeStartInput({ plannedDurationMs: MIN_DURATION_MS - 1 }), /between 5 and 240/);
  assert.throws(() => normalizeStartInput({ plannedDurationMs: MAX_DURATION_MS + 1 }), /between 5 and 240/);
});

test('requires a complete resource reference and valid versions', () => {
  assert.throws(() => normalizeStartInput({ plannedDurationMs: MIN_DURATION_MS, resourceType: 'TEST' }), /provided together/);
  assert.throws(() => normalizeExpectedVersion(0), /positive integer/);
  assert.equal(normalizeExpectedVersion('3'), 3);
});

test('counts only the current running segment and clamps at the plan', () => {
  const now = new Date('2026-09-15T10:10:00.000Z');
  const session = {
    status: 'RUNNING',
    plannedDurationMs: 12 * 60 * 1000,
    accumulatedMs: 4 * 60 * 1000,
    lastResumedAt: new Date('2026-09-15T10:00:00.000Z'),
  };
  assert.equal(getElapsedMs(session, now), 12 * 60 * 1000);
  assert.equal(getAutomaticEndAt(session).toISOString(), '2026-09-15T10:08:00.000Z');
});

test('paused time does not continue increasing', () => {
  assert.equal(getElapsedMs({ status: 'PAUSED', plannedDurationMs: 1_000_000, accumulatedMs: 123_000, lastResumedAt: null }, new Date()), 123_000);
});
