const prisma = require('../config/prisma');
const ApiError = require('../utils/ApiError');
const { buildStudentAnalyticsPayload, isTimingEligible, sourceOf } = require('../utils/analytics-transform');

const ANALYTICS_SUBMISSION_SELECT = {
  id: true,
  status: true,
  startedAt: true,
  endTime: true,
  assignmentId: true,
  classTestId: true,
  deliveryId: true,
  test: {
    select: {
      title: true,
      subject: true,
      mode: true,
    },
  },
  answers: {
    select: {
      isCorrect: true,
      question: {
        select: {
          id: true,
          domainCode: true,
          skillCode: true,
        },
      },
    },
  },
  questionTimings: {
    select: { questionId: true, activeDurationMs: true },
  },
};

const normalizeAnalyticsFilters = ({ range, days, subject, now = new Date() }) => {
  let normalizedRange = range === undefined ? null : String(range).toLowerCase();
  let normalizedDays = null;
  if (!normalizedRange && days !== undefined) {
    const legacyDays = Number.parseInt(days, 10);
    if (!Number.isInteger(legacyDays) || legacyDays < 1 || legacyDays > 365) {
      throw new ApiError(400, { message: 'Days must be between 1 and 365.' });
    }
    normalizedRange = String(legacyDays);
    normalizedDays = legacyDays;
  } else if (!normalizedRange) {
    normalizedRange = '90';
    normalizedDays = 90;
  } else if (normalizedRange === 'all') {
    normalizedDays = null;
  } else if (normalizedRange === '30' || normalizedRange === '90') {
    normalizedDays = Number(normalizedRange);
  } else {
    throw new ApiError(400, { message: 'Range must be 30, 90, or all.' });
  }

  const normalizedSubject = String(subject || 'ALL').toUpperCase();
  if (!['ALL', 'RW', 'MATH'].includes(normalizedSubject)) {
    throw new ApiError(400, { message: 'Subject must be ALL, RW, or MATH.' });
  }

  let cutoff = null;
  if (normalizedDays !== null) {
    cutoff = new Date(now);
    cutoff.setUTCDate(cutoff.getUTCDate() - normalizedDays);
    cutoff.setUTCHours(0, 0, 0, 0);
  }
  return { range: normalizedRange, days: normalizedDays, subject: normalizedSubject, cutoff };
};

const encodeAttemptCursor = row => Buffer.from(JSON.stringify({
  startedAt: new Date(row.startedAt).toISOString(),
  id: row.id,
})).toString('base64url');

const decodeAttemptCursor = value => {
  if (!value) return null;
  try {
    if (typeof value !== 'string' || value.length > 512 || !/^[A-Za-z0-9_-]+$/.test(value)) throw new Error();
    const parsed = JSON.parse(Buffer.from(value, 'base64url').toString());
    if (!Number.isInteger(parsed.id) || parsed.id < 1 || !Number.isFinite(Date.parse(parsed.startedAt))) throw new Error();
    return { id: parsed.id, startedAt: new Date(parsed.startedAt) };
  } catch {
    throw new ApiError(400, { message: 'Invalid attempts cursor.' });
  }
};

const getDataWithDb = async ({ db, userId, range, days, subject, now = new Date() }) => {
  const filters = normalizeAnalyticsFilters({ range, days, subject, now });
  const [rawData, errorLogs] = await Promise.all([
    db.submission.findMany({
      where: {
        userId,
        status: 'COMPLETED',
        ...(filters.cutoff ? { startedAt: { gte: filters.cutoff } } : {}),
        ...(filters.subject === 'ALL' ? {} : { test: { subject: filters.subject } }),
      },
      orderBy: [{ startedAt: 'asc' }, { id: 'asc' }],
      select: ANALYTICS_SUBMISSION_SELECT,
    }),
    db.errorLog.findMany({
      where: {
        userId,
        ...(filters.cutoff ? { createdAt: { gte: filters.cutoff } } : {}),
      },
      select: {
        category: true,
        reviewedAt: true,
        question: {
          select: {
            domainCode: true,
            skillCode: true,
            section: { select: { test: { select: { subject: true } } } },
          },
        },
      },
    }),
  ]);

  return buildStudentAnalyticsPayload(rawData, errorLogs, {
    range: filters.range,
    subject: filters.subject,
    now,
  });
};

