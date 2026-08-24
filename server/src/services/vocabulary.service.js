const prisma = require('../config/prisma');
const ApiError = require('../utils/ApiError');

const intId = value => Number.parseInt(value, 10);
const clean = (value, max = 500) => String(value || '').trim().slice(0, max);
const normalizeWord = value => clean(value, 100).toLocaleLowerCase('en-US').replace(/\s+/g, ' ');
const shuffle = values => {
  const result = [...values];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const target = Math.floor(Math.random() * (index + 1));
    [result[index], result[target]] = [result[target], result[index]];
  }
  return result;
};

const validateTerms = rawTerms => {
  if (!Array.isArray(rawTerms)) throw new ApiError(400, { error: 'Terms must be an array.' });
  const seen = new Set();
  return rawTerms.map((raw, order) => {
    const word = clean(raw.word, 100);
    const normalizedWord = normalizeWord(word);
    const meaning = clean(raw.meaning, 500);
    const translation = clean(raw.translation, 300);
    const exampleSentence = clean(raw.exampleSentence, 500) || null;
    if (!word || !meaning || !translation) throw new ApiError(400, { error: `Term ${order + 1} requires a word, meaning, and translation.` });
    if (seen.has(normalizedWord)) throw new ApiError(400, { error: `The word “${word}” appears more than once in this set.` });
    seen.add(normalizedWord);
    return { word, normalizedWord, meaning, translation, exampleSentence, order };
  });
};

const canManageSet = (set, userId, userRole) => userRole === 'ADMIN'
  || (set.scope === 'PERSONAL' && set.ownerId === intId(userId));

const getAccessibleSet = async ({ setId, userId, userRole, activityId, includeTerms = true }) => {
  const set = await prisma.vocabularySet.findUnique({
    where: { id: String(setId) },
    include: includeTerms ? { terms: { orderBy: { order: 'asc' } } } : undefined,
  });
  if (!set) throw new ApiError(404, { error: 'Vocabulary set not found.' });
  let readable = set.scope === 'SYSTEM'
    ? set.status === 'PUBLISHED' || userRole === 'ADMIN'
    : set.ownerId === intId(userId) || userRole === 'ADMIN';
  if (!readable && activityId) {
    readable = Boolean(await prisma.classActivity.findFirst({
      where: { id: String(activityId), type: 'VOCABULARY', vocabulary: { vocabularySetId: set.id }, assignees: { some: { studentId: intId(userId), excusedAt: null } } },
      select: { id: true },
    }));
  }
  if (!readable) throw new ApiError(403, { error: 'You do not have access to this vocabulary set.' });
  return set;
};

const setSummary = (set, progress = []) => ({
  id: set.id,
  title: set.title,
  description: set.description,
  scope: set.scope,
  status: set.status,
  sourceLanguage: set.sourceLanguage,
  translationLanguage: set.translationLanguage,
  version: set.version,
  ownerId: set.ownerId,
  createdAt: set.createdAt,
  updatedAt: set.updatedAt,
  publishedAt: set.publishedAt,
  termCount: set._count?.terms ?? set.terms?.length ?? 0,
  masteredCount: progress.filter(item => item.mastery === 'MASTERED').length,
});

exports.listSets = async ({ scope = 'SYSTEM', query, userId, userRole }) => {
  const normalizedScope = String(scope).toUpperCase();
  const search = clean(query, 100);
  const where = normalizedScope === 'MINE'
    ? { scope: 'PERSONAL', ownerId: intId(userId), status: { not: 'ARCHIVED' } }
    : normalizedScope === 'ASSIGNED'
      ? {
          activities: {
            some: {
              activity: { status: 'PUBLISHED', assignees: { some: { studentId: intId(userId), excusedAt: null } } },
            },
          },
        }
      : { scope: 'SYSTEM', ...(userRole === 'ADMIN' ? {} : { status: 'PUBLISHED' }) };
  if (search) where.OR = [
    { title: { contains: search, mode: 'insensitive' } },
    { terms: { some: { normalizedWord: { contains: normalizeWord(search) } } } },
  ];
  const sets = await prisma.vocabularySet.findMany({
    where,
    orderBy: [{ publishedAt: 'desc' }, { updatedAt: 'desc' }],
    include: {
      _count: { select: { terms: true } },
      terms: { select: { progress: { where: { userId: intId(userId) }, select: { mastery: true } } } },
      ...(normalizedScope === 'ASSIGNED' ? {
        activities: {
          where: { activity: { status: 'PUBLISHED', assignees: { some: { studentId: intId(userId), excusedAt: null } } } },
          select: { activityId: true },
          orderBy: { activity: { createdAt: 'desc' } },
          take: 1,
        },
      } : {}),
    },
    take: 100,
  });
  return sets.map(set => ({
    ...setSummary(set, set.terms.flatMap(term => term.progress)),
    ...(set.activities?.[0] ? { assignedActivityId: set.activities[0].activityId } : {}),
  }));
};

