const prisma = require('../config/prisma');
const ApiError = require('../utils/ApiError');
const { sendNotificationToUser } = require('./notification.service');

const intId = value => Number.parseInt(value, 10);

exports.listClassActivities = async ({ classId, userId, userRole }) => {
  const classroom = await prisma.class.findUnique({
    where: { id: String(classId) },
    select: {
      teacherId: true,
      students: { where: { id: intId(userId) }, select: { id: true } },
    },
  });
  if (!classroom) throw new ApiError(404, { error: 'Class not found.' });
  const canManage = userRole === 'ADMIN' || classroom.teacherId === intId(userId);
  if (!canManage && classroom.students.length === 0) {
    throw new ApiError(403, { error: 'You do not have access to this class.' });
  }

  const activities = await prisma.classActivity.findMany({
    where: {
      classId: String(classId),
      type: { in: ['TEST', 'HOMEWORK'] },
      ...(canManage ? {} : {
        status: 'PUBLISHED',
        assignees: { some: { studentId: intId(userId), excusedAt: null } },
      }),
    },
    orderBy: [{ createdAt: 'desc' }],
    select: {
      id: true,
      type: true,
      status: true,
      title: true,
      instructions: true,
      availableAt: true,
      dueAt: true,
      maxAttempts: true,
      scorePolicy: true,
      completionRule: true,
      passingScore: true,
      audience: true,
      createdAt: true,
      updatedAt: true,
      lesson: { select: { id: true, title: true, order: true, week: { select: { id: true, title: true, order: true } } } },
      assignees: canManage
        ? { select: { studentId: true, status: true, assignedAt: true, bestScore: true, attemptCount: true, excusedAt: true } }
        : { where: { studentId: intId(userId) }, select: { studentId: true, status: true, assignedAt: true, bestScore: true, attemptCount: true, excusedAt: true } },
      test: {
        select: {
          testDeliveryId: true,
          testDelivery: {
            select: {
              testId: true,
              test: { select: { title: true, subject: true, mode: true, duration: true, sections: { select: { _count: { select: { questions: true } } } } } },
            },
          },
        },
      },
      vocabulary: { select: { vocabularySetId: true, vocabularySet: { select: { title: true } }, _count: { select: { items: true } } } },
      homework: { select: { assignmentId: true } },
    },
  });

  return activities
    .map(activity => ({
      ...activity,
      assignedAt: activity.assignees.reduce((earliest, assignee) => (
        !earliest || assignee.assignedAt < earliest ? assignee.assignedAt : earliest
      ), null),
    }))
    .sort((left, right) => (right.assignedAt?.getTime() || 0) - (left.assignedAt?.getTime() || 0));
};

const chooseCountedAttempt = (submissions, scorePolicy) => {
  const completed = submissions.filter(item => item.status === 'COMPLETED');
  if (!completed.length) return null;
  if (scorePolicy === 'BEST') {
    return [...completed].sort((left, right) => (right.score || 0) - (left.score || 0) || left.attemptNo - right.attemptNo)[0];
  }
  if (scorePolicy === 'LATEST') {
    return [...completed].sort((left, right) => right.attemptNo - left.attemptNo)[0];
  }
  return [...completed].sort((left, right) => left.attemptNo - right.attemptNo)[0];
};

