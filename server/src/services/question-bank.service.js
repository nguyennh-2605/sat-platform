const prisma = require('../config/prisma');
const ApiError = require('../utils/ApiError');
const { isAnswerCorrect } = require('../utils/grading');
const { validateClassification } = require('../utils/question-taxonomy');
const { firstMathContentError, isValidSprAnswer } = require('../utils/math-content-validation');
const { createDeliveriesWithDb } = require('./test-delivery.service');
const {
  assertUsableBankImages,
  imageAssetIds,
  linkQuestionBankImages,
  syncTestImages,
} = require('./test-image.service');

const VALID_STATUSES = new Set(['DRAFT', 'PUBLISHED', 'ARCHIVED']);
const VALID_DIFFICULTIES = new Set(['EASY', 'MEDIUM', 'HARD']);
const VALID_TYPES = new Set(['MCQ', 'SPR']);
const VALID_SUBJECTS = new Set(['RW', 'MATH']);

const queryValues = value => [...new Set((Array.isArray(value) ? value : [value])
  .flatMap(item => String(item || '').split(','))
  .map(item => item.trim())
  .filter(Boolean))];

const normalizeChoices = (value, type) => {
  if (type === 'SPR') return [];
  if (!Array.isArray(value)) throw new ApiError(400, { error: 'Multiple-choice questions require choices A–D.' });
  const choices = value.map((choice, index) => ({
    id: String(choice?.id || String.fromCharCode(65 + index)).trim().toUpperCase(),
    text: String(choice?.text || '').trim(),
  }));
  if (choices.length !== 4 || choices.map(choice => choice.id).join('') !== 'ABCD' || choices.some(choice => !choice.text)) {
    throw new ApiError(400, { error: 'Multiple-choice questions require one non-empty choice for A, B, C, and D.' });
  }
  return choices;
};

const normalizeContent = ({ subject, type, domainCode, skillCode, blocks, questionText, choices, correctAnswer, explanation }) => {
  if (!VALID_SUBJECTS.has(subject)) throw new ApiError(400, { error: 'Choose Reading & Writing or Math.' });
  const normalizedType = VALID_TYPES.has(type) ? type : 'MCQ';
  if (subject === 'RW' && normalizedType !== 'MCQ') {
    throw new ApiError(400, { error: 'Reading & Writing questions must be multiple choice.' });
  }
  const classification = validateClassification({ subject, domainCode, skillCode });
  if (!classification.valid) throw new ApiError(400, { error: classification.error });
  const normalizedQuestionText = String(questionText || '').trim();
  const normalizedAnswer = String(correctAnswer || '').trim();
  if (!normalizedQuestionText) throw new ApiError(400, { error: 'Question text is required.' });
  if (!normalizedAnswer) throw new ApiError(400, { error: 'Correct answer is required.' });
  const normalizedChoices = normalizeChoices(choices, normalizedType);
  if (normalizedType === 'MCQ' && !normalizedChoices.some(choice => choice.id === normalizedAnswer.toUpperCase())) {
    throw new ApiError(400, { error: 'Correct answer must match one of choices A–D.' });
  }
  const content = {
    subject,
    type: normalizedType,
    domainCode,
    skillCode,
    blocks: Array.isArray(blocks) ? blocks : [],
    questionText: normalizedQuestionText,
    choices: normalizedChoices,
    correctAnswer: normalizedType === 'MCQ' ? normalizedAnswer.toUpperCase() : normalizedAnswer,
    explanation: String(explanation || '').trim() || null,
  };
  if (subject === 'MATH') {
    const latexError = firstMathContentError(content);
    if (latexError) throw new ApiError(422, { error: `This question has invalid Math content (${latexError}).` });
    if (normalizedType === 'SPR' && !isValidSprAnswer(content.correctAnswer)) {
      throw new ApiError(422, { error: 'Student-produced response questions need a valid decimal or fraction answer.' });
    }
  }
  return content;
};

const latestVersion = item => item.versions?.[0] || null;