exports.getSet = async ({ setId, userId, userRole, activityId }) => {
  const set = await getAccessibleSet({ setId, userId, userRole, activityId });
  const progress = await prisma.vocabularyTermProgress.findMany({
    where: { userId: intId(userId), termId: { in: set.terms.map(term => term.id) } },
  });
  const progressByTerm = new Map(progress.map(item => [item.termId, item]));
  return {
    ...setSummary(set, progress),
    canEdit: canManageSet(set, userId, userRole),
    terms: set.terms.map(term => ({ ...term, progress: progressByTerm.get(term.id) || null })),
  };
};

exports.createSet = async ({ data, userId, userRole }) => {
  const title = clean(data.title, 120);
  if (!title) throw new ApiError(400, { error: 'Set title is required.' });
  const scope = String(data.scope || 'PERSONAL').toUpperCase();
  if (!['SYSTEM', 'PERSONAL'].includes(scope)) throw new ApiError(400, { error: 'Vocabulary set scope is invalid.' });
  if (scope === 'SYSTEM' && userRole !== 'ADMIN') throw new ApiError(403, { error: 'Only administrators can create system vocabulary sets.' });
  const terms = validateTerms(data.terms || []);
  const set = await prisma.vocabularySet.create({
    data: {
      title,
      description: clean(data.description, 500) || null,
      scope,
      status: scope === 'SYSTEM' ? 'DRAFT' : 'PUBLISHED',
      sourceLanguage: clean(data.sourceLanguage, 10) || 'en',
      translationLanguage: clean(data.translationLanguage, 10) || 'vi',
      ownerId: scope === 'PERSONAL' ? intId(userId) : null,
      createdById: intId(userId),
      publishedAt: scope === 'PERSONAL' ? new Date() : null,
      terms: { create: terms },
    },
    include: { terms: { orderBy: { order: 'asc' } } },
  });
  return exports.getSet({ setId: set.id, userId, userRole });
};

exports.updateSet = async ({ setId, data, userId, userRole }) => {
  const set = await getAccessibleSet({ setId, userId, userRole, includeTerms: false });
  if (!canManageSet(set, userId, userRole)) throw new ApiError(403, { error: 'You cannot edit this vocabulary set.' });
  const title = data.title === undefined ? undefined : clean(data.title, 120);
  if (title !== undefined && !title) throw new ApiError(400, { error: 'Set title is required.' });
  await prisma.vocabularySet.update({
    where: { id: set.id },
    data: {
      title,
      description: data.description === undefined ? undefined : clean(data.description, 500) || null,
      sourceLanguage: data.sourceLanguage === undefined ? undefined : clean(data.sourceLanguage, 10) || 'en',
      translationLanguage: data.translationLanguage === undefined ? undefined : clean(data.translationLanguage, 10) || 'vi',
    },
  });
  return exports.getSet({ setId, userId, userRole });
};

exports.replaceTerms = async ({ setId, terms: rawTerms, userId, userRole }) => {
  const set = await getAccessibleSet({ setId, userId, userRole, includeTerms: false });
  if (!canManageSet(set, userId, userRole)) throw new ApiError(403, { error: 'You cannot edit this vocabulary set.' });
  const terms = validateTerms(rawTerms);
  await prisma.$transaction(async tx => {
    await tx.vocabularyTerm.deleteMany({ where: { setId: set.id } });
    if (terms.length) await tx.vocabularyTerm.createMany({ data: terms.map(term => ({ ...term, setId: set.id })) });
    await tx.vocabularySet.update({ where: { id: set.id }, data: { version: { increment: 1 } } });
  });
  return exports.getSet({ setId, userId, userRole });
};

