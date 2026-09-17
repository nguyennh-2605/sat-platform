const nextBlockOrder = async (db, lessonId) => {
  const last = await db.lessonBlock.findFirst({
    where: { lessonId: String(lessonId) },
    orderBy: [{ order: 'desc' }, { createdAt: 'desc' }],
    select: { order: true },
  });
  return (last?.order ?? -1) + 1;
};

const LESSON_BLOCK_PHASES = new Set(['BEFORE_CLASS', 'DURING_CLASS', 'AFTER_CLASS']);

const lessonBlockPhase = value => {
  const phase = String(value || 'DURING_CLASS').toUpperCase();
  if (!LESSON_BLOCK_PHASES.has(phase)) throw new ApiError(400, { error: 'Lesson phase is invalid.' });
  return phase;
};

const createResourceBlockWithDb = async ({ db, lessonId, resourceId, title, isRequired = false, phase }) => {
  const existing = await db.lessonBlock.findUnique({ where: { resourceId: String(resourceId) } });
  if (existing) return existing;
  return db.lessonBlock.create({
    data: {
      lessonId: String(lessonId),
      kind: 'RESOURCE',
      phase: lessonBlockPhase(phase),
      order: await nextBlockOrder(db, lessonId),
      title: String(title || '').trim() || null,
      isRequired: Boolean(isRequired),
      resourceId: String(resourceId),
    },
  });
};

const createActivityBlockWithDb = async ({ db, lessonId, activityId, title, isRequired = true, phase }) => {
  if (!lessonId) return null;
  const existing = await db.lessonBlock.findUnique({ where: { activityId: String(activityId) } });
  if (existing) return existing;
  return db.lessonBlock.create({
    data: {
      lessonId: String(lessonId),
      kind: 'ACTIVITY',
      phase: lessonBlockPhase(phase),
      order: await nextBlockOrder(db, lessonId),
      title: String(title || '').trim() || null,
      isRequired: Boolean(isRequired),
      activityId: String(activityId),
    },
  });
};

module.exports = {
  nextBlockOrder,
  lessonBlockPhase,
  createResourceBlockWithDb,
  createActivityBlockWithDb,
};
const ApiError = require('../utils/ApiError');
