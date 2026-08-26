const test = require('node:test');
const assert = require('node:assert/strict');
const {
  changePercent,
  getActivityWithDb,
  getOverviewWithDb,
  mergeActivitySeries,
  resolveOverviewRange,
} = require('../src/services/admin-overview.service');
const { normalizeIntegrityFilter } = require('../src/utils/test-integrity');

const fixedNow = new Date('2026-08-27T08:00:00.000Z');

test('admin overview ranges use complete platform days and equal previous periods', () => {
  const range = resolveOverviewRange('7d', fixedNow);
  assert.equal(range.from.toISOString(), '2026-08-20T17:00:00.000Z');
  assert.equal(range.to.toISOString(), '2026-08-27T17:00:00.000Z');
  assert.equal(range.previousFrom.toISOString(), '2026-08-13T17:00:00.000Z');
  assert.equal(range.previousTo.toISOString(), range.from.toISOString());
  assert.equal(range.granularity, 'DAY');
});

test('overview trends do not fabricate a percentage when the comparison period is empty', () => {
  assert.equal(changePercent(12, 0), null);
  assert.equal(changePercent(112, 100), 12);
  assert.equal(changePercent(75, 100), -25);
});

test('activity series fills missing buckets with zeroes', () => {
  const range = resolveOverviewRange('7d', fixedNow);
  const series = mergeActivitySeries({
    range,
    attempts: [{ bucket: '2026-08-22', attempts: 4, studentsTakingTests: 3 }],
    completions: [{ bucket: '2026-08-22', completions: 2 }],
  });
  assert.equal(series.length, 7);
  assert.deepEqual(series.find(item => item.bucket === '2026-08-22'), {
    bucket: '2026-08-22',
    attempts: 4,
    completions: 2,
    studentsTakingTests: 3,
  });
  assert.equal(series.find(item => item.bucket === '2026-08-21').attempts, 0);
});

test('overview returns real counts and only non-zero integrity issues', async () => {
  const userCounts = [100, 4, 10, 1, 80];
  const classCounts = [12, 2];
  const submissionCounts = [30, 20];
  const testCounts = [8, 3, 1, 15, 2, 1, 0, 2];
  const db = {
    user: { count: async () => userCounts.shift() },
    class: {
      count: async () => classCounts.shift(),
      findMany: async () => [{ teacherId: 4 }, { teacherId: 8 }],
    },
    submission: { count: async () => submissionCounts.shift() },
    test: { count: async () => testCounts.shift() },
  };

  const result = await getOverviewWithDb({ db, range: '30d', now: fixedNow });
  assert.deepEqual(result.summary.students, { total: 100, createdInPeriod: 4 });
  assert.deepEqual(result.summary.testAttempts, { current: 30, previous: 20, changePercent: 50 });
  assert.deepEqual(result.classrooms, {
    total: 12,
    teachersWithClasses: 2,
    uniqueEnrolledStudents: 80,
    createdInPeriod: 2,
  });
  assert.deepEqual(result.tests.system, { published: 8, draft: 3, archived: 1 });
  assert.equal(result.attention.length, 2);
  assert.equal(result.attention[0].code, 'PUBLISHED_SYSTEM_TEST_WITHOUT_SECTIONS');
  assert.equal(result.attention[1].code, 'PUBLISHED_SYSTEM_TEST_WITH_EMPTY_SECTION');
});

test('activity endpoint keeps chart aggregation separate from overview counts', async () => {
  const queryResults = [
    [{ bucket: '2026-08-22', attempts: 5, studentsTakingTests: 4 }],
    [{ bucket: '2026-08-22', completions: 3 }],
  ];
  const db = { $queryRaw: async () => queryResults.shift() };
  const result = await getActivityWithDb({ db, range: '7d', now: fixedNow });
  assert.equal(result.range.granularity, 'DAY');
  assert.equal(result.series.find(item => item.bucket === '2026-08-22').completions, 3);
});

test('integrity filters accept only supported admin deep-link values', () => {
  assert.equal(normalizeIntegrityFilter('no_questions'), 'NO_QUESTIONS');
  assert.equal(normalizeIntegrityFilter('draft'), '');
});