exports.publishSet = async ({ setId, userId, userRole }) => {
  const set = await getAccessibleSet({ setId, userId, userRole });
  if (userRole !== 'ADMIN' || set.scope !== 'SYSTEM') throw new ApiError(403, { error: 'Only administrators can publish system vocabulary sets.' });
  const uniqueMeanings = new Set(set.terms.map(term => term.meaning.toLocaleLowerCase('en-US')));
  if (set.terms.length < 4 || uniqueMeanings.size < 4) throw new ApiError(400, { error: 'A published set needs at least four terms with distinct meanings.' });
  await prisma.vocabularySet.update({ where: { id: set.id }, data: { status: 'PUBLISHED', publishedAt: new Date() } });
  return exports.getSet({ setId, userId, userRole });
};

exports.archiveSet = async ({ setId, userId, userRole }) => {
  const set = await getAccessibleSet({ setId, userId, userRole, includeTerms: false });
  if (!canManageSet(set, userId, userRole)) throw new ApiError(403, { error: 'You cannot archive this vocabulary set.' });
  await prisma.vocabularySet.update({ where: { id: set.id }, data: { status: 'ARCHIVED' } });
  return { archived: true };
};

const sourceItemsForSession = async ({ set, activityId, userId, mode }) => {
  if (!activityId) return set.terms.map(term => ({ ...term, sourceTermId: term.id }));
  const activity = await prisma.classActivity.findFirst({
    where: {
      id: String(activityId),
      type: 'VOCABULARY',
      status: 'PUBLISHED',
      assignees: { some: { studentId: intId(userId), excusedAt: null } },
    },
    include: { vocabulary: { include: { items: { orderBy: { order: 'asc' } } } }, assignees: { where: { studentId: intId(userId) }, take: 1 } },
  });
  if (!activity || activity.vocabulary?.vocabularySetId !== set.id) throw new ApiError(403, { error: 'This vocabulary activity is not assigned to you.' });
  if (activity.availableAt && activity.availableAt > new Date()) throw new ApiError(403, { error: 'This activity is not available yet.' });
  const assignee = activity.assignees[0];
  if (mode === 'QUIZ' && assignee.attemptCount >= activity.maxAttempts) throw new ApiError(409, { error: 'You have used all quiz attempts for this activity.' });
  await prisma.activityAssignee.update({
    where: { activityId_studentId: { activityId: activity.id, studentId: intId(userId) } },
    data: { status: 'IN_PROGRESS', startedAt: assignee.startedAt || new Date() },
  });
  return activity.vocabulary.items.map(item => ({ ...item, id: item.sourceTermId, sourceTermId: item.sourceTermId }));
};

const sessionResponse = session => ({
  id: session.id,
  setId: session.setId,
  activityId: session.activityId,
  mode: session.mode,
  status: session.status,
  totalItems: session.totalItems,
  correctCount: session.correctCount,
  score: session.totalItems ? Math.round((session.correctCount / session.totalItems) * 100) : 0,
  startedAt: session.startedAt,
  completedAt: session.completedAt,
  questions: session.questions.map(question => ({
    id: question.id,
    prompt: question.prompt,
    order: question.order,
    options: question.options,
    selectedMeaning: question.selectedMeaning,
    isCorrect: question.isCorrect,
    ...(session.mode === 'FLASHCARD' || question.answeredAt || session.status === 'COMPLETED' ? {
      meaning: question.correctMeaning,
      translation: question.translation,
      exampleSentence: question.exampleSentence,
    } : {}),
  })),
});

