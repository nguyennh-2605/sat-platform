const prisma = require('../config/prisma');
const { Prisma } = require('@prisma/client');
const ApiError = require('../utils/ApiError');
const testDeliveryService = require('./test-delivery.service');
const { sendNotificationToUser } = require('./notification.service');

const userIdNumber = value => Number.parseInt(value, 10);
const MAX_SUBMISSION_ITEMS = 10;
const MAX_SUBMISSION_FILE_BYTES = 100 * 1024 * 1024;
const MAX_RESPONSE_LENGTH = 50000;

const contentInclude = {
  items: { orderBy: [{ order: 'asc' }, { createdAt: 'asc' }], include: { fileAsset: true } },
};
const submissionInclude = { contents: { include: contentInclude } };

const normalizeText = value => String(value || '').trim() || null;
const normalizeDisplayName = value => String(value || '').trim().slice(0, 255) || null;
const normalizeExternalUrl = value => {
  const url = String(value || '').trim();
  try {
    const parsed = new URL(url);
    if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('protocol');
    if (url.length > 2048) throw new Error('length');
    return url;
  } catch {
    throw new ApiError(400, { error: 'Submission link must be a valid http(s) URL.' });
  }
};

const serializeItem = item => ({
  id: item.id,
  kind: item.kind,
  displayName: item.displayName,
  externalUrl: item.kind === 'LINK' ? item.externalUrl : null,
  fileAsset: item.fileAsset ? {
    id: item.fileAsset.id,
    name: item.fileAsset.originalName,
    mimeType: item.fileAsset.mimeType,
    sizeBytes: item.fileAsset.sizeBytes,
    status: item.fileAsset.status,
  } : null,
  order: item.order,
});

const serializeContent = content => content ? ({
  id: content.id,
  slot: content.slot,
  textResponse: content.textResponse,
  version: content.version,
  updatedAt: content.updatedAt,
  items: content.items.map(serializeItem),
}) : null;

const officialContent = submission => submission?.contents?.find(content => content.slot === 'SUBMITTED') || null;
const draftContent = submission => submission?.contents?.find(content => content.slot === 'DRAFT') || null;
const officialSubmission = submission => officialContent(submission) && submission.submittedAt ? submission : null;
const serializeSubmission = (submission, { includeDraft = true } = {}) => {
  if (!submission) return null;
  const submitted = officialContent(submission);
  const draft = draftContent(submission);
  const legacyLink = submitted?.items.find(item => item.kind === 'LINK')?.externalUrl || null;
  return {
    id: submission.id,
    submittedAt: submission.submittedAt,
    reviewedAt: submission.reviewedAt,
    score: submission.score,
    feedback: submission.feedback,
    submittedContent: serializeContent(submitted),
    draftContent: includeDraft ? serializeContent(draft) : null,
    textResponse: submitted?.textResponse || null,
    fileUrl: legacyLink,
  };
};

const getStudentAssignmentAccess = async (db, assignmentId, studentId, { enforceDeadline = true } = {}) => {
  const assignment = await db.assignment.findUnique({
    where: { id: assignmentId },
    include: {
      activity: { include: { activity: { include: { assignees: { where: { studentId, excusedAt: null }, select: { studentId: true }, take: 1 } } } } },
      class: { include: { students: { where: { id: studentId }, select: { id: true } } } },
    },
  });
  if (!assignment) throw new ApiError(404, { error: 'Assignment not found.' });
  const activity = assignment.activity?.activity || null;
  const now = new Date();
  if (!assignment.class.students.length || (activity && !activity.assignees.length)) throw new ApiError(403, { error: 'You are not assigned this work.' });
  if (activity && (activity.status !== 'PUBLISHED' || (activity.availableAt && activity.availableAt > now))) throw new ApiError(409, { error: 'This assignment is not available.' });
  const deadline = activity?.dueAt || assignment.deadline;
  if (enforceDeadline && deadline && deadline < now) throw new ApiError(409, { error: 'The submission deadline has passed.' });
  return { assignment, activity, deadline, now };
};

