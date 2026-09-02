const prisma = require('../config/prisma');
const ApiError = require('../utils/ApiError');
const testDeliveryService = require('./test-delivery.service');

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

exports.updateAssignment = async ({ assignmentId, userId, title, content, fileUrls, links, deadline, testIds }) => {
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
      deadline: formattedDeadline
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
  const currentUserId = parseInt(userId, 10);

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
      submissions: { include: { student: { select: { id: true, name: true, email: true } } }, orderBy: { submittedAt: 'desc' } },
      activity: { include: { activity: { select: { status: true, availableAt: true, assignees: { where: { excusedAt: null }, select: { studentId: true } } } } } }
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
  const submissionByStudent = new Map(assignment.submissions.map(submission => [submission.studentId, submission]));

  return {
    ...assignmentData,
    selectedTests: formattedSelectedTests,
    ...(canManage ? { studentWork: assignment.class.students.filter(student => !assignment.activity || assignment.activity.activity.assignees.some(assignee => assignee.studentId === student.id)).map(student => {
      const submission = submissionByStudent.get(student.id);
      return {
        student, submitted: Boolean(submission), status: submission?.status || 'NOT_SUBMITTED',
        submittedAt: submission?.submittedAt || null, textResponse: submission?.textResponse || null, fileUrl: submission?.fileUrl || null,
      };
    }) } : {}),
  };
};