const getAttemptsWithDb = async ({ db, userId, query = {}, now = new Date() }) => {
  const filters = normalizeAnalyticsFilters({
    range: query.range,
    days: query.days,
    subject: query.subject,
    now,
  });
  const source = String(query.source || 'ALL').toUpperCase();
  if (!['ALL', 'CLASSROOM', 'SELF_STUDY'].includes(source)) {
    throw new ApiError(400, { message: 'Source must be ALL, CLASSROOM, or SELF_STUDY.' });
  }
  const limit = query.limit === undefined ? 20 : Number(query.limit);
  if (!Number.isInteger(limit) || limit < 1 || limit > 50) {
    throw new ApiError(400, { message: 'Limit must be between 1 and 50.' });
  }
  const search = String(query.search || '').trim().slice(0, 100);
  const cursor = decodeAttemptCursor(query.cursor);
  const sourceWhere = source === 'CLASSROOM'
    ? { OR: [{ deliveryId: { not: null } }, { classTestId: { not: null } }, { assignmentId: { not: null } }] }
    : source === 'SELF_STUDY'
      ? { deliveryId: null, classTestId: null, assignmentId: null }
      : {};
  const baseWhere = {
    userId,
    status: 'COMPLETED',
    ...(filters.cutoff ? { startedAt: { gte: filters.cutoff } } : {}),
    ...(filters.subject === 'ALL' ? {} : { test: { subject: filters.subject } }),
    ...(search ? { test: { ...(filters.subject === 'ALL' ? {} : { subject: filters.subject }), title: { contains: search, mode: 'insensitive' } } } : {}),
    ...sourceWhere,
  };
  const where = cursor ? {
    AND: [baseWhere, { OR: [
      { startedAt: { lt: cursor.startedAt } },
      { startedAt: cursor.startedAt, id: { lt: cursor.id } },
    ] }],
  } : baseWhere;
  const rows = await db.submission.findMany({
    where,
    orderBy: [{ startedAt: 'desc' }, { id: 'desc' }],
    take: limit + 1,
    select: {
      id: true,
      status: true,
      startedAt: true,
      beganAt: true,
      endTime: true,
      assignmentId: true,
      classTestId: true,
      deliveryId: true,
      test: { select: { title: true, subject: true, mode: true } },
      _count: { select: { answers: true } },
    },
  });
  const pageRows = rows.slice(0, limit);
  const submissionIds = pageRows.map(row => row.id);
  const timedSubmissionIds = pageRows.filter(isTimingEligible).map(row => row.id);
  const [correctCounts, timingTotals] = await Promise.all([
    submissionIds.length
      ? db.answer.groupBy({
        by: ['submissionId'],
        where: { submissionId: { in: submissionIds }, isCorrect: true },
        _count: { _all: true },
      })
      : [],
    timedSubmissionIds.length
      ? db.questionTiming.groupBy({
        by: ['submissionId'],
        where: { submissionId: { in: timedSubmissionIds } },
        _sum: { activeDurationMs: true },
      })
      : [],
  ]);
  const correctCountBySubmission = new Map(correctCounts.map(item => [item.submissionId, item._count._all]));
  const timingBySubmission = new Map(timingTotals.map(item => [item.submissionId, item._sum.activeDurationMs || 0]));

  const items = pageRows.map(row => {
    const totalQuestions = row._count.answers;
    const correctCount = correctCountBySubmission.get(row.id) || 0;
    const activeDurationMs = timingBySubmission.get(row.id) || 0;
    const elapsedDurationMs = row.endTime
      ? Math.max(0, new Date(row.endTime).getTime() - new Date(row.beganAt || row.startedAt).getTime())
      : null;
    return {
      id: row.id,
      testName: row.test.title,
      subject: row.test.subject,
      mode: row.test.mode,
      accuracy: totalQuestions ? Math.round((correctCount / totalQuestions) * 1000) / 10 : null,
      correctCount,
      totalQuestions,
      durationMs: activeDurationMs || elapsedDurationMs,
      durationSource: activeDurationMs ? 'ACTIVE' : elapsedDurationMs !== null ? 'ELAPSED' : null,
      source: sourceOf(row),
      completedAt: (row.endTime || row.startedAt).toISOString(),
    };
  });
  return {
    items,
    nextCursor: rows.length > limit ? encodeAttemptCursor(rows[limit - 1]) : null,
  };
};

