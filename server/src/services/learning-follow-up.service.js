const prisma = require('../config/prisma');
const ApiError = require('../utils/ApiError');

const SOURCES = new Set(['SKILL_SIGNAL', 'STUDENT_CHECK_IN', 'ASSESSMENT', 'MANUAL']);
const ACTIONS = new Set(['TEST', 'HOMEWORK', 'CHECK_IN']);
const TERMINAL_UPDATES = new Set(['RESOLVED', 'NEEDS_FOLLOW_UP', 'DISMISSED']);

const optionalText = (value, maxLength) => {
  const normalized = String(value || '').trim();
  if (!normalized) return null;
  if (normalized.length > maxLength) throw new ApiError(400, { error: 'Follow-up context is too long.' });
  return normalized;
};

const optionalPercent = value => {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  if (!Number.isInteger(number) || number < 0 || number > 100) throw new ApiError(400, { error: 'Follow-up percentages must be whole numbers from 0 to 100.' });
  return number;
};

const optionalCount = value => {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  if (!Number.isInteger(number) || number < 0 || number > 1_000_000) throw new ApiError(400, { error: 'Follow-up evidence counts are invalid.' });
  return number;
};

const normalizeFollowUp = ({ followUp, actionType, assigneeIds }) => {
  if (!followUp) return null;
  const sourceType = SOURCES.has(followUp.sourceType) ? followUp.sourceType : 'MANUAL';
  const normalizedAction = ACTIONS.has(actionType) ? actionType : null;
  if (!normalizedAction) throw new ApiError(400, { error: 'Follow-up action is invalid.' });
  const eligible = new Set(assigneeIds.map(Number));
  const requested = Array.isArray(followUp.studentIds)
    ? [...new Set(followUp.studentIds.map(Number).filter(Number.isInteger))]
    : [...eligible];
  if (!requested.length || requested.some(studentId => !eligible.has(studentId))) {
    throw new ApiError(400, { error: 'Follow-up students must match the activity audience.' });
  }
  const subject = followUp.subject === 'RW' || followUp.subject === 'MATH' ? followUp.subject : null;
  const baselineAccuracy = optionalPercent(followUp.baselineAccuracy);
  const baselineCorrect = optionalCount(followUp.baselineCorrect);
  const baselineAnswerCount = optionalCount(followUp.baselineAnswerCount);
  return {
    sourceType,
    actionType: normalizedAction,
    subject,
    domainCode: optionalText(followUp.domainCode, 80),
    domainName: optionalText(followUp.domainName, 160),
    skillCode: optionalText(followUp.skillCode, 80),
    skillName: optionalText(followUp.skillName, 160),
    sourceDeliveryId: optionalText(followUp.sourceDeliveryId, 80),
    sourceStudentId: followUp.sourceStudentId !== null && followUp.sourceStudentId !== undefined && Number.isInteger(Number(followUp.sourceStudentId)) ? Number(followUp.sourceStudentId) : null,
    reason: optionalText(followUp.reason, 500),
    baselineAccuracy,
    baselineCorrect,
    baselineAnswerCount,
    baselineStudentCount: optionalCount(followUp.baselineStudentCount),
    classificationCoverage: optionalPercent(followUp.classificationCoverage),
    studentIds: requested,
  };
};

exports.createFollowUpWithDb = async ({ db, classroom, assigneeIds, userId, actionType, followUp }) => {
  const normalized = normalizeFollowUp({ followUp, actionType, assigneeIds });
  if (!normalized) return null;
  const classStudentIds = new Set(classroom.students.map(student => student.id));
  if (normalized.studentIds.some(studentId => !classStudentIds.has(studentId))) {
    throw new ApiError(400, { error: 'One or more follow-up students are not enrolled in this class.' });
  }
  if (normalized.sourceStudentId && !classStudentIds.has(normalized.sourceStudentId)) {
    throw new ApiError(400, { error: 'The follow-up source student is not enrolled in this class.' });
  }
  return db.learningFollowUp.create({
    data: {
      classId: classroom.id,
      createdById: Number(userId),
      sourceType: normalized.sourceType,
      actionType: normalized.actionType,
      status: 'ASSIGNED',
      subject: normalized.subject,
      domainCode: normalized.domainCode,
      domainName: normalized.domainName,
      skillCode: normalized.skillCode,
      skillName: normalized.skillName,
      sourceDeliveryId: normalized.sourceDeliveryId,
      sourceStudentId: normalized.sourceStudentId,
      reason: normalized.reason,
      baselineAccuracy: normalized.baselineAccuracy,
      baselineCorrect: normalized.baselineCorrect,
      baselineAnswerCount: normalized.baselineAnswerCount,
      baselineStudentCount: normalized.baselineStudentCount,
      classificationCoverage: normalized.classificationCoverage,
      targets: {
        create: normalized.studentIds.map(studentId => ({
          studentId,
          baselineAccuracy: normalized.sourceStudentId === studentId ? normalized.baselineAccuracy : null,
          baselineCorrect: normalized.sourceStudentId === studentId ? normalized.baselineCorrect : null,
          baselineAnswerCount: normalized.sourceStudentId === studentId ? normalized.baselineAnswerCount : null,
        })),
      },
    },
    select: { id: true },
  });
};

exports.updateFollowUp = async ({ classId, followUpId, userId, userRole, status, resolutionNote }) => {
  if (!TERMINAL_UPDATES.has(status)) throw new ApiError(400, { error: 'Choose a valid follow-up outcome.' });
  const existing = await prisma.learningFollowUp.findUnique({
    where: { id: String(followUpId) },
    select: { id: true, classId: true, class: { select: { teacherId: true } } },
  });
  if (!existing || existing.classId !== String(classId)) throw new ApiError(404, { error: 'Follow-up not found.' });
  if (userRole !== 'ADMIN' && existing.class.teacherId !== Number(userId)) {
    throw new ApiError(403, { error: 'You do not have permission to update this follow-up.' });
  }
  const note = optionalText(resolutionNote, 2_000);
  return prisma.learningFollowUp.update({
    where: { id: existing.id },
    data: {
      status,
      resolutionNote: note,
      resolvedAt: status === 'RESOLVED' || status === 'DISMISSED' ? new Date() : null,
    },
  });
};

exports.normalizeFollowUp = normalizeFollowUp;
