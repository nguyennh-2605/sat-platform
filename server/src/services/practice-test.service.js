const prisma = require('../config/prisma');
const ApiError = require('../utils/ApiError');
const { MAX_TEST_MODULES, allocateModuleDurations } = require('../utils/module-timing');
const { buildAttemptSummary } = require('../utils/practice-test-progress');
const { getTaxonomy, validateClassification } = require('../utils/question-taxonomy');
const { parsePagination, paginationMeta } = require('../utils/pagination');
const { INTEGRITY_FILTERS, normalizeIntegrityFilter } = require('../utils/test-integrity');
const { AUDIT_ACTIONS, recordAuditEvent } = require('./audit-event.service');
const { normalizeSatTestMonth, testMonthWhere } = require('../utils/sat-test-months');
const { assertUsableImages, imageAssetIds, syncTestImages } = require('./test-image.service');
const { firstMathContentError, isValidSprAnswer } = require('../utils/math-content-validation');
const questionBankService = require('./question-bank.service');

const activeStatuses = { in: ['DRAFT', 'PUBLISHED'] };

const encodeTestCursor = ({ id, value }) => Buffer.from(JSON.stringify({ id, value })).toString('base64url');

const decodeTestCursor = value => {
  if (!value) return null;
  try {
    const parsed = JSON.parse(Buffer.from(String(value), 'base64url').toString());
    if (!Number.isInteger(parsed.id) || typeof parsed.value !== 'string' || !parsed.value) throw new Error();
    return parsed;
  } catch {
    throw new ApiError(400, { error: 'Test library cursor is invalid.' });
  }
};

const testCursorBoundaryWhere = ({ cursor, cursorField, oldestFirst }) => {
  if (!cursor) return null;
  const comparison = oldestFirst ? 'gt' : 'lt';
  if (cursorField === 'id') {
    const cursorId = Number(cursor.value);
    if (!Number.isInteger(cursorId) || cursorId !== cursor.id) throw new ApiError(400, { error: 'Test library cursor is invalid.' });
    return { id: { [comparison]: cursorId } };
  }
  const cursorDate = new Date(cursor.value);
  if (Number.isNaN(cursorDate.getTime())) throw new ApiError(400, { error: 'Test library cursor is invalid.' });
  return { OR: [
    { updatedAt: { [comparison]: cursorDate } },
    { updatedAt: cursorDate, id: { [comparison]: cursor.id } },
  ] };
};

const lifecycleWhere = requestedStatus => requestedStatus === 'ARCHIVED'
  ? { status: 'ARCHIVED' }
  : ['DRAFT', 'PUBLISHED'].includes(requestedStatus)
    ? { status: requestedStatus }
    : { status: activeStatuses };

const normalizeSource = ({ userRole, source }) => {
  const fallback = userRole === 'ADMIN' ? 'SYSTEM' : userRole === 'TEACHER' ? 'MY' : 'AVAILABLE';
  const requested = String(source || fallback).trim().toUpperCase();
  const allowed = userRole === 'ADMIN'
    ? new Set(['SYSTEM', 'TEACHER'])
    : userRole === 'TEACHER'
      ? new Set(['MY', 'SYSTEM'])
      : new Set(['AVAILABLE']);
  if (!allowed.has(requested)) throw new ApiError(400, { error: 'Test library source is invalid for this role.' });
  return requested;
};

const testCapabilities = ({ test, userId, userRole }) => {
  const isSystem = test.scope === 'SYSTEM';
  const ownsPersonal = !isSystem && test.authorId === Number(userId);
  const canManage = (userRole === 'ADMIN' && isSystem) || (userRole === 'TEACHER' && ownsPersonal);
  const hasHistory = Number(test._count?.submissions || 0) > 0
    || Number(test._count?.deliveries || 0) > 0
    || Number(test._count?.classTests || 0) > 0;
  return {
    canEdit: canManage && test.status !== 'ARCHIVED' && !hasHistory,
    canArchive: canManage && test.status === 'PUBLISHED',
    canRestore: canManage && test.status === 'ARCHIVED',
    canDelete: canManage && !hasHistory,
    canDuplicate: userRole === 'TEACHER' || (userRole === 'ADMIN' && isSystem),
    canCopyToSystem: userRole === 'ADMIN' && !isSystem && test.author?.role === 'TEACHER',
  };
};

exports.buildTestListWhere = ({ userId, userRole, source, status }) => {
  const requestedSource = normalizeSource({ userRole, source });
  const requestedStatus = String(status || '').trim().toUpperCase();
  if (userRole === 'STUDENT') {
    return {
      source: 'AVAILABLE',
      where: {
        OR: [
          { scope: 'SYSTEM', status: 'PUBLISHED' },
          {
            deliveries: {
              some: {
                status: 'PUBLISHED',
                assignees: { some: { studentId: Number(userId), excusedAt: null } },
              },
            },
          },
        ],
      },
    };
  }
  if (userRole === 'ADMIN') {
    return {
      source: requestedSource,
      where: requestedSource === 'TEACHER'
        ? { scope: 'PERSONAL', author: { role: 'TEACHER' }, ...lifecycleWhere(requestedStatus) }
        : { scope: 'SYSTEM', ...lifecycleWhere(requestedStatus) },
    };
  }
  if (userRole === 'TEACHER' && requestedSource === 'SYSTEM') {
    return { source: requestedSource, where: { scope: 'SYSTEM', status: 'PUBLISHED' } };
  }
  return {
    source: 'MY',
    where: { scope: 'PERSONAL', authorId: Number(userId), ...lifecycleWhere(requestedStatus) },
  };
};

