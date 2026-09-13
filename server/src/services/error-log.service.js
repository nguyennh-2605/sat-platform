const prisma = require('../config/prisma');
const ApiError = require('../utils/ApiError');
const { parsePagination, paginationMeta } = require('../utils/pagination');
const { findDomain, findSkill } = require('../utils/question-taxonomy');
const { sanitizeReflection, isRichTextEmpty, richTextToPlainText } = require('../utils/error-log-rich-text');

const ANALYSIS_FIELDS = ['whyWrong', 'whyRight'];
const DEPRECATED_WRITE_FIELDS = ['markReviewed', 'whyChosen', 'takeaway', 'rootCause'];
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_CONFLICT_RETRIES = 3;
const ERROR_LOG_SELECT = {
  id: true,
  source: true,
  sourceUrl: true,
  category: true,
  userAnswer: true,
  correctAnswer: true,
  whyWrong: true,
  whyRight: true,
  reviewedAt: true,
  createdAt: true,
  updatedAt: true,
  submissionId: true,
  questionId: true,
  origin: true,
  version: true,
};

class ConcurrentErrorLogUpdate extends Error {}

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
    if (typeof cursor.id !== 'string' || !UUID_PATTERN.test(cursor.id) || typeof cursor.createdAt !== 'string' || !Number.isFinite(Date.parse(cursor.createdAt))) throw new Error();
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

const findDeprecatedWriteFields = data => DEPRECATED_WRITE_FIELDS
  .filter(field => Object.prototype.hasOwnProperty.call(data, field));

const normalizeExpectedVersion = (value) => {
  if (value === undefined) return undefined;
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 1) {
    throw new ApiError(400, { message: 'Expected version must be a positive integer.' });
  }
  return value;
};

const normalizeClientMutationId = (value) => {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string' || !/^[A-Za-z0-9._:-]{1,100}$/.test(value)) {
    throw new ApiError(400, { message: 'Client mutation ID must be 100 safe characters or fewer.' });
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
  ...(data.whyWrong !== undefined ? { whyWrong: normalizeReflection(data.whyWrong, 'Why I chose wrong') } : {}),
  ...(data.whyRight !== undefined ? { whyRight: normalizeReflection(data.whyRight, 'Why answer is right') } : {}),
});

const isReviewComplete = (entry) => Boolean(
  ANALYSIS_FIELDS.every(field => typeof entry[field] === 'string' && !isRichTextEmpty(entry[field]))
);

const normalizeManualEntry = (data = {}) => ({
  source: normalizeString(data.source, { field: 'Source', maxLength: 200, required: true }),
  sourceUrl: normalizeSourceUrl(data.sourceUrl),
  category: normalizeString(data.category ?? 'General', { field: 'Category', maxLength: 120, required: true }),
  userAnswer: normalizeString(data.userAnswer, { field: 'Your answer', maxLength: 100, required: true }),
  correctAnswer: normalizeString(data.correctAnswer, { field: 'Correct answer', maxLength: 100, required: true }),
  ...normalizeAnalysis(data),
});

const normalizeManualObjectiveUpdate = (data = {}) => ({
  ...(data.source !== undefined ? { source: normalizeString(data.source, { field: 'Source', maxLength: 200, required: true }) } : {}),
  ...(data.sourceUrl !== undefined ? { sourceUrl: normalizeSourceUrl(data.sourceUrl) } : {}),
  ...(data.category !== undefined ? { category: normalizeString(data.category, { field: 'Category', maxLength: 120, required: true }) } : {}),
  ...(data.userAnswer !== undefined ? { userAnswer: normalizeString(data.userAnswer, { field: 'Your answer', maxLength: 100, required: true }) } : {}),
  ...(data.correctAnswer !== undefined ? { correctAnswer: normalizeString(data.correctAnswer, { field: 'Correct answer', maxLength: 100, required: true }) } : {}),
});

const buildSearchText = (entry) => [
  entry.source,
  entry.category,
  richTextToPlainText(entry.whyWrong || ''),
  richTextToPlainText(entry.whyRight || ''),
]
  .map(value => String(value || '').trim())
  .filter(Boolean)
  .join(' ')
  .slice(0, 40000) || null;

