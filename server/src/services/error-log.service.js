const prisma = require('../config/prisma');
const ApiError = require('../utils/ApiError');
const { parsePagination, paginationMeta } = require('../utils/pagination');
const { findDomain, findSkill } = require('../utils/question-taxonomy');
const { sanitizeReflection, isRichTextEmpty } = require('../utils/error-log-rich-text');

const ROOT_CAUSES = [
  'KNOWLEDGE_GAP',
  'MISREAD_QUESTION',
  'MISREAD_PASSAGE',
  'WRONG_REASONING',
  'CARELESS_MISTAKE',
  'TIME_PRESSURE',
  'CALCULATION_ERROR',
  'GUESSED',
];
const ROOT_CAUSE_SET = new Set(ROOT_CAUSES);
const ANALYSIS_FIELDS = ['whyWrong', 'whyRight'];
const normalizeReflection = (value, field, maxLength = 16000) => {
  const text = normalizeString(value, { field, maxLength });
  if (!text) return text;
  const html = sanitizeReflection(text);
  return isRichTextEmpty(html) ? null : html;
};

const encodeCursor = row => Buffer.from(JSON.stringify({ createdAt: new Date(row.createdAt).toISOString(), id: row.id })).toString('base64url');
const decodeCursor = value => {
  if (value === undefined) return null;
  try {
    if (typeof value !== 'string' || value.length > 512 || !/^[A-Za-z0-9_-]+$/.test(value)) throw new Error();
    const cursor = JSON.parse(Buffer.from(value, 'base64url').toString());
    if (typeof cursor.id !== 'string' || !/^[0-9a-f-]{36}$/i.test(cursor.id) || typeof cursor.createdAt !== 'string' || !Number.isFinite(Date.parse(cursor.createdAt))) throw new Error();
    return { id: cursor.id, createdAt: new Date(cursor.createdAt) };
  } catch {
    throw new ApiError(400, { message: 'Invalid error log cursor.' });
  }
};

const normalizeRequestData = (value) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new ApiError(400, { message: 'Request body must be an object.' });
  }
  return value;
};

const normalizeMarkReviewed = (value) => {
  if (value === undefined) return undefined;
  if (typeof value !== 'boolean') throw new ApiError(400, { message: 'Review state must be true or false.' });
  return value;
};

const normalizeString = (value, { field, maxLength, required = false }) => {
  if (value === undefined) return undefined;
  if (value === null) {
    if (required) throw new ApiError(400, { message: `${field} is required.` });
    return null;
  }
  if (typeof value !== 'string') throw new ApiError(400, { message: `${field} must be text.` });
  const normalized = value.trim();
  if (required && !normalized) throw new ApiError(400, { message: `${field} is required.` });
  if (normalized.length > maxLength) {
    throw new ApiError(400, { message: `${field} must be ${maxLength} characters or fewer.` });
  }
  return normalized || null;
};

const normalizeRootCause = (value) => {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  if (typeof value !== 'string' || !ROOT_CAUSE_SET.has(value)) {
    throw new ApiError(400, { message: 'Choose a valid root cause.' });
  }
  return value;
};

const normalizeSourceUrl = (value) => {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  if (typeof value !== 'string') throw new ApiError(400, { message: 'External link must be text.' });
  const normalized = value.trim();
  if (!normalized) return null;
  if (normalized.length > 2048) throw new ApiError(400, { message: 'External link must be 2048 characters or fewer.' });
  try {
    const url = new URL(normalized);
    if (!['http:', 'https:'].includes(url.protocol)) throw new Error();
    return url.toString();
  } catch {
    throw new ApiError(400, { message: 'Enter a complete http or https link.' });
  }
};

const normalizeAnalysis = (data = {}) => ({
  ...(data.whyChosen !== undefined ? { whyChosen: normalizeString(data.whyChosen, { field: 'Why you chose the answer', maxLength: 4000 }) } : {}),
  ...(data.whyWrong !== undefined ? { whyWrong: normalizeReflection(data.whyWrong, 'Why I chose wrong') } : {}),
  ...(data.whyRight !== undefined ? { whyRight: normalizeReflection(data.whyRight, 'Why answer is right') } : {}),
  ...(data.takeaway !== undefined ? { takeaway: normalizeReflection(data.takeaway, 'Next step', 8000) } : {}),
  ...(data.rootCause !== undefined ? { rootCause: normalizeRootCause(data.rootCause) } : {}),
});

const isReviewComplete = (entry) => Boolean(
  ANALYSIS_FIELDS.every(field => typeof entry[field] === 'string' && !isRichTextEmpty(entry[field]))
);

