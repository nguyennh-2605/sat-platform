const prisma = require('../config/prisma');
const ApiError = require('../utils/ApiError');
const questionBankService = require('./question-bank.service');

const normalizeBlocks = value => {
  if (!Array.isArray(value)) return [];
  return value
    .filter(block => block && typeof block === 'object')
    .map(block => ({ type: 'text', content: String(block.content || '').trim() }))
    .filter(block => block.content);
};

const normalizeSkillCodes = value => [...new Set((Array.isArray(value) ? value : []).map(String).filter(Boolean))];

const assertSkills = async (db, skillCodes) => {
  if (!skillCodes.length) throw new ApiError(400, { error: 'Choose at least one skill for this milestone.' });
  const skills = await db.questionSkill.findMany({ where: { code: { in: skillCodes } }, select: { code: true } });
  if (skills.length !== skillCodes.length) throw new ApiError(400, { error: 'One or more selected skills are invalid.' });
};

const serializeAdminRoadmap = roadmap => ({
  ...roadmap,
  milestones: roadmap.milestones.map(milestone => ({
    ...milestone,
    skillCodes: milestone.skills.map(item => item.skillCode),
    skills: milestone.skills.map(item => item.skill),
  })),
});

exports.listAdminRoadmaps = async () => {
  const roadmaps = await prisma.roadmap.findMany({
    orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
    include: {
      milestones: {
        orderBy: { order: 'asc' },
        include: { skills: { include: { skill: { select: { code: true, name: true, domain: { select: { code: true, name: true, subject: true } } } } } } },
      },
    },
  });
  return roadmaps.map(serializeAdminRoadmap);
};

exports.createRoadmap = async ({ userId, payload }) => {
  const title = String(payload.title || '').trim();
  if (!title) throw new ApiError(400, { error: 'Roadmap title is required.' });
  return prisma.roadmap.create({
    data: { title, description: String(payload.description || '').trim() || null, createdById: Number(userId) },
    select: { id: true, title: true, description: true, status: true, createdAt: true, updatedAt: true },
  });
};

exports.updateRoadmap = async ({ roadmapId, payload }) => {
  const existing = await prisma.roadmap.findUnique({ where: { id: String(roadmapId) }, select: { id: true } });
  if (!existing) throw new ApiError(404, { error: 'Roadmap not found.' });
  const title = payload.title === undefined ? undefined : String(payload.title || '').trim();
  if (title !== undefined && !title) throw new ApiError(400, { error: 'Roadmap title is required.' });
  return prisma.roadmap.update({
    where: { id: existing.id },
    data: { ...(title !== undefined ? { title } : {}), ...(payload.description !== undefined ? { description: String(payload.description || '').trim() || null } : {}) },
    select: { id: true, title: true, description: true, status: true, updatedAt: true },
  });
};

exports.createMilestone = async ({ roadmapId, payload }) => prisma.$transaction(async tx => {
  const roadmap = await tx.roadmap.findUnique({ where: { id: String(roadmapId) }, select: { id: true, _count: { select: { milestones: true } } } });
  if (!roadmap) throw new ApiError(404, { error: 'Roadmap not found.' });
  const title = String(payload.title || '').trim();
  if (!title) throw new ApiError(400, { error: 'Milestone title is required.' });
  const skillCodes = normalizeSkillCodes(payload.skillCodes);
  await assertSkills(tx, skillCodes);
  const requiredQuestionCount = Math.min(200, Math.max(1, Number.parseInt(payload.requiredQuestionCount, 10) || 1));
  return tx.roadmapMilestone.create({
    data: {
      roadmapId: roadmap.id,
      title,
      description: String(payload.description || '').trim() || null,
      order: roadmap._count.milestones + 1,
      theoryBlocks: normalizeBlocks(payload.theoryBlocks),
      requiredQuestionCount,
      skills: { create: skillCodes.map(skillCode => ({ skillCode })) },
    },
    include: { skills: { include: { skill: { select: { code: true, name: true } } } } },
  });
});