const loadSubmission = (db, studentId, assignmentId) => db.homeworkSubmission.findUnique({
  where: { studentId_assignmentId: { studentId, assignmentId } },
  include: submissionInclude,
});

const ensureDraft = async (db, studentId, assignmentId) => {
  let submission = await loadSubmission(db, studentId, assignmentId);
  if (!submission) {
    const parent = await db.homeworkSubmission.upsert({
      where: { studentId_assignmentId: { studentId, assignmentId } },
      update: {},
      create: { studentId, assignmentId, submittedAt: null, status: 'DRAFT' },
    });
    await db.homeworkSubmissionContent.upsert({
      where: { submissionId_slot: { submissionId: parent.id, slot: 'DRAFT' } },
      update: {},
      create: { submissionId: parent.id, slot: 'DRAFT' },
    });
    submission = await loadSubmission(db, studentId, assignmentId);
  }
  if (!draftContent(submission)) throw new ApiError(409, { error: 'Choose Edit submission before changing submitted work.' });
  return submission;
};

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

exports._assignmentReviewHelpers = { reviewState, summarizeStudentWork, validateMaxPoints, normalizeExternalUrl, officialSubmission, serializeSubmission };

exports.deleteAssignment = async ({ assignmentId, userId }) => {
  // 1. Kiểm tra bài tập có tồn tại và lấy thông tin lớp học
  const assignment = await prisma.assignment.findUnique({
    where: { id: assignmentId },
    include: {
      class: true,
      submissions: { select: { contents: { select: { items: { where: { fileAssetId: { not: null } }, select: { fileAssetId: true } } } } } },
    }
  });

  if (!assignment) {
    throw new ApiError(404, { message: "Không tìm thấy bài tập này!" });
  }

  // 2. Phân quyền: Chỉ Giáo viên của lớp đó mới được xóa
  if (assignment.class.teacherId !== userId) {
    throw new ApiError(403, { message: "Bạn không có quyền xóa bài tập của lớp này!" });
  }

  // 3. Xóa bài tập (Prisma tự động xóa luôn các bài nộp nhờ Cascade)
  const assetIds = [...new Set(assignment.submissions.flatMap(submission => submission.contents.flatMap(content => content.items.map(item => item.fileAssetId))).filter(Boolean))];
  await prisma.$transaction(async tx => {
    await tx.testDelivery.updateMany({ where: { sourceAssignmentId: assignmentId }, data: { status: 'CLOSED' } });
    await tx.assignment.delete({ where: { id: assignmentId } });
    for (const fileAssetId of assetIds) {
      const remaining = await tx.homeworkSubmissionItem.count({ where: { fileAssetId } });
      if (!remaining) await tx.fileAsset.update({ where: { id: fileAssetId }, data: { status: 'PENDING_DELETE' } });
    }
  });
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
      submissions: { where: userRole === 'STUDENT' ? { studentId: currentUserId } : undefined, include: submissionInclude, orderBy: { submittedAt: 'desc' } },
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
  const submitted = officialSubmission(submission);

  return {
    ...assignmentData,
    selectedTests: formattedSelectedTests,
    activity: activity ? { status: activity.status, availableAt: activity.availableAt, dueAt: activity.dueAt, lesson: activity.lesson } : null,
    ...(canManage ? {} : {
      mySubmission: submission ? { ...serializeSubmission(submission), reviewState: reviewState(submitted, deadline) } : null,
      submissionState: reviewState(submitted, deadline),
    }),
  };
};

