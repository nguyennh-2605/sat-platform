const prisma = require('../config/prisma');
const ApiError = require('../utils/ApiError');
const {
  normalizeStartInput,
  normalizeExpectedVersion,
  getElapsedMs,
  getAutomaticEndAt,
} = require('../utils/study-session-state');
const { normalizeStudyTimeQuery, aggregateStudyTime } = require('../utils/study-time-aggregation');

const STUDY_SESSION_LOCK_KEY = 8347;
const ACTIVE_STATUSES = ['RUNNING', 'PAUSED'];

const badRequest = (error) => new ApiError(400, { message: error.message });

const serializeSession = (session, now = new Date()) => {
  if (!session) return null;
  const elapsedMs = getElapsedMs(session, now);
  return {
    id: session.id,
    status: session.status,
    source: session.source,
    activityType: session.activityType,
    resourceType: session.resourceType,
    resourceId: session.resourceId,
    label: session.label,
    plannedDurationMs: session.plannedDurationMs,
    accumulatedMs: session.accumulatedMs,
    startedAt: session.startedAt,
    lastResumedAt: session.lastResumedAt,
    endedAt: session.endedAt,
    version: session.version,
    elapsedMs,
    remainingMs: Math.max(0, session.plannedDurationMs - elapsedMs),
  };
};

const envelope = (session, now = new Date()) => ({
  session: serializeSession(session, now),
  serverNow: now,
});

const lockUser = async (tx, userId) => {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(${Number(userId)}::integer, ${STUDY_SESSION_LOCK_KEY}::integer)`;
};

const findOwned = async (tx, userId, id) => {
  const session = await tx.studySession.findFirst({ where: { id: String(id), userId } });
  if (!session) throw new ApiError(404, { message: 'Study session not found.' });
  return session;
};

const completeExpired = async (tx, session, now) => {
  if (session.status !== 'RUNNING' || getElapsedMs(session, now) < session.plannedDurationMs) return session;
  const endedAt = getAutomaticEndAt(session) || now;
  return tx.studySession.update({
    where: { id: session.id },
    data: {
      status: 'COMPLETED',
      accumulatedMs: session.plannedDurationMs,
      lastResumedAt: null,
      endedAt,
      version: { increment: 1 },
    },
  });
};

const assertVersion = (session, expectedVersion) => {
  if (session.version !== expectedVersion) {
    throw new ApiError(409, {
      message: 'This focus session changed in another tab. Refreshing to the latest state.',
      code: 'STUDY_SESSION_VERSION_CONFLICT',
      activeSession: serializeSession(session),
    });
  }
};

exports.getActive = async ({ userId }) => prisma.$transaction(async (tx) => {
  await lockUser(tx, userId);
  const now = new Date();
  const active = await tx.studySession.findFirst({
    where: { userId, status: { in: ACTIVE_STATUSES } },
    orderBy: { startedAt: 'desc' },
  });
  if (!active) return envelope(null, now);
  const reconciled = await completeExpired(tx, active, now);
  return envelope(ACTIVE_STATUSES.includes(reconciled.status) ? reconciled : null, now);
});

exports.getSummary = async ({ userId, query }) => {
  let normalized;
  try { normalized = normalizeStudyTimeQuery(query); } catch (error) { throw badRequest(error); }
  const now = new Date();
  const coarseStart = normalized.range === 'all'
    ? undefined
    : new Date(now.getTime() - (Number(normalized.range) + 2) * 86_400_000);
  const sessions = await prisma.studySession.findMany({
    where: {
      userId,
      status: 'COMPLETED',
      accumulatedMs: { gt: 0 },
      endedAt: { not: null, lte: now, ...(coarseStart ? { gte: coarseStart } : {}) },
    },
    select: { status: true, activityType: true, accumulatedMs: true, plannedDurationMs: true, endedAt: true },
    orderBy: { endedAt: 'asc' },
  });
  return aggregateStudyTime({ sessions, ...normalized, now });
};

exports.start = async ({ userId, body }) => {
  let input;
  try { input = normalizeStartInput(body); } catch (error) { throw badRequest(error); }

  return prisma.$transaction(async (tx) => {
    await lockUser(tx, userId);
    const now = new Date();

    if (input.clientMutationId) {
      const retried = await tx.studySession.findUnique({
        where: { userId_clientMutationId: { userId, clientMutationId: input.clientMutationId } },
      });
      if (retried) return envelope(retried, now);
    }

    const current = await tx.studySession.findFirst({
      where: { userId, status: { in: ACTIVE_STATUSES } },
      orderBy: { startedAt: 'desc' },
    });
    const active = current ? await completeExpired(tx, current, now) : null;
    if (active && ACTIVE_STATUSES.includes(active.status)) {
      throw new ApiError(409, {
        message: 'You already have an active focus session.',
        code: 'ACTIVE_STUDY_SESSION',
        activeSession: serializeSession(active, now),
      });
    }

    const created = await tx.studySession.create({
      data: {
        userId,
        status: 'RUNNING',
        source: 'FOCUS_CLOCK',
        ...input,
        startedAt: now,
        lastResumedAt: now,
      },
    });
    return envelope(created, now);
  });
};

const transition = async ({ userId, id, expectedVersion: rawVersion, action }) => {
  let expectedVersion;
  try { expectedVersion = normalizeExpectedVersion(rawVersion); } catch (error) { throw badRequest(error); }

  return prisma.$transaction(async (tx) => {
    await lockUser(tx, userId);
    const now = new Date();
    let session = await findOwned(tx, userId, id);
    session = await completeExpired(tx, session, now);

    const idempotentStatus = { pause: 'PAUSED', resume: 'RUNNING', finish: 'COMPLETED', cancel: 'CANCELLED' }[action];
    if (session.status === idempotentStatus) return envelope(session, now);
    assertVersion(session, expectedVersion);

    if (!ACTIVE_STATUSES.includes(session.status)) {
      throw new ApiError(409, { message: 'This focus session has already ended.', code: 'STUDY_SESSION_ENDED' });
    }

    if (action === 'pause') {
      if (session.status !== 'RUNNING') throw new ApiError(409, { message: 'Only a running session can be paused.' });
      const elapsedMs = getElapsedMs(session, now);
      session = await tx.studySession.update({ where: { id: session.id }, data: { status: 'PAUSED', accumulatedMs: elapsedMs, lastResumedAt: null, version: { increment: 1 } } });
    } else if (action === 'resume') {
      if (session.status !== 'PAUSED') throw new ApiError(409, { message: 'Only a paused session can be resumed.' });
      session = await tx.studySession.update({ where: { id: session.id }, data: { status: 'RUNNING', lastResumedAt: now, version: { increment: 1 } } });
    } else {
      const elapsedMs = getElapsedMs(session, now);
      const status = action === 'finish' ? 'COMPLETED' : 'CANCELLED';
      session = await tx.studySession.update({
        where: { id: session.id },
        data: { status, accumulatedMs: elapsedMs, lastResumedAt: null, endedAt: now, version: { increment: 1 } },
      });
    }

    return envelope(session, now);
  });
};

exports.pause = (input) => transition({ ...input, action: 'pause' });
exports.resume = (input) => transition({ ...input, action: 'resume' });
exports.finish = (input) => transition({ ...input, action: 'finish' });
exports.cancel = (input) => transition({ ...input, action: 'cancel' });

exports.serializeSession = serializeSession;
