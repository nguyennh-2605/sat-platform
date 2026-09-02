const prisma = require('../config/prisma');
const ApiError = require('../utils/ApiError');

const parseUserId = value => Number.parseInt(value, 10);
const stripHtml = value => String(value || '').replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
const questionCount = test => (test?.sections || []).reduce((sum, section) => sum + section._count.questions, 0);
const hasCompletedSubmission = submissions => submissions.some(submission => submission.status === 'COMPLETED');
const firstCompletedByStudent = submissions => {
  const firstByStudent = new Map();
  for (const submission of submissions) {
    if (submission.status === 'COMPLETED' && !firstByStudent.has(submission.userId)) {
      firstByStudent.set(submission.userId, submission);
    }
  }
  return [...firstByStudent.values()];
};

const priorityFor = dueAt => {
  if (!dueAt) return 'NORMAL';
  const remaining = new Date(dueAt).getTime() - Date.now();
  if (remaining < 0) return 'OVERDUE';
  return remaining <= 48 * 60 * 60 * 1000 ? 'DUE_SOON' : 'NORMAL';
};

const sortTodos = items => {
  const rank = { OVERDUE: 0, DUE_SOON: 1, NORMAL: 2 };
  return items.sort((first, second) => {
    const priorityDifference = rank[first.priority] - rank[second.priority];
    if (priorityDifference) return priorityDifference;
    if (first.dueAt && second.dueAt) return new Date(first.dueAt) - new Date(second.dueAt);
    if (first.dueAt) return -1;
    if (second.dueAt) return 1;
    return new Date(second.createdAt) - new Date(first.createdAt);
  }).slice(0, 50);
};

const handledKeysFor = async userId => new Set((await prisma.userTodoState.findMany({
  where: { userId, handledAt: { not: null } },
  select: { itemKey: true },
})).map(item => item.itemKey));

const getTeacherTodos = async userId => {
  const handled = await handledKeysFor(userId);
  const deliveries = await prisma.testDelivery.findMany({
    where: { class: { teacherId: userId }, submissions: { some: { status: 'COMPLETED' } } },
    select: {
      id: true,
      classId: true,
      title: true,
      createdAt: true,
      class: { select: { name: true } },
      test: {
        select: {
          id: true,
          title: true,
          mode: true,
          sections: { select: { _count: { select: { questions: true } } } },
        },
      },
      submissions: {
        where: { status: 'COMPLETED' },
        orderBy: [{ attemptNo: 'asc' }, { endTime: 'asc' }],
        select: {
          id: true,
          userId: true,
          status: true,
          score: true,
          attemptNo: true,
          beganAt: true,
          endTime: true,
          user: { select: { name: true, email: true } },
        },
      },
    },
  });

  const items = [];
  for (const delivery of deliveries) {
    for (const submission of firstCompletedByStudent(delivery.submissions)) {
      const key = `teacher-result:${delivery.id}:${submission.userId}`;
      if (handled.has(key)) continue;
      const totalQuestions = questionCount(delivery.test);
      const durationMs = delivery.test.mode === 'EXAM' && submission.beganAt && submission.endTime
        ? Math.max(0, new Date(submission.endTime) - new Date(submission.beganAt))
        : null;
      items.push({
        key,
        type: 'TEST_RESULT',
        classId: delivery.classId,
        className: delivery.class.name,
        title: `Review ${submission.user.name || submission.user.email}'s result`,
        description: delivery.test.title,
        createdAt: submission.endTime || delivery.createdAt,
        dueAt: null,
        priority: 'NORMAL',
        deliveryId: delivery.id,
        testId: delivery.test.id,
        submissionId: submission.id,
        testMode: delivery.test.mode,
        score: submission.score,
        totalQuestions,
        durationMs,
      });
    }
  }
  return sortTodos(items);
};

