const prisma = require('../config/prisma');
const ApiError = require('../utils/ApiError');
const { buildAttemptSummary } = require('../utils/practice-test-progress');
const { getTaxonomy, validateClassification } = require('../utils/question-taxonomy');
const testDeliveryService = require('./test-delivery.service');

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

exports.getTests = async ({ userId, userRole }) => {
  const hasUser = !isNaN(userId);

  let whereCondition;
  if (!hasUser) {
    whereCondition = { isPublic: true, author: { role: 'ADMIN' } };
  } else if (userRole === 'STUDENT') {
    whereCondition = {
      OR: [
        // Học sinh luôn thấy đề do admin công khai.
        { isPublic: true, author: { role: 'ADMIN' } },
        // Đề của giáo viên chỉ hiện khi đã giao vào lớp mà học sinh tham gia.
        {
          deliveries: {
            some: {
              status: 'PUBLISHED',
              assignees: { some: { studentId: userId, excusedAt: null } }
            }
          }
        }
      ]
    };
  } else {
    // Giáo viên/Admin quản lý đúng kho đề họ đã tải lên.
    whereCondition = { authorId: userId };
  }

  const tests = await prisma.test.findMany({
    where: whereCondition,
    orderBy: { id: 'desc' },
    select: {
      id: true,
      title: true,
      description: true,
      duration: true,
      subject: true,
      category: true,
      testDate: true,
      mode: true,
      authorId: true,
      author: { select: { id: true, name: true, role: true } },
      sections: {
        select: { _count: { select: { questions: true } } }
      },
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
      ...(hasUser && {
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
  });

  // Map dữ liệu để trả về format gọn gàng cho Frontend
  return tests.map(test => {
    const { submissions, sections, ...rest } = test;
    const questionCount = sections.reduce(
      (total, section) => total + section._count.questions,
      0
    );
    const latestSubmission = submissions?.[0] || null;
    const attemptSummary = buildAttemptSummary({ questionCount, submission: latestSubmission });

    return {
      ...rest,
      questionCount,
      ...attemptSummary
    };
  });
};

exports.assignTestsToClasses = async ({ testIds, classIds, availableAt, dueAt, maxAttempts, scorePolicy, userId, userRole }) => {
  const deliveries = await testDeliveryService.createDeliveries({
    testIds,
    classIds,
    availableAt,
    dueAt,
    maxAttempts,
    scorePolicy,
    userId,
    userRole,
  });
  return {
    assignedTests: new Set(deliveries.map(item => item.testId)).size,
    assignedClasses: new Set(deliveries.map(item => item.classId)).size,
    deliveries,
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

exports.createTest = async ({ title, duration, subject, mode, sections, testDate, category, folderId, userId, userRole }) => {
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
  const isPublic = userRole === 'ADMIN';
  const finalCategory = userRole === 'ADMIN' && category === 'REAL' ? 'REAL' : userRole === 'ADMIN' ? 'PRACTICE' : 'CLASS';
  const finalTestDate = userRole === 'ADMIN' && finalCategory === 'REAL' && testDate ? String(testDate) : null;

  console.log(`Creating test: ${normalizedTitle} (${normalizedSections.length} modules)`);

  const newTest = await prisma.test.create({
    data: {
      title: normalizedTitle,
      description: null,
      duration: normalizedDuration,
      subject,
      mode: mode === 'EXAM' ? 'EXAM' : 'PRACTICE',
      authorId: Number(userId),
      isPublic,
      category: finalCategory,
      testDate: finalTestDate,
      folderId: Number.isInteger(Number(folderId)) ? Number(folderId) : null,
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

const ownedTest = async ({ testId, userId, include = {} }) => {
  const id = Number(testId);
  if (!Number.isInteger(id)) throw new ApiError(400, { error: 'Invalid exam ID.' });
  const test = await prisma.test.findFirst({ where: { id, authorId: Number(userId) }, include });
  if (!test) throw new ApiError(404, { error: 'Exam not found or you do not have permission to manage it.' });
  return test;
};

exports.getTestForEdit = async ({ testId, userId }) => {
  const test = await ownedTest({
    testId,
    userId,
    include: {
      sections: {
        orderBy: { order: 'asc' },
        include: { questions: { orderBy: { order: 'asc' } } },
      },
      _count: { select: { submissions: true } },
    },
  });
  return {
    id: test.id,
    title: test.title,
    duration: test.duration,
    subject: test.subject,
    mode: test.mode,
    category: test.category,
    testDate: test.testDate,
    folderId: test.folderId,
    moduleCount: test.sections.length,
    hasAttempts: test._count.submissions > 0,
    structuredText: serializeTest(test),
  };
};

exports.updateTest = async ({ testId, title, duration, subject, mode, sections, testDate, category, folderId, userId, userRole }) => {
  const existing = await ownedTest({ testId, userId, include: { _count: { select: { submissions: true } } } });
  if (existing._count.submissions > 0) {
    throw new ApiError(409, { error: 'This exam cannot be edited because a student has already started it.' });
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
        mode: mode === 'EXAM' ? 'EXAM' : 'PRACTICE',
        category: finalCategory,
        isPublic: userRole === 'ADMIN',
        testDate: finalTestDate,
        folderId: Number.isInteger(Number(folderId)) ? Number(folderId) : null,
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

exports.deleteTest = async ({ testId, userId }) => {
  const test = await ownedTest({ testId, userId });
  await prisma.test.delete({ where: { id: test.id } });
};

exports.serializeTest = serializeTest;
