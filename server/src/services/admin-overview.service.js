const { Prisma } = require('@prisma/client');
const prisma = require('../config/prisma');
const ApiError = require('../utils/ApiError');
const { PLATFORM_TIME_ZONE, PLATFORM_UTC_OFFSET_MINUTES } = require('../config/platform-time');
const { INTEGRITY_FILTERS } = require('../utils/test-integrity');

const DAY_MS = 24 * 60 * 60 * 1000;
const RANGE_DAYS = { '7d': 7, '30d': 30, '90d': 90 };

const normalizeRangeKey = value => {
  const normalized = String(value || '30d').trim().toLowerCase();
  if (!RANGE_DAYS[normalized]) throw new ApiError(400, { error: 'Range must be 7d, 30d, or 90d.' });
  return normalized;
};

const startOfPlatformDay = date => {
  const shifted = new Date(date.getTime() + PLATFORM_UTC_OFFSET_MINUTES * 60_000);
  return new Date(Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate()) - PLATFORM_UTC_OFFSET_MINUTES * 60_000);
};

const resolveOverviewRange = (value, now = new Date()) => {
  const key = normalizeRangeKey(value);
  const days = RANGE_DAYS[key];
  const todayStart = startOfPlatformDay(now);
  const to = new Date(todayStart.getTime() + DAY_MS);
  const from = new Date(to.getTime() - days * DAY_MS);
  const previousTo = from;
  const previousFrom = new Date(previousTo.getTime() - days * DAY_MS);
  return {
    key,
    days,
    granularity: days > 30 ? 'WEEK' : 'DAY',
    from,
    to,
    previousFrom,
    previousTo,
  };
};

const changePercent = (current, previous) => previous === 0
  ? null
  : Math.round(((current - previous) / previous) * 1000) / 10;

const dateKeyFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: PLATFORM_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

const formatDateKey = value => dateKeyFormatter.format(value);

const startOfIsoWeekKey = dateKey => {
  const date = new Date(`${dateKey}T00:00:00.000Z`);
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() - day + 1);
  return date.toISOString().slice(0, 10);
};

const bucketKeys = range => {
  const keys = [];
  const seen = new Set();
  for (let time = range.from.getTime(); time < range.to.getTime(); time += DAY_MS) {
    const dayKey = formatDateKey(new Date(time));
    const key = range.granularity === 'WEEK' ? startOfIsoWeekKey(dayKey) : dayKey;
    if (!seen.has(key)) {
      seen.add(key);
      keys.push(key);
    }
  }
  return keys;
};

const mergeActivitySeries = ({ range, attempts = [], completions = [] }) => {
  const attemptMap = new Map(attempts.map(item => [String(item.bucket), item]));
  const completionMap = new Map(completions.map(item => [String(item.bucket), item]));
  return bucketKeys(range).map(bucket => ({
    bucket,
    attempts: Number(attemptMap.get(bucket)?.attempts || 0),
    completions: Number(completionMap.get(bucket)?.completions || 0),
    studentsTakingTests: Number(attemptMap.get(bucket)?.studentsTakingTests || 0),
  }));
};

const attentionDefinitions = [
  {
    code: 'PUBLISHED_SYSTEM_TEST_WITHOUT_SECTIONS',
    integrity: 'NO_SECTIONS',
    severity: 'critical',
    title: 'Published tests have no sections',
  },
  {
    code: 'PUBLISHED_SYSTEM_TEST_WITHOUT_QUESTIONS',
    integrity: 'NO_QUESTIONS',
    severity: 'critical',
    title: 'Published tests have no questions',
  },
  {
    code: 'PUBLISHED_SYSTEM_TEST_WITH_EMPTY_SECTION',
    integrity: 'EMPTY_SECTION',
    severity: 'warning',
    title: 'Published tests contain an empty section',
  },
];

const overviewRangeResponse = range => ({
  key: range.key,
  from: range.from.toISOString(),
  to: range.to.toISOString(),
  previousFrom: range.previousFrom.toISOString(),
  previousTo: range.previousTo.toISOString(),
});

