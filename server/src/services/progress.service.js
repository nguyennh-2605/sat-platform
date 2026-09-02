const prisma = require('../config/prisma');
const ApiError = require('../utils/ApiError');
const testDeliveryService = require('./test-delivery.service');
const { sendNotificationToUser } = require('./notification.service');
const { canManageProgress, canReadProgress } = require('../utils/progress-access');

const CONTENT_STATUSES = new Set(['DRAFT', 'SCHEDULED', 'PUBLISHED', 'ARCHIVED']);
const RESOURCE_KINDS = new Set(['FILE', 'VIDEO', 'LINK', 'EMBED']);
const userIdNumber = value => Number.parseInt(value, 10);
const dateValue = value => value ? new Date(value) : null;

const getLessonWithClass = lessonId => prisma.lesson.findUnique({
  where: { id: lessonId },
  include: { week: { include: { class: { include: { students: { select: { id: true, name: true } }, teacher: { select: { name: true } } } } } } },
});

const assertCanManage = ({ classData, userId, userRole }) => {
  if (!canManageProgress({ teacherId: classData.teacherId, userId, userRole })) {
    throw new ApiError(403, { success: false, error: 'Bạn không có quyền chỉnh sửa khóa học này.' });
  }
};

const contentStatus = value => {
  const normalized = String(value || 'DRAFT').toUpperCase();
  if (!CONTENT_STATUSES.has(normalized)) throw new ApiError(400, { success: false, error: 'Trạng thái nội dung không hợp lệ.' });
  return normalized;
};

const normalizeOrderedIds = orderedIds => {
  if (!Array.isArray(orderedIds)) {
    throw new ApiError(400, { success: false, error: 'Thứ tự nội dung không hợp lệ.' });
  }
  const normalized = orderedIds.map(value => String(value || '').trim());
  if (normalized.some(id => !id) || new Set(normalized).size !== normalized.length) {
    throw new ApiError(400, { success: false, error: 'Thứ tự nội dung chứa mã trống hoặc trùng lặp.' });
  }
  return normalized;
};

const assertCompleteOrder = (orderedIds, existingItems) => {
  const existingIds = existingItems.map(item => String(item.id));
  const requested = new Set(orderedIds);
  if (orderedIds.length !== existingIds.length || existingIds.some(id => !requested.has(id))) {
    throw new ApiError(400, { success: false, error: 'Thứ tự mới phải chứa đầy đủ nội dung thuộc cùng một cấp.' });
  }
};

const validateResource = file => {
  const name = String(file?.name || '').trim();
  const url = String(file?.url || '').trim();
  const kind = String(file?.kind || 'FILE').toUpperCase();
  if (!name || !url) throw new ApiError(400, { success: false, error: 'Tài liệu cần có tên và đường dẫn.' });
  try {
    const parsed = new URL(url);
    if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('protocol');
  } catch {
    throw new ApiError(400, { success: false, error: 'Đường dẫn tài liệu phải là URL http(s) hợp lệ.' });
  }
  if (!RESOURCE_KINDS.has(kind)) throw new ApiError(400, { success: false, error: 'Loại tài liệu không hợp lệ.' });
  return { name, url, kind };
};

const notifyStudents = async (classData, message, link) => {
  await Promise.all((classData.students || []).map(student => sendNotificationToUser(student.id, message, link)));
};