exports.listClassResults = async ({ classId, userId, userRole }) => {
  const classroom = await prisma.class.findUnique({
    where: { id: String(classId) },
    select: { teacherId: true },
  });
  if (!classroom) throw new ApiError(404, { error: 'Class not found.' });
  if (userRole !== 'ADMIN' && classroom.teacherId !== intId(userId)) {
    throw new ApiError(403, { error: 'Only class staff can view results.' });
  }

  const activities = await prisma.classActivity.findMany({
    where: { classId: String(classId), type: { in: ['TEST', 'HOMEWORK'] } },
    orderBy: [{ createdAt: 'desc' }],
    select: {
      id: true,
      type: true,
      status: true,
      title: true,
      dueAt: true,
      createdAt: true,
      lesson: { select: { id: true, title: true, order: true, week: { select: { id: true, title: true, order: true } } } },
      assignees: { select: { studentId: true, assignedAt: true, excusedAt: true } },
      test: {
        select: {
          testDeliveryId: true,
          testDelivery: {
            select: {
              scorePolicy: true,
              test: { select: { sections: { select: { _count: { select: { questions: true } } } } } },
              submissions: { select: { userId: true, status: true, score: true, attemptNo: true } },
            },
          },
        },
      },
      homework: {
        select: {
          assignmentId: true,
          assignment: { select: { submissions: { select: { studentId: true } } } },
        },
      },
    },
  });

  return activities.map(activity => {
    const activeAssignees = activity.assignees.filter(item => !item.excusedAt);
    const assignedIds = new Set(activeAssignees.map(item => item.studentId));
    const assignedAt = activeAssignees.reduce((earliest, assignee) => (
      !earliest || assignee.assignedAt < earliest ? assignee.assignedAt : earliest
    ), null);
    const base = {
      id: activity.id,
      type: activity.type,
      status: activity.status,
      title: activity.title,
      assignedAt,
      dueAt: activity.dueAt,
      createdAt: activity.createdAt,
      lesson: activity.lesson,
    };

    if (activity.type === 'TEST' && activity.test?.testDelivery) {
      const delivery = activity.test.testDelivery;
      const questionCount = delivery.test.sections.reduce((sum, section) => sum + section._count.questions, 0);
      const counted = activeAssignees.map(assignee => chooseCountedAttempt(
        delivery.submissions.filter(item => item.userId === assignee.studentId),
        delivery.scorePolicy,
      )).filter(Boolean);
      const completedIds = new Set(counted.map(item => item.userId));
      const inProgressIds = new Set(delivery.submissions
        .filter(item => item.status === 'DOING' && assignedIds.has(item.userId) && !completedIds.has(item.userId))
        .map(item => item.userId));
      const scores = counted
        .map(item => questionCount && Number.isFinite(Number(item.score)) ? Math.round((Number(item.score) / questionCount) * 100) : null)
        .filter(Number.isFinite);
      return {
        ...base,
        testResult: {
          deliveryId: activity.test.testDeliveryId,
          assigned: activeAssignees.length,
          completed: completedIds.size,
          inProgress: inProgressIds.size,
          missing: activity.dueAt && activity.dueAt < new Date() ? activeAssignees.length - completedIds.size : 0,
          averageScore: scores.length ? Math.round(scores.reduce((sum, value) => sum + value, 0) / scores.length) : null,
        },
      };
    }

    const submittedIds = new Set((activity.homework?.assignment.submissions || [])
      .filter(item => assignedIds.has(item.studentId))
      .map(item => item.studentId));
    return {
      ...base,
      assignmentResult: {
        assignmentId: activity.homework?.assignmentId || null,
        assigned: activeAssignees.length,
        submitted: submittedIds.size,
        missing: activity.dueAt && activity.dueAt < new Date() ? activeAssignees.length - submittedIds.size : 0,
      },
    };
  });
};

const normalizeDate = (value, fieldName) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new ApiError(400, { error: `${fieldName} is invalid.` });
  return date;
};

const normalizeUrls = (value, fieldName) => {
  if (!Array.isArray(value)) return [];
  if (value.length > 20) throw new ApiError(400, { error: `${fieldName} can contain at most 20 items.` });
  return [...new Set(value.map(item => String(item || '').trim()).filter(Boolean))].map(item => {
    try {
      const url = new URL(item);
      if (!['http:', 'https:'].includes(url.protocol)) throw new Error('protocol');
      return item;
    } catch {
      throw new ApiError(400, { error: `${fieldName} must contain valid http(s) URLs.` });
    }
  });
};