exports.updateMilestone = async ({ roadmapId, milestoneId, payload }) => prisma.$transaction(async tx => {
  const existing = await tx.roadmapMilestone.findFirst({ where: { id: String(milestoneId), roadmapId: String(roadmapId) } });
  if (!existing) throw new ApiError(404, { error: 'Milestone not found.' });
  const skillCodes = payload.skillCodes === undefined ? null : normalizeSkillCodes(payload.skillCodes);
  if (skillCodes) await assertSkills(tx, skillCodes);
  const title = payload.title === undefined ? undefined : String(payload.title || '').trim();
  if (title !== undefined && !title) throw new ApiError(400, { error: 'Milestone title is required.' });
  const requiredQuestionCount = payload.requiredQuestionCount === undefined
    ? undefined
    : Math.min(200, Math.max(1, Number.parseInt(payload.requiredQuestionCount, 10) || 1));
  return tx.roadmapMilestone.update({
    where: { id: existing.id },
    data: {
      ...(title !== undefined ? { title } : {}),
      ...(payload.description !== undefined ? { description: String(payload.description || '').trim() || null } : {}),
      ...(payload.theoryBlocks !== undefined ? { theoryBlocks: normalizeBlocks(payload.theoryBlocks) } : {}),
      ...(requiredQuestionCount !== undefined ? { requiredQuestionCount } : {}),
      ...(skillCodes ? { skills: { deleteMany: {}, create: skillCodes.map(skillCode => ({ skillCode })) } } : {}),
    },
    include: { skills: { include: { skill: { select: { code: true, name: true } } } } },
  });
});

exports.publishRoadmap = async ({ roadmapId }) => prisma.$transaction(async tx => {
  const roadmap = await tx.roadmap.findUnique({
    where: { id: String(roadmapId) },
    include: { milestones: { orderBy: { order: 'asc' }, include: { skills: { select: { skillCode: true } } } } },
  });
  if (!roadmap) throw new ApiError(404, { error: 'Roadmap not found.' });
  if (!roadmap.milestones.length) throw new ApiError(400, { error: 'Add at least one milestone before publishing.' });
  for (const milestone of roadmap.milestones) {
    const poolCount = await tx.questionBankItem.count({
      where: { scope: 'SYSTEM', status: 'PUBLISHED', skillCode: { in: milestone.skills.map(item => item.skillCode) } },
    });
    if (poolCount < milestone.requiredQuestionCount) {
      throw new ApiError(400, { error: `“${milestone.title}” needs ${milestone.requiredQuestionCount} published questions but currently has ${poolCount}.` });
    }
  }
  await tx.roadmap.updateMany({ where: { status: 'PUBLISHED', id: { not: roadmap.id } }, data: { status: 'ARCHIVED' } });
  return tx.roadmap.update({ where: { id: roadmap.id }, data: { status: 'PUBLISHED' }, select: { id: true, title: true, status: true, updatedAt: true } });
});