const normalizeQuestionChoices = (choices) => (Array.isArray(choices) ? choices : []).map((choice, index) => {
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

const normalizeQuestionForClient = (question) => {
  if (!question || typeof question !== 'object' || Array.isArray(question)) return null;
  const section = question.section && typeof question.section === 'object' ? question.section : {};
  const test = section.test && typeof section.test === 'object' ? section.test : {};
  return {
    ...question,
    type: question.type === 'SPR' ? 'SPR' : 'MCQ',
    blocks: Array.isArray(question.blocks) ? question.blocks : [],
    questionText: String(question.questionText || ''),
    choices: normalizeQuestionChoices(question.choices),
    explanation: question.explanation ? String(question.explanation) : null,
    order: Number.isInteger(question.order) && question.order > 0 ? question.order : 1,
    section: {
      name: String(section.name || ''),
      order: Number.isInteger(section.order) && section.order > 0 ? section.order : 1,
      test: {
        title: String(test.title || ''),
        subject: test.subject === 'MATH' ? 'MATH' : 'RW',
      },
    },
  };
};

const buildQuestionSnapshot = ({ test, section, question, sectionIndex, questionIndex }) => ({
  type: question.type,
  blocks: question.blocks || [],
  questionText: question.questionText,
  choices: normalizeQuestionChoices(question.choices),
  explanation: question.explanation || null,
  order: question.order || questionIndex + 1,
  section: {
    name: section.name,
    order: section.order || sectionIndex + 1,
    test: { title: test.title, subject: test.subject },
  },
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
      const row = {
        userId,
        submissionId,
        questionId: question.id,
        origin: 'SYSTEM_QUESTION',
        source: `${test.title} · Module ${moduleNumber} · Question ${questionNumber}`,
        category: skill?.name || domain?.name || 'General',
        userAnswer: answer.selectedChoice || 'Omitted',
        correctAnswer: question.correctAnswer,
        questionSnapshot: buildQuestionSnapshot({ test, section, question, sectionIndex, questionIndex }),
      };
      rows.push({ ...row, searchText: buildSearchText(row) });
    });
  });

  return rows;
};

exports.getErrorLogs = async ({ userId, query = {} }) => {
  const cursorMode = query.limit !== undefined || query.cursor !== undefined || (query.page === undefined && query.pageSize === undefined);
  const limit = query.limit === undefined ? 40 : Number(query.limit);
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw new ApiError(400, { message: 'Limit must be between 1 and 100.' });
  const cursor = decodeCursor(query.cursor);
  const search = String(query.search || '').trim().slice(0, 100);
  const status = String(query.status || 'ALL').toUpperCase();
  const category = String(query.category || '').trim().slice(0, 120);
  if (!['ALL', 'NEEDS_REVIEW', 'REVIEWED'].includes(status)) {
    throw new ApiError(400, { message: 'Choose a valid review status.' });
  }

  const where = {
    userId,
    ...(status === 'NEEDS_REVIEW' ? { reviewedAt: null } : {}),
    ...(status === 'REVIEWED' ? { reviewedAt: { not: null } } : {}),
    ...(category ? { category } : {}),
    ...(search ? { searchText: { contains: search, mode: 'insensitive' } } : {}),
  };
  if (cursorMode) {
    const pageWhere = cursor ? { AND: [where, { OR: [
      { createdAt: { lt: cursor.createdAt } },
      { createdAt: cursor.createdAt, id: { lt: cursor.id } },
    ] }] } : where;
    const listQuery = prisma.errorLog.findMany({
      where: pageWhere,
      select: ERROR_LOG_SELECT,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
    });
    const [rows, total, needsReview] = cursor
      ? [await listQuery, undefined, undefined]
      : await prisma.$transaction([
          listQuery,
          prisma.errorLog.count({ where }),
          prisma.errorLog.count({ where: { AND: [where, { reviewedAt: null }] } }),
        ]);
    const items = rows.slice(0, limit);
    return {
      items,
      nextCursor: rows.length > limit ? encodeCursor(items[items.length - 1]) : null,
      ...(cursor ? {} : { total, needsReview }),
    };
  }

  const pagination = parsePagination(query, { defaultPageSize: 10, maxPageSize: 50 });
  const [total, items] = await prisma.$transaction([
    prisma.errorLog.count({ where }),
    prisma.errorLog.findMany({
      where,
      select: ERROR_LOG_SELECT,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      skip: pagination.skip,
      take: pagination.pageSize,
    }),
  ]);
  return { items, pagination: paginationMeta({ ...pagination, total }) };
};

exports.getErrorLogQuestion = async ({ id, userId }) => {
  const entry = await prisma.errorLog.findFirst({ where: { id, userId }, select: {
    questionSnapshot: true,
    question: { select: {
      type: true, blocks: true, questionText: true, choices: true, explanation: true, order: true,
      section: { select: { name: true, order: true, test: { select: { title: true, subject: true } } } },
    } },
  } });
  if (!entry) throw new ApiError(404, { message: 'Error log entry not found.' });
  return { question: normalizeQuestionForClient(entry.questionSnapshot || entry.question) };
};