exports.createSession = async ({ setId, activityId, mode, questionCount, startIndex, endIndex, masteries, restart, userId, userRole }) => {
  const set = await getAccessibleSet({ setId, userId, userRole, activityId });
  const normalizedMode = String(mode || 'FLASHCARD').toUpperCase();
  if (!['FLASHCARD', 'QUIZ'].includes(normalizedMode)) throw new ApiError(400, { error: 'Study mode is invalid.' });
  const existingSession = await prisma.vocabularyStudySession.findFirst({
    where: { userId: intId(userId), setId: set.id, activityId: activityId ? String(activityId) : null, mode: normalizedMode, status: 'IN_PROGRESS' },
    orderBy: { startedAt: 'desc' },
    include: { questions: { orderBy: { order: 'asc' } } },
  });
  if (existingSession && !restart) return sessionResponse(existingSession);
  if (existingSession && restart) await prisma.vocabularyStudySession.delete({ where: { id: existingSession.id } });
  let sourceItems = await sourceItemsForSession({ set, activityId, userId, mode: normalizedMode });
  if (!sourceItems.length) throw new ApiError(400, { error: 'This vocabulary set has no terms.' });
  if (normalizedMode === 'QUIZ') {
    const rangeStart = Math.max(1, intId(startIndex) || 1);
    const rangeEnd = Math.min(sourceItems.length, Math.max(rangeStart, intId(endIndex) || sourceItems.length));
    if (rangeStart > sourceItems.length) throw new ApiError(400, { error: 'The quiz range starts after the final word.' });
    sourceItems = sourceItems.slice(rangeStart - 1, rangeEnd);
    const requestedMasteries = Array.isArray(masteries) ? [...new Set(masteries.map(value => String(value).toUpperCase()))] : [];
    const allowedMasteries = ['NOT_STUDIED', 'LEARNING', 'MASTERED'];
    if (requestedMasteries.some(value => !allowedMasteries.includes(value))) throw new ApiError(400, { error: 'Quiz mastery filter is invalid.' });
    if (requestedMasteries.length && requestedMasteries.length < allowedMasteries.length) {
      const sourceTermIds = sourceItems.map(item => item.sourceTermId || item.id).filter(Boolean);
      const progress = await prisma.vocabularyTermProgress.findMany({ where: { userId: intId(userId), termId: { in: sourceTermIds } }, select: { termId: true, mastery: true } });
      const masteryByTerm = new Map(progress.map(item => [item.termId, item.mastery]));
      sourceItems = sourceItems.filter(item => requestedMasteries.includes(masteryByTerm.get(item.sourceTermId || item.id) || 'NOT_STUDIED'));
    }
    if (sourceItems.length > 40) sourceItems = sourceItems.slice(0, 40);
  }
  if (!sourceItems.length) throw new ApiError(400, { error: 'No words match the selected quiz filters.' });
  const uniqueMeanings = [...new Set(sourceItems.map(item => item.meaning))];
  if (normalizedMode === 'QUIZ' && uniqueMeanings.length < 4) throw new ApiError(400, { error: 'Quiz mode requires four distinct meanings.' });
  const assignedQuestionCount = activityId
    ? (await prisma.vocabularyActivity.findUnique({ where: { activityId: String(activityId) }, select: { questionCount: true } }))?.questionCount
    : null;
  const limit = Math.min(sourceItems.length, Math.max(1, intId(questionCount) || assignedQuestionCount || sourceItems.length));
  const selected = shuffle(sourceItems).slice(0, limit);
  const session = await prisma.vocabularyStudySession.create({
    data: {
      userId: intId(userId),
      setId: set.id,
      activityId: activityId ? String(activityId) : null,
      mode: normalizedMode,
      totalItems: selected.length,
      questions: {
        create: selected.map((item, order) => {
          const distractors = normalizedMode === 'QUIZ'
            ? shuffle(uniqueMeanings.filter(meaning => meaning !== item.meaning)).slice(0, 3)
            : [];
          return {
            sourceTermId: item.sourceTermId || null,
            prompt: item.word,
            correctMeaning: item.meaning,
            translation: item.translation,
            exampleSentence: item.exampleSentence || null,
            options: normalizedMode === 'QUIZ' ? shuffle([item.meaning, ...distractors]) : [],
            order,
          };
        }),
      },
    },
    include: { questions: { orderBy: { order: 'asc' } } },
  });
  return sessionResponse(session);
};

exports.getSession = async ({ sessionId, userId }) => {
  const session = await prisma.vocabularyStudySession.findFirst({
    where: { id: String(sessionId), userId: intId(userId) },
    include: { questions: { orderBy: { order: 'asc' } } },
  });
  if (!session) throw new ApiError(404, { error: 'Study session not found.' });
  return sessionResponse(session);
};

const nextTermMastery = ({ existing, correct, mode }) => {
  const currentStreak = existing?.correctStreak || 0;
  if (!correct) return { mastery: 'LEARNING', correctStreak: 0 };
  if (mode === 'QUIZ') {
    const correctStreak = currentStreak + 1;
    return { mastery: correctStreak >= 2 ? 'MASTERED' : 'LEARNING', correctStreak };
  }
  return {
    mastery: existing?.mastery === 'MASTERED' ? 'MASTERED' : 'LEARNING',
    correctStreak: currentStreak,
  };
};