const getStudentTodos = async userId => {
  const handled = await handledKeysFor(userId);
  const [announcements, posts, deliveries, vocabularyActivities] = await Promise.all([
    prisma.classAnnouncement.findMany({
      where: { class: { students: { some: { id: userId } } } }, orderBy: { createdAt: 'desc' },
      select: { id: true, title: true, content: true, createdAt: true, classId: true, class: { select: { name: true } } },
    }),
    prisma.assignment.findMany({
      where: { type: { not: 'announcement' }, class: { students: { some: { id: userId } } }, OR: [{ activity: null }, { activity: { activity: { status: 'PUBLISHED', AND: [{ OR: [{ availableAt: null }, { availableAt: { lte: new Date() } }] }], assignees: { some: { studentId: userId, excusedAt: null } } } } }] },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        title: true,
        type: true,
        content: true,
        fileUrls: true,
        links: true,
        testIds: true,
        deadline: true,
        createdAt: true,
        classId: true,
        class: { select: { name: true } },
        submissions: { where: { studentId: userId }, select: { id: true }, take: 1 },
      },
    }),
    prisma.testDelivery.findMany({
      where: {
        status: 'PUBLISHED',
        AND: [{ OR: [{ availableAt: null }, { availableAt: { lte: new Date() } }] }],
        assignees: { some: { studentId: userId, excusedAt: null } },
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        classId: true,
        createdAt: true,
        dueAt: true,
        class: { select: { name: true } },
        test: {
          select: {
            id: true,
            title: true,
            mode: true,
            duration: true,
            sections: { select: { _count: { select: { questions: true } } } },
          },
        },
        submissions: {
          where: { userId },
          orderBy: { attemptNo: 'desc' },
          select: { status: true },
        },
      },
    }),
    prisma.classActivity.findMany({
      where: {
        type: 'VOCABULARY',
        status: 'PUBLISHED',
        AND: [{ OR: [{ availableAt: null }, { availableAt: { lte: new Date() } }] }],
        assignees: { some: { studentId: userId, excusedAt: null } },
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        classId: true,
        title: true,
        instructions: true,
        createdAt: true,
        dueAt: true,
        maxAttempts: true,
        passingScore: true,
        class: { select: { name: true } },
        vocabulary: { select: { vocabularySetId: true, _count: { select: { items: true } } } },
        assignees: { where: { studentId: userId }, select: { status: true, bestScore: true, attemptCount: true }, take: 1 },
      },
    }),
  ]);

  const items = [];
  for (const announcement of announcements) {
    const key = `student-announcement:${announcement.id}`;
    if (handled.has(key)) continue;
    items.push({ key, type: 'ANNOUNCEMENT', classId: announcement.classId, className: announcement.class.name, title: announcement.title,
      description: stripHtml(announcement.content).slice(0, 120) || 'New class announcement', createdAt: announcement.createdAt,
      dueAt: null, priority: 'NORMAL', announcementId: announcement.id });
  }
  for (const post of posts) {
    const key = `student-post:${post.id}`;
    if (post.submissions.length > 0) continue;
    const hasStandaloneWork = Boolean(stripHtml(post.content) || post.fileUrls.length || post.links.length || post.testIds.length === 0);
    if (!hasStandaloneWork) continue;
    items.push({
      key,
      type: 'ASSIGNMENT',
      classId: post.classId,
      className: post.class.name,
      title: post.title,
      description: stripHtml(post.content).slice(0, 120) || 'Class assignment',
      createdAt: post.createdAt,
      dueAt: post.deadline,
      priority: priorityFor(post.deadline),
      assignmentId: post.id,
    });
  }

  for (const delivery of deliveries) {
    if (hasCompletedSubmission(delivery.submissions)) continue;
    const doing = delivery.submissions.some(submission => submission.status === 'DOING');
    items.push({
      key: `student-test:${delivery.id}`,
      type: 'TEST',
      classId: delivery.classId,
      className: delivery.class.name,
      title: delivery.test.title,
      description: `${questionCount(delivery.test)} questions · ${delivery.test.mode === 'EXAM' ? 'Test mode' : 'Practice mode'}`,
      createdAt: delivery.createdAt,
      dueAt: delivery.dueAt,
      priority: priorityFor(delivery.dueAt),
      deliveryId: delivery.id,
      testId: delivery.test.id,
      testMode: delivery.test.mode,
      durationMinutes: delivery.test.duration,
      totalQuestions: questionCount(delivery.test),
      attemptStatus: doing ? 'DOING' : 'NOT_STARTED',
    });
  }

  for (const activity of vocabularyActivities) {
    const assignee = activity.assignees[0];
    if (!assignee || assignee.status === 'COMPLETED') continue;
    items.push({
      key: `student-vocabulary:${activity.id}`,
      type: 'VOCABULARY',
      classId: activity.classId,
      className: activity.class.name,
      title: activity.title,
      description: `${activity.vocabulary?._count.items || 0} words · ${activity.passingScore ? `Pass at ${activity.passingScore}%` : 'Review all cards'}`,
      createdAt: activity.createdAt,
      dueAt: activity.dueAt,
      priority: priorityFor(activity.dueAt),
      activityId: activity.id,
      setId: activity.vocabulary?.vocabularySetId,
      attemptStatus: assignee.status,
      bestScore: assignee.bestScore,
      attemptCount: assignee.attemptCount,
      maxAttempts: activity.maxAttempts,
    });
  }
  return sortTodos(items);
};

exports.getTodos = async ({ userId, userRole }) => {
  const currentUserId = parseUserId(userId);
  if (!currentUserId) throw new ApiError(401, { error: 'Sign in to view To Do items.' });
  return userRole === 'STUDENT' ? getStudentTodos(currentUserId) : getTeacherTodos(currentUserId);
};

exports.acknowledgeTodo = async ({ itemKey, userId, userRole }) => {
  const currentUserId = parseUserId(userId);
  if (!currentUserId) throw new ApiError(401, { error: 'Sign in to update To Do items.' });
  const normalizedKey = String(itemKey || '').trim();
  const todos = await exports.getTodos({ userId: currentUserId, userRole });
  const item = todos.find(todo => todo.key === normalizedKey);
  if (!item || !['ANNOUNCEMENT', 'TEST_RESULT'].includes(item.type)) {
    throw new ApiError(404, { error: 'To Do item not found.' });
  }
  await prisma.userTodoState.upsert({
    where: { userId_itemKey: { userId: currentUserId, itemKey: normalizedKey } },
    update: { handledAt: new Date(), completedAt: new Date() },
    create: { userId: currentUserId, itemKey: normalizedKey, handledAt: new Date(), completedAt: new Date() },
  });
  return { acknowledged: true };
};

exports.priorityFor = priorityFor;
exports.sortTodos = sortTodos;
exports.hasCompletedSubmission = hasCompletedSubmission;
exports.firstCompletedByStudent = firstCompletedByStudent;
