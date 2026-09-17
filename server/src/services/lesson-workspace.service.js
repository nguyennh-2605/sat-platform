const prisma = require('../config/prisma');
const ApiError = require('../utils/ApiError');
const { canManageProgress, canReadProgress } = require('../utils/progress-access');
const { nextBlockOrder, lessonBlockPhase } = require('./lesson-block.service');

const intId = value => Number.parseInt(value, 10);
const terminalActivityStatus = status => status === 'COMPLETED';
const dateMs = value => value ? new Date(value).getTime() : 0;

const assertLessonAccess = async ({ db = prisma, lessonId, userId, userRole, manage = false }) => {
  const currentUserId = intId(userId);
  const lesson = await db.lesson.findUnique({
    where: { id: String(lessonId) },
    select: {
      id: true,
      status: true,
      scheduledAt: true,
      week: {
        select: {
          status: true,
          availableAt: true,
          class: {
            select: {
              id: true,
              name: true,
              teacherId: true,
              students: { select: { id: true, name: true, email: true } },
            },
          },
        },
      },
    },
  });
  if (!lesson) throw new ApiError(404, { error: 'Lesson not found.' });
  const classroom = lesson.week.class;
  const canManage = canManageProgress({ teacherId: classroom.teacherId, userId: currentUserId, userRole });
  if (manage && !canManage) throw new ApiError(403, { error: 'You do not have permission to manage this lesson.' });
  if (!manage && !canReadProgress({ teacherId: classroom.teacherId, studentIds: classroom.students.map(item => item.id), userId: currentUserId, userRole })) {
    throw new ApiError(403, { error: 'You do not have access to this lesson.' });
  }
  if (!canManage) {
    const now = new Date();
    const lessonVisible = lesson.status === 'PUBLISHED' || (lesson.status === 'SCHEDULED' && lesson.scheduledAt && lesson.scheduledAt <= now);
    const weekVisible = lesson.week.status === 'PUBLISHED' && (!lesson.week.availableAt || lesson.week.availableAt <= now);
    if (!lessonVisible || !weekVisible) throw new ApiError(404, { error: 'Lesson not found.' });
  }
  return { lesson, classroom, canManage, currentUserId };
};

const blockStateForStudent = (block, studentId) => {
  const progress = block.progress.find(item => item.studentId === studentId) || null;
  if (block.kind === 'TEXT') {
    return {
      visible: true,
      started: Boolean(progress),
      completed: Boolean(progress?.completedAt),
      lastActiveAt: progress?.lastOpenedAt || null,
    };
  }
  if (block.kind === 'RESOURCE') {
    const resourceProgress = block.resource?.progress.find(item => item.studentId === studentId) || null;
    return {
      visible: Boolean(block.resource),
      started: Boolean(resourceProgress),
      completed: Boolean(resourceProgress?.completedAt),
      lastActiveAt: resourceProgress?.lastOpenedAt || null,
    };
  }
  const assignee = block.activity?.assignees.find(item => item.studentId === studentId && !item.excusedAt) || null;
  return {
    visible: Boolean(block.activity && assignee),
    started: Boolean(assignee && assignee.status !== 'ASSIGNED'),
    completed: Boolean(assignee && terminalActivityStatus(assignee.status)),
    lastActiveAt: assignee?.completedAt || assignee?.startedAt || null,
  };
};

const progressForStudent = (blocks, studentId) => {
  const visibleBlocks = blocks
    .map(block => ({ block, state: blockStateForStudent(block, studentId) }))
    .filter(item => item.state.visible);
  const required = visibleBlocks.filter(item => item.block.isRequired);
  const completed = required.filter(item => item.state.completed).length;
  const started = visibleBlocks.some(item => item.state.started);
  const lastActiveAt = visibleBlocks.reduce((latest, item) => dateMs(item.state.lastActiveAt) > dateMs(latest) ? item.state.lastActiveAt : latest, null);
  const nextBlock = required.find(item => !item.state.completed)?.block || visibleBlocks.find(item => !item.state.completed)?.block || null;
  return {
    requiredBlocks: required.length,
    completedBlocks: completed,
    percent: required.length ? Math.round((completed / required.length) * 100) : 0,
    status: required.length > 0 && completed === required.length ? 'COMPLETED' : started ? 'IN_PROGRESS' : 'NOT_STARTED',
    lastActiveAt,
    nextBlockId: nextBlock?.id || null,
  };
};