exports.getClasses = ({ userId, userRole }) => {
  let whereCondition = {};

  if (userRole === 'TEACHER') {
    // Nếu là Giáo viên: Lấy các lớp do họ TẠO hoặc ĐỨNG LỚP
    whereCondition = { teacherId: userId };
  } else if (userRole === 'STUDENT') {
    // Nếu là Học sinh: Lấy các lớp họ đang theo học
    whereCondition = { students: { some: { id: userId } } };
  }

  return prisma.class.findMany({
    where: whereCondition,
    select: {
      id: true,
      name: true,
      _count: { select: { students: true } }
    },
    orderBy: { createdAt: 'desc' }
  });
};

exports.getTests = async ({ userId, userRole, query = {} }) => {
  const hasUser = !isNaN(userId);
  const access = hasUser
    ? exports.buildTestListWhere({ userId, userRole, source: query.source, status: query.status })
    : { source: 'SYSTEM', where: { scope: 'SYSTEM', status: 'PUBLISHED' } };
  const whereCondition = access.where;

  const search = String(query.search || '').trim().slice(0, 100);
  const requestedSubject = String(query.subject || '').toUpperCase();
  const requestedMode = String(query.mode || '').toUpperCase();
  const requestedMonth = normalizeSatTestMonth(query.month);
  if (query.month && !requestedMonth) throw new ApiError(400, { error: 'Choose a valid SAT testing month.' });
  const requestedIntegrity = userRole === 'ADMIN' && access.source === 'SYSTEM'
    ? normalizeIntegrityFilter(query.integrity)
    : '';
  const pagination = parsePagination(query, { defaultPageSize: 24, maxPageSize: 48 });
  const filters = [whereCondition, { isDiscoverable: true }];
  if (search) filters.push({ OR: [
    { title: { contains: search, mode: 'insensitive' } },
    { description: { contains: search, mode: 'insensitive' } },
    ...(userRole === 'ADMIN' && access.source === 'TEACHER'
      ? [{ author: { name: { contains: search, mode: 'insensitive' } } }]
      : []),
  ] });
  if (['RW', 'MATH'].includes(requestedSubject)) filters.push({ subject: requestedSubject });
  if (['PRACTICE', 'EXAM'].includes(requestedMode)) filters.push({ mode: requestedMode });
  if (requestedMonth) filters.push(testMonthWhere(requestedMonth));
  if (userRole === 'STUDENT' && query.classId) filters.push({ OR: [
    { classTests: { some: { classId: String(query.classId), isHidden: false } } },
    { deliveries: { some: { classId: String(query.classId), status: 'PUBLISHED', assignees: { some: { studentId: Number(userId), excusedAt: null } } } } },
  ] });
  if (requestedIntegrity) filters.push(INTEGRITY_FILTERS[requestedIntegrity]);
  const totalWhere = { AND: [...filters] };
  const cursorMode = query.limit !== undefined || query.cursor !== undefined;
  const cursor = cursorMode ? decodeTestCursor(query.cursor) : null;
  const limit = Math.min(Math.max(Number.parseInt(query.limit, 10) || 30, 1), 50);
  const oldestFirst = String(query.sort || '').toUpperCase() === 'OLDEST';
  const cursorField = userRole === 'STUDENT' ? 'id' : 'updatedAt';
  const cursorBoundary = testCursorBoundaryWhere({ cursor, cursorField, oldestFirst });
  if (cursorBoundary) filters.push(cursorBoundary);
  const pagedWhere = { AND: filters };
  const orderDirection = oldestFirst ? 'asc' : 'desc';
  const orderBy = cursorField === 'id'
    ? [{ id: orderDirection }]
    : [{ updatedAt: orderDirection }, { id: orderDirection }];

  const operations = [
    prisma.test.count({ where: totalWhere }),
    prisma.test.findMany({
    where: pagedWhere,
    orderBy,
    skip: cursorMode ? 0 : pagination.skip,
    take: cursorMode ? limit + 1 : pagination.pageSize,
    select: {
      id: true,
      title: true,
      description: true,
      duration: true,
      subject: true,
      category: true,
      testDate: true,
      mode: true,
      status: true,
      scope: true,
      isPublic: true,
      createdAt: true,
      updatedAt: true,
      authorId: true,
      author: { select: { id: true, name: true, role: true } },
      sections: {
        select: { _count: { select: { questions: true } } }
      },
      _count: { select: { submissions: true, deliveries: true, classTests: true } },
      classTests: {
        ...(userRole === 'STUDENT' ? {
          where: {
            isHidden: false,
            class: { students: { some: { id: userId } } }
          }
        } : {}),
        select: { classId: true, class: { select: { name: true } } }
      },
      ...(userRole === 'STUDENT' && {
        deliveries: {
          where: {
            status: 'PUBLISHED',
            assignees: { some: { studentId: userId, excusedAt: null } }
          },
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            title: true,
            classId: true,
            availableAt: true,
            dueAt: true,
            maxAttempts: true,
            scorePolicy: true,
            class: { select: { name: true } },
            submissions: {
              where: { userId },
              orderBy: { attemptNo: 'desc' },
              take: 1,
              select: { id: true, status: true, attemptNo: true },
            },
          }
        }
      }),
      // Lấy lần làm gần nhất để dựng trạng thái và tiến trình thật trên card.
      ...(userRole === 'STUDENT' && {
        submissions: {
          where: { userId: userId },
          orderBy: { startedAt: 'desc' },
          take: 1,
          select: {
            id: true,
            status: true,
            score: true,
            startedAt: true,
            beganAt: true,
            endTime: true,
            currentQuestionIndex: true,
            savedAnswers: true
          }
        }
      })
    }
    }),
  ];
  if (userRole === 'TEACHER') {
    operations.push(
      prisma.test.count({ where: { scope: 'PERSONAL', authorId: Number(userId), status: activeStatuses } }),
      prisma.test.count({ where: { scope: 'SYSTEM', status: 'PUBLISHED' } }),
    );
  } else if (userRole === 'ADMIN') {
    operations.push(
      prisma.test.count({ where: { scope: 'SYSTEM', status: activeStatuses } }),
      prisma.test.count({ where: { scope: 'PERSONAL', author: { role: 'TEACHER' }, status: activeStatuses } }),
    );
  }
  const [total, fetchedTests, firstSourceCount, secondSourceCount] = await prisma.$transaction(operations);
  const hasMore = cursorMode && fetchedTests.length > limit;
  const tests = cursorMode ? fetchedTests.slice(0, limit) : fetchedTests;

  // Map dữ liệu để trả về format gọn gàng cho Frontend
  const items = tests.map(test => {
    const { submissions, sections, deliveries, _count, ...rest } = test;
    const questionCount = sections.reduce(
      (total, section) => total + section._count.questions,
      0
    );
    const latestSubmission = submissions?.[0] || null;
    const attemptSummary = userRole === 'STUDENT'
      ? buildAttemptSummary({ questionCount, submission: latestSubmission })
      : {};

    return {
      ...rest,
      ...(userRole === 'STUDENT' ? {
        deliveries: (deliveries || []).map(({ submissions: deliverySubmissions, ...delivery }) => {
          const latestSubmission = deliverySubmissions?.[0] || null;
          const attemptsUsed = latestSubmission?.attemptNo || 0;
          return {
            ...delivery,
            latestSubmission,
            attemptsUsed,
            canStart: latestSubmission?.status === 'DOING' || attemptsUsed < delivery.maxAttempts,
          };
        }),
      } : {}),
      questionCount,
      usage: {
        attempts: _count.submissions,
        deliveries: _count.deliveries,
        legacyClassLinks: _count.classTests,
      },
      capabilities: testCapabilities({ test, userId, userRole }),
      ...attemptSummary
    };
  });

  const lastTest = tests.at(-1);
  return {
    items,
    ...(cursorMode ? {
      total,
      nextCursor: hasMore && lastTest
        ? encodeTestCursor({ id: lastTest.id, value: cursorField === 'id' ? String(lastTest.id) : lastTest.updatedAt.toISOString() })
        : null,
    } : { pagination: paginationMeta({ ...pagination, total }) }),
    source: access.source,
    ...(userRole === 'TEACHER' ? { sourceCounts: { my: firstSourceCount, system: secondSourceCount } } : {}),
    ...(userRole === 'ADMIN' ? { sourceCounts: { system: firstSourceCount, teacher: secondSourceCount } } : {}),
  };
};

