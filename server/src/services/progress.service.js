const prisma = require('../config/prisma');
const ApiError = require('../utils/ApiError');
const testDeliveryService = require('./test-delivery.service');
const { canManageProgress, canReadProgress } = require('../utils/progress-access');

// Helper dùng chung: lấy lesson kèm thông tin lớp để kiểm tra quyền sở hữu
const getLessonWithClass = (lessonId) =>
  prisma.lesson.findUnique({
    where: { id: lessonId },
    include: { week: { include: { class: true } } }
  });

const assertCanManage = ({ classData, userId, userRole }) => {
  if (!canManageProgress({ teacherId: classData.teacherId, userId, userRole })) {
    throw new ApiError(403, { success: false, error: 'Bạn không có quyền chỉnh sửa tiến độ lớp học này.' });
  }
};

// ==========================================
// WEEK MANAGEMENT
// ==========================================

exports.getWeeks = async ({ classId, userId, userRole }) => {
  const classData = await prisma.class.findUnique({
    where: { id: classId },
    select: {
      teacherId: true,
      students: { where: { id: Number(userId) }, select: { id: true }, take: 1 },
    },
  });
  if (!classData) throw new ApiError(404, { success: false, error: 'Không tìm thấy lớp học.' });
  if (!canReadProgress({
    teacherId: classData.teacherId,
    studentIds: classData.students.map(student => student.id),
    userId,
    userRole,
  })) {
    throw new ApiError(403, { success: false, error: 'Bạn không có quyền xem tiến độ lớp học này.' });
  }

  return prisma.week.findMany({
    where: { classId },
    orderBy: { order: 'asc' },
    include: {
      lessons: {
        orderBy: { order: 'asc' },
        include: {
          files: { orderBy: { createdAt: 'asc' } },
          assignments: true,
          deliveries: {
            orderBy: { createdAt: 'desc' },
            include: {
              test: { select: { id: true, title: true, mode: true, duration: true } },
            },
          },
        }
      }
    }
  });
};

exports.createWeek = async ({ classId, title, userId, userRole }) => {
  if (!title) {
    throw new ApiError(400, { success: false, error: 'Tiêu đề tuần không được để trống' });
  }

  const classData = await prisma.class.findUnique({ where: { id: classId } });

  if (!classData) {
    throw new ApiError(404, { success: false, error: 'Không tìm thấy lớp học' });
  }

  assertCanManage({ classData, userId, userRole });

  const maxOrderWeek = await prisma.week.findFirst({
    where: { classId },
    orderBy: { order: 'desc' }
  });

  const newOrder = maxOrderWeek ? maxOrderWeek.order + 1 : 0;

  return prisma.week.create({
    data: { title, classId, order: newOrder }
  });
};

exports.updateWeek = async ({ weekId, title, isExpanded, userId, userRole }) => {
  const week = await prisma.week.findUnique({
    where: { id: weekId },
    include: { class: true }
  });

  if (!week) {
    throw new ApiError(404, { success: false, error: 'Không tìm thấy tuần học' });
  }

  assertCanManage({ classData: week.class, userId, userRole });

  return prisma.week.update({
    where: { id: weekId },
    data: {
      ...(title && { title }),
      ...(isExpanded !== undefined && { isExpanded })
    }
  });
};

exports.deleteWeek = async ({ weekId, userId, userRole }) => {
  const week = await prisma.week.findUnique({
    where: { id: weekId },
    include: { class: true }
  });

  if (!week) {
    throw new ApiError(404, { success: false, error: 'Không tìm thấy tuần học' });
  }

  assertCanManage({ classData: week.class, userId, userRole });

  await prisma.week.delete({ where: { id: weekId } });
};

// ==========================================
// LESSON MANAGEMENT
// ==========================================

exports.createLesson = async ({ weekId, title, userId, userRole }) => {
  if (!title) {
    throw new ApiError(400, { success: false, error: 'Tiêu đề buổi học không được để trống' });
  }

  const week = await prisma.week.findUnique({
    where: { id: weekId },
    include: { class: true }
  });

  if (!week) {
    throw new ApiError(404, { success: false, error: 'Không tìm thấy tuần học' });
  }

  assertCanManage({ classData: week.class, userId, userRole });

  const maxOrderLesson = await prisma.lesson.findFirst({
    where: { weekId },
    orderBy: { order: 'desc' }
  });

  const newOrder = maxOrderLesson ? maxOrderLesson.order + 1 : 0;

  return prisma.lesson.create({
    data: { title, weekId, order: newOrder },
    include: { files: true, assignments: true }
  });
};