const activeLockedQuestionIds = async ({ userId, questionIds, db = prisma }) => {
  const ids = [...new Set((questionIds || []).filter(Boolean))];
  if (!ids.length) return new Set();
  const now = new Date();
  const rows = await db.question.findMany({
    where: {
      sourceBankQuestionId: { in: ids },
      section: {
        test: {
          deliveries: {
            some: {
              status: 'PUBLISHED',
              OR: [{ dueAt: null }, { dueAt: { gt: now } }],
              assignees: { some: { studentId: Number(userId), excusedAt: null } },
              // A completed Quiz no longer withholds solutions for this student.
              // Other open deliveries containing the same question still do.
              NOT: {
                activity: { is: { activity: { type: 'QUIZ' } } },
                submissions: { some: { userId: Number(userId), status: 'COMPLETED' } },
              },
            },
          },
        },
      },
    },
    distinct: ['sourceBankQuestionId'],
    select: { sourceBankQuestionId: true },
  });
  return new Set(rows.map(row => row.sourceBankQuestionId).filter(Boolean));
};

const serializeItem = ({ item, includeSolution, solutionLocked = false }) => {
  const version = latestVersion(item);
  if (!version) return null;
  return {
    id: item.id,
    ownerId: item.ownerId,
    ownerName: item.owner?.name || null,
    scope: item.scope,
    status: item.status,
    subject: item.subject,
    type: item.type,
    difficulty: item.difficulty,
    domain: item.domain,
    skill: item.skill,
    versionId: version.id,
    version: version.version,
    blocks: version.blocks,
    questionText: version.questionText,
    choices: version.choices,
    ...(includeSolution && !solutionLocked ? {
      correctAnswer: version.correctAnswer,
      explanation: version.explanation,
    } : {}),
    solutionLocked,
    progress: item.progress?.[0] || null,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  };
};

const listWhere = ({ userId, userRole, source, status, subject, domainCode, domainCodes, skillCode, skillCodes, difficulty, difficulties, search }) => {
  const requestedDomains = queryValues(domainCodes ?? domainCode);
  const requestedSkills = queryValues(skillCodes ?? skillCode);
  const requestedDifficulties = queryValues(difficulties ?? difficulty).filter(value => VALID_DIFFICULTIES.has(value));
  const filters = {
    ...(VALID_SUBJECTS.has(subject) ? { subject } : {}),
    ...(requestedDomains.length ? { domainCode: { in: requestedDomains } } : {}),
    ...(requestedSkills.length ? { skillCode: { in: requestedSkills } } : {}),
    ...(requestedDifficulties.length ? { difficulty: { in: requestedDifficulties } } : {}),
    ...(search ? { versions: { some: { questionText: { contains: String(search).trim(), mode: 'insensitive' } } } } : {}),
  };
  if (userRole === 'ADMIN') {
    return { ...filters, scope: 'SYSTEM', ...(VALID_STATUSES.has(status) ? { status } : { status: { not: 'ARCHIVED' } }) };
  }
  if (userRole === 'TEACHER') {
    if (source === 'SYSTEM') return { ...filters, scope: 'SYSTEM', status: 'PUBLISHED' };
    return { ...filters, scope: 'PERSONAL', ownerId: Number(userId), ...(VALID_STATUSES.has(status) ? { status } : { status: { not: 'ARCHIVED' } }) };
  }
  return { ...filters, scope: 'SYSTEM', status: 'PUBLISHED' };
};