exports.getTaxonomy = ({ subject }) => {
  if (subject && !['RW', 'MATH'].includes(subject)) {
    throw new ApiError(400, { error: 'Subject must be RW or MATH.' });
  }
  return getTaxonomy(subject);
};

const normalizeChoices = (choices) => (Array.isArray(choices) ? choices : [])
  .map(choice => ({ id: String(choice?.id || '').trim().toUpperCase(), text: String(choice?.text || '').trim() }))
  .filter(choice => choice.id && choice.text);

const validateBlocks = ({ blocks, moduleOrder, questionNumber, status }) => {
  const normalized = Array.isArray(blocks) ? blocks : [];
  for (const block of normalized) {
    if (!block || !['text', 'table', 'poem', 'note', 'image'].includes(block.type)) {
      throw new ApiError(422, { error: `Question ${questionNumber} in Module ${moduleOrder} contains an unsupported content block.` });
    }
    if (block.type === 'table') {
      const headers = Array.isArray(block.headers) ? block.headers : [];
      const rows = Array.isArray(block.rows) ? block.rows : [];
      if (headers.length === 0 || rows.some(row => !Array.isArray(row) || row.length !== headers.length)) {
        throw new ApiError(422, { error: `Question ${questionNumber} in Module ${moduleOrder} has a table with inconsistent columns.` });
      }
    }
    if (status === 'PUBLISHED' && block.type === 'image' && !block.assetId) {
      throw new ApiError(422, { error: `Question ${questionNumber} in Module ${moduleOrder} needs a platform-hosted image before publishing.` });
    }
  }
  return normalized;
};