exports.normalizeAnalyticsFilters = normalizeAnalyticsFilters;

const getSubmissionDetailWithDb = async ({ db, id, userId }) => {
  const submissionId = Number(id);
  if (!Number.isSafeInteger(submissionId) || submissionId < 1) {
    throw new ApiError(400, { message: 'Submission id must be a positive integer.' });
  }

  const submission = await db.submission.findFirst({
    where: {
      id: submissionId,
      userId,
      status: 'COMPLETED',
    },
    select: {
      startedAt: true,
      beganAt: true,
      endTime: true,
      test: {
        select: { title: true, subject: true },
      },
      answers: {
        orderBy: { question: { order: 'asc' } },
        select: {
          selectedChoice: true,
          isCorrect: true,
          question: {
            select: {
              id: true,
              order: true,
              blocks: true,
              questionText: true,
              choices: true,
              correctAnswer: true,
              section: { select: { order: true } },
            },
          },
        },
      },
      questionTimings: {
        select: { questionId: true, activeDurationMs: true },
      },
    },
  });

  if (!submission) {
    throw new ApiError(404, { message: 'Completed submission not found.' });
  }

  let durationString = 'N/A';
  if (submission.startedAt && submission.endTime) {
    const diffSeconds = Math.max(0, Math.floor((new Date(submission.endTime) - new Date(submission.beganAt || submission.startedAt)) / 1000));
    const h = Math.floor(diffSeconds / 3600);
    const m = Math.floor((diffSeconds % 3600) / 60);
    const s = diffSeconds % 60;
    durationString = `${h > 0 ? h + ':' : ''}${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }

  const timingByQuestionId = new Map(
    submission.questionTimings.map(timing => [timing.questionId, timing.activeDurationMs])
  );

  const formattedQuestions = submission.answers.map((ans, index) => {
    const question = ans.question;

    return {
      id: question.id,
      module: `Module ${question.section?.order || 1}`,
      questionNumber: question.order || (index + 1),
      blocks: question.blocks || [],
      questionText: question.questionText,
      choices: question.choices || [],
      correctAnswer: question.correctAnswer,
      userAnswer: ans.selectedChoice,
      isCorrect: ans.isCorrect,
      activeDurationMs: timingByQuestionId.get(question.id) ?? null,
    };
  });

  return {
    examTitle: submission.test.title,
    subject: submission.test.subject,
    date: submission.endTime?.toISOString() || submission.startedAt.toISOString(),
    startedAt: submission.startedAt.toISOString(),
    completedAt: submission.endTime?.toISOString() || null,
    duration: durationString,
    questions: formattedQuestions,
  };
};

exports.getData = params => getDataWithDb({ ...params, db: prisma });
exports.getAttempts = params => getAttemptsWithDb({ ...params, db: prisma });
exports.getSubmissionDetail = params => getSubmissionDetailWithDb({ ...params, db: prisma });
exports.getDataWithDb = getDataWithDb;
exports.getAttemptsWithDb = getAttemptsWithDb;
exports.getSubmissionDetailWithDb = getSubmissionDetailWithDb;
