const prisma = require('../config/prisma');
const ApiError = require('../utils/ApiError');

// Helper dùng chung: lấy lesson kèm thông tin lớp để kiểm tra quyền sở hữu
const getLessonWithClass = (lessonId) =>
  prisma.lesson.findUnique({
    where: { id: lessonId },
    include: { week: { include: { class: true } } }
  });

// ==========================================
// WEEK MANAGEMENT
// ==========================================

exports.getWeeks = async ({ classId }) => {
  try {
    const weeks = await prisma.week.findMany({
      where: { classId },
      orderBy: { order: 'asc' },
      include: {
        lessons: {
          orderBy: { order: 'asc' },
          include: {
            files: { orderBy: { createdAt: 'asc' } },
            assignments: true
          }
        }
      }
    });
    return weeks;
  } catch (error) {
    console.error('Database error in getWeeks:', error);
    throw error;
  }
};

exports.createWeek = async ({ classId, title, userId }) => {
  if (!title) {
    throw new ApiError(400, { success: false, error: 'Tiêu đề tuần không được để trống' });
  }

  const classData = await prisma.class.findUnique({ where: { id: classId } });

  if (!classData) {
    throw new ApiError(404, { success: false, error: 'Không tìm thấy lớp học' });
  }

  if (classData.teacherId !== userId) {
    throw new ApiError(403, { success: false, error: 'Bạn không có quyền thêm tuần học' });
  }

  const maxOrderWeek = await prisma.week.findFirst({
    where: { classId },
    orderBy: { order: 'desc' }
  });

  const newOrder = maxOrderWeek ? maxOrderWeek.order + 1 : 0;

  return prisma.week.create({
    data: { title, classId, order: newOrder }
  });
};

exports.updateWeek = async ({ weekId, title, isExpanded, userId }) => {
  const week = await prisma.week.findUnique({
    where: { id: weekId },
    include: { class: true }
  });

  if (!week) {
    throw new ApiError(404, { success: false, error: 'Không tìm thấy tuần học' });
  }

  if (week.class.teacherId !== userId) {
    throw new ApiError(403, { success: false, error: 'Bạn không có quyền chỉnh sửa' });
  }

  return prisma.week.update({
    where: { id: weekId },
    data: {
      ...(title && { title }),
      ...(isExpanded !== undefined && { isExpanded })
    }
  });
};

exports.deleteWeek = async ({ weekId, userId }) => {
  const week = await prisma.week.findUnique({
    where: { id: weekId },
    include: { class: true }
  });

  if (!week) {
    throw new ApiError(404, { success: false, error: 'Không tìm thấy tuần học' });
  }

  if (week.class.teacherId !== userId) {
    throw new ApiError(403, { success: false, error: 'Bạn không có quyền xóa' });
  }

  await prisma.week.delete({ where: { id: weekId } });
};

// ==========================================
// LESSON MANAGEMENT
// ==========================================

exports.createLesson = async ({ weekId, title, userId }) => {
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

  if (week.class.teacherId !== userId) {
    throw new ApiError(403, { success: false, error: 'Bạn không có quyền thêm buổi học' });
  }

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

exports.deleteLesson = async ({ lessonId, userId }) => {
  const lesson = await getLessonWithClass(lessonId);

  if (!lesson) {
    throw new ApiError(404, { success: false, error: 'Không tìm thấy buổi học' });
  }

  if (lesson.week.class.teacherId !== userId) {
    throw new ApiError(403, { success: false, error: 'Bạn không có quyền xóa' });
  }

  await prisma.lesson.delete({ where: { id: lessonId } });
};

// ==========================================
// FILE MANAGEMENT
// ==========================================

exports.addFiles = async ({ lessonId, files, userId }) => {
  if (!files || !Array.isArray(files) || files.length === 0) {
    throw new ApiError(400, { success: false, error: 'Danh sách file không hợp lệ' });
  }

  const lesson = await getLessonWithClass(lessonId);

  if (!lesson) {
    throw new ApiError(404, { success: false, error: 'Không tìm thấy buổi học' });
  }

  if (lesson.week.class.teacherId !== userId) {
    throw new ApiError(403, { success: false, error: 'Bạn không có quyền thêm tài liệu' });
  }

  return prisma.$transaction(
    files.map(file =>
      prisma.lessonFile.create({
        data: { name: file.name, url: file.url, lessonId }
      })
    )
  );
};

exports.deleteFile = async ({ fileId, userId }) => {
  const file = await prisma.lessonFile.findUnique({
    where: { id: fileId },
    include: {
      lesson: { include: { week: { include: { class: true } } } }
    }
  });

  if (!file) {
    throw new ApiError(404, { success: false, error: 'Không tìm thấy tài liệu' });
  }

  if (file.lesson.week.class.teacherId !== userId) {
    throw new ApiError(403, { success: false, error: 'Bạn không có quyền xóa' });
  }

  await prisma.lessonFile.delete({ where: { id: fileId } });
};

// ==========================================
// ASSIGNMENT MANAGEMENT
// ==========================================

exports.createOrUpdateAssignment = async ({ lessonId, title, content, dueDate, testIds, userId }) => {
  if (!title) {
    throw new ApiError(400, { success: false, error: 'Tiêu đề bài tập không được để trống' });
  }

  const lesson = await getLessonWithClass(lessonId);

  if (!lesson) {
    throw new ApiError(404, { success: false, error: 'Không tìm thấy buổi học' });
  }

  if (lesson.week.class.teacherId !== userId) {
    throw new ApiError(403, { success: false, error: 'Bạn không có quyền giao bài tập' });
  }

  return prisma.lessonAssignment.upsert({
    where: { lessonId },
    update: {
      title,
      content: content || null,
      dueDate: dueDate ? new Date(dueDate) : null,
      testIds: Array.isArray(testIds) ? testIds : []
    },
    create: {
      title,
      content: content || null,
      dueDate: dueDate ? new Date(dueDate) : null,
      testIds: Array.isArray(testIds) ? testIds : [],
      lessonId
    }
  });
};

exports.deleteAssignment = async ({ assignmentId, userId }) => {
  const assignment = await prisma.lessonAssignment.findUnique({
    where: { id: assignmentId },
    include: {
      lesson: { include: { week: { include: { class: true } } } }
    }
  });

  if (!assignment) {
    throw new ApiError(404, { success: false, error: 'Không tìm thấy bài tập' });
  }

  if (assignment.lesson.week.class.teacherId !== userId) {
    throw new ApiError(403, { success: false, error: 'Bạn không có quyền xóa' });
  }

  await prisma.lessonAssignment.delete({ where: { id: assignmentId } });
};