const assertOfficialTestShape = ({ sections, subject, duration, category, status }) => {
  if (category !== 'REAL' || status !== 'PUBLISHED') return;
  const expectedQuestions = subject === 'MATH' ? 22 : 27;
  const expectedDuration = subject === 'MATH' ? 70 : 64;
  if (sections.length !== 2 || sections.some(section => section.questions.length !== expectedQuestions)) {
    throw new ApiError(422, { error: `Published official ${subject === 'MATH' ? 'Math' : 'Reading & Writing'} tests require 2 modules with ${expectedQuestions} questions each.` });
  }
  if (duration !== expectedDuration) {
    throw new ApiError(422, { error: `Published official ${subject === 'MATH' ? 'Math' : 'Reading & Writing'} tests require a ${expectedDuration}-minute duration.` });
  }
};

const validateSections = ({ sections, subject, status = 'DRAFT' }) => {
  if (!Array.isArray(sections) || sections.length === 0) {
    throw new ApiError(400, { error: 'Add at least one module with questions.' });
  }
  if (sections.length > MAX_TEST_MODULES) {
    throw new ApiError(422, { error: `A test can contain at most ${MAX_TEST_MODULES} modules.` });
  }

  const seenOrders = new Set();
  return sections.map((section, sectionIndex) => {
    const order = Number(section?.order || sectionIndex + 1);
    if (!Number.isInteger(order) || order !== sectionIndex + 1 || seenOrders.has(order)) {
      throw new ApiError(422, { error: `Module ${sectionIndex + 1} has an invalid order.` });
    }
    seenOrders.add(order);

    if (!Array.isArray(section.questions) || section.questions.length === 0) {
      throw new ApiError(422, { error: `Module ${order} does not contain any questions.` });
    }

    return {
      name: String(section.name || `Module ${order}`).trim() || `Module ${order}`,
      order,
      duration: Math.max(1, Number.parseInt(section.duration, 10) || 1),
      questions: section.questions.map((question, questionIndex) => {
        const questionText = String(question?.questionText || '').trim();
        const type = question?.type === 'SPR' ? 'SPR' : 'MCQ';
        const choices = normalizeChoices(question?.choices);
        const correctAnswer = String(question?.correctAnswer || '').trim().toUpperCase();
        const classification = validateClassification({
          subject,
          domainCode: question?.domainCode,
          skillCode: question?.skillCode,
        });

        if (!questionText) {
          throw new ApiError(422, { error: `Question ${questionIndex + 1} in Module ${order} is missing question text.` });
        }
        if (!classification.valid) {
          throw new ApiError(422, { error: `Question ${questionIndex + 1} in Module ${order}: ${classification.error}` });
        }
        if (!correctAnswer) {
          throw new ApiError(422, { error: `Question ${questionIndex + 1} in Module ${order} is missing the correct answer.` });
        }
        if (subject === 'RW' && type === 'SPR') {
          throw new ApiError(422, { error: `Question ${questionIndex + 1} in Module ${order} must contain choices A, B, C, and D.` });
        }
        if (type === 'MCQ') {
          if (choices.map(choice => choice.id).join('') !== 'ABCD') {
            throw new ApiError(422, { error: `Question ${questionIndex + 1} in Module ${order} must contain exactly one choice each for A, B, C, and D in order.` });
          }
          if (!choices.some(choice => choice.id === correctAnswer)) {
            throw new ApiError(422, { error: `Question ${questionIndex + 1} in Module ${order} has an answer that does not match its choices.` });
          }
        }

        const blocks = validateBlocks({
          blocks: question?.blocks,
          moduleOrder: order,
          questionNumber: questionIndex + 1,
          status,
        });
        const normalizedQuestion = {
          questionText,
          choices: type === 'MCQ' ? choices : [],
          explanation: String(question?.explanation || '').trim() || null,
          blocks,
        };
        if (subject === 'MATH') {
          const latexError = firstMathContentError(normalizedQuestion);
          if (latexError) {
            throw new ApiError(422, { error: `Question ${questionIndex + 1} in Module ${order} has invalid Math content (${latexError}).` });
          }
          if (type === 'SPR' && !isValidSprAnswer(correctAnswer)) {
            throw new ApiError(422, { error: `Question ${questionIndex + 1} in Module ${order} needs a valid decimal or fraction answer.` });
          }
        }

        return {
          order: questionIndex + 1,
          questionText,
          correctAnswer,
          type,
          explanation: normalizedQuestion.explanation,
          blocks: normalizedQuestion.blocks,
          choices: normalizedQuestion.choices,
          domainCode: classification.domain.code,
          skillCode: classification.skill.code,
          sourceBankQuestionId: question?.sourceBankQuestionId ? String(question.sourceBankQuestionId) : null,
          sourceBankVersionId: question?.sourceBankVersionId ? String(question.sourceBankVersionId) : null,
        };
      }),
    };
  });
};