const lessonInclude = {
  week: { select: { id: true, title: true, order: true, class: { select: { id: true, name: true, teacherId: true, students: { select: { id: true, name: true, email: true } } } } } },
  attendance: { select: { records: { select: { studentId: true, status: true } } } },
  progress: { select: { studentId: true, status: true, lastOpenedAt: true, completedAt: true } },
  blocks: {
    orderBy: [{ phase: 'asc' }, { order: 'asc' }, { createdAt: 'asc' }],
    include: {
      progress: { select: { studentId: true, openedAt: true, lastOpenedAt: true, completedAt: true } },
      resource: {
        include: { progress: { select: { studentId: true, openedAt: true, lastOpenedAt: true, completedAt: true, positionSeconds: true } } },
      },
      activity: {
        include: {
          assignees: { select: { studentId: true, status: true, startedAt: true, completedAt: true, bestScore: true, attemptCount: true, excusedAt: true } },
          homework: { select: { assignmentId: true } },
          test: { select: { testDeliveryId: true, testDelivery: { select: { testId: true, test: { select: { title: true, subject: true, mode: true, duration: true, sections: { select: { _count: { select: { questions: true } } } } } } } } } },
          vocabulary: { select: { vocabularySetId: true } },
        },
      },
    },
  },
};

const sanitizeBlock = (block, studentId, canManage) => {
  const state = blockStateForStudent(block, studentId);
  const resource = block.resource ? {
    id: block.resource.id,
    name: block.resource.name,
    url: block.resource.url,
    kind: block.resource.kind,
    provider: block.resource.provider,
    mimeType: block.resource.mimeType,
    durationSeconds: block.resource.durationSeconds,
    fileAssetId: block.resource.fileAssetId,
    progress: canManage ? null : block.resource.progress.find(item => item.studentId === studentId) || null,
  } : null;
  const activity = block.activity ? {
    id: block.activity.id,
    type: block.activity.type,
    title: block.activity.title,
    instructions: block.activity.instructions,
    availableAt: block.activity.availableAt,
    dueAt: block.activity.dueAt,
    homework: block.activity.homework,
    test: block.activity.test ? {
      testDeliveryId: block.activity.test.testDeliveryId,
      testId: block.activity.test.testDelivery.testId,
      title: block.activity.test.testDelivery.test.title,
      subject: block.activity.test.testDelivery.test.subject,
      mode: block.activity.test.testDelivery.test.mode,
      duration: block.activity.test.testDelivery.test.duration,
      questionCount: block.activity.test.testDelivery.test.sections.reduce((sum, section) => sum + section._count.questions, 0),
    } : null,
    vocabularySetId: block.activity.vocabulary?.vocabularySetId || null,
    assignee: canManage ? null : block.activity.assignees.find(item => item.studentId === studentId && !item.excusedAt) || null,
  } : null;
  return {
    id: block.id,
    kind: block.kind,
    phase: block.phase,
    order: block.order,
    title: block.title,
    body: block.body,
    isRequired: block.isRequired,
    state: canManage ? null : state,
    resource,
    activity,
  };
};

const reconcileStudentLessonProgress = async ({ lessonId, studentId, progress }) => {
  const now = new Date();
  await prisma.lessonProgress.upsert({
    where: { lessonId_studentId: { lessonId, studentId } },
    create: {
      lessonId,
      studentId,
      status: progress.status === 'COMPLETED' ? 'COMPLETED' : 'IN_PROGRESS',
      progress: progress.status === 'COMPLETED' ? 100 : Math.max(1, progress.percent),
      startedAt: now,
      lastOpenedAt: now,
      completedAt: progress.status === 'COMPLETED' ? now : null,
    },
    update: {
      status: progress.status === 'COMPLETED' ? 'COMPLETED' : 'IN_PROGRESS',
      progress: progress.status === 'COMPLETED' ? 100 : Math.max(1, progress.percent),
      lastOpenedAt: now,
      ...(progress.status === 'COMPLETED' ? { completedAt: now } : {}),
    },
  });
};

