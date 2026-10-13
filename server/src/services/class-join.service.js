const prisma = require('../config/prisma');
const ApiError = require('../utils/ApiError');
const { AUDIT_ACTIONS, recordAuditEvent } = require('./audit-event.service');

// Teachers already share Class.id through the existing Copy class code action.
const normalizeClassCode = code => {
  if (typeof code !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(code.trim())) {
    throw new ApiError(400, { error: 'Enter the class code shared by your teacher.' });
  }
  return code.trim().toLowerCase();
};

async function joinClassWithDb({ db, userId, userRole, code }) {
  const studentId = Number(userId);
  if (!Number.isSafeInteger(studentId) || studentId <= 0) throw new ApiError(401, { error: 'Sign in to join a class.' });
  if (userRole !== 'STUDENT') throw new ApiError(403, { error: 'Only students can join a class with a code.' });
  const classId = normalizeClassCode(code);

  return db.$transaction(async tx => {
    const student = await tx.user.findUnique({ where: { id: studentId }, select: { id: true, name: true, role: true } });
    if (!student) throw new ApiError(401, { error: 'Sign in to join a class.' });
    if (student.role !== 'STUDENT') throw new ApiError(403, { error: 'Only students can join a class with a code.' });
    const classroom = await tx.class.findUnique({
      where: { id: classId },
      select: { id: true, name: true, students: { where: { id: studentId }, select: { id: true }, take: 1 } },
    });
    if (!classroom) throw new ApiError(404, { error: 'No class matches this code. Check the code with your teacher.' });
    const result = { classroom: { id: classroom.id, name: classroom.name }, alreadyJoined: classroom.students.length > 0 };
    if (result.alreadyJoined) return result;

    await tx.class.update({ where: { id: classId }, data: { students: { connect: { id: studentId } } }, select: { id: true } });
    const activities = await tx.classActivity.findMany({
      where: { classId, status: 'PUBLISHED', audience: 'ALL_STUDENTS' },
      select: { id: true, test: { select: { testDeliveryId: true } } },
    });
    if (activities.length) await tx.activityAssignee.createMany({
      data: activities.map(activity => ({ activityId: activity.id, studentId })), skipDuplicates: true,
    });
    const deliveryIds = activities.flatMap(activity => activity.test ? [activity.test.testDeliveryId] : []);
    const deliveries = await tx.testDelivery.findMany({
      where: { classId, status: 'PUBLISHED', OR: [{ activity: { is: null } }, { id: { in: deliveryIds } }] },
      select: { id: true },
    });
    if (deliveries.length) await tx.deliveryAssignee.createMany({
      data: deliveries.map(delivery => ({ deliveryId: delivery.id, studentId })), skipDuplicates: true,
    });
    await recordAuditEvent(tx, {
      action: AUDIT_ACTIONS.CLASS_STUDENT_ADDED,
      actorUserId: studentId, actorLabel: student.name || 'Student', actorRole: 'STUDENT',
      entityType: 'CLASS', entityId: classId, entityLabel: classroom.name,
      metadata: { memberLabel: student.name || 'Student' },
    });
    return result;
  });
}

exports.joinClass = params => joinClassWithDb({ ...params, db: prisma });
exports.joinClassWithDb = joinClassWithDb;
exports.normalizeClassCode = normalizeClassCode;
