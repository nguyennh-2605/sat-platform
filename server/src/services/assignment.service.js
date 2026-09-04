const prisma = require('../config/prisma');
const ApiError = require('../utils/ApiError');
const testDeliveryService = require('./test-delivery.service');
const { sendNotificationToUser } = require('./notification.service');

const userIdNumber = value => Number.parseInt(value, 10);

const canManageAssignment = (assignment, userId, userRole) => userRole === 'ADMIN' || assignment.class.teacherId === userId;

const reviewState = (submission, deadline, now = new Date()) => {
  if (!submission) return deadline && deadline < now ? 'MISSING' : 'NOT_SUBMITTED';
  if (submission.reviewedAt && submission.reviewedAt >= submission.submittedAt) return 'REVIEWED';
  return 'NEEDS_REVIEW';
};

const validateMaxPoints = value => {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  const points = Number(value);
  if (!Number.isFinite(points) || points <= 0 || points > 10000) {
    throw new ApiError(400, { error: 'Maximum points must be between 0 and 10,000.' });
  }
  return points;
};

const summarizeStudentWork = items => items.reduce((counts, item) => {
  counts.assigned += 1;
  if (item.submittedAt) counts.submitted += 1;
  if (item.state === 'NEEDS_REVIEW') counts.needsReview += 1;
  if (item.state === 'REVIEWED') counts.reviewed += 1;
  if (item.state === 'MISSING') counts.missing += 1;
  if (item.state === 'NOT_SUBMITTED') counts.pending += 1;
  return counts;
}, { assigned: 0, submitted: 0, needsReview: 0, reviewed: 0, missing: 0, pending: 0 });

exports._assignmentReviewHelpers = { reviewState, summarizeStudentWork, validateMaxPoints };

exports.deleteAssignment = async ({ assignmentId, userId }) => {
  // 1. Kiểm tra bài tập có tồn tại và lấy thông tin lớp học
  const assignment = await prisma.assignment.findUnique({
    where: { id: assignmentId },
    include: { class: true }
  });

  if (!assignment) {
    throw new ApiError(404, { message: "Không tìm thấy bài tập này!" });
  }

  // 2. Phân quyền: Chỉ Giáo viên của lớp đó mới được xóa
  if (assignment.class.teacherId !== userId) {
    throw new ApiError(403, { message: "Bạn không có quyền xóa bài tập của lớp này!" });
  }

  // 3. Xóa bài tập (Prisma tự động xóa luôn các bài nộp nhờ Cascade)
  await prisma.testDelivery.updateMany({
    where: { sourceAssignmentId: assignmentId },
    data: { status: 'CLOSED' },
  });
  await prisma.assignment.delete({ where: { id: assignmentId } });
};

exports.updateAssignment = async ({ assignmentId, userId, title, content, fileUrls, links, deadline, testIds, maxPoints }) => {
  // 1. Kiểm tra tồn tại và phân quyền
  const assignment = await prisma.assignment.findUnique({
    where: { id: assignmentId },
    include: { class: true }
  });

  if (!assignment) {
    throw new ApiError(404, { message: "Không tìm thấy bài tập!" });
  }

  if (assignment.class.teacherId !== userId) {
    throw new ApiError(403, { message: "Bạn không có quyền chỉnh sửa bài tập này!" });
  }

  // 2. Format lại deadline nếu có (chuyển string thành Date object)
  let formattedDeadline = undefined;
  if (deadline !== undefined) {
    formattedDeadline = deadline ? new Date(deadline) : null;
  }

  // 3. Cập nhật dữ liệu
  const updatedAssignment = await prisma.assignment.update({
    where: { id: assignmentId },
    data: {
      title: title !== undefined ? title : undefined,
      content: content !== undefined ? content : undefined,
      fileUrls: fileUrls !== undefined ? fileUrls : undefined,
      links: links !== undefined ? links : undefined,
      testIds: testIds !== undefined ? testIds : undefined,
      deadline: formattedDeadline,
      maxPoints: validateMaxPoints(maxPoints),
    }
  });
  await prisma.classActivity.updateMany({
    where: { homework: { assignmentId } },
    data: {
      ...(title !== undefined && { title }),
      ...(content !== undefined && { instructions: content }),
      ...(deadline !== undefined && { dueAt: formattedDeadline }),
    },
  });
  await testDeliveryService.syncClassAssignmentDeliveries({
    assignment: updatedAssignment,
    userId,
    userRole: 'TEACHER',
  });
  return updatedAssignment;
};