exports.getWorkspace = async ({ lessonId, userId, userRole }) => {
  const access = await assertLessonAccess({ lessonId, userId, userRole });
  const lesson = await prisma.lesson.findUnique({ where: { id: String(lessonId) }, include: lessonInclude });
  const students = lesson.week.class.students;

  if (!access.canManage) {
    const blocks = lesson.blocks.filter(block => {
      if (block.kind === 'ACTIVITY') return blockStateForStudent(block, access.currentUserId).visible && block.activity.status === 'PUBLISHED' && (!block.activity.availableAt || block.activity.availableAt <= new Date());
      if (block.kind === 'RESOURCE') return Boolean(block.resource && (!block.resource.availableAt || block.resource.availableAt <= new Date()));
      return true;
    });
    const studentProgress = progressForStudent(blocks, access.currentUserId);
    await reconcileStudentLessonProgress({ lessonId: lesson.id, studentId: access.currentUserId, progress: studentProgress });
    return {
      canManage: false,
      lesson: { id: lesson.id, title: lesson.title, summary: lesson.summary, durationMinutes: lesson.durationMinutes, scheduledAt: lesson.scheduledAt, week: { id: lesson.week.id, title: lesson.week.title, class: { id: lesson.week.class.id, name: lesson.week.class.name } } },
      blocks: blocks.map(block => sanitizeBlock(block, access.currentUserId, false)),
      progress: studentProgress,
      monitor: null,
    };
  }

  const attendance = new Map((lesson.attendance?.records || []).map(item => [item.studentId, item.status]));
  const studentRows = students.map(student => {
    const derivedProgress = progressForStudent(lesson.blocks, student.id);
    const storedProgress = lesson.progress.find(item => item.studentId === student.id) || null;
    const progress = {
      ...derivedProgress,
      status: derivedProgress.status === 'NOT_STARTED' && storedProgress ? 'IN_PROGRESS' : derivedProgress.status,
      lastActiveAt: dateMs(storedProgress?.lastOpenedAt) > dateMs(derivedProgress.lastActiveAt) ? storedProgress.lastOpenedAt : derivedProgress.lastActiveAt,
    };
    const missingCount = lesson.blocks.filter(block => {
      if (block.kind !== 'ACTIVITY' || !block.activity?.dueAt || block.activity.dueAt >= new Date()) return false;
      const assignee = block.activity.assignees.find(item => item.studentId === student.id && !item.excusedAt);
      return Boolean(assignee && assignee.status !== 'COMPLETED');
    }).length;
    return { ...student, ...progress, missingCount, attendanceStatus: attendance.get(student.id) || null };
  });
  const blockRows = lesson.blocks.map(block => {
    const states = students.map(student => blockStateForStudent(block, student.id)).filter(state => state.visible);
    return {
      id: block.id,
      title: block.title || block.resource?.name || block.activity?.title || 'Untitled block',
      kind: block.kind,
      isRequired: block.isRequired,
      assigned: states.length,
      started: states.filter(state => state.started).length,
      completed: states.filter(state => state.completed).length,
    };
  });
  return {
    canManage: true,
    lesson: { id: lesson.id, title: lesson.title, summary: lesson.summary, durationMinutes: lesson.durationMinutes, scheduledAt: lesson.scheduledAt, week: { id: lesson.week.id, title: lesson.week.title, class: { id: lesson.week.class.id, name: lesson.week.class.name } } },
    blocks: lesson.blocks.map(block => sanitizeBlock(block, access.currentUserId, true)),
    progress: null,
    monitor: {
      summary: {
        assigned: students.length,
        started: studentRows.filter(item => item.status !== 'NOT_STARTED').length,
        completed: studentRows.filter(item => item.status === 'COMPLETED').length,
        needsAttention: studentRows.filter(item => item.missingCount > 0 || (item.status === 'IN_PROGRESS' && item.percent < 50)).length,
      },
      students: studentRows,
      blocks: blockRows,
    },
  };
};

exports.createTextBlock = async ({ lessonId, title, body, isRequired, phase, userId, userRole }) => {
  await assertLessonAccess({ lessonId, userId, userRole, manage: true });
  const normalizedTitle = String(title || '').trim();
  const normalizedBody = String(body || '').trim();
  if (!normalizedTitle || !normalizedBody) throw new ApiError(400, { error: 'Block title and content are required.' });
  if (normalizedTitle.length > 160 || normalizedBody.length > 20_000) throw new ApiError(400, { error: 'Lesson block content is too long.' });
  return prisma.$transaction(async tx => tx.lessonBlock.create({ data: { lessonId: String(lessonId), kind: 'TEXT', phase: lessonBlockPhase(phase), order: await nextBlockOrder(tx, lessonId), title: normalizedTitle, body: normalizedBody, isRequired: Boolean(isRequired) } }));
};