exports.createTest = async ({ title, duration, subject, mode, sections, testDate, category, folderId, status, userId, userRole }) => {
  const trimmedTitle = String(title || '').trim();
  const normalizedTitle = trimmedTitle ? `${trimmedTitle.charAt(0).toLocaleUpperCase()}${trimmedTitle.slice(1)}` : trimmedTitle;
  if (!normalizedTitle) {
    throw new ApiError(400, { error: 'Enter a test name.' });
  }
  if (!['RW', 'MATH'].includes(subject)) {
    throw new ApiError(400, { error: 'Choose Reading & Writing or Math.' });
  }

  const normalizedDuration = Number.parseInt(duration, 10);
  if (!Number.isInteger(normalizedDuration) || normalizedDuration < 1) {
    throw new ApiError(400, { error: 'Enter a valid test duration.' });
  }

  const finalStatus = status === 'PUBLISHED' ? 'PUBLISHED' : 'DRAFT';
  const finalCategory = userRole === 'ADMIN' && category === 'REAL' ? 'REAL' : userRole === 'ADMIN' ? 'PRACTICE' : 'CLASS';
  const hydratedSections = await questionBankService.hydrateBankQuestions({ sections, userId, userRole });
  const validatedSections = validateSections({ sections: hydratedSections, subject, status: finalStatus });
  assertOfficialTestShape({ sections: validatedSections, subject, duration: normalizedDuration, category: finalCategory, status: finalStatus });
  const imageIds = await assertUsableImages({ sections: validatedSections, userId });
  let normalizedSections;
  try {
    const durations = allocateModuleDurations(normalizedDuration, validatedSections.length);
    normalizedSections = validatedSections.map((section, index) => ({ ...section, duration: durations[index] }));
  } catch (error) {
    throw new ApiError(400, { error: error.message });
  }
  const scope = userRole === 'ADMIN' ? 'SYSTEM' : 'PERSONAL';
  const isPublic = scope === 'SYSTEM' && finalStatus === 'PUBLISHED';
  const finalTestDate = userRole === 'ADMIN' && finalCategory === 'REAL' ? normalizeSatTestMonth(testDate) : null;
  if (finalCategory === 'REAL' && !finalTestDate) throw new ApiError(400, { error: 'Choose a valid SAT testing month.' });

  console.log(`Creating test: ${normalizedTitle} (${normalizedSections.length} modules)`);

  return prisma.$transaction(async tx => {
    const newTest = await tx.test.create({
    data: {
      title: normalizedTitle,
      description: null,
      duration: normalizedDuration,
      subject,
      status: finalStatus,
      mode: mode === 'EXAM' ? 'EXAM' : 'PRACTICE',
      authorId: Number(userId),
      scope,
      isPublic,
      category: finalCategory,
      testDate: finalTestDate,
      folderId: scope === 'PERSONAL' && Number.isInteger(Number(folderId)) ? Number(folderId) : null,
      sections: {
        create: normalizedSections.map((section) => ({
          name: section.name,
          order: section.order,
          duration: section.duration,
          questions: {
            create: section.questions.map((q) => ({
              order: q.order,
              questionText: q.questionText,
              correctAnswer: q.correctAnswer,
              type: q.type,
              explanation: q.explanation,
              blocks: q.blocks,
              choices: q.choices,
              domainCode: q.domainCode,
              skillCode: q.skillCode,
              sourceBankQuestionId: q.sourceBankQuestionId,
              sourceBankVersionId: q.sourceBankVersionId,
            }))
          }
        }))
      }
    },
    include: {
      sections: {
        select: { id: true, name: true, questions: { select: { id: true } } }
      }
    }
    });

    await recordAuditEvent(tx, {
      action: AUDIT_ACTIONS.TEST_CREATED,
      actorUserId: userId,
      actorRole: userRole,
      entityType: 'TEST',
      entityId: newTest.id,
      entityLabel: newTest.title,
      metadata: { scope: newTest.scope, status: newTest.status },
    });

    console.log(`Created test ID: ${newTest.id}`);
    await syncTestImages({ db: tx, testId: newTest.id, assetIds: imageIds });
    return newTest;
  });
};

const serializeBlockMetadata = metadata => {
  const values = Object.fromEntries(Object.entries(metadata).filter(([, value]) => String(value || '').trim()));
  return Object.keys(values).length ? `@meta ${JSON.stringify(values)}` : '';
};

const serializeBlock = (block) => {
  if (!block || typeof block !== 'object') return '';
  if (block.type === 'text') return `[TEXT]\n${String(block.content || '').trim()}`;
  if (block.type === 'table') {
    const metadata = serializeBlockMetadata({ title: block.title, note: block.note });
    const rows = [block.headers, ...(Array.isArray(block.rows) ? block.rows : [])]
      .filter(Array.isArray)
      .map(row => row.map(cell => String(cell || '').trim()).join('\t'));
    return `[TABLE]\n${[metadata, ...rows].filter(Boolean).join('\n')}`;
  }
  if (block.type === 'poem') {
    const metadata = serializeBlockMetadata({ title: block.title, author: block.author });
    return `[POEM]\n${[metadata, ...(block.lines || [])].filter(Boolean).join('\n')}`;
  }
  if (block.type === 'note') return `[NOTE]\n${(block.lines || []).map(line => `- ${line}`).join('\n')}`;
  if (block.type === 'image') {
    const metadata = serializeBlockMetadata({ alt: block.alt, caption: block.caption });
    return `[IMG]\n${[metadata, block.assetId ? `asset:${block.assetId}` : String(block.src || '').trim()].filter(Boolean).join('\n')}`;
  }
  return '';
};