const getOverviewWithDb = async ({ db, range: requestedRange, now = new Date() }) => {
  const range = resolveOverviewRange(requestedRange, now);
  const createdInPeriod = { gte: range.from, lt: range.to };
  const currentAttempts = { gte: range.from, lt: range.to };
  const previousAttempts = { gte: range.previousFrom, lt: range.previousTo };

  const [
    studentsTotal,
    studentsCreated,
    teachersTotal,
    teachersCreated,
    classroomsTotal,
    classroomsCreated,
    attemptsCurrent,
    attemptsPrevious,
    systemPublished,
    systemDraft,
    systemArchived,
    teacherTestsTotal,
    teacherTestsCreated,
    teachersWithClasses,
    uniqueEnrolledStudents,
    ...attentionCounts
  ] = await Promise.all([
    db.user.count({ where: { role: 'STUDENT' } }),
    db.user.count({ where: { role: 'STUDENT', createdAt: createdInPeriod } }),
    db.user.count({ where: { role: 'TEACHER' } }),
    db.user.count({ where: { role: 'TEACHER', createdAt: createdInPeriod } }),
    db.class.count(),
    db.class.count({ where: { createdAt: createdInPeriod } }),
    db.submission.count({ where: { startedAt: currentAttempts } }),
    db.submission.count({ where: { startedAt: previousAttempts } }),
    db.test.count({ where: { scope: 'SYSTEM', status: 'PUBLISHED' } }),
    db.test.count({ where: { scope: 'SYSTEM', status: 'DRAFT' } }),
    db.test.count({ where: { scope: 'SYSTEM', status: 'ARCHIVED' } }),
    db.test.count({ where: { scope: 'PERSONAL', author: { role: 'TEACHER' } } }),
    db.test.count({ where: { scope: 'PERSONAL', author: { role: 'TEACHER' }, createdAt: createdInPeriod } }),
    db.class.findMany({ distinct: ['teacherId'], select: { teacherId: true } }),
    db.user.count({ where: { role: 'STUDENT', studyingClasses: { some: {} } } }),
    ...attentionDefinitions.map(item => db.test.count({ where: INTEGRITY_FILTERS[item.integrity] })),
  ]);

  return {
    generatedAt: now.toISOString(),
    range: overviewRangeResponse(range),
    summary: {
      students: { total: studentsTotal, createdInPeriod: studentsCreated },
      teachers: { total: teachersTotal, createdInPeriod: teachersCreated },
      classrooms: { total: classroomsTotal, createdInPeriod: classroomsCreated },
      testAttempts: {
        current: attemptsCurrent,
        previous: attemptsPrevious,
        changePercent: changePercent(attemptsCurrent, attemptsPrevious),
      },
    },
    attention: attentionDefinitions.flatMap((definition, index) => {
      const count = Number(attentionCounts[index] || 0);
      return count > 0 ? [{
        code: definition.code,
        severity: definition.severity,
        count,
        title: definition.title,
        href: `/dashboard/practice-test?source=SYSTEM&status=PUBLISHED&integrity=${definition.integrity}`,
      }] : [];
    }),
    tests: {
      system: { published: systemPublished, draft: systemDraft, archived: systemArchived },
      teacher: { total: teacherTestsTotal, createdInPeriod: teacherTestsCreated },
    },
    classrooms: {
      total: classroomsTotal,
      teachersWithClasses: teachersWithClasses.length,
      uniqueEnrolledStudents,
      createdInPeriod: classroomsCreated,
    },
  };
};

const getActivityWithDb = async ({ db, range: requestedRange, now = new Date() }) => {
  const range = resolveOverviewRange(requestedRange, now);
  const unit = range.granularity === 'WEEK' ? 'week' : 'day';
  const attempts = await db.$queryRaw(Prisma.sql`
    SELECT
      TO_CHAR(DATE_TRUNC(${unit}, "startedAt" AT TIME ZONE ${PLATFORM_TIME_ZONE}), 'YYYY-MM-DD') AS bucket,
      COUNT(*)::int AS attempts,
      COUNT(DISTINCT "userId")::int AS "studentsTakingTests"
    FROM "Submission"
    WHERE "startedAt" >= ${range.from} AND "startedAt" < ${range.to}
    GROUP BY 1
    ORDER BY 1
  `);
  const completions = await db.$queryRaw(Prisma.sql`
    SELECT
      TO_CHAR(DATE_TRUNC(${unit}, "endTime" AT TIME ZONE ${PLATFORM_TIME_ZONE}), 'YYYY-MM-DD') AS bucket,
      COUNT(*)::int AS completions
    FROM "Submission"
    WHERE "status" = 'COMPLETED'
      AND "endTime" IS NOT NULL
      AND "endTime" >= ${range.from}
      AND "endTime" < ${range.to}
    GROUP BY 1
    ORDER BY 1
  `);

  return {
    range: {
      ...overviewRangeResponse(range),
      granularity: range.granularity,
    },
    series: mergeActivitySeries({ range, attempts, completions }),
  };
};

exports.getOverview = args => getOverviewWithDb({ db: prisma, ...args });
exports.getActivity = args => getActivityWithDb({ db: prisma, ...args });
exports.getOverviewWithDb = getOverviewWithDb;
exports.getActivityWithDb = getActivityWithDb;
exports.resolveOverviewRange = resolveOverviewRange;
exports.changePercent = changePercent;
exports.mergeActivitySeries = mergeActivitySeries;
exports.integrityFilters = INTEGRITY_FILTERS;