const studentWorkCte = ({ assignmentId, classId, activityId, overdue }) => {
  const assignedStudents = activityId
    ? Prisma.sql`
        SELECT student."id", student."name", student."email"
        FROM "_StudentClasses" enrollment
        JOIN "User" student ON student."id" = enrollment."B"
        JOIN "ActivityAssignee" assignee
          ON assignee."studentId" = student."id"
         AND assignee."activityId" = ${activityId}
         AND assignee."excusedAt" IS NULL
        WHERE enrollment."A" = ${classId}
      `
    : Prisma.sql`
        SELECT student."id", student."name", student."email"
        FROM "_StudentClasses" enrollment
        JOIN "User" student ON student."id" = enrollment."B"
        WHERE enrollment."A" = ${classId}
      `;

  return Prisma.sql`
    WITH assigned_students AS (${assignedStudents}),
    work_items AS (
      SELECT
        student."id" AS "studentId",
        student."name",
        student."email",
        submission."submittedAt",
        submission."reviewedAt",
        submission."score",
        CASE
          WHEN submitted_content."id" IS NOT NULL AND submission."submittedAt" IS NOT NULL THEN
            CASE
              WHEN submission."reviewedAt" IS NOT NULL
               AND submission."reviewedAt" >= submission."submittedAt" THEN 'REVIEWED'
              ELSE 'NEEDS_REVIEW'
            END
          WHEN ${overdue} THEN 'MISSING'
          ELSE 'NOT_SUBMITTED'
        END AS "state"
      FROM assigned_students student
      LEFT JOIN "HomeworkSubmission" submission
        ON submission."studentId" = student."id"
       AND submission."assignmentId" = ${assignmentId}
      LEFT JOIN "HomeworkSubmissionContent" submitted_content
        ON submitted_content."submissionId" = submission."id"
       AND submitted_content."slot" = 'SUBMITTED'
    )
  `;
};

const listStudentWorkWithDb = async ({ assignmentId, userId, userRole, search, status, cursor, limit }, db) => {
  const currentUserId = userIdNumber(userId);
  const normalizedStatus = String(status || 'ALL').toUpperCase();
  const allowedStatuses = new Set(['ALL', 'NEEDS_REVIEW', 'REVIEWED', 'MISSING', 'NOT_SUBMITTED']);
  if (!allowedStatuses.has(normalizedStatus)) throw new ApiError(400, { error: 'Invalid student work status.' });
  const pageSize = Math.min(100, Math.max(1, Number.parseInt(limit, 10) || 50));
  const cursorId = Number(cursor);
  const normalizedCursor = Number.isInteger(cursorId) && cursorId > 0 ? cursorId : null;
  const normalizedSearch = String(search || '').trim().toLowerCase();

  const assignment = await db.assignment.findUnique({
    where: { id: assignmentId },
    select: {
      id: true,
      classId: true,
      deadline: true,
      class: { select: { teacherId: true } },
      activity: { select: { activity: { select: { id: true, dueAt: true } } } },
    },
  });
  if (!assignment) throw new ApiError(404, { error: 'Assignment not found.' });
  if (!canManageAssignment(assignment, currentUserId, userRole)) throw new ApiError(403, { error: 'Only class staff can review student work.' });

  const deadline = assignment.activity?.activity.dueAt || assignment.deadline;
  const cte = studentWorkCte({
    assignmentId: assignment.id,
    classId: assignment.classId,
    activityId: assignment.activity?.activity.id || null,
    overdue: Boolean(deadline && deadline < new Date()),
  });
  const [summaryRows, pageRows] = await Promise.all([
    db.$queryRaw(Prisma.sql`
      ${cte}
      SELECT
        COUNT(*)::int AS "assigned",
        (COUNT(*) FILTER (WHERE "state" IN ('NEEDS_REVIEW', 'REVIEWED')))::int AS "submitted",
        (COUNT(*) FILTER (WHERE "state" = 'NEEDS_REVIEW'))::int AS "needsReview",
        (COUNT(*) FILTER (WHERE "state" = 'REVIEWED'))::int AS "reviewed",
        (COUNT(*) FILTER (WHERE "state" = 'MISSING'))::int AS "missing",
        (COUNT(*) FILTER (WHERE "state" = 'NOT_SUBMITTED'))::int AS "pending"
      FROM work_items
    `),
    db.$queryRaw(Prisma.sql`
      ${cte},
      filtered AS (
        SELECT *
        FROM work_items
        WHERE (${normalizedStatus} = 'ALL' OR "state" = ${normalizedStatus})
          AND (${normalizedSearch} = '' OR POSITION(
            ${normalizedSearch} IN LOWER(CONCAT_WS(' ', COALESCE("name", ''), "email"))
          ) > 0)
      ),
      ranked AS (
        SELECT *, ROW_NUMBER() OVER (
          ORDER BY
            CASE "state"
              WHEN 'NEEDS_REVIEW' THEN 0
              WHEN 'MISSING' THEN 1
              WHEN 'REVIEWED' THEN 2
              ELSE 3
            END,
            "submittedAt" DESC NULLS LAST,
            "studentId" ASC
        ) AS "rowNumber"
        FROM filtered
      )
      SELECT "studentId", "name", "email", "state", "submittedAt", "reviewedAt", "score"
      FROM ranked
      WHERE "rowNumber" > COALESCE(
        (SELECT "rowNumber" FROM ranked WHERE "studentId" = ${normalizedCursor}),
        0
      )
      ORDER BY "rowNumber"
      LIMIT ${pageSize + 1}
    `),
  ]);

  const summary = summaryRows[0] || { assigned: 0, submitted: 0, needsReview: 0, reviewed: 0, missing: 0, pending: 0 };
  const hasNextPage = pageRows.length > pageSize;
  const items = pageRows.slice(0, pageSize).map(row => {
    const hasOfficialSubmission = row.state === 'NEEDS_REVIEW' || row.state === 'REVIEWED';
    return {
      student: { id: row.studentId, name: row.name, email: row.email },
      state: row.state,
      submittedAt: hasOfficialSubmission ? row.submittedAt : null,
      reviewedAt: hasOfficialSubmission ? row.reviewedAt : null,
      score: hasOfficialSubmission ? row.score ?? null : null,
    };
  });
  return {
    summary,
    items,
    nextCursor: hasNextPage ? String(items.at(-1).student.id) : null,
  };
};