const serializeQuestion = (question) => {
  const parts = [
    `QUESTION ${question.order}`,
    `Domain: ${question.domainCode || ''}`,
    `Skill: ${question.skillCode || ''}`,
    ...(question.sourceBankQuestionId ? [`Source-Bank-Question: ${question.sourceBankQuestionId}`] : []),
    ...(question.sourceBankVersionId ? [`Source-Bank-Version: ${question.sourceBankVersionId}`] : []),
    ...(Array.isArray(question.blocks) ? question.blocks.map(serializeBlock).filter(Boolean) : []),
    '[QUESTION]',
    question.questionText,
    ...(question.type === 'MCQ' && Array.isArray(question.choices)
      ? question.choices.map((choice, index) => `${String(choice.id || String.fromCharCode(65 + index)).toUpperCase()}. ${choice.text}`)
      : []),
    `Answer: ${question.correctAnswer}`,
    ...(question.explanation ? [`Explanation: ${question.explanation}`] : []),
  ];
  return parts.filter(value => String(value || '').trim()).join('\n\n');
};

const serializeTest = (test) => test.sections.map(section => [
  `=== MODULE ${section.order} ===`,
  ...section.questions.map(serializeQuestion),
].join('\n\n')).join('\n\n');

const manageableTest = async ({ testId, userId, userRole, include = {} }) => {
  const id = Number(testId);
  if (!Number.isInteger(id)) throw new ApiError(400, { error: 'Invalid exam ID.' });
  const where = exports.buildManageableTestWhere({ id, userId, userRole });
  const test = await prisma.test.findFirst({ where, include });
  if (!test) throw new ApiError(404, { error: 'Exam not found or you do not have permission to manage it.' });
  return test;
};

exports.buildManageableTestWhere = ({ id, userId, userRole }) => userRole === 'ADMIN'
  ? { id: Number(id), scope: 'SYSTEM' }
  : { id: Number(id), scope: 'PERSONAL', authorId: Number(userId) };

const readableTest = async ({ testId, userId, userRole, include = {} }) => {
  const id = Number(testId);
  if (!Number.isInteger(id)) throw new ApiError(400, { error: 'Invalid test ID.' });
  const test = await prisma.test.findFirst({
    where: {
      id,
      ...(userRole === 'ADMIN'
        ? {}
        : {
            OR: [
              { scope: 'PERSONAL', authorId: Number(userId) },
              { scope: 'SYSTEM', status: 'PUBLISHED' },
            ],
          }),
    },
    include,
  });
  if (!test) throw new ApiError(404, { error: 'Test not found or you do not have permission to view it.' });
  return test;
};

exports.getTestForEdit = async ({ testId, userId, userRole }) => {
  const test = await manageableTest({
    testId,
    userId,
    userRole,
    include: {
      sections: {
        orderBy: { order: 'asc' },
        include: { questions: { orderBy: { order: 'asc' } } },
      },
      _count: { select: { submissions: true, deliveries: true, classTests: true } },
    },
  });
  return {
    id: test.id,
    title: test.title,
    duration: test.duration,
    subject: test.subject,
    mode: test.mode,
    category: test.category,
    status: test.status,
    scope: test.scope,
    testDate: normalizeSatTestMonth(test.testDate),
    folderId: test.folderId,
    moduleCount: test.sections.length,
    hasAttempts: test._count.submissions > 0,
    hasUsage: test._count.submissions > 0 || test._count.deliveries > 0 || test._count.classTests > 0,
    structuredText: serializeTest(test),
  };
};

exports.getTestContent = async ({ testId, userId, userRole }) => {
  const test = await readableTest({
    testId,
    userId,
    userRole,
    include: {
      author: { select: { id: true, name: true, role: true } },
      sections: { orderBy: { order: 'asc' }, include: { questions: { orderBy: { order: 'asc' } } } },
      _count: { select: { submissions: true, deliveries: true, classTests: true } },
    },
  });
  return {
    id: test.id,
    title: test.title,
    description: test.description,
    duration: test.duration,
    subject: test.subject,
    mode: test.mode,
    category: test.category,
    status: test.status,
    scope: test.scope,
    createdAt: test.createdAt,
    updatedAt: test.updatedAt,
    authorId: test.authorId,
    author: test.author,
    isOwner: test.authorId === Number(userId),
    hasAttempts: test._count.submissions > 0,
    hasUsage: test._count.submissions > 0 || test._count.deliveries > 0 || test._count.classTests > 0,
    deliveryCount: test._count.deliveries,
    capabilities: testCapabilities({ test, userId, userRole }),
    questionCount: test.sections.reduce((sum, section) => sum + section.questions.length, 0),
    sections: test.sections,
    structuredText: serializeTest(test),
  };
};