const updateTermProgress = async (tx, { userId, termId, correct, mode }) => {
  if (!termId) return;
  const existing = await tx.vocabularyTermProgress.findUnique({ where: { userId_termId: { userId, termId } } });
  const { mastery, correctStreak } = nextTermMastery({ existing, correct, mode });
  await tx.vocabularyTermProgress.upsert({
    where: { userId_termId: { userId, termId } },
    update: { mastery, correctStreak, seenCount: { increment: 1 }, correctCount: { increment: correct ? 1 : 0 }, incorrectCount: { increment: correct ? 0 : 1 }, lastReviewedAt: new Date() },
    create: { userId, termId, mastery, correctStreak, seenCount: 1, correctCount: correct ? 1 : 0, incorrectCount: correct ? 0 : 1, lastReviewedAt: new Date() },
  });
};

const finishSessionIfReady = async (tx, sessionId) => {
  const session = await tx.vocabularyStudySession.findUnique({
    where: { id: sessionId },
    include: { questions: true, activity: true },
  });
  if (!session || session.status === 'COMPLETED' || session.questions.some(question => !question.answeredAt)) return;
  const correctCount = session.questions.filter(question => question.isCorrect).length;
  await tx.vocabularyStudySession.update({ where: { id: session.id }, data: { status: 'COMPLETED', correctCount, completedAt: new Date() } });
  if (!session.activityId) return;
  const score = Math.round((correctCount / session.totalItems) * 100);
  const threshold = session.activity.passingScore ?? 80;
  if (session.mode === 'FLASHCARD' && session.activity.completionRule === 'SCORE_AT_LEAST') {
    await tx.activityAssignee.update({
      where: { activityId_studentId: { activityId: session.activityId, studentId: session.userId } },
      data: { status: 'IN_PROGRESS' },
    });
    return;
  }
  const completed = session.activity.completionRule === 'VIEW_ALL'
    || session.activity.completionRule === 'SUBMIT'
    || (session.activity.completionRule === 'SCORE_AT_LEAST' && score >= threshold);
  const assignee = await tx.activityAssignee.findUnique({ where: { activityId_studentId: { activityId: session.activityId, studentId: session.userId } } });
  await tx.activityAssignee.update({
    where: { activityId_studentId: { activityId: session.activityId, studentId: session.userId } },
    data: {
      attemptCount: { increment: 1 },
      bestScore: Math.max(assignee?.bestScore ?? 0, score),
      status: completed ? 'COMPLETED' : 'IN_PROGRESS',
      completedAt: completed ? new Date() : null,
    },
  });
};

exports.answerQuestion = async ({ sessionId, questionId, selectedMeaning, mastery, userId }) => {
  await prisma.$transaction(async tx => {
    const session = await tx.vocabularyStudySession.findFirst({
      where: { id: String(sessionId), userId: intId(userId), status: 'IN_PROGRESS' },
    });
    if (!session) throw new ApiError(404, { error: 'Active study session not found.' });
    const question = await tx.vocabularySessionQuestion.findFirst({ where: { id: String(questionId), sessionId: session.id } });
    if (!question) throw new ApiError(404, { error: 'Study question not found.' });
    if (question.answeredAt) throw new ApiError(409, { error: 'This question has already been answered.' });
    const answer = session.mode === 'FLASHCARD' ? String(mastery || '').toUpperCase() : clean(selectedMeaning, 500);
    if (session.mode === 'FLASHCARD' && !['KNOW', 'LEARNING'].includes(answer)) throw new ApiError(400, { error: 'Choose Know or Still learning.' });
    if (session.mode === 'QUIZ' && !(question.options || []).includes(answer)) throw new ApiError(400, { error: 'Choose one of the provided meanings.' });
    const correct = session.mode === 'FLASHCARD' ? answer === 'KNOW' : answer === question.correctMeaning;
    await tx.vocabularySessionQuestion.update({
      where: { id: question.id },
      data: { selectedMeaning: answer, isCorrect: correct, answeredAt: new Date() },
    });
    await updateTermProgress(tx, { userId: intId(userId), termId: question.sourceTermId, correct, mode: session.mode });
    await finishSessionIfReady(tx, session.id);
  });
  return exports.getSession({ sessionId, userId });
};