exports.getWeeks = async ({ classId, userId, userRole }) => {
  const currentUserId = userIdNumber(userId);
  const classData = await prisma.class.findUnique({
    where: { id: classId },
    select: { teacherId: true, students: { where: { id: currentUserId }, select: { id: true }, take: 1 } },
  });
  if (!classData) throw new ApiError(404, { success: false, error: 'Không tìm thấy lớp học.' });
  if (!canReadProgress({ teacherId: classData.teacherId, studentIds: classData.students.map(student => student.id), userId, userRole })) {
    throw new ApiError(403, { success: false, error: 'Bạn không có quyền xem khóa học này.' });
  }

  const canManage = canManageProgress({ teacherId: classData.teacherId, userId, userRole });
  const now = new Date();
  const publishedFilter = { status: 'PUBLISHED', OR: [{ availableAt: null }, { availableAt: { lte: now } }] };
  const lessonVisibilityFilter = { OR: [publishedFilter, { status: 'SCHEDULED', scheduledAt: { lte: now } }] };
  const weeks = await prisma.week.findMany({
    where: { classId, ...(canManage ? {} : publishedFilter) },
    orderBy: { order: 'asc' },
    include: {
      lessons: {
        where: canManage ? {} : lessonVisibilityFilter,
        orderBy: { order: 'asc' },
        include: {
          files: {
            where: canManage ? {} : { OR: [{ availableAt: null }, { availableAt: { lte: now } }] },
            orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
            include: { progress: { where: { studentId: currentUserId }, take: 1 } },
          },
          assignments: { include: { assignment: { select: { id: true, deadline: true, submissions: { where: { studentId: currentUserId }, select: { status: true, submittedAt: true, score: true }, take: 1 } } } } },
          deliveries: {
            where: canManage ? {} : { status: 'PUBLISHED', assignees: { some: { studentId: currentUserId, excusedAt: null } } },
            orderBy: { createdAt: 'desc' },
            include: { test: { select: { id: true, title: true, mode: true, duration: true, subject: true, folderId: true, sections: { select: { _count: { select: { questions: true } } } } } } },
          },
          activities: {
            where: canManage ? { type: { in: ['VOCABULARY', 'HOMEWORK', 'RESOURCE'] } } : { type: { in: ['VOCABULARY', 'HOMEWORK', 'RESOURCE'] }, status: 'PUBLISHED', assignees: { some: { studentId: currentUserId, status: { not: 'EXCUSED' } } } },
            include: {
              assignees: canManage ? true : { where: { studentId: currentUserId }, take: 1 },
              homework: { include: { assignment: { select: { id: true, content: true, fileUrls: true, links: true, submissions: { where: { studentId: currentUserId }, select: { status: true, submittedAt: true }, take: 1 } } } } },
            },
          },
          progress: canManage ? true : { where: { studentId: currentUserId }, take: 1 },
        },
      },
    },
  });

  return weeks.map(week => ({
    ...week,
    lessons: week.lessons.map(lesson => ({
      ...lesson,
      assignments: lesson.assignments.map(item => ({ ...item, id: item.assignmentId || item.id })),
      studentProgress: canManage ? null : lesson.progress[0] || null,
      progressSummary: canManage ? { completed: lesson.progress.filter(item => item.status === 'COMPLETED').length, started: lesson.progress.filter(item => item.status === 'IN_PROGRESS').length } : null,
    })),
  }));
};

exports.createWeek = async ({ classId, title, description, status, availableAt, userId, userRole }) => {
  if (!String(title || '').trim()) throw new ApiError(400, { success: false, error: 'Tiêu đề tuần không được để trống.' });
  const classData = await prisma.class.findUnique({ where: { id: classId } });
  if (!classData) throw new ApiError(404, { success: false, error: 'Không tìm thấy lớp học.' });
  assertCanManage({ classData, userId, userRole });
  const last = await prisma.week.findFirst({ where: { classId }, orderBy: { order: 'desc' }, select: { order: true } });
  const nextStatus = contentStatus(status);
  return prisma.week.create({ data: { title: title.trim(), description: description?.trim() || null, classId, order: last ? last.order + 1 : 0, status: nextStatus, availableAt: dateValue(availableAt), publishedAt: nextStatus === 'PUBLISHED' ? new Date() : null } });
};

exports.updateWeek = async ({ weekId, title, description, status, availableAt, userId, userRole }) => {
  const week = await prisma.week.findUnique({ where: { id: weekId }, include: { class: { include: { students: { select: { id: true } } } } } });
  if (!week) throw new ApiError(404, { success: false, error: 'Không tìm thấy tuần học.' });
  assertCanManage({ classData: week.class, userId, userRole });
  const nextStatus = status === undefined ? week.status : contentStatus(status);
  const updated = await prisma.week.update({ where: { id: weekId }, data: {
    ...(title !== undefined && { title: String(title).trim() }), ...(description !== undefined && { description: description?.trim() || null }),
    ...(status !== undefined && { status: nextStatus, publishedAt: nextStatus === 'PUBLISHED' ? (week.publishedAt || new Date()) : week.publishedAt }),
    ...(availableAt !== undefined && { availableAt: dateValue(availableAt) }),
  } });
  if (week.status !== 'PUBLISHED' && nextStatus === 'PUBLISHED') await notifyStudents(week.class, `Tuần học mới đã được mở: "${updated.title}".`, `/dashboard/class/${week.classId}?tab=lessons`);
  return updated;
};