exports.listStudentWorkWithDb = listStudentWorkWithDb;
exports.listStudentWork = params => listStudentWorkWithDb(params, prisma);

exports.getStudentWork = async ({ assignmentId, studentId, userId, userRole }) => {
  const currentUserId = userIdNumber(userId);
  const targetStudentId = userIdNumber(studentId);
  const assignment = await prisma.assignment.findUnique({
    where: { id: assignmentId },
    include: {
      class: { select: { teacherId: true, students: { where: { id: targetStudentId }, select: { id: true, name: true, email: true } } } },
      submissions: { where: { studentId: targetStudentId }, include: submissionInclude, take: 1 },
      activity: { include: { activity: { select: { dueAt: true, assignees: { where: { studentId: targetStudentId, excusedAt: null }, select: { studentId: true } } } } } },
    },
  });
  if (!assignment) throw new ApiError(404, { error: 'Assignment not found.' });
  if (!canManageAssignment(assignment, currentUserId, userRole)) throw new ApiError(403, { error: 'Only class staff can review student work.' });
  const student = assignment.class.students[0];
  const isAssigned = student && (!assignment.activity || assignment.activity.activity.assignees.length > 0);
  if (!isAssigned) throw new ApiError(404, { error: 'Assigned student not found.' });
  const submission = officialSubmission(assignment.submissions[0]) || null;
  const deadline = assignment.activity?.activity.dueAt || assignment.deadline;
  return {
    student,
    submission: serializeSubmission(submission, { includeDraft: false }),
    state: reviewState(submission, deadline),
    maxPoints: assignment.maxPoints,
  };
};

exports.reviewStudentWork = async ({ assignmentId, studentId, userId, userRole, score, feedback }) => {
  const currentUserId = userIdNumber(userId);
  const targetStudentId = userIdNumber(studentId);
  const assignment = await prisma.assignment.findUnique({ where: { id: assignmentId }, include: { class: { select: { teacherId: true } } } });
  if (!assignment) throw new ApiError(404, { error: 'Assignment not found.' });
  if (!canManageAssignment(assignment, currentUserId, userRole)) throw new ApiError(403, { error: 'Only class staff can review student work.' });
  const submission = await loadSubmission(prisma, targetStudentId, assignmentId);
  if (!officialSubmission(submission)) throw new ApiError(404, { error: 'This student has not submitted work.' });

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
    data: { score: normalizedScore, feedback: normalizedFeedback, reviewedAt: new Date() },
  });
  await sendNotificationToUser(targetStudentId, `Your teacher reviewed “${assignment.title}”.`, `/dashboard/class/${assignment.classId}/assignment/${assignment.id}`);
  return { ...updated, reviewState: 'REVIEWED' };
};