const assertClassManager = async ({ classId, userId, userRole }) => {
  const classroom = await prisma.class.findUnique({
    where: { id: String(classId) },
    include: { students: { select: { id: true } } },
  });
  if (!classroom) throw new ApiError(404, { error: 'Class not found.' });
  if (userRole !== 'ADMIN' && classroom.teacherId !== intId(userId)) throw new ApiError(403, { error: 'You cannot manage this class.' });
  return classroom;
};

exports.assignSet = async ({ data, userId, userRole }) => {
  const classroom = await assertClassManager({ classId: data.classId, userId, userRole });
  const set = await getAccessibleSet({ setId: data.setId, userId, userRole });
  if (set.status !== 'PUBLISHED') throw new ApiError(400, { error: 'Only published vocabulary sets can be assigned.' });
  if (set.scope === 'PERSONAL' && set.ownerId !== intId(userId) && userRole !== 'ADMIN') throw new ApiError(403, { error: 'You can only assign your own personal sets.' });
  if (set.terms.length < 4) throw new ApiError(400, { error: 'Assign a set with at least four terms.' });
  const availableAt = data.availableAt ? new Date(data.availableAt) : null;
  const dueAt = data.dueAt ? new Date(data.dueAt) : null;
  if ((availableAt && Number.isNaN(availableAt.getTime())) || (dueAt && Number.isNaN(dueAt.getTime()))) throw new ApiError(400, { error: 'Activity dates are invalid.' });
  if (availableAt && dueAt && availableAt >= dueAt) throw new ApiError(400, { error: 'Due date must be after the available date.' });
  if (data.lessonId) {
    const lesson = await prisma.lesson.findFirst({ where: { id: String(data.lessonId), week: { classId: classroom.id } }, select: { id: true } });
    if (!lesson) throw new ApiError(400, { error: 'The selected lesson does not belong to this class.' });
  }
  const requestedIds = Array.isArray(data.studentIds) ? [...new Set(data.studentIds.map(intId).filter(Number.isInteger))] : [];
  const classStudentIds = new Set(classroom.students.map(student => student.id));
  const assigneeIds = requestedIds.length ? requestedIds.filter(id => classStudentIds.has(id)) : [...classStudentIds];
  if (!assigneeIds.length) throw new ApiError(400, { error: 'Select at least one student.' });
  const completionRule = ['VIEW_ALL', 'SUBMIT', 'SCORE_AT_LEAST'].includes(data.completionRule) ? data.completionRule : 'SCORE_AT_LEAST';
  const passingScore = completionRule === 'SCORE_AT_LEAST' ? Math.min(100, Math.max(1, intId(data.passingScore) || 80)) : null;
  const activity = await prisma.classActivity.create({
    data: {
      type: 'VOCABULARY',
      status: 'PUBLISHED',
      classId: classroom.id,
      lessonId: data.lessonId ? String(data.lessonId) : null,
      title: clean(data.title, 120) || set.title,
      instructions: clean(data.instructions, 1000) || null,
      availableAt,
      dueAt,
      maxAttempts: Math.min(10, Math.max(1, intId(data.maxAttempts) || 3)),
      scorePolicy: ['FIRST', 'BEST', 'LATEST'].includes(data.scorePolicy) ? data.scorePolicy : 'BEST',
      completionRule,
      passingScore,
      audience: requestedIds.length ? 'SELECTED' : 'ALL_STUDENTS',
      createdById: intId(userId),
      assignees: { create: assigneeIds.map(studentId => ({ studentId })) },
      vocabulary: {
        create: {
          vocabularySetId: set.id,
          sourceSetVersion: set.version,
          questionCount: data.questionCount ? Math.min(set.terms.length, Math.max(4, intId(data.questionCount))) : null,
          items: {
            create: set.terms.map(term => ({
              sourceTermId: term.id,
              word: term.word,
              meaning: term.meaning,
              translation: term.translation,
              exampleSentence: term.exampleSentence,
              order: term.order,
            })),
          },
        },
      },
    },
    include: { class: { select: { name: true } } },
  });
  await prisma.notification.createMany({
    data: assigneeIds.map(studentId => ({ userId: studentId, message: `${activity.class.name}: ${activity.title}`, link: `/dashboard/vocabulary?activity=${activity.id}` })),
  });
  return exports.getActivity({ activityId: activity.id, userId, userRole });
};