const reorderWeeksWithDb = async ({ db, classId, orderedIds, userId, userRole }) => {
  const normalizedIds = normalizeOrderedIds(orderedIds);
  const classData = await db.class.findUnique({ where: { id: classId }, select: { id: true, teacherId: true } });
  if (!classData) throw new ApiError(404, { success: false, error: 'Không tìm thấy lớp học.' });
  assertCanManage({ classData, userId, userRole });
  const existing = await db.week.findMany({ where: { classId }, select: { id: true } });
  assertCompleteOrder(normalizedIds, existing);
  await db.$transaction(normalizedIds.map((id, order) => db.week.update({ where: { id }, data: { order } })));
  return { orderedIds: normalizedIds };
};

exports.reorderWeeksWithDb = reorderWeeksWithDb;
exports.reorderWeeks = args => reorderWeeksWithDb({ db: prisma, ...args });

exports.deleteWeek = async ({ weekId, userId, userRole }) => {
  const week = await prisma.week.findUnique({ where: { id: weekId }, include: { class: true, lessons: { select: { id: true } } } });
  if (!week) throw new ApiError(404, { success: false, error: 'Không tìm thấy tuần học.' });
  assertCanManage({ classData: week.class, userId, userRole });
  await prisma.week.delete({ where: { id: weekId } });
};

exports.createLesson = async ({ weekId, title, summary, status, scheduledAt, durationMinutes, availableAt, userId, userRole }) => {
  if (!String(title || '').trim()) throw new ApiError(400, { success: false, error: 'Tiêu đề buổi học không được để trống.' });
  const week = await prisma.week.findUnique({ where: { id: weekId }, include: { class: true } });
  if (!week) throw new ApiError(404, { success: false, error: 'Không tìm thấy tuần học.' });
  assertCanManage({ classData: week.class, userId, userRole });
  const last = await prisma.lesson.findFirst({ where: { weekId }, orderBy: { order: 'desc' }, select: { order: true } });
  const nextStatus = contentStatus(status);
  if (nextStatus === 'SCHEDULED' && !scheduledAt) throw new ApiError(400, { success: false, error: 'Buổi học đã lên lịch cần ngày và giờ mở.' });
  return prisma.lesson.create({ data: { title: title.trim(), summary: summary?.trim() || null, weekId, order: last ? last.order + 1 : 0, status: nextStatus, scheduledAt: dateValue(scheduledAt), durationMinutes: durationMinutes ? Number(durationMinutes) : null, availableAt: dateValue(availableAt), publishedAt: nextStatus === 'PUBLISHED' ? new Date() : null }, include: { files: true, assignments: true } });
};

exports.updateLesson = async ({ lessonId, title, summary, status, scheduledAt, durationMinutes, availableAt, userId, userRole }) => {
  const lesson = await getLessonWithClass(lessonId);
  if (!lesson) throw new ApiError(404, { success: false, error: 'Không tìm thấy buổi học.' });
  assertCanManage({ classData: lesson.week.class, userId, userRole });
  const nextStatus = status === undefined ? lesson.status : contentStatus(status);
  if (nextStatus === 'SCHEDULED' && !(scheduledAt || lesson.scheduledAt)) throw new ApiError(400, { success: false, error: 'Buổi học đã lên lịch cần ngày và giờ mở.' });
  const updated = await prisma.lesson.update({ where: { id: lessonId }, data: {
    ...(title !== undefined && { title: String(title).trim() }), ...(summary !== undefined && { summary: summary?.trim() || null }),
    ...(status !== undefined && { status: nextStatus, publishedAt: nextStatus === 'PUBLISHED' ? (lesson.publishedAt || new Date()) : lesson.publishedAt }),
    ...(scheduledAt !== undefined && { scheduledAt: dateValue(scheduledAt) }), ...(availableAt !== undefined && { availableAt: dateValue(availableAt) }),
    ...(durationMinutes !== undefined && { durationMinutes: durationMinutes ? Number(durationMinutes) : null }),
  } });
  if (lesson.status !== 'PUBLISHED' && nextStatus === 'PUBLISHED') await notifyStudents(lesson.week.class, `Buổi học mới đã được mở: "${updated.title}".`, `/dashboard/class/${lesson.week.classId}?tab=lessons`);
  return updated;
};

const reorderLessonsWithDb = async ({ db, weekId, orderedIds, userId, userRole }) => {
  const normalizedIds = normalizeOrderedIds(orderedIds);
  const week = await db.week.findUnique({ where: { id: weekId }, include: { class: true } });
  if (!week) throw new ApiError(404, { success: false, error: 'Không tìm thấy tuần học.' });
  assertCanManage({ classData: week.class, userId, userRole });
  const existing = await db.lesson.findMany({ where: { weekId }, select: { id: true } });
  assertCompleteOrder(normalizedIds, existing);
  await db.$transaction(normalizedIds.map((id, order) => db.lesson.update({ where: { id }, data: { order } })));
  return { orderedIds: normalizedIds };
};

