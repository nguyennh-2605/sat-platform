const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeStudyTimeQuery, dateKeyInTimeZone, aggregateStudyTime } = require('../src/utils/study-time-aggregation');

const completed = ({ endedAt, minutes, activityType = 'PRACTICE', status = 'COMPLETED' }) => ({
  status,
  activityType,
  accumulatedMs: minutes * 60 * 1000,
  plannedDurationMs: 60 * 60 * 1000,
  endedAt: new Date(endedAt),
});

test('study summary validates ranges and IANA time zones', () => {
  assert.deepEqual(normalizeStudyTimeQuery({ range: '30', timeZone: 'Asia/Ho_Chi_Minh' }), { range: '30', timeZone: 'Asia/Ho_Chi_Minh' });
  assert.throws(() => normalizeStudyTimeQuery({ range: '7' }), /range/);
  assert.throws(() => normalizeStudyTimeQuery({ timeZone: 'Mars/Olympus' }), /IANA/);
  assert.throws(() => normalizeStudyTimeQuery({ timeZone: ['UTC'] }), /IANA/);
});

test('date bucketing follows the student time zone across UTC midnight', () => {
  assert.equal(dateKeyInTimeZone('2026-09-14T18:00:00.000Z', 'Asia/Ho_Chi_Minh'), '2026-09-15');
  assert.equal(dateKeyInTimeZone('2026-09-14T18:00:00.000Z', 'America/New_York'), '2026-09-14');
});

test('date bucketing remains stable across a daylight-saving repeated hour', () => {
  assert.equal(dateKeyInTimeZone('2026-11-01T05:30:00.000Z', 'America/New_York'), '2026-11-01');
  assert.equal(dateKeyInTimeZone('2026-11-01T06:30:00.000Z', 'America/New_York'), '2026-11-01');
});

test('aggregation counts completed focus time and excludes active or cancelled rows', () => {
  const result = aggregateStudyTime({
    range: '30',
    timeZone: 'UTC',
    now: new Date('2026-09-15T12:00:00.000Z'),
    sessions: [
      completed({ endedAt: '2026-09-15T08:00:00.000Z', minutes: 25 }),
      completed({ endedAt: '2026-09-15T09:00:00.000Z', minutes: 20, activityType: 'VOCABULARY' }),
      completed({ endedAt: '2026-09-14T09:00:00.000Z', minutes: 10, status: 'CANCELLED' }),
      completed({ endedAt: '2026-09-13T09:00:00.000Z', minutes: 10, status: 'RUNNING' }),
    ],
  });
  assert.deepEqual(result.summary, {
    trackedMs: 45 * 60 * 1000,
    sessionCount: 2,
    activeDays: 1,
    currentStreak: 1,
    longestStreak: 1,
    averageSessionMs: 22.5 * 60 * 1000,
  });
  assert.deepEqual(result.activities.map(item => [item.activityType, item.trackedMs, item.percentage]), [
    ['PRACTICE', 25 * 60 * 1000, 56],
    ['VOCABULARY', 20 * 60 * 1000, 44],
  ]);
});

test('streaks use distinct local calendar days and can remain current from yesterday', () => {
  const result = aggregateStudyTime({
    range: '30',
    timeZone: 'UTC',
    now: new Date('2026-09-15T12:00:00.000Z'),
    sessions: [
      completed({ endedAt: '2026-09-11T10:00:00.000Z', minutes: 10 }),
      completed({ endedAt: '2026-09-12T10:00:00.000Z', minutes: 10 }),
      completed({ endedAt: '2026-09-13T10:00:00.000Z', minutes: 10 }),
      completed({ endedAt: '2026-09-14T10:00:00.000Z', minutes: 10 }),
      completed({ endedAt: '2026-09-14T11:00:00.000Z', minutes: 10 }),
    ],
  });
  assert.equal(result.summary.currentStreak, 4);
  assert.equal(result.summary.longestStreak, 4);
  assert.equal(result.summary.activeDays, 4);
});

test('selected range excludes older sessions and all-time chart declares truncation', () => {
  const now = new Date('2026-09-15T12:00:00.000Z');
  const old = completed({ endedAt: '2024-01-01T12:00:00.000Z', minutes: 50 });
  assert.equal(aggregateStudyTime({ range: '30', timeZone: 'UTC', now, sessions: [old] }).summary.sessionCount, 0);
  const all = aggregateStudyTime({ range: 'all', timeZone: 'UTC', now, sessions: [old] });
  assert.equal(all.summary.sessionCount, 1);
  assert.equal(all.daily.length, 0);
  assert.equal(all.chartWindow.truncated, true);
});