const normalizeManualEntry = (data = {}) => ({
  source: normalizeString(data.source, { field: 'Source', maxLength: 200, required: true }),
  sourceUrl: normalizeSourceUrl(data.sourceUrl),
  category: normalizeString(data.category ?? 'General', { field: 'Skill', maxLength: 120, required: true }),
  userAnswer: normalizeString(data.userAnswer, { field: 'Your answer', maxLength: 100, required: true }),
  correctAnswer: normalizeString(data.correctAnswer, { field: 'Correct answer', maxLength: 100, required: true }),
  ...normalizeAnalysis(data),
});

const normalizeManualObjectiveUpdate = (data = {}) => ({
  ...(data.source !== undefined ? { source: normalizeString(data.source, { field: 'Source', maxLength: 200, required: true }) } : {}),
  ...(data.sourceUrl !== undefined ? { sourceUrl: normalizeSourceUrl(data.sourceUrl) } : {}),
  ...(data.category !== undefined ? { category: normalizeString(data.category, { field: 'Skill', maxLength: 120, required: true }) } : {}),
  ...(data.userAnswer !== undefined ? { userAnswer: normalizeString(data.userAnswer, { field: 'Your answer', maxLength: 100, required: true }) } : {}),
  ...(data.correctAnswer !== undefined ? { correctAnswer: normalizeString(data.correctAnswer, { field: 'Correct answer', maxLength: 100, required: true }) } : {}),
});

const buildAutomaticErrorLogRows = ({ userId, submissionId, test, answerRows }) => {
  const answerByQuestionId = new Map(answerRows.map(answer => [answer.questionId, answer]));
  const rows = [];

  test.sections.forEach((section, sectionIndex) => {
    section.questions.forEach((question, questionIndex) => {
      const answer = answerByQuestionId.get(question.id);
      if (!answer || answer.isCorrect) return;
      const skill = question.skillCode ? findSkill(question.skillCode, question.domainCode) : null;
      const domain = question.domainCode ? findDomain(question.domainCode, test.subject) : null;
      const moduleNumber = section.order || sectionIndex + 1;
      const questionNumber = question.order || questionIndex + 1;

      rows.push({
        userId,
        submissionId,
        questionId: question.id,
        source: `${test.title} · Module ${moduleNumber} · Question ${questionNumber}`,
        category: skill?.name || domain?.name || 'General',
        userAnswer: answer.selectedChoice || 'Omitted',
        correctAnswer: question.correctAnswer,
      });
    });
  });

  return rows;
};

exports.getErrorLogs = async ({ userId, query = {} }) => {
  const cursorMode = query.limit !== undefined || query.cursor !== undefined || (query.page === undefined && query.pageSize === undefined);
  const limit = query.limit === undefined ? 40 : Number(query.limit);
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw new ApiError(400, { message: 'Limit must be between 1 and 100.' });
  const cursor = decodeCursor(query.cursor);
  const pagination = parsePagination(query, { defaultPageSize: 10, maxPageSize: 50 });
  const search = String(query.search || '').trim().slice(0, 100);
  const status = String(query.status || 'ALL').toUpperCase();
  const rootCause = String(query.rootCause || '').toUpperCase();
  if (!['ALL', 'NEEDS_REVIEW', 'REVIEWED'].includes(status)) {
    throw new ApiError(400, { message: 'Choose a valid review status.' });
  }
  if (rootCause && !ROOT_CAUSE_SET.has(rootCause)) {
    throw new ApiError(400, { message: 'Choose a valid root cause.' });
  }

  const where = {
    userId,
    ...(status === 'NEEDS_REVIEW' ? { reviewedAt: null } : {}),
    ...(status === 'REVIEWED' ? { reviewedAt: { not: null } } : {}),
    ...(rootCause ? { rootCause } : {}),
    ...(query.category ? { category: String(query.category).slice(0, 120) } : {}),
    ...(search ? {
      OR: [
        { source: { contains: search, mode: 'insensitive' } },
        { category: { contains: search, mode: 'insensitive' } },
        { whyChosen: { contains: search, mode: 'insensitive' } },
        { whyWrong: { contains: search, mode: 'insensitive' } },
        { whyRight: { contains: search, mode: 'insensitive' } },
        { takeaway: { contains: search, mode: 'insensitive' } },
      ],
    } : {}),
  };
  const select = {
    id: true,
    source: true,
    sourceUrl: true,
    category: true,
    userAnswer: true,
    correctAnswer: true,
    whyChosen: true,
    whyWrong: true,
    whyRight: true,
    takeaway: true,
    rootCause: true,
    reviewedAt: true,
    createdAt: true,
    updatedAt: true,
    submissionId: true,
    questionId: true,
  };
  if (cursorMode) {
    delete select.whyChosen;
    delete select.takeaway;
    delete select.rootCause;
    const pageWhere = cursor ? { AND: [where, { OR: [
      { createdAt: { lt: cursor.createdAt } },
      { createdAt: cursor.createdAt, id: { lt: cursor.id } },
    ] }] } : where;
    const [rows, total, needsReview] = await prisma.$transaction([
      prisma.errorLog.findMany({ where: pageWhere, select, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: limit + 1 }),
      prisma.errorLog.count({ where }),
      prisma.errorLog.count({ where: { AND: [where, { reviewedAt: null }] } }),
    ]);
    const items = rows.slice(0, limit);
    return { items, nextCursor: rows.length > limit ? encodeCursor(items[items.length - 1]) : null, total, needsReview };
  }
  const [total, items] = await prisma.$transaction([
    prisma.errorLog.count({ where }),
    prisma.errorLog.findMany({ where, select, orderBy: { createdAt: 'desc' }, skip: pagination.skip, take: pagination.pageSize }),
  ]);
  return { items, pagination: paginationMeta({ ...pagination, total }) };
};

