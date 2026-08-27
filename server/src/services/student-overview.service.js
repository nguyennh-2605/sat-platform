const prisma = require('../config/prisma');
const ApiError = require('../utils/ApiError');
const { buildAnalyticsPayload } = require('../utils/analytics-transform');
const { buildAttemptSummary } = require('../utils/practice-test-progress');
const classTodoService = require('./class-todo.service');

const OVERVIEW_DAYS = 90;
const MIN_RECOMMENDATION_ANSWERS = 20;
const MIN_SUBJECT_ANSWERS = 10;
const MIN_CLASSIFICATION_COVERAGE = 70;

const questionCount = test => (test?.sections || []).reduce((total, section) => total + section._count.questions, 0);

const todoHref = todo => {
  if (todo.type === 'VOCABULARY' && todo.activityId) return `/dashboard/vocabulary?activity=${todo.activityId}`;
  if (todo.type === 'TEST' && todo.testId && todo.deliveryId) return `/test/${todo.testId}?deliveryId=${todo.deliveryId}`;
  if (todo.assignmentId) return `/dashboard/class/${todo.classId}/assignment/${todo.assignmentId}`;
  return `/dashboard/class/${todo.classId}`;
};

const todoFocus = todo => ({
  type: 'CLASSROOM',
  title: todo.priority === 'OVERDUE' ? `Catch up on ${todo.title}` : todo.title,
  description: `${todo.className}${todo.dueAt ? ` · ${todo.priority === 'OVERDUE' ? 'Overdue' : 'Due soon'}` : ''}`,
  actionLabel: todo.type === 'TEST' && todo.attemptStatus === 'DOING' ? 'Continue' : 'Open coursework',
  href: todoHref(todo),
  dueAt: todo.dueAt || null,
  source: 'CLASSROOM',
  testId: todo.testId || null,
  deliveryId: todo.deliveryId || null,
  durationMinutes: todo.durationMinutes || null,
  todoKey: todo.key,
});

const testFocus = (submission, progress) => ({
  type: 'TEST',
  title: `Continue ${submission.test.title}`,
  description: `${submission.test.subject === 'MATH' ? 'Math' : 'Reading & Writing'} · ${progress}% complete`,
  actionLabel: 'Continue test',
  href: `/test/${submission.test.id}${submission.deliveryId ? `?deliveryId=${submission.deliveryId}` : ''}`,
  progress,
  source: submission.deliveryId ? 'CLASSROOM' : 'SELF_STUDY',
  testId: submission.test.id,
  deliveryId: submission.deliveryId || null,
  durationMinutes: submission.test.duration,
});

const vocabularyFocus = session => ({
  type: 'VOCABULARY',
  title: `Continue ${session.set.title}`,
  description: `${session.mode === 'QUIZ' ? 'Vocabulary quiz' : 'Flashcards'} · ${session.totalItems} words`,
  actionLabel: 'Continue studying',
  href: session.activityId
    ? `/dashboard/vocabulary?activity=${session.activityId}`
    : `/dashboard/vocabulary?set=${session.setId}`,
  source: session.activityId ? 'CLASSROOM' : 'SELF_STUDY',
});