exports.getMySubmission = async ({ assignmentId, studentId }) => {
  const currentStudentId = userIdNumber(studentId);
  const { deadline } = await getStudentAssignmentAccess(prisma, assignmentId, currentStudentId, { enforceDeadline: false });
  const submission = await loadSubmission(prisma, currentStudentId, assignmentId);
  const submitted = officialSubmission(submission);
  return { submission: serializeSubmission(submission), state: reviewState(submitted, deadline), deadline };
};

exports.updateDraft = async ({ assignmentId, studentId, textResponse, expectedVersion }) => {
  const currentStudentId = userIdNumber(studentId);
  const text = normalizeText(textResponse);
  if (text && text.length > MAX_RESPONSE_LENGTH) throw new ApiError(400, { error: 'Response must be 50,000 characters or fewer.' });
  await getStudentAssignmentAccess(prisma, assignmentId, currentStudentId);
  const updated = await prisma.$transaction(async tx => {
    const submission = await ensureDraft(tx, currentStudentId, assignmentId);
    const draft = draftContent(submission);
    if (expectedVersion !== undefined) {
      const result = await tx.homeworkSubmissionContent.updateMany({ where: { id: draft.id, version: Number(expectedVersion) }, data: { textResponse: text, version: { increment: 1 } } });
      if (!result.count) throw new ApiError(409, { error: 'This draft changed in another tab. Reload before continuing.' });
    } else {
      await tx.homeworkSubmissionContent.update({ where: { id: draft.id }, data: { textResponse: text, version: { increment: 1 } } });
    }
    return loadSubmission(tx, currentStudentId, assignmentId);
  });
  return serializeSubmission(updated);
};

exports.editSubmission = async ({ assignmentId, studentId }) => {
  const currentStudentId = userIdNumber(studentId);
  await getStudentAssignmentAccess(prisma, assignmentId, currentStudentId);
  const updated = await prisma.$transaction(async tx => {
    const submission = await loadSubmission(tx, currentStudentId, assignmentId);
    if (!officialSubmission(submission)) throw new ApiError(409, { error: 'There is no submitted work to edit.' });
    if (draftContent(submission)) return submission;
    const submitted = officialContent(submission);
    await tx.homeworkSubmissionContent.create({
      data: {
        submissionId: submission.id,
        slot: 'DRAFT',
        textResponse: submitted.textResponse,
        items: { create: submitted.items.map(item => ({ kind: item.kind, fileAssetId: item.fileAssetId, externalUrl: item.externalUrl, displayName: item.displayName, order: item.order })) },
      },
    });
    return loadSubmission(tx, currentStudentId, assignmentId);
  });
  return serializeSubmission(updated);
};

exports.discardDraft = async ({ assignmentId, studentId }) => {
  const currentStudentId = userIdNumber(studentId);
  await getStudentAssignmentAccess(prisma, assignmentId, currentStudentId, { enforceDeadline: false });
  const result = await prisma.$transaction(async tx => {
    const submission = await loadSubmission(tx, currentStudentId, assignmentId);
    if (!submission) return null;
    const draft = draftContent(submission);
    if (!draft) return submission;
    const assetIds = draft.items.filter(item => item.fileAssetId).map(item => item.fileAssetId);
    await tx.homeworkSubmissionContent.delete({ where: { id: draft.id } });
    for (const fileAssetId of assetIds) {
      const remaining = await tx.homeworkSubmissionItem.count({ where: { fileAssetId } });
      if (!remaining) await tx.fileAsset.update({ where: { id: fileAssetId }, data: { status: 'PENDING_DELETE' } });
    }
    const remainingSubmission = await loadSubmission(tx, currentStudentId, assignmentId);
    if (!officialSubmission(remainingSubmission)) {
      await tx.homeworkSubmission.delete({ where: { id: submission.id } });
      return null;
    }
    return remainingSubmission;
  });
  return serializeSubmission(result);
};