exports.updateTest = async ({ testId, title, duration, subject, mode, sections, testDate, category, folderId, status, userId, userRole }) => {
  const existing = await manageableTest({ testId, userId, userRole, include: { _count: { select: { submissions: true, deliveries: true, classTests: true } } } });
  if (existing.status === 'ARCHIVED') {
    throw new ApiError(409, { error: 'Restore this test before editing it.' });
  }
  if (existing._count.submissions > 0 || existing._count.deliveries > 0 || existing._count.classTests > 0) {
    throw new ApiError(409, { error: 'This test is already used by a classroom. Duplicate it to create a new editable version.' });
  }

  const trimmedTitle = String(title || '').trim();
  const normalizedTitle = trimmedTitle ? `${trimmedTitle.charAt(0).toLocaleUpperCase()}${trimmedTitle.slice(1)}` : '';
  if (!normalizedTitle) throw new ApiError(400, { error: 'Enter a test name.' });
  if (!['RW', 'MATH'].includes(subject)) throw new ApiError(400, { error: 'Choose Reading & Writing or Math.' });
  const normalizedDuration = Number.parseInt(duration, 10);
  if (!Number.isInteger(normalizedDuration) || normalizedDuration < 1) throw new ApiError(400, { error: 'Enter a valid test duration.' });
  const finalStatus = status === 'PUBLISHED' ? 'PUBLISHED' : 'DRAFT';
  const finalCategory = userRole === 'ADMIN' && category === 'REAL' ? 'REAL' : userRole === 'ADMIN' ? 'PRACTICE' : 'CLASS';
  const hydratedSections = await questionBankService.hydrateBankQuestions({ sections, userId, userRole });
  const validatedSections = validateSections({ sections: hydratedSections, subject, status: finalStatus });
  assertOfficialTestShape({ sections: validatedSections, subject, duration: normalizedDuration, category: finalCategory, status: finalStatus });
  const imageIds = await assertUsableImages({ sections: validatedSections, userId, existingTestId: existing.id });
  let normalizedSections;
  try {
    const durations = allocateModuleDurations(normalizedDuration, validatedSections.length);
    normalizedSections = validatedSections.map((section, index) => ({ ...section, duration: durations[index] }));
  } catch (error) {
    throw new ApiError(400, { error: error.message });
  }
  const finalTestDate = userRole === 'ADMIN' && finalCategory === 'REAL' ? normalizeSatTestMonth(testDate) : null;
  if (finalCategory === 'REAL' && !finalTestDate) throw new ApiError(400, { error: 'Choose a valid SAT testing month.' });

  return prisma.$transaction(async tx => {
    await tx.section.deleteMany({ where: { testId: existing.id } });
    const updated = await tx.test.update({
      where: { id: existing.id },
      data: {
        title: normalizedTitle,
        duration: normalizedDuration,
        subject,
        status: finalStatus,
        mode: mode === 'EXAM' ? 'EXAM' : 'PRACTICE',
        category: finalCategory,
        isPublic: existing.scope === 'SYSTEM' && finalStatus === 'PUBLISHED',
        testDate: finalTestDate,
        folderId: existing.scope === 'PERSONAL' && Number.isInteger(Number(folderId)) ? Number(folderId) : null,
        sections: {
          create: normalizedSections.map(section => ({
            name: section.name,
            order: section.order,
            duration: section.duration,
            questions: { create: section.questions },
          })),
        },
      },
    });
    await syncTestImages({ db: tx, testId: updated.id, assetIds: imageIds });
    if (updated.status !== existing.status) {
      const statusActions = {
        PUBLISHED: AUDIT_ACTIONS.TEST_PUBLISHED,
        DRAFT: AUDIT_ACTIONS.TEST_MOVED_TO_DRAFT,
      };
      await recordAuditEvent(tx, {
        action: statusActions[updated.status],
        actorUserId: userId,
        actorRole: userRole,
        entityType: 'TEST',
        entityId: updated.id,
        entityLabel: updated.title,
        metadata: { scope: updated.scope },
      });
    }
    return updated;
  });
};

exports.updateTestStatus = async ({ testId, status, userId, userRole }) => {
  const normalizedStatus = String(status || '').toUpperCase();
  if (!['DRAFT', 'PUBLISHED', 'ARCHIVED'].includes(normalizedStatus)) {
    throw new ApiError(400, { error: 'Test status is invalid.' });
  }
  const test = await manageableTest({
    testId,
    userId,
    userRole,
    include: normalizedStatus === 'PUBLISHED'
      ? { sections: { orderBy: { order: 'asc' }, include: { questions: { orderBy: { order: 'asc' } } } } }
      : {},
  });
  if (normalizedStatus === 'PUBLISHED') {
    const validatedSections = validateSections({ sections: test.sections, subject: test.subject, status: normalizedStatus });
    assertOfficialTestShape({
      sections: validatedSections,
      subject: test.subject,
      duration: test.duration,
      category: test.category,
      status: normalizedStatus,
    });
    await assertUsableImages({ sections: validatedSections, userId, existingTestId: test.id });
  }
  return prisma.$transaction(async tx => {
    const updated = await tx.test.update({
      where: { id: test.id },
      data: {
        status: normalizedStatus,
        isPublic: test.scope === 'SYSTEM' && normalizedStatus === 'PUBLISHED',
      },
    });
    if (updated.status !== test.status) {
      const statusActions = {
        PUBLISHED: AUDIT_ACTIONS.TEST_PUBLISHED,
        ARCHIVED: AUDIT_ACTIONS.TEST_ARCHIVED,
        DRAFT: AUDIT_ACTIONS.TEST_MOVED_TO_DRAFT,
      };
      await recordAuditEvent(tx, {
        action: statusActions[updated.status],
        actorUserId: userId,
        actorRole: userRole,
        entityType: 'TEST',
        entityId: updated.id,
        entityLabel: updated.title,
        metadata: { scope: updated.scope },
      });
    }
    return updated;
  });
};