exports.reorderLessonsWithDb = reorderLessonsWithDb;
exports.reorderLessons = args => reorderLessonsWithDb({ db: prisma, ...args });

exports.deleteLesson = async ({ lessonId, userId, userRole }) => {
  const lesson = await getLessonWithClass(lessonId);
  if (!lesson) throw new ApiError(404, { success: false, error: 'Không tìm thấy buổi học.' });
  assertCanManage({ classData: lesson.week.class, userId, userRole });
  await prisma.lesson.delete({ where: { id: lessonId } });
};

exports.addFiles = async ({ lessonId, files, userId, userRole }) => {
  if (!Array.isArray(files) || !files.length) throw new ApiError(400, { success: false, error: 'Danh sách tài liệu không hợp lệ.' });
  const lesson = await getLessonWithClass(lessonId);
  if (!lesson) throw new ApiError(404, { success: false, error: 'Không tìm thấy buổi học.' });
  assertCanManage({ classData: lesson.week.class, userId, userRole });
  const last = await prisma.lessonFile.findFirst({ where: { lessonId }, orderBy: { order: 'desc' }, select: { order: true } });
  const normalized = files.map(validateResource);
  return prisma.$transaction(normalized.map((file, index) => prisma.lessonFile.create({ data: { ...file, lessonId, provider: files[index].provider || null, mimeType: files[index].mimeType || null, thumbnailUrl: files[index].thumbnailUrl || null, durationSeconds: files[index].durationSeconds ? Number(files[index].durationSeconds) : null, isRequired: Boolean(files[index].isRequired), availableAt: dateValue(files[index].availableAt), order: (last?.order ?? -1) + index + 1 } })));
};

exports.deleteFile = async ({ fileId, userId, userRole }) => {
  const file = await prisma.lessonFile.findUnique({ where: { id: fileId }, include: { lesson: { include: { week: { include: { class: true } } } } } });
  if (!file) throw new ApiError(404, { success: false, error: 'Không tìm thấy tài liệu.' });
  assertCanManage({ classData: file.lesson.week.class, userId, userRole });
  await prisma.lessonFile.delete({ where: { id: fileId } });
};

exports.openResource = async ({ fileId, completed, positionSeconds, userId, userRole }) => {
  if (userRole !== 'STUDENT') throw new ApiError(403, { success: false, error: 'Chỉ học sinh có tiến độ tài liệu.' });
  const studentId = userIdNumber(userId);
  const file = await prisma.lessonFile.findFirst({ where: { id: fileId, lesson: { week: { class: { students: { some: { id: studentId } } } } } }, select: { lessonId: true } });
  if (!file) throw new ApiError(404, { success: false, error: 'Không tìm thấy tài liệu.' });
  const now = new Date();
  const progress = await prisma.resourceProgress.upsert({ where: { fileId_studentId: { fileId, studentId } }, update: { lastOpenedAt: now, ...(completed && { completedAt: now }), ...(positionSeconds !== undefined && { positionSeconds: Math.max(0, Number(positionSeconds) || 0) }) }, create: { fileId, studentId, openedAt: now, lastOpenedAt: now, completedAt: completed ? now : null, positionSeconds: Math.max(0, Number(positionSeconds) || 0) } });
  const lessonProgress = await prisma.lessonProgress.findUnique({ where: { lessonId_studentId: { lessonId: file.lessonId, studentId } }, select: { status: true } });
  if (lessonProgress?.status !== 'COMPLETED') await prisma.lessonProgress.upsert({ where: { lessonId_studentId: { lessonId: file.lessonId, studentId } }, update: { status: 'IN_PROGRESS', startedAt: now, lastOpenedAt: now }, create: { lessonId: file.lessonId, studentId, status: 'IN_PROGRESS', progress: 1, startedAt: now, lastOpenedAt: now } });
  return progress;
};

exports.completeLesson = async ({ lessonId, completed, userId, userRole }) => {
  if (userRole !== 'STUDENT') throw new ApiError(403, { success: false, error: 'Chỉ học sinh có tiến độ buổi học.' });
  const studentId = userIdNumber(userId);
  const lesson = await prisma.lesson.findFirst({ where: { id: lessonId, status: 'PUBLISHED', week: { class: { students: { some: { id: studentId } } } } }, select: { id: true } });
  if (!lesson) throw new ApiError(404, { success: false, error: 'Không tìm thấy buổi học.' });
  const now = new Date();
  return prisma.lessonProgress.upsert({ where: { lessonId_studentId: { lessonId, studentId } }, update: { status: completed ? 'COMPLETED' : 'IN_PROGRESS', progress: completed ? 100 : 1, lastOpenedAt: now, completedAt: completed ? now : null }, create: { lessonId, studentId, status: completed ? 'COMPLETED' : 'IN_PROGRESS', progress: completed ? 100 : 1, startedAt: now, lastOpenedAt: now, completedAt: completed ? now : null } });
};