function selectFocus({ todos, doingSubmission, vocabularySession, completedTests, savedMistakeCount, weakSubject, practice }) {
  const urgentTodo = todos.find(todo => todo.type !== 'ANNOUNCEMENT' && ['OVERDUE', 'DUE_SOON'].includes(todo.priority));
  if (urgentTodo) return todoFocus(urgentTodo);

  if (doingSubmission) {
    const summary = buildAttemptSummary({ questionCount: questionCount(doingSubmission.test), submission: doingSubmission });
    return testFocus(doingSubmission, summary.progress);
  }

  if (vocabularySession) return vocabularyFocus(vocabularySession);

  const firstPractice = practice.find(item => item.attemptStatus === 'NOT_STARTED') || practice[0];
  if (completedTests === 0 && firstPractice) {
    return {
      type: 'BASELINE',
      title: 'Build your SAT baseline',
      description: `Start with ${firstPractice.title} to unlock a clearer view of your progress.`,
      actionLabel: 'Start practice',
      href: `/test/${firstPractice.id}`,
      source: 'SELF_STUDY',
      testId: firstPractice.id,
      deliveryId: null,
      durationMinutes: firstPractice.duration,
    };
  }

  if (savedMistakeCount > 0) {
    return {
      type: 'ERROR_LOG',
      title: `Review ${savedMistakeCount} saved ${savedMistakeCount === 1 ? 'mistake' : 'mistakes'}`,
      description: 'Revisit the questions and explanations you saved for another look.',
      actionLabel: 'Review mistakes',
      href: '/dashboard/error-log',
      source: 'SELF_STUDY',
    };
  }

  if (weakSubject) {
    const label = weakSubject === 'MATH' ? 'Math' : 'Reading & Writing';
    return {
      type: 'SUBJECT',
      title: `Strengthen your ${label} accuracy`,
      description: 'Based on enough classified questions from your recent completed tests.',
      actionLabel: `Browse ${label}`,
      href: `/dashboard/practice-test?subject=${weakSubject}`,
      source: 'SELF_STUDY',
    };
  }

  if (!firstPractice) return null;
  return {
    type: 'PRACTICE',
    title: `Ready for ${firstPractice.title}?`,
    description: `${firstPractice.subject === 'MATH' ? 'Math' : 'Reading & Writing'} · ${firstPractice.questionCount} questions`,
    actionLabel: firstPractice.attemptStatus === 'COMPLETED' ? 'Practice again' : 'Start practice',
    href: `/test/${firstPractice.id}`,
    source: 'SELF_STUDY',
    testId: firstPractice.id,
    deliveryId: null,
    durationMinutes: firstPractice.duration,
  };
}

const subjectPerformance = chartData => {
  const totals = { RW: { attempted: 0, correct: 0 }, MATH: { attempted: 0, correct: 0 } };
  for (const item of chartData) {
    const subject = item.subject === 'MATH' ? 'MATH' : 'RW';
    totals[subject].attempted += item.totalQuestions;
    totals[subject].correct += item.correctCount;
  }
  return Object.fromEntries(Object.entries(totals).map(([subject, value]) => [subject, {
    attempted: value.attempted,
    accuracy: value.attempted ? Number(((value.correct / value.attempted) * 100).toFixed(1)) : null,
  }]));
};

const recommendedWeakSubject = (performance, analytics) => {
  if (analytics.summary.questionsAttempted < MIN_RECOMMENDATION_ANSWERS) return null;
  if ((analytics.classificationCoverage.percentage || 0) < MIN_CLASSIFICATION_COVERAGE) return null;
  return Object.entries(performance)
    .filter(([, value]) => value.attempted >= MIN_SUBJECT_ANSWERS && value.accuracy !== null)
    .sort((first, second) => first[1].accuracy - second[1].accuracy)[0]?.[0] || null;
};