exports.addDraftItem = async ({ assignmentId, studentId, kind, externalUrl, displayName, fileAssetId }) => {
  const currentStudentId = userIdNumber(studentId);
  const normalizedKind = String(kind || '').toUpperCase();
  if (!['FILE', 'LINK'].includes(normalizedKind)) throw new ApiError(400, { error: 'Attachment type must be FILE or LINK.' });
  await getStudentAssignmentAccess(prisma, assignmentId, currentStudentId);
  const updated = await prisma.$transaction(async tx => {
    const submission = await ensureDraft(tx, currentStudentId, assignmentId);
    const draft = draftContent(submission);
    if (draft.items.length >= MAX_SUBMISSION_ITEMS) throw new ApiError(400, { error: `A submission can contain up to ${MAX_SUBMISSION_ITEMS} attachments.` });
    let itemData;
    if (normalizedKind === 'LINK') {
      itemData = { kind: 'LINK', externalUrl: normalizeExternalUrl(externalUrl), displayName: normalizeDisplayName(displayName), order: draft.items.length };
    } else {
      const asset = await tx.fileAsset.findUnique({ where: { id: String(fileAssetId || '') } });
      if (!asset || asset.ownerId !== currentStudentId || asset.status !== 'READY') throw new ApiError(400, { error: 'Choose a completed upload that belongs to you.' });
      if (draft.items.some(item => item.fileAssetId === asset.id)) throw new ApiError(409, { error: 'This file is already attached.' });
      const totalBytes = draft.items.reduce((sum, item) => sum + (item.fileAsset?.sizeBytes || 0), 0) + asset.sizeBytes;
      if (totalBytes > MAX_SUBMISSION_FILE_BYTES) throw new ApiError(400, { error: 'Managed files can total up to 100 MB per submission.' });
      itemData = { kind: 'FILE', fileAssetId: asset.id, displayName: normalizeDisplayName(displayName), order: draft.items.length };
    }
    await tx.homeworkSubmissionItem.create({ data: { contentId: draft.id, ...itemData } });
    await tx.homeworkSubmissionContent.update({ where: { id: draft.id }, data: { version: { increment: 1 } } });
    return loadSubmission(tx, currentStudentId, assignmentId);
  });
  return serializeSubmission(updated);
};

exports.removeDraftItem = async ({ assignmentId, itemId, studentId }) => {
  const currentStudentId = userIdNumber(studentId);
  await getStudentAssignmentAccess(prisma, assignmentId, currentStudentId);
  const updated = await prisma.$transaction(async tx => {
    const item = await tx.homeworkSubmissionItem.findUnique({
      where: { id: itemId },
      include: { content: { include: { submission: true } } },
    });
    if (!item || item.content.slot !== 'DRAFT' || item.content.submission.studentId !== currentStudentId || item.content.submission.assignmentId !== assignmentId) throw new ApiError(404, { error: 'Draft attachment not found.' });
    await tx.homeworkSubmissionItem.delete({ where: { id: item.id } });
    await tx.homeworkSubmissionContent.update({ where: { id: item.contentId }, data: { version: { increment: 1 } } });
    if (item.fileAssetId) {
      const remaining = await tx.homeworkSubmissionItem.count({ where: { fileAssetId: item.fileAssetId } });
      if (!remaining) await tx.fileAsset.update({ where: { id: item.fileAssetId }, data: { status: 'PENDING_DELETE' } });
    }
    return loadSubmission(tx, currentStudentId, assignmentId);
  });
  return serializeSubmission(updated);
};