exports.listQuestions = async ({ userId, userRole, query = {} }) => {
  const limit = Math.min(100, Math.max(1, Number.parseInt(query.limit, 10) || 40));
  const page = Math.max(1, Number.parseInt(query.page, 10) || 1);
  const where = listWhere({ userId, userRole, ...query });
  const [total, items] = await Promise.all([
    prisma.questionBankItem.count({ where }),
    prisma.questionBankItem.findMany({
      where,
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
      skip: (page - 1) * limit,
      take: limit,
      include: {
        owner: { select: { name: true } },
        domain: { select: { code: true, name: true } },
        skill: { select: { code: true, name: true } },
        versions: { orderBy: { version: 'desc' }, take: 1 },
        ...(userRole === 'STUDENT' ? { progress: { where: { userId: Number(userId) }, take: 1 } } : {}),
      },
    }),
  ]);
  const lockedIds = userRole === 'STUDENT'
    ? await activeLockedQuestionIds({ userId, questionIds: items.map(item => item.id) })
    : new Set();
  return {
    items: items.map(item => serializeItem({
      item,
      includeSolution: userRole !== 'STUDENT',
      solutionLocked: lockedIds.has(item.id),
    })).filter(Boolean),
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
};

exports.createQuestion = async ({ userId, userRole, payload }) => {
  const content = normalizeContent(payload);
  const difficulty = VALID_DIFFICULTIES.has(payload.difficulty) ? payload.difficulty : 'MEDIUM';
  const status = payload.status === 'PUBLISHED' ? 'PUBLISHED' : 'DRAFT';
  const scope = userRole === 'ADMIN' ? 'SYSTEM' : 'PERSONAL';
  return prisma.$transaction(async tx => {
    const assetIds = await assertUsableBankImages({
      blocks: content.blocks,
      choices: content.choices,
      userId,
      db: tx,
    });
    const item = await tx.questionBankItem.create({
      data: {
        ownerId: Number(userId), scope, status, difficulty,
        subject: content.subject, type: content.type, domainCode: content.domainCode, skillCode: content.skillCode,
        versions: {
          create: {
            version: 1, blocks: content.blocks, questionText: content.questionText, choices: content.choices,
            correctAnswer: content.correctAnswer, explanation: content.explanation, createdById: Number(userId),
          },
        },
      },
      include: {
        owner: { select: { name: true } }, domain: { select: { code: true, name: true } },
        skill: { select: { code: true, name: true } }, versions: { orderBy: { version: 'desc' }, take: 1 },
      },
    });
    await linkQuestionBankImages({ db: tx, questionId: item.id, assetIds });
    return serializeItem({ item, includeSolution: true });
  });
};

const manageableItem = async ({ questionId, userId, userRole, db = prisma }) => {
  const item = await db.questionBankItem.findFirst({
    where: userRole === 'ADMIN'
      ? { id: String(questionId), scope: 'SYSTEM' }
      : { id: String(questionId), scope: 'PERSONAL', ownerId: Number(userId) },
    include: { versions: { orderBy: { version: 'desc' }, take: 1 } },
  });
  if (!item) throw new ApiError(404, { error: 'Question not found or you do not have permission to manage it.' });
  return item;
};

exports.updateQuestion = async ({ questionId, userId, userRole, payload }) => prisma.$transaction(async tx => {
  const existing = await manageableItem({ questionId, userId, userRole, db: tx });
  const current = latestVersion(existing);
  const content = normalizeContent({
    subject: payload.subject ?? existing.subject,
    type: payload.type ?? existing.type,
    domainCode: payload.domainCode ?? existing.domainCode,
    skillCode: payload.skillCode ?? existing.skillCode,
    blocks: payload.blocks ?? current.blocks,
    questionText: payload.questionText ?? current.questionText,
    choices: payload.choices ?? current.choices,
    correctAnswer: payload.correctAnswer ?? current.correctAnswer,
    explanation: payload.explanation ?? current.explanation,
  });
  const assetIds = await assertUsableBankImages({
    blocks: content.blocks,
    choices: content.choices,
    userId,
    existingQuestionId: existing.id,
    db: tx,
  });
  const item = await tx.questionBankItem.update({
    where: { id: existing.id },
    data: {
      subject: content.subject,
      type: content.type,
      domainCode: content.domainCode,
      skillCode: content.skillCode,
      difficulty: VALID_DIFFICULTIES.has(payload.difficulty) ? payload.difficulty : existing.difficulty,
      status: VALID_STATUSES.has(payload.status) ? payload.status : existing.status,
      versions: {
        create: {
          version: current.version + 1, blocks: content.blocks, questionText: content.questionText,
          choices: content.choices, correctAnswer: content.correctAnswer, explanation: content.explanation,
          createdById: Number(userId),
        },
      },
    },
    include: {
      owner: { select: { name: true } }, domain: { select: { code: true, name: true } },
      skill: { select: { code: true, name: true } }, versions: { orderBy: { version: 'desc' }, take: 1 },
    },
  });
  await linkQuestionBankImages({ db: tx, questionId: item.id, assetIds });
  return serializeItem({ item, includeSolution: true });
});

exports.updateStatus = async ({ questionId, userId, userRole, status }) => {
  if (!VALID_STATUSES.has(status)) throw new ApiError(400, { error: 'Choose Draft, Published, or Archived.' });
  const existing = await manageableItem({ questionId, userId, userRole });
  return prisma.questionBankItem.update({ where: { id: existing.id }, data: { status }, select: { id: true, status: true } });
};

const accessibleBankItems = async ({ selections, userId, userRole, db = prisma }) => {
  const requested = [...new Map((selections || []).filter(item => item?.sourceBankQuestionId).map(item => [
    String(item.sourceBankQuestionId),
    { questionId: String(item.sourceBankQuestionId), versionId: item.sourceBankVersionId ? String(item.sourceBankVersionId) : null },
  ])).values()];
  if (!requested.length) return new Map();
  const items = await db.questionBankItem.findMany({
    where: {
      id: { in: requested.map(item => item.questionId) },
      OR: [
        { scope: 'SYSTEM', status: 'PUBLISHED' },
        ...(userRole === 'TEACHER' ? [{ scope: 'PERSONAL', ownerId: Number(userId), status: { not: 'ARCHIVED' } }] : []),
        ...(userRole === 'ADMIN' ? [{ scope: 'SYSTEM', status: { not: 'ARCHIVED' } }] : []),
      ],
    },
    include: { versions: { orderBy: { version: 'desc' } } },
  });
  if (items.length !== requested.length) throw new ApiError(403, { error: 'One or more selected bank questions are unavailable.' });
  return new Map(items.map(item => {
    const request = requested.find(entry => entry.questionId === item.id);
    const version = request.versionId ? item.versions.find(entry => entry.id === request.versionId) : item.versions[0];
    if (!version) throw new ApiError(400, { error: 'A selected question version no longer exists.' });
    return [item.id, { item, version }];
  }));
};

exports.hydrateBankQuestions = async ({ sections, userId, userRole, db = prisma }) => {
  const rawSections = Array.isArray(sections) ? sections : [];
  const selected = rawSections.flatMap(section => Array.isArray(section.questions) ? section.questions : []);
  const bankItems = await accessibleBankItems({ selections: selected, userId, userRole, db });
  return rawSections.map(section => ({
    ...section,
    questions: (section.questions || []).map(question => {
      if (!question.sourceBankQuestionId) return question;
      const source = bankItems.get(String(question.sourceBankQuestionId));
      if (!source) throw new ApiError(403, { error: 'A selected bank question is unavailable.' });
      return {
        ...question,
        type: source.item.type,
        blocks: source.version.blocks,
        questionText: source.version.questionText,
        choices: source.version.choices,
        correctAnswer: source.version.correctAnswer,
        explanation: source.version.explanation,
        domainCode: source.item.domainCode,
        skillCode: source.item.skillCode,
        sourceBankQuestionId: source.item.id,
        sourceBankVersionId: source.version.id,
      };
    }),
  }));
};

exports.createAssignedQuiz = async ({ userId, userRole, payload }) => {
  const title = String(payload?.title || '').trim().replace(/\s+/g, ' ');
  const subject = VALID_SUBJECTS.has(payload?.subject) ? payload.subject : null;
  const duration = Number.parseInt(payload?.duration, 10);
  const selections = Array.isArray(payload?.questions) ? payload.questions : [];
  const uniqueIds = new Set(selections.map(item => String(item?.sourceBankQuestionId || '')).filter(Boolean));
  if (!title) throw new ApiError(400, { error: 'Enter a quiz title.' });
  if (title.length > 160) throw new ApiError(400, { error: 'Quiz title must be 160 characters or fewer.' });
  if (!subject) throw new ApiError(400, { error: 'Choose Reading & Writing or Math.' });
  if (!Number.isInteger(duration) || duration < 1 || duration > 180) throw new ApiError(400, { error: 'Quiz duration must be between 1 and 180 minutes.' });
  if (!selections.length || selections.length > 60 || uniqueIds.size !== selections.length) {
    throw new ApiError(400, { error: 'Select between 1 and 60 unique questions.' });
  }

  return prisma.$transaction(async tx => {
    const [section] = await exports.hydrateBankQuestions({
      sections: [{ name: 'Quiz', order: 1, questions: selections }],
      userId,
      userRole,
      db: tx,
    });
    const domainCodes = [...new Set(section.questions.map(question => question.domainCode))];
    const domains = await tx.questionDomain.findMany({ where: { code: { in: domainCodes } }, select: { code: true, subject: true } });
    if (domains.length !== domainCodes.length || domains.some(domain => domain.subject !== subject)) {
      throw new ApiError(400, { error: 'Every quiz question must match the selected subject.' });
    }

    const quiz = await tx.test.create({
      data: {
        title,
        duration,
        subject,
        mode: 'PRACTICE',
        category: 'CLASS',
        scope: 'PERSONAL',
        status: 'PUBLISHED',
        isPublic: false,
        isDiscoverable: false,
        authorId: Number(userId),
        sections: {
          create: {
            name: 'Quiz',
            order: 1,
            duration,
            questions: {
              create: section.questions.map((question, index) => ({
                order: index + 1,
                type: question.type,
                blocks: question.blocks,
                questionText: question.questionText,
                choices: question.choices,
                correctAnswer: question.correctAnswer,
                explanation: question.explanation,
                domainCode: question.domainCode,
                skillCode: question.skillCode,
                sourceBankQuestionId: question.sourceBankQuestionId,
                sourceBankVersionId: question.sourceBankVersionId,
              })),
            },
          },
        },
      },
      select: { id: true, title: true, duration: true, subject: true },
    });
    await syncTestImages({ db: tx, testId: quiz.id, assetIds: imageAssetIds([section]) });

    const deliveries = await createDeliveriesWithDb({
      db: tx,
      classIds: [payload.classId],
      testIds: [quiz.id],
      studentIds: payload.studentIds,
      lessonId: payload.lessonId,
      lessonPhase: payload.lessonPhase,
      title,
      availableAt: payload.availableAt,
      dueAt: payload.dueAt,
      maxAttempts: payload.maxAttempts,
      scorePolicy: payload.scorePolicy,
      activityType: 'QUIZ',
      userId,
      userRole,
    });
    return { quiz: { ...quiz, questionCount: section.questions.length }, delivery: deliveries[0] };
  });
};

exports.createRandomQuiz = async ({ userId, payload }) => {
  const subject = VALID_SUBJECTS.has(payload.subject) ? payload.subject : null;
  if (!subject) throw new ApiError(400, { error: 'Choose Reading & Writing or Math.' });
  const count = Math.min(40, Math.max(1, Number.parseInt(payload.count, 10) || 10));
  const where = {
    scope: 'SYSTEM', status: 'PUBLISHED', subject,
    ...(payload.domainCode ? { domainCode: String(payload.domainCode) } : {}),
    ...(payload.skillCode ? { skillCode: String(payload.skillCode) } : {}),
    ...(VALID_DIFFICULTIES.has(payload.difficulty) ? { difficulty: payload.difficulty } : {}),
    progress: { none: { userId: Number(userId), attemptCount: { gt: 0 } } },
  };
  const candidates = await prisma.questionBankItem.findMany({
    where,
    take: 2000,
    select: { id: true, type: true, domainCode: true, skillCode: true, versions: { orderBy: { version: 'desc' }, take: 1 } },
  });
  const locked = await activeLockedQuestionIds({ userId, questionIds: candidates.map(item => item.id) });
  const available = candidates.filter(item => item.versions[0] && !locked.has(item.id));
  if (available.length < count) {
    throw new ApiError(409, { error: `Only ${available.length} unseen question${available.length === 1 ? '' : 's'} match these filters.`, availableCount: available.length });
  }
  for (let index = available.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [available[index], available[randomIndex]] = [available[randomIndex], available[index]];
  }
  const selected = available.slice(0, count);
  return prisma.$transaction(async tx => {
    const questions = selected.map((source, index) => {
      const version = source.versions[0];
      return {
        order: index + 1, type: source.type, blocks: version.blocks, questionText: version.questionText,
        choices: version.choices, correctAnswer: version.correctAnswer, explanation: version.explanation,
        domainCode: source.domainCode, skillCode: source.skillCode,
        sourceBankQuestionId: source.id, sourceBankVersionId: version.id,
      };
    });
    const test = await tx.test.create({
      data: {
        title: `Random ${subject === 'MATH' ? 'Math' : 'Reading & Writing'} practice`,
        duration: Math.max(10, count * 2), subject, mode: 'PRACTICE', category: 'PRACTICE',
        scope: 'PERSONAL', status: 'PUBLISHED', isPublic: false, isDiscoverable: false, authorId: Number(userId),
        sections: {
          create: {
            name: 'Practice', order: 1, duration: Math.max(10, count * 2),
            questions: { create: questions },
          },
        },
      },
      select: { id: true, title: true },
    });
    await syncTestImages({ db: tx, testId: test.id, assetIds: imageAssetIds([{ questions }]) });
    return { ...test, questionCount: selected.length };
  });
};

exports.recordProgressWithDb = async ({ db, userId, question, selectedChoice, isCorrect }) => {
  if (!question.sourceBankQuestionId) return;
  const now = new Date();
  await db.studentBankQuestionProgress.upsert({
    where: { userId_questionId: { userId: Number(userId), questionId: question.sourceBankQuestionId } },
    update: {
      attemptCount: { increment: 1 },
      correctCount: isCorrect ? { increment: 1 } : undefined,
      bestCorrect: isCorrect ? true : undefined,
      lastCorrect: isCorrect,
      lastAttemptAt: now,
    },
    create: {
      userId: Number(userId), questionId: question.sourceBankQuestionId, attemptCount: 1,
      correctCount: isCorrect ? 1 : 0, bestCorrect: isCorrect, lastCorrect: isCorrect,
      firstAttemptAt: now, lastAttemptAt: now,
    },
  });
  return { selectedChoice };
};

exports.answerRoadmapQuestion = async ({ userId, milestoneId, questionId, selectedChoice }) => prisma.$transaction(async tx => {
  const milestone = await tx.roadmapMilestone.findFirst({
    where: { id: String(milestoneId), roadmap: { status: 'PUBLISHED' }, skills: { some: {} } },
    select: { id: true, skills: { select: { skillCode: true } } },
  });
  if (!milestone) throw new ApiError(404, { error: 'Milestone not found.' });
  const question = await tx.questionBankItem.findFirst({
    where: { id: String(questionId), scope: 'SYSTEM', status: 'PUBLISHED', skillCode: { in: milestone.skills.map(item => item.skillCode) } },
    include: { versions: { orderBy: { version: 'desc' }, take: 1 } },
  });
  const version = question && latestVersion(question);
  if (!version) throw new ApiError(404, { error: 'Practice question not found.' });
  const normalizedChoice = String(selectedChoice || '').trim();
  if (!normalizedChoice || normalizedChoice.length > 200) throw new ApiError(400, { error: 'Enter an answer before checking this question.' });
  if (question.type === 'MCQ' && !version.choices.some(choice => choice.id === normalizedChoice.toUpperCase())) {
    throw new ApiError(400, { error: 'Choose one of the available answers.' });
  }
  const isCorrect = isAnswerCorrect({ type: question.type, choices: version.choices, correctAnswer: version.correctAnswer, userAnswer: normalizedChoice });
  await tx.bankQuestionAttempt.create({
    data: { userId: Number(userId), questionId: question.id, versionId: version.id, milestoneId: milestone.id, selectedChoice: normalizedChoice, isCorrect },
  });
  await exports.recordProgressWithDb({ db: tx, userId, question: { sourceBankQuestionId: question.id }, selectedChoice: normalizedChoice, isCorrect });
  const distinctAnswered = await tx.bankQuestionAttempt.groupBy({ by: ['questionId'], where: { userId: Number(userId), milestoneId: milestone.id } });
  const fullMilestone = await tx.roadmapMilestone.findUnique({ where: { id: milestone.id }, select: { requiredQuestionCount: true } });
  const completed = distinctAnswered.length >= fullMilestone.requiredQuestionCount;
  await tx.studentMilestoneProgress.upsert({
    where: { userId_milestoneId: { userId: Number(userId), milestoneId: milestone.id } },
    update: { ...(completed ? { completedAt: new Date() } : {}) },
    create: { userId: Number(userId), milestoneId: milestone.id, ...(completed ? { completedAt: new Date() } : {}) },
  });
  const locked = await activeLockedQuestionIds({ userId, questionIds: [question.id], db: tx });
  return {
    questionId: question.id,
    answeredCount: distinctAnswered.length,
    completed,
    solutionLocked: locked.has(question.id),
    ...(!locked.has(question.id) ? { isCorrect, correctAnswer: version.correctAnswer, explanation: version.explanation } : {}),
  };
});

exports.activeLockedQuestionIds = activeLockedQuestionIds;
exports.serializeItem = serializeItem;
exports.normalizeContent = normalizeContent;
exports.listWhere = listWhere;
