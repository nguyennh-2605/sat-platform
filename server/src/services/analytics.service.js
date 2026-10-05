const prisma = require('../config/prisma');
const ApiError = require('../utils/ApiError');
const { SOLUTION_DELIVERY_SELECT, isSubmissionSolutionLocked } = require('../utils/solution-access');
const { buildStudentAnalyticsPayload, isTimingEligible, sourceOf } = require('../utils/analytics-transform');
const { domains: taxonomyDomains, skills: taxonomySkills } = require('../utils/question-taxonomy');

const domainByCode = new Map(taxonomyDomains.map(domain => [domain.code, domain]));
const skillByCode = new Map(taxonomySkills.map(skill => [skill.code, skill]));

const ANALYTICS_SUBMISSION_SELECT = {
  id: true,
  status: true,
  startedAt: true,
  endTime: true,
  assignmentId: true,
  classTestId: true,
  deliveryId: true,
  attemptMode: true,
  timingPreset: true,
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

const roundPercentage = (correct, total) => total ? Number(((correct / total) * 100).toFixed(1)) : null;

const normalizeChoices = choices => (Array.isArray(choices) ? choices : []).map((choice, index) => {
  const fallbackId = String.fromCharCode(65 + index);
  if (typeof choice === 'string') return { id: fallbackId, text: choice };
  if (!choice || typeof choice !== 'object' || Array.isArray(choice)) {
    return { id: fallbackId, text: String(choice ?? '') };
  }
  return {
    id: String(choice.id || fallbackId),
    text: String(choice.text ?? choice.content ?? ''),
  };
});

const addOutcome = (target, question) => {
  target.total += 1;
  if (question.isCorrect) target.correct += 1;
  else if (question.isOmitted) target.omitted += 1;
  else target.incorrect += 1;
  if (Number.isFinite(question.activeDurationMs) && question.activeDurationMs > 0) {
    target.activeDurationMs += question.activeDurationMs;
    target.timedQuestions += 1;
  }
};

const finalizeOutcome = target => ({
  ...target,
  accuracy: roundPercentage(target.correct, target.total),
  timingCoverage: target.total ? Number(((target.timedQuestions / target.total) * 100).toFixed(1)) : null,
});

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
      attemptMode: true,
      timingPreset: true,
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
      mode: row.attemptMode || row.test.mode,
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
      id: true,
      attemptNo: true,
      attemptMode: true,
      timingPreset: true,
      startedAt: true,
      beganAt: true,
      endTime: true,
      test: {
        select: { title: true, subject: true, mode: true },
      },
      delivery: { select: SOLUTION_DELIVERY_SELECT },
      answers: {
        select: {
          selectedChoice: true,
          isCorrect: true,
          question: {
            select: {
              id: true,
              type: true,
              order: true,
              blocks: true,
              questionText: true,
              choices: true,
              correctAnswer: true,
              explanation: true,
              domainCode: true,
              skillCode: true,
              section: { select: { id: true, name: true, order: true } },
            },
          },
        },
      },
      questionTimings: {
        select: { questionId: true, activeDurationMs: true },
      },
      errorLogs: {
        select: { id: true, questionId: true },
      },
    },
  });

  if (!submission) {
    throw new ApiError(404, { message: 'Completed submission not found.' });
  }
  const solutionsLocked = isSubmissionSolutionLocked({ status: 'COMPLETED', delivery: submission.delivery });

  const elapsedDurationMs = submission.endTime
    ? Math.max(0, new Date(submission.endTime).getTime() - new Date(submission.beganAt || submission.startedAt).getTime())
    : null;
  const totalSeconds = elapsedDurationMs === null ? null : Math.floor(elapsedDurationMs / 1000);
  const durationString = totalSeconds === null
    ? 'N/A'
    : `${totalSeconds >= 3600 ? `${Math.floor(totalSeconds / 3600)}:` : ''}${Math.floor((totalSeconds % 3600) / 60).toString().padStart(2, '0')}:${(totalSeconds % 60).toString().padStart(2, '0')}`;

  const timingByQuestionId = new Map(
    submission.questionTimings.map(timing => [timing.questionId, timing.activeDurationMs])
  );
  const errorLogByQuestionId = new Map(
    submission.errorLogs.filter(log => log.questionId).map(log => [log.questionId, log.id])
  );

  const questions = submission.answers.map((ans, index) => {
    const question = ans.question;
    const moduleOrder = question.section?.order || 1;
    const domain = question.domainCode ? domainByCode.get(question.domainCode) : null;
    const candidateSkill = question.skillCode ? skillByCode.get(question.skillCode) : null;
    const skill = candidateSkill?.domainCode === domain?.code ? candidateSkill : null;
    const isOmitted = ans.selectedChoice === null || String(ans.selectedChoice).trim() === '';
    const activeDurationMs = timingByQuestionId.get(question.id);

    return {
      id: question.id,
      type: question.type === 'SPR' ? 'SPR' : 'MCQ',
      module: {
        id: question.section?.id || null,
        name: question.section?.name || `Module ${moduleOrder}`,
        order: moduleOrder,
      },
      questionNumber: question.order || (index + 1),
      blocks: question.blocks || [],
      questionText: question.questionText,
      choices: normalizeChoices(question.choices),
      correctAnswer: question.correctAnswer,
      userAnswer: ans.selectedChoice,
      isCorrect: ans.isCorrect,
      isOmitted,
      explanation: String(question.explanation || '').trim() || null,
      domain: domain ? { code: domain.code, name: domain.name, sortOrder: domain.sortOrder } : null,
      skill: skill ? { code: skill.code, name: skill.name, sortOrder: skill.sortOrder } : null,
      activeDurationMs: Number.isFinite(activeDurationMs) && activeDurationMs > 0 ? activeDurationMs : null,
      errorLogId: errorLogByQuestionId.get(question.id) || null,
    };
  }).sort((first, second) => first.module.order - second.module.order
    || first.questionNumber - second.questionNumber
    || Number(first.id) - Number(second.id));

  const summaryState = { total: 0, correct: 0, incorrect: 0, omitted: 0, activeDurationMs: 0, timedQuestions: 0 };
  const moduleStates = new Map();
  const domainStates = new Map(
    taxonomyDomains
      .filter(domain => domain.subject === submission.test.subject)
      .map(domain => [domain.code, {
        code: domain.code,
        name: domain.name,
        sortOrder: domain.sortOrder,
        total: 0,
        correct: 0,
        incorrect: 0,
        omitted: 0,
        activeDurationMs: 0,
        timedQuestions: 0,
        skills: new Map(),
      }])
  );
  for (const question of questions) {
    addOutcome(summaryState, question);

    const moduleState = moduleStates.get(question.module.order) || {
      ...question.module,
      total: 0,
      correct: 0,
      incorrect: 0,
      omitted: 0,
      activeDurationMs: 0,
      timedQuestions: 0,
    };
    addOutcome(moduleState, question);
    moduleStates.set(question.module.order, moduleState);

    const domainKey = question.domain?.code || 'UNCLASSIFIED';
    const domainState = domainStates.get(domainKey) || {
      code: domainKey,
      name: question.domain?.name || 'Unclassified',
      sortOrder: question.domain?.sortOrder ?? 999,
      total: 0,
      correct: 0,
      incorrect: 0,
      omitted: 0,
      activeDurationMs: 0,
      timedQuestions: 0,
      skills: new Map(),
    };
    addOutcome(domainState, question);
    if (question.skill) {
      const skillState = domainState.skills.get(question.skill.code) || {
        ...question.skill,
        total: 0,
        correct: 0,
        incorrect: 0,
        omitted: 0,
        activeDurationMs: 0,
        timedQuestions: 0,
      };
      addOutcome(skillState, question);
      domainState.skills.set(question.skill.code, skillState);
    }
    domainStates.set(domainKey, domainState);
  }

  const summary = finalizeOutcome(summaryState);
  const modules = [...moduleStates.values()]
    .sort((first, second) => first.order - second.order)
    .map(finalizeOutcome);
  const domains = [...domainStates.values()]
    .sort((first, second) => first.sortOrder - second.sortOrder || first.name.localeCompare(second.name))
    .map(domain => {
      const { skills, ...domainOutcome } = domain;
      return {
        ...finalizeOutcome(domainOutcome),
        skills: [...skills.values()]
          .sort((first, second) => first.sortOrder - second.sortOrder || first.name.localeCompare(second.name))
          .map(finalizeOutcome),
      };
    });
  const timedQuestions = questions.filter(question => question.activeDurationMs !== null);
  const slowestQuestion = timedQuestions.reduce((slowest, question) => (
    !slowest || question.activeDurationMs > slowest.activeDurationMs ? question : slowest
  ), null);
  const classifiedQuestionCount = questions.filter(question => question.domain).length;

  return {
    submissionId: submission.id,
    examTitle: submission.test.title,
    subject: submission.test.subject,
    mode: submission.attemptMode || submission.test.mode,
    attemptNo: submission.attemptNo,
    date: submission.endTime?.toISOString() || submission.startedAt.toISOString(),
    startedAt: submission.startedAt.toISOString(),
    completedAt: submission.endTime?.toISOString() || null,
    duration: durationString,
    elapsedDurationMs,
    activeDurationMs: summary.activeDurationMs || null,
    summary,
    modules,
    domains,
    pacing: {
      activeDurationMs: summary.activeDurationMs || null,
      averageActiveDurationMs: summary.timedQuestions ? Math.round(summary.activeDurationMs / summary.timedQuestions) : null,
      timedQuestions: summary.timedQuestions,
      totalQuestions: summary.total,
      timingCoverage: summary.timingCoverage,
      slowestQuestion: slowestQuestion ? {
        id: slowestQuestion.id,
        questionNumber: slowestQuestion.questionNumber,
        moduleOrder: slowestQuestion.module.order,
        activeDurationMs: slowestQuestion.activeDurationMs,
      } : null,
    },
    classificationCoverage: {
      classified: classifiedQuestionCount,
      total: questions.length,
      percentage: questions.length
        ? Number(((classifiedQuestionCount / questions.length) * 100).toFixed(1))
        : null,
    },
    solutionsLocked,
    solutionAvailableAt: solutionsLocked ? submission.delivery?.dueAt?.toISOString() || null : null,
    questions: solutionsLocked
      ? questions.map(question => ({ ...question, correctAnswer: null, explanation: null, isCorrect: null }))
      : questions,
  };
};

exports.getData = params => getDataWithDb({ ...params, db: prisma });
exports.getAttempts = params => getAttemptsWithDb({ ...params, db: prisma });
exports.getSubmissionDetail = params => getSubmissionDetailWithDb({ ...params, db: prisma });
exports.getDataWithDb = getDataWithDb;
exports.getAttemptsWithDb = getAttemptsWithDb;
exports.getSubmissionDetailWithDb = getSubmissionDetailWithDb;