exports.getAssignmentById = async ({ id, userId, userRole }) => {
  const currentUserId = userIdNumber(userId);

  if (!currentUserId) {
    throw new ApiError(401, { message: "Không tìm thấy thông tin người dùng." });
  }

  const assignment = await prisma.assignment.findUnique({
    where: { id: id },
    include: {
      class: {
        select: {
          teacherId: true,
          students: { select: { id: true, name: true, email: true } }
        }
      },
      submissions: { where: userRole === 'STUDENT' ? { studentId: currentUserId } : undefined, orderBy: { submittedAt: 'desc' } },
      activity: { include: { activity: { select: { status: true, availableAt: true, dueAt: true, lesson: { select: { id: true, title: true, order: true, week: { select: { id: true, title: true, order: true } } } }, assignees: { where: { excusedAt: null }, select: { studentId: true } } } } } }
    }
  });

  if (!assignment) {
    throw new ApiError(404, { message: "Không tìm thấy bài tập" });
  }

  const isTeacher = assignment.class.teacherId === currentUserId;
  const enrolledStudent = assignment.class.students.some(student => student.id === currentUserId);
  const activityAvailable = !assignment.activity || (assignment.activity.activity.status === 'PUBLISHED'
    && (!assignment.activity.activity.availableAt || assignment.activity.activity.availableAt <= new Date())
    && assignment.activity.activity.assignees.some(assignee => assignee.studentId === currentUserId));
  const isStudent = enrolledStudent && activityAvailable;

  if (userRole !== 'ADMIN' && !isTeacher && !isStudent) {
    throw new ApiError(403, { message: "Bạn không có quyền xem bài tập này!" });
  }

  const selectedTests = assignment.testIds.length > 0
    ? await prisma.test.findMany({
        where: { id: { in: assignment.testIds } },
        include: {
          sections: {
            select: { _count: { select: { questions: true } } }
          }
        }
      })
    : [];
  const deliveries = assignment.testIds.length > 0
    ? await prisma.testDelivery.findMany({
        where: { sourceAssignmentId: assignment.id, status: 'PUBLISHED' },
        select: { id: true, testId: true },
      })
    : [];
  const deliveryByTestId = new Map(deliveries.map(delivery => [delivery.testId, delivery.id]));

  const formattedSelectedTests = selectedTests.map(test => ({
    id: test.id,
    title: test.title,
    subject: test.subject,
    mode: test.mode,
    duration: test.duration,
    folderId: test.folderId,
    questionCount: test.sections.reduce((sum, section) => {
      return sum + section._count.questions;
    }, 0),
    deliveryId: deliveryByTestId.get(test.id) || null,
  }));

  const assignmentData = { ...assignment };
  delete assignmentData.class;
  delete assignmentData.submissions;
  delete assignmentData.activity;
  const canManage = userRole === 'ADMIN' || isTeacher;
  const activity = assignment.activity?.activity || null;
  const deadline = activity?.dueAt || assignment.deadline;
  const submission = assignment.submissions.find(item => item.studentId === currentUserId) || null;

  return {
    ...assignmentData,
    selectedTests: formattedSelectedTests,
    activity: activity ? { status: activity.status, availableAt: activity.availableAt, dueAt: activity.dueAt, lesson: activity.lesson } : null,
    ...(canManage ? {} : {
      mySubmission: submission ? { ...submission, reviewState: reviewState(submission, deadline) } : null,
      submissionState: reviewState(submission, deadline),
    }),
  };
};

