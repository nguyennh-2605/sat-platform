const prisma = require('../config/prisma');
const ApiError = require('../utils/ApiError');
const { AUDIT_ACTIONS, recordAuditEvent } = require('./audit-event.service');

const userSelect = { id: true, name: true, email: true, role: true, googleSubject: true };
const include = { user: { select: { id: true, name: true, email: true, role: true } } };
const serialize = request => request ? {
  id: request.id, reason: request.reason, status: request.status,
  reviewNote: request.reviewNote, createdAt: request.createdAt, updatedAt: request.updatedAt,
  reviewedAt: request.reviewedAt, ...(request.user ? { user: request.user } : {}),
} : null;

const boundedText = (value, required = false) => {
  if (value == null && !required) return null;
  if (typeof value !== 'string' || (required && !value.trim())) throw new ApiError(400, { error: 'Explain why you need teacher access.' });
  const text = value.trim();
  if (text.length > 1000) throw new ApiError(400, { error: 'Use 1,000 characters or fewer.' });
  return text || null;
};

const requireUser = async (db, userId, roles) => {
  const user = await db.user.findUnique({ where: { id: Number(userId) }, select: userSelect });
  if (!user) throw new ApiError(401, { error: 'Account is unavailable.' });
  if (roles && !roles.includes(user.role)) throw new ApiError(403, { error: 'You do not have permission to perform this action.' });
  return user;
};

exports.getMine = async ({ userId, db = prisma }) => {
  const user = await requireUser(db, userId);
  const request = await db.teacherAccessRequest.findUnique({ where: { userId: user.id } });
  return { role: user.role, request: serialize(request) };
};

exports.submit = async ({ userId, reason, db = prisma }) => {
  const text = boundedText(reason, true);
  try {
    return await db.$transaction(async tx => {
      const user = await requireUser(tx, userId, ['STUDENT']);
      if (!user.googleSubject) throw new ApiError(409, { error: 'Sign in with Google before requesting teacher access.' });
      const existing = await tx.teacherAccessRequest.findUnique({ where: { userId: user.id } });
      if (existing?.status === 'PENDING') return { role: user.role, request: serialize(existing) };
      if (existing?.status === 'APPROVED') throw new ApiError(409, { error: 'This request was already approved. Refresh your account status.' });
      const data = { reason: text, status: 'PENDING', reviewNote: null, reviewedAt: null, reviewedById: null };
      let request;
      if (existing) {
        const changed = await tx.teacherAccessRequest.updateMany({ where: { id: existing.id, status: 'REJECTED' }, data });
        if (changed.count !== 1) throw new ApiError(409, { error: 'Request status changed. Refresh and try again.' });
        request = await tx.teacherAccessRequest.findUnique({ where: { id: existing.id } });
      } else {
        request = await tx.teacherAccessRequest.create({ data: { userId: user.id, ...data } });
      }
      await recordAuditEvent(tx, { action: AUDIT_ACTIONS.TEACHER_ACCESS_REQUESTED, actorUserId: user.id, actorLabel: user.name, actorRole: user.role, entityType: 'TEACHER_ACCESS_REQUEST', entityId: request.id, entityLabel: user.name || user.email });
      return { role: user.role, request: serialize(request) };
    });
  } catch (error) {
    if (error.code === 'P2002') throw new ApiError(409, { error: 'A request already exists. Refresh your account status.' });
    throw error;
  }
};

exports.list = async ({ userId, status = 'PENDING', cursor, db = prisma }) => {
  await requireUser(db, userId, ['ADMIN']);
  if (!['PENDING', 'APPROVED', 'REJECTED'].includes(status)) throw new ApiError(400, { error: 'Invalid request status.' });
  // User IDs are unique, immutable integers, so pagination remains stable after reviews.
  const afterId = cursor == null || cursor === '' ? null : Number(cursor);
  if (afterId !== null && (!Number.isSafeInteger(afterId) || afterId < 1)) throw new ApiError(400, { error: 'Invalid request cursor.' });
  const rows = await db.teacherAccessRequest.findMany({ where: { status, ...(afterId ? { userId: { gt: afterId } } : {}) }, include, orderBy: { userId: 'asc' }, take: 26 });
  const items = rows.slice(0, 25);
  return { items: items.map(serialize), nextCursor: rows.length > 25 ? String(items.at(-1).userId) : null };
};

exports.review = async ({ userId, requestId, decision, reviewNote, db = prisma }) => {
  if (!['APPROVED', 'REJECTED'].includes(decision)) throw new ApiError(400, { error: 'Choose approve or reject.' });
  if (typeof requestId !== 'string' || requestId.length > 100) throw new ApiError(400, { error: 'Invalid request ID.' });
  const note = boundedText(reviewNote);
  return db.$transaction(async tx => {
    const admin = await requireUser(tx, userId, ['ADMIN']);
    const request = await tx.teacherAccessRequest.findUnique({ where: { id: requestId }, include });
    if (!request) throw new ApiError(404, { error: 'Request not found.' });
    if (request.status !== 'PENDING') throw new ApiError(409, { error: 'This request has already been reviewed.' });
    const changed = await tx.teacherAccessRequest.updateMany({ where: { id: requestId, status: 'PENDING' }, data: { status: decision, reviewNote: note, reviewedAt: new Date(), reviewedById: admin.id } });
    if (changed.count !== 1) throw new ApiError(409, { error: 'Another admin already reviewed this request.' });
    if (decision === 'APPROVED') {
      const promoted = await tx.user.updateMany({ where: { id: request.userId, role: 'STUDENT', googleSubject: { not: null } }, data: { role: 'TEACHER' } });
      if (promoted.count !== 1) throw new ApiError(409, { error: 'The applicant account changed. Refresh before reviewing.' });
    }
    await recordAuditEvent(tx, { action: decision === 'APPROVED' ? AUDIT_ACTIONS.TEACHER_ACCESS_APPROVED : AUDIT_ACTIONS.TEACHER_ACCESS_REJECTED, actorUserId: admin.id, actorLabel: admin.name, actorRole: admin.role, entityType: 'TEACHER_ACCESS_REQUEST', entityId: requestId, entityLabel: request.user.name || request.user.email });
    return serialize(await tx.teacherAccessRequest.findUnique({ where: { id: requestId }, include }));
  });
};

exports._private = { serialize, boundedText };