exports.listClassActivities = async ({ classId, userId, userRole }) => {
  const classroom = await prisma.class.findUnique({ where: { id: String(classId) }, select: { teacherId: true, students: { where: { id: intId(userId) }, select: { id: true } } } });
  if (!classroom) throw new ApiError(404, { error: 'Class not found.' });
  const canManage = userRole === 'ADMIN' || classroom.teacherId === intId(userId);
  if (!canManage && !classroom.students.length) throw new ApiError(403, { error: 'You do not have access to this class.' });
  const activities = await prisma.classActivity.findMany({
    where: { classId: String(classId), type: 'VOCABULARY', ...(canManage ? {} : { status: 'PUBLISHED', assignees: { some: { studentId: intId(userId), excusedAt: null } } }) },
    orderBy: { createdAt: 'desc' },
    include: {
      vocabulary: { include: { vocabularySet: { select: { id: true, title: true } }, _count: { select: { items: true } } } },
      assignees: canManage ? true : { where: { studentId: intId(userId) } },
      lesson: { select: { id: true, title: true, week: { select: { title: true } } } },
    },
  });
  return activities;
};

exports.getActivity = async ({ activityId, userId, userRole }) => {
  const activity = await prisma.classActivity.findUnique({
    where: { id: String(activityId) },
    include: {
      class: { select: { id: true, name: true, teacherId: true } },
      vocabulary: { include: { vocabularySet: true, items: { orderBy: { order: 'asc' } } } },
      assignees: { include: { student: { select: { id: true, name: true, email: true } } } },
      vocabularySessions: { where: { status: 'COMPLETED' }, select: { userId: true, correctCount: true, totalItems: true, completedAt: true } },
    },
  });
  if (!activity || activity.type !== 'VOCABULARY') throw new ApiError(404, { error: 'Vocabulary activity not found.' });
  const canManage = userRole === 'ADMIN' || activity.class.teacherId === intId(userId);
  const isAssignee = activity.assignees.some(item => item.studentId === intId(userId) && !item.excusedAt);
  if (!canManage && !isAssignee) throw new ApiError(403, { error: 'You do not have access to this activity.' });
  return activity;
};

exports.getActivityPerformance = async ({ activityId, userId, userRole }) => {
  const activity = await exports.getActivity({ activityId, userId, userRole });
  if (userRole !== 'ADMIN' && activity.class.teacherId !== intId(userId)) throw new ApiError(403, { error: 'Only class staff can view performance.' });
  const active = activity.assignees.filter(item => !item.excusedAt);
  const completed = active.filter(item => item.status === 'COMPLETED');
  const scores = active.map(item => item.bestScore).filter(Number.isFinite);
  const missed = new Map(activity.vocabulary.items.map(item => [item.word, { word: item.word, incorrect: 0 }]));
  const sessions = await prisma.vocabularyStudySession.findMany({
    where: { activityId: activity.id, status: 'COMPLETED' },
    include: { questions: { where: { isCorrect: false }, select: { prompt: true } } },
  });
  sessions.forEach(session => session.questions.forEach(question => {
    const item = missed.get(question.prompt);
    if (item) item.incorrect += 1;
  }));
  return {
    activity: { id: activity.id, title: activity.title, dueAt: activity.dueAt, passingScore: activity.passingScore },
    stats: {
      assigned: active.length,
      completed: completed.length,
      inProgress: active.filter(item => item.status === 'IN_PROGRESS').length,
      missing: activity.dueAt && activity.dueAt < new Date() ? active.filter(item => item.status !== 'COMPLETED').length : 0,
      completionRate: active.length ? Math.round((completed.length / active.length) * 100) : 0,
      averageScore: scores.length ? Math.round(scores.reduce((sum, value) => sum + value, 0) / scores.length) : null,
    },
    students: active.map(item => ({ id: item.student.id, name: item.student.name || item.student.email, email: item.student.email, status: item.status, bestScore: item.bestScore, attemptCount: item.attemptCount, completedAt: item.completedAt })),
    mostMissed: [...missed.values()].filter(item => item.incorrect > 0).sort((a, b) => b.incorrect - a.incorrect).slice(0, 10),
  };
};

exports._private = { validateTerms, normalizeWord, shuffle, nextTermMastery };