exports.createAssignmentActivity = async ({ classId, lessonId, title, instructions, availableAt, dueAt, fileUrls, links, studentIds, userId, userRole }) => {
  const teacherId = intId(userId);
  const normalizedTitle = String(title || '').trim().replace(/\s+/g, ' ');
  if (!classId || !normalizedTitle) throw new ApiError(400, { error: 'Class and assignment title are required.' });
  if (normalizedTitle.length > 160) throw new ApiError(400, { error: 'Assignment title must be 160 characters or fewer.' });
  const normalizedInstructions = String(instructions || '').trim() || null;
  if (normalizedInstructions && normalizedInstructions.length > 20_000) throw new ApiError(400, { error: 'Assignment instructions are too long.' });
  const startsAt = normalizeDate(availableAt, 'Availability date');
  const deadline = normalizeDate(dueAt, 'Due date');
  if (startsAt && deadline && deadline <= startsAt) throw new ApiError(400, { error: 'Due date must be after the availability date.' });
  const attachmentUrls = normalizeUrls(fileUrls, 'Attachments');
  const externalLinks = normalizeUrls(links, 'Links');

  const result = await prisma.$transaction(async tx => {
    const classroom = await tx.class.findUnique({
      where: { id: String(classId) },
      select: { id: true, name: true, teacherId: true, students: { select: { id: true } } },
    });
    if (!classroom) throw new ApiError(404, { error: 'Class not found.' });
    if (userRole !== 'ADMIN' && classroom.teacherId !== teacherId) throw new ApiError(403, { error: 'You do not have permission to manage this class.' });
    if (lessonId) {
      const lesson = await tx.lesson.findFirst({ where: { id: String(lessonId), week: { classId: classroom.id } }, select: { id: true } });
      if (!lesson) throw new ApiError(400, { error: 'The selected lesson does not belong to this class.' });
    }
    const enrolledIds = new Set(classroom.students.map(student => student.id));
    const requestedIds = Array.isArray(studentIds) ? [...new Set(studentIds.map(intId).filter(Number.isInteger))] : [];
    if (requestedIds.some(id => !enrolledIds.has(id))) throw new ApiError(400, { error: 'One or more selected students are not in this class.' });
    const assigneeIds = requestedIds.length ? requestedIds : [...enrolledIds];
    if (!assigneeIds.length) throw new ApiError(400, { error: 'This class has no students to receive the assignment.' });

    const assignment = await tx.assignment.create({ data: {
      classId: classroom.id, title: normalizedTitle, type: 'assignment', content: normalizedInstructions,
      fileUrls: attachmentUrls, links: externalLinks, deadline,
    } });
    const activity = await tx.classActivity.create({
      data: {
        classId: classroom.id, lessonId: lessonId ? String(lessonId) : null, type: 'HOMEWORK', status: 'PUBLISHED',
        title: normalizedTitle, instructions: normalizedInstructions, availableAt: startsAt, dueAt: deadline,
        maxAttempts: 1, scorePolicy: 'FIRST', completionRule: 'SUBMIT',
        audience: requestedIds.length ? 'SELECTED' : 'ALL_STUDENTS', createdById: teacherId,
        homework: { create: { assignmentId: assignment.id } },
        assignees: { create: assigneeIds.map(studentId => ({ studentId })) },
      },
      include: { homework: true, assignees: { select: { studentId: true, status: true } } },
    });
    return { classroom, assignment, activity, assigneeIds };
  });

  await Promise.all(result.assigneeIds.map(studentId => sendNotificationToUser(
    studentId,
    `New assignment in ${result.classroom.name}: "${result.assignment.title}"`,
    `/dashboard/class/${result.classroom.id}/assignment/${result.assignment.id}`,
  )));
  return result.activity;
};

exports.createHomeworkActivity = exports.createAssignmentActivity;