exports.createErrorLog = async ({ userId, data }) => {
  const requestData = normalizeRequestData(data);
  const normalized = normalizeManualEntry(requestData);
  const clientMutationId = normalizeClientMutationId(requestData.clientMutationId);
  const createData = {
    userId,
    ...normalized,
    origin: 'MANUAL',
    clientMutationId,
    searchText: buildSearchText(normalized),
    reviewedAt: isReviewComplete(normalized) ? new Date() : null,
  };
  try {
    return await prisma.errorLog.create({ data: createData, select: ERROR_LOG_SELECT });
  } catch (error) {
    if (clientMutationId && error?.code === 'P2002') {
      const existing = await prisma.errorLog.findFirst({ where: { userId, clientMutationId }, select: ERROR_LOG_SELECT });
      if (existing) return existing;
    }
    throw error;
  }
};

const publicErrorLog = entry => entry && Object.fromEntries(
  Object.keys(ERROR_LOG_SELECT).map(field => [field, entry[field]])
);
const conflictError = current => new ApiError(409, {
  message: 'This error log entry changed in another tab. Review the latest row before saving again.',
  ...(current ? { current: publicErrorLog(current) } : {}),
});

exports.updateErrorLog = async ({ id, userId, data }) => {
  const requestData = normalizeRequestData(data);
  const expectedVersion = normalizeExpectedVersion(requestData.expectedVersion);

  for (let attempt = 0; attempt < MAX_CONFLICT_RETRIES; attempt += 1) {
    try {
      return await prisma.$transaction(async tx => {
        const existingLog = await tx.errorLog.findFirst({ where: { id, userId } });
        if (!existingLog) throw new ApiError(404, { message: 'Error log entry not found.' });
        if (expectedVersion !== undefined && existingLog.version !== expectedVersion) throw conflictError(existingLog);

        const origin = existingLog.origin || (existingLog.questionId ? 'SYSTEM_QUESTION' : 'MANUAL');
        const normalized = {
          ...(origin === 'MANUAL' ? normalizeManualObjectiveUpdate(requestData) : {}),
          ...normalizeAnalysis(requestData),
        };
        if (Object.keys(normalized).length === 0) {
          if (findDeprecatedWriteFields(requestData).length > 0) return publicErrorLog(existingLog);
          throw new ApiError(400, { message: 'Provide at least one editable Error Log field.' });
        }
        const candidate = { ...existingLog, ...normalized };
        const reviewedAt = isReviewComplete(candidate) ? existingLog.reviewedAt || new Date() : null;
        const update = await tx.errorLog.updateMany({
          where: { id, userId, version: existingLog.version },
          data: {
            ...normalized,
            searchText: buildSearchText(candidate),
            reviewedAt,
            version: { increment: 1 },
          },
        });
        if (update.count === 0) throw new ConcurrentErrorLogUpdate();
        return tx.errorLog.findFirst({ where: { id, userId }, select: ERROR_LOG_SELECT });
      });
    } catch (error) {
      if (!(error instanceof ConcurrentErrorLogUpdate)) throw error;
      if (expectedVersion !== undefined || attempt === MAX_CONFLICT_RETRIES - 1) {
        const current = await prisma.errorLog.findFirst({ where: { id, userId }, select: ERROR_LOG_SELECT });
        if (!current) throw new ApiError(404, { message: 'Error log entry not found.' });
        throw conflictError(current);
      }
    }
  }
  throw conflictError();
};

exports.deleteErrorLog = async ({ id, userId }) => {
  const result = await prisma.errorLog.deleteMany({ where: { id, userId } });
  if (result.count === 0) throw new ApiError(404, { message: 'Error log entry not found.' });
};

exports.syncSubmissionErrorLogs = async ({ db, userId, submissionId, test, answerRows }) => {
  const rows = buildAutomaticErrorLogRows({ userId, submissionId, test, answerRows });
  if (rows.length === 0) return 0;
  const result = await db.errorLog.createMany({ data: rows, skipDuplicates: true });
  return result.count;
};

exports._errorLogHelpers = {
  UUID_PATTERN,
  buildAutomaticErrorLogRows,
  buildQuestionSnapshot,
  buildSearchText,
  findDeprecatedWriteFields,
  isReviewComplete,
  normalizeAnalysis,
  normalizeClientMutationId,
  normalizeExpectedVersion,
  normalizeManualEntry,
  normalizeRequestData,
  normalizeSourceUrl,
  normalizeQuestionChoices,
  normalizeQuestionForClient,
  encodeCursor,
  decodeCursor,
};