exports.createOrUpdateAssignment = async ({ lessonId, title, content, dueDate, testIds, userId, userRole }) => {
  if (!String(title || '').trim()) throw new ApiError(400, { success: false, error: 'Tiêu đề bài tập không được để trống.' });
  const lesson = await getLessonWithClass(lessonId);
  if (!lesson) throw new ApiError(404, { success: false, error: 'Không tìm thấy buổi học.' });
  assertCanManage({ classData: lesson.week.class, userId, userRole });
  const normalizedTestIds = [...new Set((Array.isArray(testIds) ? testIds : []).map(Number).filter(Number.isInteger))];
  const existing = await prisma.lessonAssignment.findUnique({ where: { lessonId }, include: { assignment: { include: { activity: true } } } });
  const deadline = dateValue(dueDate);
  let canonical;
  if (existing?.assignment) {
    canonical = await prisma.assignment.update({ where: { id: existing.assignment.id }, data: { title: title.trim(), content: content || null, deadline, testIds: normalizedTestIds } });
    if (existing.assignment.activity) await prisma.classActivity.update({ where: { id: existing.assignment.activity.activityId }, data: { title: canonical.title, instructions: canonical.content, dueAt: canonical.deadline, lessonId, status: 'PUBLISHED' } });
  } else {
    canonical = await prisma.assignment.create({ data: { title: title.trim(), type: 'assignment', content: content || null, deadline, testIds: normalizedTestIds, fileUrls: [], links: [], classId: lesson.week.classId } });
    await prisma.classActivity.create({ data: { type: 'HOMEWORK', status: 'PUBLISHED', classId: lesson.week.classId, lessonId, title: canonical.title, instructions: canonical.content, dueAt: canonical.deadline, completionRule: 'SUBMIT', audience: 'ALL_STUDENTS', createdById: userIdNumber(userId), homework: { create: { assignmentId: canonical.id } }, assignees: { create: lesson.week.class.students.map(student => ({ studentId: student.id })) } } });
  }
  const assignment = await prisma.lessonAssignment.upsert({ where: { lessonId }, update: { title: canonical.title, content: canonical.content, dueDate: canonical.deadline, testIds: normalizedTestIds, assignmentId: canonical.id }, create: { title: canonical.title, content: canonical.content, dueDate: canonical.deadline, testIds: normalizedTestIds, lessonId, assignmentId: canonical.id } });
  await testDeliveryService.syncClassAssignmentDeliveries({ assignment: canonical, userId, userRole });
  await prisma.testDelivery.updateMany({ where: { sourceAssignmentId: canonical.id }, data: { lessonId } });
  const testAdapters = await prisma.testActivity.findMany({ where: { testDelivery: { sourceAssignmentId: canonical.id } }, select: { activityId: true } });
  if (testAdapters.length) await prisma.classActivity.updateMany({ where: { id: { in: testAdapters.map(item => item.activityId) } }, data: { lessonId } });
  if (!existing) await notifyStudents(lesson.week.class, `Bài tập mới: "${canonical.title}".`, `/dashboard/class/${lesson.week.classId}/assignment/${canonical.id}`);
  return { ...assignment, id: canonical.id, lessonAssignmentId: assignment.id };
};

exports.deleteAssignment = async ({ assignmentId, userId, userRole }) => {
  const assignment = await prisma.lessonAssignment.findFirst({ where: { OR: [{ id: assignmentId }, { assignmentId }] }, include: { lesson: { include: { week: { include: { class: true } } } } } });
  if (!assignment) throw new ApiError(404, { success: false, error: 'Không tìm thấy bài tập.' });
  assertCanManage({ classData: assignment.lesson.week.class, userId, userRole });
  await prisma.testDelivery.updateMany({ where: { OR: [{ sourceLessonAssignmentId: assignment.id }, ...(assignment.assignmentId ? [{ sourceAssignmentId: assignment.assignmentId }] : [])] }, data: { status: 'CLOSED' } });
  if (assignment.assignmentId) await prisma.assignment.delete({ where: { id: assignment.assignmentId } });
  else await prisma.lessonAssignment.delete({ where: { id: assignment.id } });
};
