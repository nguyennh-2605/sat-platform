const RANGE_DAYS = { 30: 30, 90: 90 };
const ALL_TIME_CHART_DAYS = 365;
const ACTIVITY_ORDER = ['PRACTICE', 'VOCABULARY', 'ERROR_LOG', 'HOMEWORK', 'OTHER'];

const normalizeStudyTimeQuery = ({ range, timeZone } = {}) => {
  const normalizedRange = range === undefined ? '90' : String(range);
  if (!['30', '90', 'all'].includes(normalizedRange)) throw new TypeError('range must be 30, 90, or all.');
  if (timeZone !== undefined && typeof timeZone !== 'string') throw new TypeError('timeZone must be a valid IANA time zone.');
  const normalizedTimeZone = typeof timeZone === 'string' && timeZone.trim() ? timeZone.trim() : 'UTC';
  if (normalizedTimeZone.length > 100) throw new TypeError('timeZone is invalid.');
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: normalizedTimeZone }).format(new Date());
  } catch {
    throw new TypeError('timeZone must be a valid IANA time zone.');
  }
  return { range: normalizedRange, timeZone: normalizedTimeZone };
};

const dateKeyInTimeZone = (value, timeZone) => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(value));
  const part = type => parts.find(item => item.type === type)?.value;
  return `${part('year')}-${part('month')}-${part('day')}`;
};

const dayOrdinal = (dateKey) => {
  const [year, month, day] = dateKey.split('-').map(Number);
  return Math.floor(Date.UTC(year, month - 1, day) / 86_400_000);
};

const dateKeyFromOrdinal = (ordinal) => new Date(ordinal * 86_400_000).toISOString().slice(0, 10);

const sessionDuration = (session) => Math.max(0, Math.min(
  Number(session.accumulatedMs) || 0,
  Number(session.plannedDurationMs) || Number(session.accumulatedMs) || 0,
));

const calculateStreaks = (dateKeys, todayOrdinal) => {
  const active = new Set(dateKeys.map(dayOrdinal));
  const sorted = [...active].sort((a, b) => a - b);
  let longestStreak = 0;
  let run = 0;
  let previous = null;
  for (const ordinal of sorted) {
    run = previous !== null && ordinal === previous + 1 ? run + 1 : 1;
    longestStreak = Math.max(longestStreak, run);
    previous = ordinal;
  }

  let cursor = active.has(todayOrdinal) ? todayOrdinal : todayOrdinal - 1;
  let currentStreak = 0;
  while (active.has(cursor)) {
    currentStreak += 1;
    cursor -= 1;
  }
  return { currentStreak, longestStreak };
};

const aggregateStudyTime = ({ sessions = [], range = '90', timeZone = 'UTC', now = new Date() }) => {
  const query = normalizeStudyTimeQuery({ range, timeZone });
  const todayKey = dateKeyInTimeZone(now, query.timeZone);
  const todayOrdinal = dayOrdinal(todayKey);
  const requestedDays = RANGE_DAYS[query.range] || null;
  const summaryStartOrdinal = requestedDays ? todayOrdinal - requestedDays + 1 : null;
  const chartStartOrdinal = requestedDays ? summaryStartOrdinal : todayOrdinal - ALL_TIME_CHART_DAYS + 1;

  const eligible = sessions
    .filter(session => session.status === 'COMPLETED' && session.endedAt && sessionDuration(session) > 0 && new Date(session.endedAt) <= now)
    .map(session => ({ ...session, durationMs: sessionDuration(session), date: dateKeyInTimeZone(session.endedAt, query.timeZone) }))
    .filter(session => dayOrdinal(session.date) <= todayOrdinal);
  const summarySessions = eligible.filter(session => summaryStartOrdinal === null || dayOrdinal(session.date) >= summaryStartOrdinal);
  const chartSessions = summarySessions.filter(session => dayOrdinal(session.date) >= chartStartOrdinal);

  const dailyMap = new Map();
  for (const session of chartSessions) {
    const current = dailyMap.get(session.date) || { date: session.date, trackedMs: 0, sessionCount: 0 };
    current.trackedMs += session.durationMs;
    current.sessionCount += 1;
    dailyMap.set(session.date, current);
  }

  const activityMap = new Map(ACTIVITY_ORDER.map(activityType => [activityType, { activityType, trackedMs: 0, sessionCount: 0 }]));
  for (const session of summarySessions) {
    const current = activityMap.get(session.activityType) || activityMap.get('OTHER');
    current.trackedMs += session.durationMs;
    current.sessionCount += 1;
  }

  const trackedMs = summarySessions.reduce((total, session) => total + session.durationMs, 0);
  const activeDates = [...new Set(summarySessions.map(session => session.date))];
  const streaks = calculateStreaks(activeDates, todayOrdinal);
  const activities = [...activityMap.values()]
    .filter(item => item.sessionCount > 0)
    .map(item => ({ ...item, percentage: trackedMs ? Math.round((item.trackedMs / trackedMs) * 100) : 0 }));

  const earliestSummaryDate = activeDates.sort()[0] || null;
  return {
    range: query.range,
    timeZone: query.timeZone,
    generatedAt: now,
    period: {
      from: summaryStartOrdinal === null ? earliestSummaryDate : dateKeyFromOrdinal(summaryStartOrdinal),
      to: todayKey,
    },
    summary: {
      trackedMs,
      sessionCount: summarySessions.length,
      activeDays: activeDates.length,
      currentStreak: streaks.currentStreak,
      longestStreak: streaks.longestStreak,
      averageSessionMs: summarySessions.length ? Math.round(trackedMs / summarySessions.length) : null,
    },
    daily: [...dailyMap.values()].sort((a, b) => a.date.localeCompare(b.date)),
    activities,
    chartWindow: {
      from: dateKeyFromOrdinal(chartStartOrdinal),
      to: todayKey,
      truncated: summaryStartOrdinal === null && Boolean(earliestSummaryDate && dayOrdinal(earliestSummaryDate) < chartStartOrdinal),
    },
  };
};

module.exports = {
  ALL_TIME_CHART_DAYS,
  ACTIVITY_ORDER,
  normalizeStudyTimeQuery,
  dateKeyInTimeZone,
  aggregateStudyTime,
};