exports.duplicateTest = async ({ testId, userId, userRole }) => {
  const source = await readableTest({
    testId,
    userId,
    userRole,
    include: { sections: { orderBy: { order: 'asc' }, include: { questions: { orderBy: { order: 'asc' } } } } },
  });
  const moduleDurations = allocateModuleDurations(source.duration, source.sections.length);
  return prisma.$transaction(async tx => {
    const duplicate = await tx.test.create({
      data: {
      title: `Copy of ${source.title}`.slice(0, 200),
      description: source.description,
      duration: source.duration,
      subject: source.subject,
      mode: source.mode,
      category: userRole === 'ADMIN' ? source.category : 'CLASS',
      testDate: userRole === 'ADMIN' && source.category === 'REAL' ? normalizeSatTestMonth(source.testDate) || null : null,
      status: 'DRAFT',
      scope: userRole === 'ADMIN' ? 'SYSTEM' : 'PERSONAL',
      isPublic: false,
      authorId: Number(userId),
      sections: {
        create: source.sections.map((section, index) => ({
          name: section.name,
          order: section.order,
          duration: moduleDurations[index],
          questions: {
            create: section.questions.map(question => ({
              order: question.order,
              questionText: question.questionText,
              correctAnswer: question.correctAnswer,
              type: question.type,
              explanation: question.explanation,
              blocks: question.blocks,
              choices: question.choices,
              domainCode: question.domainCode,
              skillCode: question.skillCode,
            })),
          },
        })),
      },
    },
      select: { id: true, title: true, status: true, scope: true },
    });
    await syncTestImages({ db: tx, testId: duplicate.id, assetIds: imageAssetIds(source.sections) });
    await recordAuditEvent(tx, {
      action: AUDIT_ACTIONS.TEST_CREATED,
      actorUserId: userId,
      actorRole: userRole,
      entityType: 'TEST',
      entityId: duplicate.id,
      entityLabel: duplicate.title,
      metadata: { scope: duplicate.scope, status: duplicate.status, sourceTestId: source.id },
    });
    return duplicate;
  });
};

exports.copyTestToSystem = async ({ testId, userId, userRole }) => {
  if (userRole !== 'ADMIN') throw new ApiError(403, { error: 'Only administrators can copy tests to the System Library.' });
  const id = Number(testId);
  if (!Number.isInteger(id)) throw new ApiError(400, { error: 'Invalid test ID.' });
  const source = await prisma.test.findFirst({
    where: { id, scope: 'PERSONAL', author: { role: 'TEACHER' } },
    include: { sections: { orderBy: { order: 'asc' }, include: { questions: { orderBy: { order: 'asc' } } } } },
  });
  if (!source) throw new ApiError(404, { error: 'Teacher test not found.' });
  const moduleDurations = allocateModuleDurations(source.duration, source.sections.length);
  return prisma.$transaction(async tx => {
    const copy = await tx.test.create({
      data: {
      title: `Copy of ${source.title}`.slice(0, 200),
      description: source.description,
      duration: source.duration,
      subject: source.subject,
      mode: source.mode,
      category: source.category === 'REAL' ? 'REAL' : 'PRACTICE',
      status: 'DRAFT',
      scope: 'SYSTEM',
      isPublic: false,
      authorId: Number(userId),
      sections: {
        create: source.sections.map((section, index) => ({
          name: section.name,
          order: section.order,
          duration: moduleDurations[index],
          questions: {
            create: section.questions.map(question => ({
              order: question.order,
              questionText: question.questionText,
              correctAnswer: question.correctAnswer,
              type: question.type,
              explanation: question.explanation,
              blocks: question.blocks,
              choices: question.choices,
              domainCode: question.domainCode,
              skillCode: question.skillCode,
            })),
          },
        })),
      },
    },
      select: { id: true, title: true, status: true, scope: true },
    });
    await syncTestImages({ db: tx, testId: copy.id, assetIds: imageAssetIds(source.sections) });
    await recordAuditEvent(tx, {
      action: AUDIT_ACTIONS.TEST_COPIED_TO_SYSTEM,
      actorUserId: userId,
      actorRole: userRole,
      entityType: 'TEST',
      entityId: copy.id,
      entityLabel: copy.title,
      metadata: { sourceTestId: source.id },
    });
    return copy;
  });
};

exports.deleteTest = async ({ testId, userId, userRole }) => {
  const test = await manageableTest({
    testId,
    userId,
    userRole,
    include: { _count: { select: { submissions: true, deliveries: true, classTests: true } } },
  });
  if (test._count.submissions > 0 || test._count.deliveries > 0 || test._count.classTests > 0) {
    throw new ApiError(409, { error: 'This test has classroom or attempt history and cannot be permanently deleted. Archive it instead.' });
  }
  await prisma.$transaction(async tx => {
    await tx.test.delete({ where: { id: test.id } });
    await recordAuditEvent(tx, {
      action: AUDIT_ACTIONS.TEST_DELETED,
      actorUserId: userId,
      actorRole: userRole,
      entityType: 'TEST',
      entityId: test.id,
      entityLabel: test.title,
      metadata: { scope: test.scope },
    });
  });
};

exports.serializeTest = serializeTest;
exports._testListPaginationHelpers = { encodeTestCursor, decodeTestCursor, testCursorBoundaryWhere };
exports._testContentValidationHelpers = { assertOfficialTestShape, validateSections };