exports.getStudentRoadmap = async ({ userId }) => {
  const roadmap = await prisma.roadmap.findFirst({
    where: { status: 'PUBLISHED' },
    orderBy: { updatedAt: 'desc' },
    include: {
      milestones: {
        orderBy: { order: 'asc' },
        include: {
          skills: { include: { skill: { select: { code: true, name: true, domain: { select: { code: true, name: true, subject: true } } } } } },
          progress: { where: { userId: Number(userId) }, take: 1 },
        },
      },
    },
  });
  if (!roadmap) return null;
  const milestoneIds = roadmap.milestones.map(item => item.id);
  const attemptCounts = milestoneIds.length ? await prisma.bankQuestionAttempt.groupBy({
    by: ['milestoneId', 'questionId'],
    where: { userId: Number(userId), milestoneId: { in: milestoneIds } },
  }) : [];
  const answeredByMilestone = new Map();
  attemptCounts.forEach(item => answeredByMilestone.set(item.milestoneId, (answeredByMilestone.get(item.milestoneId) || 0) + 1));
  let previousComplete = true;
  return {
    id: roadmap.id,
    title: roadmap.title,
    description: roadmap.description,
    milestones: roadmap.milestones.map(milestone => {
      const progress = milestone.progress[0] || null;
      const answeredCount = answeredByMilestone.get(milestone.id) || 0;
      const completed = Boolean(progress?.completedAt) || answeredCount >= milestone.requiredQuestionCount;
      const locked = !previousComplete;
      previousComplete = previousComplete && completed;
      return {
        id: milestone.id,
        title: milestone.title,
        description: milestone.description,
        order: milestone.order,
        theoryBlocks: milestone.theoryBlocks,
        requiredQuestionCount: milestone.requiredQuestionCount,
        answeredCount,
        theoryConfirmedAt: progress?.theoryConfirmedAt || null,
        completedAt: progress?.completedAt || (completed ? new Date() : null),
        locked,
        skills: milestone.skills.map(item => item.skill),
      };
    }),
  };
};

const assertUnlockedMilestone = async ({ milestoneId, userId }) => {
  const roadmap = await exports.getStudentRoadmap({ userId });
  const milestone = roadmap?.milestones.find(item => item.id === String(milestoneId));
  if (!milestone) throw new ApiError(404, { error: 'Milestone not found.' });
  if (milestone.locked) throw new ApiError(403, { error: 'Complete the previous milestone first.' });
  return milestone;
};

exports.getMilestoneQuestions = async ({ milestoneId, userId, query = {} }) => {
  await assertUnlockedMilestone({ milestoneId, userId });
  const milestone = await prisma.roadmapMilestone.findUnique({
    where: { id: String(milestoneId) },
    select: { skills: { select: { skillCode: true } } },
  });
  const page = Math.max(1, Number.parseInt(query.page, 10) || 1);
  const limit = Math.min(40, Math.max(1, Number.parseInt(query.limit, 10) || 20));
  const where = { scope: 'SYSTEM', status: 'PUBLISHED', skillCode: { in: milestone.skills.map(item => item.skillCode) } };
  const [total, items] = await Promise.all([
    prisma.questionBankItem.count({ where }),
    prisma.questionBankItem.findMany({
      where,
      orderBy: [{ skillCode: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
      skip: (page - 1) * limit,
      take: limit,
      include: {
        owner: { select: { name: true } }, domain: { select: { code: true, name: true } }, skill: { select: { code: true, name: true } },
        versions: { orderBy: { version: 'desc' }, take: 1 }, progress: { where: { userId: Number(userId) }, take: 1 },
      },
    }),
  ]);
  const lockedIds = await questionBankService.activeLockedQuestionIds({ userId, questionIds: items.map(item => item.id) });
  return {
    items: items.map(item => questionBankService.serializeItem({ item, includeSolution: false, solutionLocked: lockedIds.has(item.id) })),
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
};

exports.confirmTheory = async ({ milestoneId, userId }) => {
  await assertUnlockedMilestone({ milestoneId, userId });
  return prisma.studentMilestoneProgress.upsert({
    where: { userId_milestoneId: { userId: Number(userId), milestoneId: String(milestoneId) } },
    update: { theoryConfirmedAt: new Date() },
    create: { userId: Number(userId), milestoneId: String(milestoneId), theoryConfirmedAt: new Date() },
    select: { theoryConfirmedAt: true, completedAt: true },
  });
};

exports.answerQuestion = async ({ milestoneId, questionId, selectedChoice, userId }) => {
  await assertUnlockedMilestone({ milestoneId, userId });
  return questionBankService.answerRoadmapQuestion({ milestoneId, questionId, selectedChoice, userId });
};