exports.listStudentWork = async ({ assignmentId, userId, userRole, search, status, cursor, limit }) => {
  const currentUserId = userIdNumber(userId);
  const assignment = await prisma.assignment.findUnique({
    where: { id: assignmentId },
    include: {
      class: { select: { teacherId: true, students: { select: { id: true, name: true, email: true } } } },
      submissions: true,
      activity: { include: { activity: { select: { dueAt: true, assignees: { where: { excusedAt: null }, select: { studentId: true } } } } } },
    },
  });
  if (!assignment) throw new ApiError(404, { error: 'Assignment not found.' });
  if (!canManageAssignment(assignment, currentUserId, userRole)) throw new ApiError(403, { error: 'Only class staff can review student work.' });

  const assignedIds = assignment.activity
    ? new Set(assignment.activity.activity.assignees.map(item => item.studentId))
    : new Set(assignment.class.students.map(item => item.id));
  const submissionByStudent = new Map(assignment.submissions.map(item => [item.studentId, item]));
  const deadline = assignment.activity?.activity.dueAt || assignment.deadline;
  const allItems = assignment.class.students.filter(student => assignedIds.has(student.id)).map(student => {
    const submission = submissionByStudent.get(student.id) || null;
    return {
      student,
      state: reviewState(submission, deadline),
      submittedAt: submission?.submittedAt || null,
      reviewedAt: submission?.reviewedAt || null,
      score: submission?.score ?? null,
    };
  });
  const summary = summarizeStudentWork(allItems);

  const normalizedSearch = String(search || '').trim().toLowerCase();
  const normalizedStatus = String(status || 'ALL').toUpperCase();
  const allowedStatuses = new Set(['ALL', 'NEEDS_REVIEW', 'REVIEWED', 'MISSING', 'NOT_SUBMITTED']);
  if (!allowedStatuses.has(normalizedStatus)) throw new ApiError(400, { error: 'Invalid student work status.' });
  const priorities = { NEEDS_REVIEW: 0, MISSING: 1, REVIEWED: 2, NOT_SUBMITTED: 3 };
  const filtered = allItems.filter(item => {
    if (normalizedStatus !== 'ALL' && item.state !== normalizedStatus) return false;
    if (!normalizedSearch) return true;
    return `${item.student.name || ''} ${item.student.email}`.toLowerCase().includes(normalizedSearch);
  }).sort((left, right) => priorities[left.state] - priorities[right.state]
    || new Date(right.submittedAt || 0).getTime() - new Date(left.submittedAt || 0).getTime()
    || left.student.id - right.student.id);

  const pageSize = Math.min(100, Math.max(1, Number.parseInt(limit, 10) || 50));
  const cursorIndex = cursor ? filtered.findIndex(item => String(item.student.id) === String(cursor)) : -1;
  const start = cursorIndex >= 0 ? cursorIndex + 1 : 0;
  const items = filtered.slice(start, start + pageSize);
  return {
    summary,
    items,
    nextCursor: start + pageSize < filtered.length ? String(items.at(-1).student.id) : null,
  };
};

exports.getStudentWork = async ({ assignmentId, studentId, userId, userRole }) => {
  const currentUserId = userIdNumber(userId);
  const targetStudentId = userIdNumber(studentId);
  const assignment = await prisma.assignment.findUnique({
    where: { id: assignmentId },
    include: {
      class: { select: { teacherId: true, students: { where: { id: targetStudentId }, select: { id: true, name: true, email: true } } } },
      submissions: { where: { studentId: targetStudentId }, take: 1 },
      activity: { include: { activity: { select: { dueAt: true, assignees: { where: { studentId: targetStudentId, excusedAt: null }, select: { studentId: true } } } } } },
    },
  });
  if (!assignment) throw new ApiError(404, { error: 'Assignment not found.' });
  if (!canManageAssignment(assignment, currentUserId, userRole)) throw new ApiError(403, { error: 'Only class staff can review student work.' });
  const student = assignment.class.students[0];
  const isAssigned = student && (!assignment.activity || assignment.activity.activity.assignees.length > 0);
  if (!isAssigned) throw new ApiError(404, { error: 'Assigned student not found.' });
  const submission = assignment.submissions[0] || null;
  const deadline = assignment.activity?.activity.dueAt || assignment.deadline;
  return { student, submission, state: reviewState(submission, deadline), maxPoints: assignment.maxPoints };
};