exports.getErrorLogQuestion = async ({ id, userId }) => {
  const entry = await prisma.errorLog.findFirst({ where: { id, userId }, select: {
    question: { select: {
      type: true, blocks: true, questionText: true, choices: true, explanation: true, order: true,
      section: { select: { name: true, order: true, test: { select: { title: true, subject: true } } } },
    } },
  } });
  if (!entry) throw new ApiError(404, { message: 'Error log entry not found.' });
  return entry;
};

exports.createErrorLog = async ({ userId, data }) => {
  const requestData = normalizeRequestData(data);
  const markReviewed = normalizeMarkReviewed(requestData.markReviewed);
  const normalized = normalizeManualEntry(requestData);
  if (markReviewed && !isReviewComplete(normalized)) {
    throw new ApiError(400, { message: 'Complete both reflection fields before marking this entry reviewed.' });
  }
  return prisma.errorLog.create({
    data: { userId, ...normalized, reviewedAt: markReviewed !== false && isReviewComplete(normalized) ? new Date() : null },
  });
};

exports.updateErrorLog = async ({ id, userId, data }) => {
  const requestData = normalizeRequestData(data);
  const markReviewed = normalizeMarkReviewed(requestData.markReviewed);
  const existingLog = await prisma.errorLog.findUnique({ where: { id } });
  if (!existingLog) throw new ApiError(404, { message: 'Error log entry not found.' });
  if (existingLog.userId !== userId) throw new ApiError(403, { message: 'You do not have access to this error log entry.' });

  const normalized = {
    ...(!existingLog.questionId ? normalizeManualObjectiveUpdate(requestData) : {}),
    ...normalizeAnalysis(requestData),
  };
  const candidate = { ...existingLog, ...normalized };
  let reviewedAt = existingLog.reviewedAt;
  if (markReviewed === true) {
    if (!isReviewComplete(candidate)) {
      throw new ApiError(400, { message: 'Complete both reflection fields before marking this entry reviewed.' });
    }
    reviewedAt = reviewedAt || new Date();
  } else if (markReviewed === false || !isReviewComplete(candidate)) {
    reviewedAt = null;
  } else {
    reviewedAt = reviewedAt || new Date();
  }

  return prisma.errorLog.update({ where: { id }, data: { ...normalized, reviewedAt } });
};

exports.deleteErrorLog = async ({ id, userId }) => {
  const existingLog = await prisma.errorLog.findUnique({ where: { id }, select: { userId: true } });
  if (!existingLog) throw new ApiError(404, { message: 'Error log entry not found.' });
  if (existingLog.userId !== userId) throw new ApiError(403, { message: 'You do not have access to this error log entry.' });
  await prisma.errorLog.delete({ where: { id } });
};

exports.syncSubmissionErrorLogs = async ({ db, userId, submissionId, test, answerRows }) => {
  const rows = buildAutomaticErrorLogRows({ userId, submissionId, test, answerRows });
  if (rows.length === 0) return 0;
  const result = await db.errorLog.createMany({ data: rows, skipDuplicates: true });
  return result.count;
};

exports._errorLogHelpers = {
  ROOT_CAUSES,
  buildAutomaticErrorLogRows,
  isReviewComplete,
  normalizeAnalysis,
  normalizeManualEntry,
  normalizeMarkReviewed,
  normalizeRequestData,
  normalizeSourceUrl,
  encodeCursor,
  decodeCursor,
};