exports.submitDraft = async ({ assignmentId, studentId }) => {
  const currentStudentId = userIdNumber(studentId);
  const result = await prisma.$transaction(async tx => {
    const access = await getStudentAssignmentAccess(tx, assignmentId, currentStudentId);
    const submission = await loadSubmission(tx, currentStudentId, assignmentId);
    const draft = draftContent(submission);
    if (!draft) {
      if (officialSubmission(submission)) return { submission, submitted: false, access };
      throw new ApiError(400, { error: 'Add a response or attachment before submitting.' });
    }
    if (!draft.textResponse && !draft.items.length) throw new ApiError(400, { error: 'Add a response or attachment before submitting.' });
    if (draft.items.length > MAX_SUBMISSION_ITEMS) throw new ApiError(400, { error: 'This submission has too many attachments.' });
    const fileItems = draft.items.filter(item => item.kind === 'FILE');
    if (fileItems.some(item => !item.fileAsset || item.fileAsset.ownerId !== currentStudentId || item.fileAsset.status !== 'READY')) throw new ApiError(409, { error: 'Wait for every file upload to finish before submitting.' });
    if (fileItems.reduce((sum, item) => sum + item.fileAsset.sizeBytes, 0) > MAX_SUBMISSION_FILE_BYTES) throw new ApiError(400, { error: 'Managed files can total up to 100 MB per submission.' });

    const previous = officialContent(submission);
    const previousAssetIds = previous?.items.filter(item => item.fileAssetId).map(item => item.fileAssetId) || [];
    if (previous) await tx.homeworkSubmissionContent.delete({ where: { id: previous.id } });
    await tx.homeworkSubmissionContent.update({ where: { id: draft.id }, data: { slot: 'SUBMITTED', version: { increment: 1 } } });
    const now = new Date();
    await tx.homeworkSubmission.update({ where: { id: submission.id }, data: { submittedAt: now, status: 'SUBMITTED' } });
    if (access.activity) {
      await tx.activityAssignee.updateMany({
        where: { activityId: access.activity.id, studentId: currentStudentId, startedAt: null },
        data: { startedAt: now },
      });
      await tx.activityAssignee.updateMany({
        where: { activityId: access.activity.id, studentId: currentStudentId },
        data: { status: 'COMPLETED', completedAt: now, attemptCount: { increment: 1 } },
      });
    }
    for (const fileAssetId of previousAssetIds) {
      const remaining = await tx.homeworkSubmissionItem.count({ where: { fileAssetId } });
      if (!remaining) await tx.fileAsset.update({ where: { id: fileAssetId }, data: { status: 'PENDING_DELETE' } });
    }
    return { submission: await loadSubmission(tx, currentStudentId, assignmentId), submitted: true, access };
  });

  if (result.submitted) {
    const student = await prisma.user.findUnique({ where: { id: currentStudentId }, select: { name: true, email: true } });
    await sendNotificationToUser(result.access.assignment.class.teacherId, `${student?.name || student?.email || 'A student'} submitted “${result.access.assignment.title}”.`, `/dashboard/class/${result.access.assignment.classId}/assignment/${result.access.assignment.id}?view=student-work`);
  }
  const submitted = officialSubmission(result.submission);
  return { ...serializeSubmission(result.submission), reviewState: reviewState(submitted, result.access.deadline), submitted: result.submitted };
};

// Compatibility command for older clients. New clients persist a draft and invoke submit explicitly.
exports.upsertSubmission = async ({ assignmentId, textResponse, fileUrl, studentId }) => {
  const currentStudentId = userIdNumber(studentId);
  const existing = await loadSubmission(prisma, currentStudentId, assignmentId);
  if (officialSubmission(existing) && !draftContent(existing)) await exports.editSubmission({ assignmentId, studentId: currentStudentId });
  await exports.updateDraft({ assignmentId, studentId: currentStudentId, textResponse });
  const refreshed = await loadSubmission(prisma, currentStudentId, assignmentId);
  const draft = draftContent(refreshed);
  for (const item of draft.items) await exports.removeDraftItem({ assignmentId, itemId: item.id, studentId: currentStudentId });
  if (normalizeText(fileUrl)) await exports.addDraftItem({ assignmentId, studentId: currentStudentId, kind: 'LINK', externalUrl: fileUrl });
  return exports.submitDraft({ assignmentId, studentId: currentStudentId });
};