exports.reviewStudentWork = async ({ assignmentId, studentId, userId, userRole, score, feedback }) => {
  const currentUserId = userIdNumber(userId);
  const targetStudentId = userIdNumber(studentId);
  const assignment = await prisma.assignment.findUnique({ where: { id: assignmentId }, include: { class: { select: { teacherId: true } } } });
  if (!assignment) throw new ApiError(404, { error: 'Assignment not found.' });
  if (!canManageAssignment(assignment, currentUserId, userRole)) throw new ApiError(403, { error: 'Only class staff can review student work.' });
  const submission = await prisma.homeworkSubmission.findUnique({ where: { studentId_assignmentId: { studentId: targetStudentId, assignmentId } } });
  if (!submission) throw new ApiError(404, { error: 'This student has not submitted work.' });

  let normalizedScore;
  if (score === undefined || score === null || score === '') normalizedScore = null;
  else {
    normalizedScore = Number(score);
    if (!assignment.maxPoints) throw new ApiError(400, { error: 'This assignment is configured for feedback only.' });
    if (!Number.isFinite(normalizedScore) || normalizedScore < 0 || normalizedScore > assignment.maxPoints) {
      throw new ApiError(400, { error: `Score must be between 0 and ${assignment.maxPoints}.` });
    }
  }
  const normalizedFeedback = String(feedback || '').trim() || null;
  if (normalizedFeedback && normalizedFeedback.length > 10000) throw new ApiError(400, { error: 'Feedback must be 10,000 characters or fewer.' });

  const updated = await prisma.homeworkSubmission.update({
    where: { id: submission.id },
    data: { score: normalizedScore, feedback: normalizedFeedback, reviewedAt: new Date(), status: 'REVIEWED' },
  });
  await sendNotificationToUser(targetStudentId, `Your teacher reviewed “${assignment.title}”.`, `/dashboard/class/${assignment.classId}/assignment/${assignment.id}`);
  return { ...updated, reviewState: 'REVIEWED' };
};

exports.upsertSubmission = async ({ assignmentId, textResponse, fileUrl, studentId }) => {
  const currentStudentId = userIdNumber(studentId);
  if (!currentStudentId) throw new ApiError(401, { error: 'Student information is unavailable.' });
  const text = String(textResponse || '').trim() || null;
  const link = String(fileUrl || '').trim() || null;
  if (!text && !link) throw new ApiError(400, { error: 'Enter a response or submission link.' });
  if (link) {
    try {
      const parsed = new URL(link);
      if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('protocol');
    } catch {
      throw new ApiError(400, { error: 'Submission link must be a valid http(s) URL.' });
    }
  }

  const assignment = await prisma.assignment.findUnique({
    where: { id: assignmentId },
    include: {
      activity: { include: { activity: { include: { assignees: { where: { studentId: currentStudentId, excusedAt: null }, select: { studentId: true }, take: 1 } } } } },
      class: { include: { students: { where: { id: currentStudentId }, select: { id: true } } } },
    },
  });
  if (!assignment) throw new ApiError(404, { error: 'Assignment not found.' });
  const activity = assignment.activity?.activity || null;
  const now = new Date();
  const deadline = activity?.dueAt || assignment.deadline;
  const assigned = !activity || activity.assignees.length > 0;
  if (!assignment.class.students.length || !assigned) throw new ApiError(403, { error: 'You are not assigned this work.' });
  if (activity && (activity.status !== 'PUBLISHED' || (activity.availableAt && activity.availableAt > now))) throw new ApiError(409, { error: 'This assignment is not available.' });
  if (deadline && deadline < now) throw new ApiError(409, { error: 'The submission deadline has passed.' });

  const submission = await prisma.homeworkSubmission.upsert({
    where: { studentId_assignmentId: { studentId: currentStudentId, assignmentId } },
    update: { textResponse: text, fileUrl: link, submittedAt: now, status: 'SUBMITTED' },
    create: { studentId: currentStudentId, assignmentId, textResponse: text, fileUrl: link, status: 'SUBMITTED' },
  });
  if (activity) {
    await prisma.activityAssignee.updateMany({
      where: { activityId: activity.id, studentId: currentStudentId },
      data: { status: 'COMPLETED', startedAt: submission.submittedAt, completedAt: submission.submittedAt, attemptCount: { increment: 1 } },
    });
  }
  const student = await prisma.user.findUnique({ where: { id: currentStudentId }, select: { name: true, email: true } });
  await sendNotificationToUser(assignment.class.teacherId, `${student?.name || student?.email || 'A student'} submitted “${assignment.title}”.`, `/dashboard/class/${assignment.classId}/assignment/${assignment.id}?view=student-work`);
  return { ...submission, reviewState: reviewState(submission, deadline) };
};