exports.deleteLesson = async ({ lessonId, userId, userRole }) => {
  const lesson = await getLessonWithClass(lessonId);

  if (!lesson) {
    throw new ApiError(404, { success: false, error: 'Không tìm thấy buổi học' });
  }

  assertCanManage({ classData: lesson.week.class, userId, userRole });

  await prisma.lesson.delete({ where: { id: lessonId } });
};

// ==========================================
// FILE MANAGEMENT
// ==========================================

exports.addFiles = async ({ lessonId, files, userId, userRole }) => {
  if (!files || !Array.isArray(files) || files.length === 0) {
    throw new ApiError(400, { success: false, error: 'Danh sách file không hợp lệ' });
  }

  const lesson = await getLessonWithClass(lessonId);

  if (!lesson) {
    throw new ApiError(404, { success: false, error: 'Không tìm thấy buổi học' });
  }

  assertCanManage({ classData: lesson.week.class, userId, userRole });

  return prisma.$transaction(
    files.map(file =>
      prisma.lessonFile.create({
        data: { name: file.name, url: file.url, lessonId }
      })
    )
  );
};

exports.deleteFile = async ({ fileId, userId, userRole }) => {
  const file = await prisma.lessonFile.findUnique({
    where: { id: fileId },
    include: {
      lesson: { include: { week: { include: { class: true } } } }
    }
  });

  if (!file) {
    throw new ApiError(404, { success: false, error: 'Không tìm thấy tài liệu' });
  }

  assertCanManage({ classData: file.lesson.week.class, userId, userRole });

  await prisma.lessonFile.delete({ where: { id: fileId } });
};

// ==========================================
// ASSIGNMENT MANAGEMENT
// ==========================================

exports.createOrUpdateAssignment = async ({ lessonId, title, content, dueDate, testIds, userId, userRole }) => {
  if (!title) {
    throw new ApiError(400, { success: false, error: 'Tiêu đề bài tập không được để trống' });
  }

  const lesson = await getLessonWithClass(lessonId);

  if (!lesson) {
    throw new ApiError(404, { success: false, error: 'Không tìm thấy buổi học' });
  }

  assertCanManage({ classData: lesson.week.class, userId, userRole });

  const normalizedTestIds = [...new Set((Array.isArray(testIds) ? testIds : []).map(Number).filter(Number.isInteger))];
  const assignment = await prisma.lessonAssignment.upsert({
    where: { lessonId },
    update: {
      title,
      content: content || null,
      dueDate: dueDate ? new Date(dueDate) : null,
      testIds: normalizedTestIds
    },
    create: {
      title,
      content: content || null,
      dueDate: dueDate ? new Date(dueDate) : null,
      testIds: normalizedTestIds,
      lessonId
    }
  });

  const existingDeliveries = await prisma.testDelivery.findMany({
    where: { sourceLessonAssignmentId: assignment.id },
    select: { id: true, testId: true },
  });
  const retainedTestIds = new Set(normalizedTestIds);
  await prisma.testDelivery.updateMany({
    where: {
      sourceLessonAssignmentId: assignment.id,
      testId: { notIn: normalizedTestIds.length ? normalizedTestIds : [-1] },
    },
    data: { status: 'CLOSED' },
  });
  await prisma.testDelivery.updateMany({
    where: { sourceLessonAssignmentId: assignment.id, testId: { in: normalizedTestIds } },
    data: { title, dueAt: dueDate ? new Date(dueDate) : null, status: 'PUBLISHED' },
  });

  const existingTestIds = new Set(existingDeliveries.map(item => item.testId));
  const newTestIds = normalizedTestIds.filter(testId => !existingTestIds.has(testId) && retainedTestIds.has(testId));
  if (newTestIds.length > 0) {
    const deliveries = await testDeliveryService.createDeliveries({
      classIds: [lesson.week.classId],
      testIds: newTestIds,
      lessonId,
      title,
      dueAt: dueDate ? new Date(dueDate) : null,
      maxAttempts: 1,
      scorePolicy: 'FIRST',
      userId,
      userRole,
    });
    await prisma.testDelivery.updateMany({
      where: { id: { in: deliveries.map(item => item.id) } },
      data: { sourceLessonAssignmentId: assignment.id },
    });
  }

  return assignment;
};

exports.deleteAssignment = async ({ assignmentId, userId, userRole }) => {
  const assignment = await prisma.lessonAssignment.findUnique({
    where: { id: assignmentId },
    include: {
      lesson: { include: { week: { include: { class: true } } } }
    }
  });

  if (!assignment) {
    throw new ApiError(404, { success: false, error: 'Không tìm thấy bài tập' });
  }

  assertCanManage({ classData: assignment.lesson.week.class, userId, userRole });

  await prisma.testDelivery.updateMany({
    where: { sourceLessonAssignmentId: assignmentId },
    data: { status: 'CLOSED' },
  });
  await prisma.lessonAssignment.delete({ where: { id: assignmentId } });
};