async function getOverviewWithDb({ db, userId, now = new Date(), getTodos = classTodoService.getTodos }) {
  const currentUserId = Number.parseInt(userId, 10);
  if (!currentUserId) throw new ApiError(401, { error: 'Sign in to view your overview.' });

  const cutoff = new Date(now);
  cutoff.setUTCDate(cutoff.getUTCDate() - OVERVIEW_DAYS);
  cutoff.setUTCHours(0, 0, 0, 0);

  const [rawSubmissions, doingSubmission, systemTests, savedMistakeCount, vocabularySession, membershipCount, todos, preferences] = await Promise.all([
    db.submission.findMany({
      where: { userId: currentUserId, startedAt: { gte: cutoff } },
      orderBy: { startedAt: 'asc' },
      select: {
        id: true,
        status: true,
        startedAt: true,
        endTime: true,
        test: { select: { id: true, title: true, subject: true } },
        answers: { select: { isCorrect: true, question: { select: { domain: { select: { code: true, name: true, subject: true, sortOrder: true } }, skill: { select: { code: true, name: true, sortOrder: true } } } } } },
      },
    }),
    db.submission.findFirst({
      where: { userId: currentUserId, status: 'DOING' },
      orderBy: { startedAt: 'desc' },
      select: {
        id: true, status: true, startedAt: true, beganAt: true, endTime: true, savedAnswers: true, deliveryId: true,
        test: { select: { id: true, title: true, subject: true, duration: true, sections: { select: { _count: { select: { questions: true } } } } } },
      },
    }),
    db.test.findMany({
      where: { scope: 'SYSTEM', status: 'PUBLISHED' },
      orderBy: { updatedAt: 'desc' },
      take: 12,
      select: {
        id: true, title: true, description: true, duration: true, subject: true, mode: true, updatedAt: true,
        sections: { select: { _count: { select: { questions: true } } } },
        submissions: {
          where: { userId: currentUserId },
          orderBy: { startedAt: 'desc' },
          take: 1,
          select: { status: true, savedAnswers: true, score: true, startedAt: true, beganAt: true, endTime: true },
        },
      },
    }),
    db.errorLog.count({ where: { userId: currentUserId } }),
    db.vocabularyStudySession.findFirst({
      where: { userId: currentUserId, status: 'IN_PROGRESS' },
      orderBy: { startedAt: 'desc' },
      select: { id: true, setId: true, activityId: true, mode: true, totalItems: true, set: { select: { title: true } } },
    }),
    db.class.count({ where: { students: { some: { id: currentUserId } } } }),
    getTodos({ userId: currentUserId, userRole: 'STUDENT' }).catch(error => {
      console.error('Unable to load classroom work for the student overview.', error);
      return null;
    }),
    db.user.findUnique({
      where: { id: currentUserId },
      select: { satTestDate: true, currentSatScore: true, targetSatScore: true },
    }),
  ]);

  const analytics = buildAnalyticsPayload(rawSubmissions, { days: OVERVIEW_DAYS, now });
  const performance = subjectPerformance(analytics.chartData);
  const weakSubject = recommendedWeakSubject(performance, analytics);
  const practice = systemTests
    .map(test => {
      const totalQuestions = questionCount(test);
      const attempt = buildAttemptSummary({ questionCount: totalQuestions, submission: test.submissions[0] });
      return {
        id: test.id,
        title: test.title,
        description: test.description,
        subject: test.subject,
        mode: test.mode,
        duration: test.duration,
        questionCount: totalQuestions,
        attemptStatus: attempt.attemptStatus,
        progress: attempt.progress,
      };
    })
    .sort((first, second) => Number(first.attemptStatus !== 'NOT_STARTED') - Number(second.attemptStatus !== 'NOT_STARTED'))
    .slice(0, 3);

  const classroomAvailable = Array.isArray(todos);
  const classroomTodos = membershipCount > 0 && classroomAvailable ? todos.slice(0, 5) : [];
  const focus = selectFocus({
    todos: classroomTodos,
    doingSubmission,
    vocabularySession,
    completedTests: analytics.summary.completedTests,
    savedMistakeCount,
    weakSubject,
    practice,
  });
  const focusedTodoKey = focus?.todoKey
    || (focus?.deliveryId ? classroomTodos.find(todo => todo.deliveryId === focus.deliveryId)?.key : null);

  return {
    generatedAt: now.toISOString(),
    preferences: {
      satTestDate: preferences?.satTestDate?.toISOString() || null,
      currentScore: preferences?.currentSatScore ?? null,
      targetScore: preferences?.targetSatScore ?? null,
    },
    focus,
    progress: {
      windowDays: OVERVIEW_DAYS,
      overallAccuracy: analytics.summary.questionsAttempted ? analytics.summary.overallAccuracy : null,
      completedTests: analytics.summary.completedTests,
      questionsAnswered: analytics.summary.questionsAttempted,
      rwAccuracy: performance.RW.accuracy,
      mathAccuracy: performance.MATH.accuracy,
      trend: analytics.chartData.slice(-8).map(item => ({
        date: new Date(item.date).toISOString(),
        title: item.testName,
        subject: item.subject,
        accuracy: item.accuracy,
      })),
    },
    practice,
    recentResults: [...rawSubmissions]
      .filter(item => item.status === 'COMPLETED')
      .reverse()
      .slice(0, 5)
      .map(item => {
        const correctCount = item.answers.filter(answer => answer.isCorrect).length;
        const totalQuestions = item.answers.length;
        return {
          submissionId: item.id,
          title: item.test.title,
          subject: item.test.subject,
          correctCount,
          totalQuestions,
          accuracy: totalQuestions ? Math.round((correctCount / totalQuestions) * 100) : 0,
          completedAt: new Date(item.endTime || item.startedAt).toISOString(),
        };
      }),
    review: { savedMistakeCount, href: '/dashboard/error-log' },
    classroom: { available: classroomAvailable, membershipCount, todos: classroomTodos.filter(todo => todo.key !== focusedTodoKey) },
  };
}

exports.getOverview = params => getOverviewWithDb({ ...params, db: prisma });
exports.getOverviewWithDb = getOverviewWithDb;
exports.selectFocus = selectFocus;
exports.recommendedWeakSubject = recommendedWeakSubject;
exports.subjectPerformance = subjectPerformance;
