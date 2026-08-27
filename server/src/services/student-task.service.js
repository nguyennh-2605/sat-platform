const prisma = require('../config/prisma');
const ApiError = require('../utils/ApiError');
const { PLATFORM_TIME_ZONE, PLATFORM_UTC_OFFSET_MINUTES } = require('../config/platform-time');

const MAX_TASKS = 120;
const validViews = new Set(['TODAY', 'TOMORROW', 'WEEK', 'COMPLETED', 'DATE']);
const parseUserId = value => Number.parseInt(value, 10);
const stripHtml = value => String(value || '').replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
const questionCount = test => (test?.sections || []).reduce((sum, section) => sum + section._count.questions, 0);
const DAY_MS = 24 * 60 * 60 * 1000;
const dateKeyFormatter = new Intl.DateTimeFormat('en-CA', { timeZone: PLATFORM_TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' });
const platformDayStart = date => {
  const shifted = new Date(date.getTime() + PLATFORM_UTC_OFFSET_MINUTES * 60_000);
  return new Date(Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate()) - PLATFORM_UTC_OFFSET_MINUTES * 60_000);
};

const assertStudent = role => {
  if (role !== 'STUDENT') throw new ApiError(403, { error: 'Student tasks are available to students only.' });
};

const normalizedTitle = value => {
  const title = String(value || '').trim().replace(/\s+/g, ' ');
  if (!title) throw new ApiError(400, { error: 'Task title is required.' });
  if (title.length > 160) throw new ApiError(400, { error: 'Task title must be 160 characters or fewer.' });
  return title;
};

const normalizedDetails = value => {
  const details = String(value || '').trim();
  if (details.length > 1000) throw new ApiError(400, { error: 'Task details must be 1,000 characters or fewer.' });
  return details || null;
};

const normalizedDueAt = value => {
  if (value === null || value === undefined || value === '') return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new ApiError(400, { error: 'Choose a valid task date.' });
  return date;
};

const priorityFor = dueAt => {
  if (!dueAt) return 'NORMAL';
  const remaining = new Date(dueAt).getTime() - Date.now();
  if (remaining < 0) return 'OVERDUE';
  return remaining <= 48 * 60 * 60 * 1000 ? 'DUE_SOON' : 'NORMAL';
};

const taskHref = item => {
  if (item.type === 'VOCABULARY') return `/dashboard/vocabulary?activity=${item.activityId}`;
  if (item.type === 'TEST') return `/test/${item.testId}?deliveryId=${item.deliveryId}`;
  return `/dashboard/class/${item.classId}/assignment/${item.assignmentId}`;
};

const sortTasks = tasks => {
  const rank = { OVERDUE: 0, DUE_SOON: 1, NORMAL: 2 };
  return tasks.sort((first, second) => {
    if (first.completed !== second.completed) return Number(first.completed) - Number(second.completed);
    const firstPosition = first.position ?? Number.MAX_SAFE_INTEGER;
    const secondPosition = second.position ?? Number.MAX_SAFE_INTEGER;
    if (firstPosition !== secondPosition) return firstPosition - secondPosition;
    if (rank[first.priority] !== rank[second.priority]) return rank[first.priority] - rank[second.priority];
    if (first.dueAt && second.dueAt) return new Date(first.dueAt) - new Date(second.dueAt);
    if (first.dueAt) return -1;
    if (second.dueAt) return 1;
    return new Date(second.createdAt) - new Date(first.createdAt);
  });
};

const calendarDate = task => task.dueAt || (task.type === 'ANNOUNCEMENT' ? task.createdAt : null);

const calendarMarkers = tasks => {
  const byDate = new Map();
  for (const task of tasks) {
    const value = calendarDate(task);
    if (!value) continue;
    const date = dateKeyFormatter.format(new Date(value));
    const current = byDate.get(date) || { date, total: 0, incomplete: 0, hasDeadline: false };
    current.total += 1;
    if (!task.completed) current.incomplete += 1;
    if (task.dueAt) current.hasDeadline = true;
    byDate.set(date, current);
  }
  return [...byDate.values()].sort((first, second) => first.date.localeCompare(second.date));
};

const taskSummary = (tasks, now = new Date()) => {
  const today = platformDayStart(now);
  const tomorrow = new Date(today.getTime() + DAY_MS);
  const weekEnd = new Date(today.getTime() + 7 * DAY_MS);
  const isTodayTask = task => {
    if (task.completed) return false;
    if (!task.dueAt) return task.source === 'PERSONAL' || task.type === 'ANNOUNCEMENT';
    return new Date(task.dueAt) < tomorrow;
  };
  const weekTasks = tasks.filter(task => {
    const value = calendarDate(task);
    return value && new Date(value) >= today && new Date(value) < weekEnd;
  });
  const weekCompleted = weekTasks.filter(task => task.completed).length;
  return {
    todayRemaining: tasks.filter(isTodayTask).length,
    weekCompleted,
    weekTotal: weekTasks.length,
    weekPercentage: weekTasks.length ? Math.round((weekCompleted / weekTasks.length) * 100) : 0,
  };
};

async function loadTaskSources({ db, userId }) {
  const [personal, states, posts, deliveries, vocabularyActivities] = await Promise.all([
    db.studentTask.findMany({ where: { userId }, orderBy: [{ position: 'asc' }, { createdAt: 'desc' }], take: MAX_TASKS }),
    db.userTodoState.findMany({ where: { userId }, select: { itemKey: true, handledAt: true, completedAt: true, position: true } }),
    db.assignment.findMany({
      where: { class: { students: { some: { id: userId } } } },
      orderBy: { createdAt: 'desc' },
      take: MAX_TASKS,
      select: {
        id: true, title: true, type: true, content: true, deadline: true, createdAt: true, classId: true,
        class: { select: { name: true } },
        submissions: { where: { studentId: userId }, select: { submittedAt: true }, take: 1 },
      },
    }),
    db.testDelivery.findMany({
      where: { status: 'PUBLISHED', assignees: { some: { studentId: userId, excusedAt: null } } },
      orderBy: { createdAt: 'desc' },
      take: MAX_TASKS,
      select: {
        id: true, classId: true, createdAt: true, dueAt: true,
        class: { select: { name: true } },
        test: { select: { id: true, title: true, mode: true, duration: true, sections: { select: { _count: { select: { questions: true } } } } } },
        submissions: { where: { userId }, orderBy: { startedAt: 'desc' }, select: { status: true, endTime: true }, take: 10 },
      },
    }),
    db.classActivity.findMany({
      where: { type: 'VOCABULARY', status: 'PUBLISHED', assignees: { some: { studentId: userId, excusedAt: null } } },
      orderBy: { createdAt: 'desc' },
      take: MAX_TASKS,
      select: {
        id: true, classId: true, title: true, instructions: true, createdAt: true, dueAt: true,
        class: { select: { name: true } },
        vocabulary: { select: { vocabularySetId: true, _count: { select: { items: true } } } },
        assignees: { where: { studentId: userId }, select: { status: true, completedAt: true }, take: 1 },
      },
    }),
  ]);
  return { personal, states, posts, deliveries, vocabularyActivities };
}

async function getTasksWithDb({ db, userId, userRole, now = new Date() }) {
  assertStudent(userRole);
  const currentUserId = parseUserId(userId);
  if (!currentUserId) throw new ApiError(401, { error: 'Sign in to view tasks.' });
  const { personal, states, posts, deliveries, vocabularyActivities } = await loadTaskSources({ db, userId: currentUserId });
  const stateByKey = new Map(states.map(state => [state.itemKey, state]));
  const tasks = [];

  for (const task of personal) {
    const key = `personal:${task.id}`;
    const state = stateByKey.get(key);
    tasks.push({
      key, id: task.id, source: 'PERSONAL', type: 'PERSONAL', title: task.title, description: task.details,
      className: null, classId: null, assignmentId: null, activityId: null, testId: null, deliveryId: null, durationMinutes: null,
      createdAt: task.createdAt, dueAt: task.dueAt, completedAt: task.completedAt,
      completed: Boolean(task.completedAt), completionMode: 'USER', priority: task.completedAt ? 'NORMAL' : priorityFor(task.dueAt),
      position: state?.position ?? task.position, href: null, canEdit: true, canDelete: true, canComplete: true,
    });
  }

  for (const post of posts) {
    const announcement = post.type === 'announcement';
    const key = `student-post:${post.id}`;
    const state = stateByKey.get(key);
    const submittedAt = post.submissions[0]?.submittedAt || null;
    const completedAt = announcement ? (state?.completedAt || state?.handledAt || null) : submittedAt;
    tasks.push({
      key, id: post.id, source: 'CLASSROOM', type: announcement ? 'ANNOUNCEMENT' : 'ASSIGNMENT', title: post.title,
      description: stripHtml(post.content).slice(0, 160) || (announcement ? 'Class announcement' : 'Class assignment'),
      className: post.class.name, classId: post.classId, assignmentId: post.id, createdAt: post.createdAt, dueAt: post.deadline,
      activityId: null, testId: null, deliveryId: null, durationMinutes: null,
      completedAt, completed: Boolean(completedAt), completionMode: announcement ? 'USER' : 'SOURCE',
      priority: completedAt || announcement ? 'NORMAL' : priorityFor(post.deadline), position: state?.position ?? null,
      href: taskHref({ type: announcement ? 'ANNOUNCEMENT' : 'ASSIGNMENT', classId: post.classId, assignmentId: post.id }),
      canEdit: false, canDelete: false, canComplete: announcement,
    });
  }

  for (const delivery of deliveries) {
    const key = `student-test:${delivery.id}`;
    const state = stateByKey.get(key);
    const completedSubmission = delivery.submissions.find(submission => submission.status === 'COMPLETED');
    const totalQuestions = questionCount(delivery.test);
    tasks.push({
      key, id: delivery.id, source: 'CLASSROOM', type: 'TEST', title: delivery.test.title,
      description: `${totalQuestions} questions · ${delivery.test.mode === 'EXAM' ? 'Test mode' : 'Practice mode'}`,
      className: delivery.class.name, classId: delivery.classId, testId: delivery.test.id, deliveryId: delivery.id,
      assignmentId: null, activityId: null,
      durationMinutes: delivery.test.duration, createdAt: delivery.createdAt, dueAt: delivery.dueAt,
      completedAt: completedSubmission?.endTime || null, completed: Boolean(completedSubmission), completionMode: 'SOURCE',
      priority: completedSubmission ? 'NORMAL' : priorityFor(delivery.dueAt), position: state?.position ?? null,
      href: taskHref({ type: 'TEST', testId: delivery.test.id, deliveryId: delivery.id }),
      canEdit: false, canDelete: false, canComplete: false,
    });
  }

  for (const activity of vocabularyActivities) {
    const key = `student-vocabulary:${activity.id}`;
    const state = stateByKey.get(key);
    const assignee = activity.assignees[0];
    const completed = assignee?.status === 'COMPLETED';
    tasks.push({
      key, id: activity.id, source: 'CLASSROOM', type: 'VOCABULARY', title: activity.title,
      description: `${activity.vocabulary?._count.items || 0} words${activity.instructions ? ` · ${stripHtml(activity.instructions).slice(0, 100)}` : ''}`,
      className: activity.class.name, classId: activity.classId, activityId: activity.id,
      assignmentId: null, testId: null, deliveryId: null, durationMinutes: null,
      createdAt: activity.createdAt, dueAt: activity.dueAt, completedAt: assignee?.completedAt || null,
      completed, completionMode: 'SOURCE', priority: completed ? 'NORMAL' : priorityFor(activity.dueAt),
      position: state?.position ?? null, href: taskHref({ type: 'VOCABULARY', activityId: activity.id }),
      canEdit: false, canDelete: false, canComplete: false,
    });
  }

  const ordered = sortTasks(tasks).slice(0, MAX_TASKS);
  return { items: ordered, summary: taskSummary(ordered, now), calendar: calendarMarkers(ordered), views: [...validViews] };
}

exports.getTasks = params => getTasksWithDb({ ...params, db: prisma });

exports.createTask = async ({ userId, userRole, data }) => {
  assertStudent(userRole);
  const currentUserId = parseUserId(userId);
  const last = await prisma.studentTask.findFirst({ where: { userId: currentUserId }, orderBy: { position: 'desc' }, select: { position: true } });
  return prisma.studentTask.create({
    data: { userId: currentUserId, title: normalizedTitle(data?.title), details: normalizedDetails(data?.details), dueAt: normalizedDueAt(data?.dueAt), position: (last?.position || 0) + 1 },
  });
};

exports.updateTask = async ({ taskId, userId, userRole, data }) => {
  assertStudent(userRole);
  const currentUserId = parseUserId(userId);
  const existing = await prisma.studentTask.findFirst({ where: { id: String(taskId), userId: currentUserId } });
  if (!existing) throw new ApiError(404, { error: 'Task not found.' });
  return prisma.studentTask.update({
    where: { id: existing.id },
    data: {
      ...(data?.title !== undefined && { title: normalizedTitle(data.title) }),
      ...(data?.details !== undefined && { details: normalizedDetails(data.details) }),
      ...(data?.dueAt !== undefined && { dueAt: normalizedDueAt(data.dueAt) }),
      ...(data?.completed !== undefined && { completedAt: data.completed ? new Date() : null }),
    },
  });
};

exports.deleteTask = async ({ taskId, userId, userRole }) => {
  assertStudent(userRole);
  const result = await prisma.studentTask.deleteMany({ where: { id: String(taskId), userId: parseUserId(userId) } });
  if (!result.count) throw new ApiError(404, { error: 'Task not found.' });
  return { deleted: true };
};

exports.updateTaskState = async ({ itemKey, completed, userId, userRole }) => {
  assertStudent(userRole);
  const currentUserId = parseUserId(userId);
  const key = String(itemKey || '').trim();
  if (key.startsWith('personal:')) {
    return exports.updateTask({ taskId: key.slice('personal:'.length), userId: currentUserId, userRole, data: { completed } });
  }
  if (!key.startsWith('student-post:')) throw new ApiError(400, { error: 'Complete this coursework from its learning activity.' });
  const assignmentId = key.slice('student-post:'.length);
  const announcement = await prisma.assignment.findFirst({
    where: { id: assignmentId, type: 'announcement', class: { students: { some: { id: currentUserId } } } },
    select: { id: true },
  });
  if (!announcement) throw new ApiError(404, { error: 'Announcement not found.' });
  const completedAt = completed ? new Date() : null;
  await prisma.userTodoState.upsert({
    where: { userId_itemKey: { userId: currentUserId, itemKey: key } },
    update: { completedAt, handledAt: completedAt },
    create: { userId: currentUserId, itemKey: key, completedAt, handledAt: completedAt },
  });
  return { itemKey: key, completed: Boolean(completedAt), completedAt };
};

exports.reorderTasks = async ({ orderedKeys, userId, userRole }) => {
  assertStudent(userRole);
  const currentUserId = parseUserId(userId);
  if (!Array.isArray(orderedKeys) || orderedKeys.length === 0 || orderedKeys.length > MAX_TASKS || new Set(orderedKeys).size !== orderedKeys.length) {
    throw new ApiError(400, { error: 'Choose a valid task order.' });
  }
  const available = await exports.getTasks({ userId: currentUserId, userRole });
  const availableKeys = new Set(available.items.map(item => item.key));
  if (orderedKeys.some(key => !availableKeys.has(String(key)))) throw new ApiError(403, { error: 'Task order contains an unavailable item.' });
  await prisma.$transaction(orderedKeys.map((itemKey, index) => prisma.userTodoState.upsert({
    where: { userId_itemKey: { userId: currentUserId, itemKey: String(itemKey) } },
    update: { position: index + 1 },
    create: { userId: currentUserId, itemKey: String(itemKey), position: index + 1 },
  })));
  return { orderedKeys: orderedKeys.map(String) };
};

exports.getTasksWithDb = getTasksWithDb;
exports.priorityFor = priorityFor;
exports.sortTasks = sortTasks;
exports.taskSummary = taskSummary;
exports.normalizedTitle = normalizedTitle;
exports.normalizedDueAt = normalizedDueAt;