exports.updateBlock = async ({ lessonId, blockId, title, body, isRequired, phase, userId, userRole }) => {
  await assertLessonAccess({ lessonId, userId, userRole, manage: true });
  const block = await prisma.lessonBlock.findFirst({ where: { id: String(blockId), lessonId: String(lessonId) } });
  if (!block) throw new ApiError(404, { error: 'Lesson block not found.' });
  const data = { isRequired: Boolean(isRequired), ...(phase !== undefined ? { phase: lessonBlockPhase(phase) } : {}) };
  if (block.kind === 'TEXT') {
    const normalizedTitle = String(title || '').trim();
    const normalizedBody = String(body || '').trim();
    if (!normalizedTitle || !normalizedBody) throw new ApiError(400, { error: 'Block title and content are required.' });
    if (normalizedTitle.length > 160 || normalizedBody.length > 20_000) throw new ApiError(400, { error: 'Lesson block content is too long.' });
    data.title = normalizedTitle;
    data.body = normalizedBody;
  }
  return prisma.$transaction(async tx => {
    if (block.resourceId) await tx.lessonFile.update({ where: { id: block.resourceId }, data: { isRequired: data.isRequired } });
    return tx.lessonBlock.update({ where: { id: block.id }, data });
  });
};

exports.deleteTextBlock = async ({ lessonId, blockId, userId, userRole }) => {
  await assertLessonAccess({ lessonId, userId, userRole, manage: true });
  const block = await prisma.lessonBlock.findFirst({ where: { id: String(blockId), lessonId: String(lessonId) } });
  if (!block) throw new ApiError(404, { error: 'Lesson block not found.' });
  if (block.kind !== 'TEXT') throw new ApiError(400, { error: 'Delete the original resource or activity instead.' });
  await prisma.lessonBlock.delete({ where: { id: block.id } });
};

exports.reorderBlocks = async ({ lessonId, orderedIds, userId, userRole }) => {
  await assertLessonAccess({ lessonId, userId, userRole, manage: true });
  if (!Array.isArray(orderedIds)) throw new ApiError(400, { error: 'Block order is invalid.' });
  const normalized = orderedIds.map(value => String(value || '').trim());
  if (normalized.some(value => !value) || new Set(normalized).size !== normalized.length) throw new ApiError(400, { error: 'Block order contains invalid IDs.' });
  const blocks = await prisma.lessonBlock.findMany({ where: { lessonId: String(lessonId) }, select: { id: true } });
  const existing = new Set(blocks.map(item => item.id));
  if (normalized.length !== blocks.length || normalized.some(id => !existing.has(id))) throw new ApiError(400, { error: 'Block order must include every lesson block exactly once.' });
  await prisma.$transaction(normalized.map((id, order) => prisma.lessonBlock.update({ where: { id }, data: { order } })));
  return { orderedIds: normalized };
};

exports.updateBlockProgress = async ({ lessonId, blockId, completed, positionSeconds, userId, userRole }) => {
  if (userRole !== 'STUDENT') throw new ApiError(403, { error: 'Only students have lesson progress.' });
  const access = await assertLessonAccess({ lessonId, userId, userRole });
  const block = await prisma.lessonBlock.findFirst({
    where: { id: String(blockId), lessonId: String(lessonId) },
    include: { resource: true, activity: { include: { assignees: { where: { studentId: access.currentUserId, excusedAt: null } } } } },
  });
  if (!block) throw new ApiError(404, { error: 'Lesson block not found.' });
  if (block.kind === 'ACTIVITY') throw new ApiError(400, { error: 'Complete this block through its activity.' });
  const now = new Date();
  await prisma.$transaction(async tx => {
    await tx.lessonBlockProgress.upsert({
      where: { blockId_studentId: { blockId: block.id, studentId: access.currentUserId } },
      create: { blockId: block.id, studentId: access.currentUserId, completedAt: completed ? now : null },
      update: { ...(completed ? { completedAt: now } : {}) },
    });
    if (block.resourceId) {
      await tx.resourceProgress.upsert({
        where: { fileId_studentId: { fileId: block.resourceId, studentId: access.currentUserId } },
        create: { fileId: block.resourceId, studentId: access.currentUserId, completedAt: completed ? now : null, positionSeconds: Math.max(0, Number(positionSeconds) || 0) },
        update: { lastOpenedAt: now, ...(completed ? { completedAt: now } : {}), ...(positionSeconds !== undefined ? { positionSeconds: Math.max(0, Number(positionSeconds) || 0) } : {}) },
      });
    }
  });
  const workspace = await exports.getWorkspace({ lessonId, userId, userRole });
  return workspace.progress;
};

exports._helpers = { blockStateForStudent, progressForStudent };
