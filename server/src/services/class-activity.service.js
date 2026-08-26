const prisma = require('../config/prisma');
const ApiError = require('../utils/ApiError');

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

  return prisma.classActivity.findMany({
    where: {
      classId: String(classId),
      ...(canManage ? {} : {
        status: 'PUBLISHED',
        assignees: { some: { studentId: intId(userId), excusedAt: null } },
      }),
    },
    orderBy: [{ dueAt: 'asc' }, { createdAt: 'desc' }],
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
      assignees: canManage
        ? { select: { studentId: true, status: true, bestScore: true, attemptCount: true, excusedAt: true } }
        : { where: { studentId: intId(userId) }, select: { studentId: true, status: true, bestScore: true, attemptCount: true, excusedAt: true } },
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
};
