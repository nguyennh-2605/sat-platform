const prisma = require('../config/prisma');
const ApiError = require('../utils/ApiError');
const { buildAttemptSummary } = require('../utils/practice-test-progress');
const { getTaxonomy, validateClassification } = require('../utils/question-taxonomy');
const { parsePagination, paginationMeta } = require('../utils/pagination');

const activeStatuses = { in: ['DRAFT', 'PUBLISHED'] };

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
  const pagination = parsePagination(query, { defaultPageSize: 24, maxPageSize: 48 });
  const filters = [whereCondition];
  if (search) filters.push({ OR: [
    { title: { contains: search, mode: 'insensitive' } },
    { description: { contains: search, mode: 'insensitive' } },
    ...(userRole === 'ADMIN' && access.source === 'TEACHER'
      ? [{ author: { name: { contains: search, mode: 'insensitive' } } }]
      : []),
  ] });
  if (['RW', 'MATH'].includes(requestedSubject)) filters.push({ subject: requestedSubject });
  if (['PRACTICE', 'EXAM'].includes(requestedMode)) filters.push({ mode: requestedMode });
  const pagedWhere = { AND: filters };

  const operations = [
    prisma.test.count({ where: pagedWhere }),
    prisma.test.findMany({
    where: pagedWhere,
    orderBy: userRole === 'STUDENT'
      ? { id: String(query.sort || '').toUpperCase() === 'OLDEST' ? 'asc' : 'desc' }
      : { updatedAt: String(query.sort || '').toUpperCase() === 'OLDEST' ? 'asc' : 'desc' },
    skip: pagination.skip,
    take: pagination.pageSize,
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
            class: { select: { name: true } }
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
  const [total, tests, firstSourceCount, secondSourceCount] = await prisma.$transaction(operations);

  // Map dữ liệu để trả về format gọn gàng cho Frontend
  const items = tests.map(test => {
    const { submissions, sections, _count, ...rest } = test;
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

  return {
    items,
    pagination: paginationMeta({ ...pagination, total }),
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

const validateSections = ({ sections, subject }) => {
  if (!Array.isArray(sections) || sections.length === 0) {
    throw new ApiError(400, { error: 'Add at least one module with questions.' });
  }

  const seenOrders = new Set();
  return sections.map((section, sectionIndex) => {
    const order = Number(section?.order || sectionIndex + 1);
    if (!Number.isInteger(order) || order < 1 || seenOrders.has(order)) {
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
        if (type === 'MCQ') {
          if (choices.length < 2) {
            throw new ApiError(422, { error: `Question ${questionIndex + 1} in Module ${order} needs answer choices.` });
          }
          if (!choices.some(choice => choice.id === correctAnswer)) {
            throw new ApiError(422, { error: `Question ${questionIndex + 1} in Module ${order} has an answer that does not match its choices.` });
          }
        }

        return {
          order: questionIndex + 1,
          questionText,
          correctAnswer,
          type,
          explanation: String(question?.explanation || '').trim() || null,
          blocks: Array.isArray(question?.blocks) ? question.blocks : [],
          choices: type === 'MCQ' ? choices : [],
          domainCode: classification.domain.code,
          skillCode: classification.skill.code,
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

  const normalizedSections = validateSections({ sections, subject });
  const finalStatus = status === 'PUBLISHED' ? 'PUBLISHED' : 'DRAFT';
  const scope = userRole === 'ADMIN' ? 'SYSTEM' : 'PERSONAL';
  const isPublic = scope === 'SYSTEM' && finalStatus === 'PUBLISHED';
  const finalCategory = userRole === 'ADMIN' && category === 'REAL' ? 'REAL' : userRole === 'ADMIN' ? 'PRACTICE' : 'CLASS';
  const finalTestDate = userRole === 'ADMIN' && finalCategory === 'REAL' && testDate ? String(testDate) : null;

  console.log(`Creating test: ${normalizedTitle} (${normalizedSections.length} modules)`);

  const newTest = await prisma.test.create({
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

  console.log(`Created test ID: ${newTest.id}`);
  return newTest;
};

const serializeBlock = (block) => {
  if (!block || typeof block !== 'object') return '';
  if (block.type === 'text') return `[TEXT]\n${String(block.content || '').trim()}`;
  if (block.type === 'table') {
    const rows = [block.headers, ...(Array.isArray(block.rows) ? block.rows : [])]
      .filter(Array.isArray)
      .map(row => row.map(cell => String(cell || '').trim()).join('\t'));
    return `[TABLE]\n${rows.join('\n')}`;
  }
  if (block.type === 'poem') return `[POEM]\n${(block.lines || []).join('\n')}`;
  if (block.type === 'note') return `[NOTE]\n${(block.lines || []).map(line => `- ${line}`).join('\n')}`;
  if (block.type === 'image') return `[IMG]\n${String(block.src || '').trim()}`;
  return '';
};

const serializeQuestion = (question) => {
  const parts = [
    `QUESTION ${question.order}`,
    `Domain: ${question.domainCode || ''}`,
    `Skill: ${question.skillCode || ''}`,
    ...(Array.isArray(question.blocks) ? question.blocks.map(serializeBlock).filter(Boolean) : []),
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
    testDate: test.testDate,
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
  const normalizedSections = validateSections({ sections, subject });
  const finalCategory = userRole === 'ADMIN' && category === 'REAL' ? 'REAL' : userRole === 'ADMIN' ? 'PRACTICE' : 'CLASS';
  const finalTestDate = userRole === 'ADMIN' && finalCategory === 'REAL' && testDate ? String(testDate) : null;

  return prisma.$transaction(async tx => {
    await tx.section.deleteMany({ where: { testId: existing.id } });
    return tx.test.update({
      where: { id: existing.id },
      data: {
        title: normalizedTitle,
        duration: normalizedDuration,
        subject,
        status: status === 'PUBLISHED' ? 'PUBLISHED' : 'DRAFT',
        mode: mode === 'EXAM' ? 'EXAM' : 'PRACTICE',
        category: finalCategory,
        isPublic: existing.scope === 'SYSTEM' && status === 'PUBLISHED',
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
  });
};

exports.updateTestStatus = async ({ testId, status, userId, userRole }) => {
  const normalizedStatus = String(status || '').toUpperCase();
  if (!['DRAFT', 'PUBLISHED', 'ARCHIVED'].includes(normalizedStatus)) {
    throw new ApiError(400, { error: 'Test status is invalid.' });
  }
  const test = await manageableTest({ testId, userId, userRole });
  return prisma.test.update({
    where: { id: test.id },
    data: {
      status: normalizedStatus,
      isPublic: test.scope === 'SYSTEM' && normalizedStatus === 'PUBLISHED',
    },
  });
};

exports.duplicateTest = async ({ testId, userId, userRole }) => {
  const source = await readableTest({
    testId,
    userId,
    userRole,
    include: { sections: { orderBy: { order: 'asc' }, include: { questions: { orderBy: { order: 'asc' } } } } },
  });
  return prisma.test.create({
    data: {
      title: `Copy of ${source.title}`.slice(0, 200),
      description: source.description,
      duration: source.duration,
      subject: source.subject,
      mode: source.mode,
      category: userRole === 'ADMIN' ? source.category : 'CLASS',
      status: 'DRAFT',
      scope: userRole === 'ADMIN' ? 'SYSTEM' : 'PERSONAL',
      isPublic: false,
      authorId: Number(userId),
      sections: {
        create: source.sections.map(section => ({
          name: section.name,
          order: section.order,
          duration: section.duration,
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
    select: { id: true, title: true, status: true },
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
  return prisma.test.create({
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
        create: source.sections.map(section => ({
          name: section.name,
          order: section.order,
          duration: section.duration,
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
  await prisma.test.delete({ where: { id: test.id } });
};

exports.serializeTest = serializeTest;
