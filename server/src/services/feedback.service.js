const { randomUUID } = require('node:crypto');
const prisma = require('../config/prisma');
const ApiError = require('../utils/ApiError');
const { getObjectStorage } = require('../storage/object-storage');
const { _imageHelpers: { imageDimensions, MAX_IMAGE_BYTES } } = require('./test-image.service');

const LEVELS = ['CRITICAL', 'MAJOR', 'MINOR', 'IMPROVEMENT', 'GENERAL'];
const STATUSES = ['NEW', 'IN_PROGRESS', 'RESOLVED'];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EXTENSIONS = { 'image/png': '.png', 'image/jpeg': '.jpg', 'image/webp': '.webp' };
const assetSelect = { id: true, originalName: true, mimeType: true, sizeBytes: true };
const include = { user: { select: { id: true, name: true, email: true, role: true } }, attachments: { include: { asset: { select: assetSelect } } } };
const serialize = row => ({ ...row, attachments: row.attachments.map(({ asset }) => ({ id: asset.id, name: asset.originalName, mimeType: asset.mimeType, sizeBytes: asset.sizeBytes })) });

async function requireUser(db, userId, adminOnly = false) {
  const user = await db.user.findUnique({ where: { id: Number(userId) }, select: { id: true, role: true } });
  if (!user) throw new ApiError(401, { error: 'Account is unavailable.' });
  if (adminOnly && user.role !== 'ADMIN') throw new ApiError(403, { error: 'Only admins can review feedback.' });
  return user;
}

function storageClient(storageFactory) {
  try { return storageFactory(); }
  catch { throw new ApiError(503, { error: 'Image uploads are unavailable. You can still send feedback without images.' }); }
}

exports.uploadImage = async ({ userId, file, db = prisma, storageFactory = getObjectStorage }) => {
  const user = await requireUser(db, userId);
  if (!file || !Buffer.isBuffer(file.buffer) || !EXTENSIONS[file.mimetype] || file.buffer.length === 0 || file.buffer.length > MAX_IMAGE_BYTES) {
    throw new ApiError(400, { error: 'Choose a PNG, JPEG, or WebP image of 5 MB or less.' });
  }
  const dimensions = imageDimensions(file.buffer, file.mimetype);
  if (!dimensions || dimensions.some(value => value < 1 || value > 8192) || dimensions[0] * dimensions[1] > 24 * 1024 * 1024) {
    throw new ApiError(400, { error: 'This file is not a supported image or its dimensions are too large.' });
  }
  const name = String(file.originalname || 'Screenshot').replace(/[\u0000-\u001f]/g, '').trim().slice(0, 255) || 'Screenshot';
  const storage = storageClient(storageFactory);
  const asset = await db.fileAsset.create({ data: {
    ownerId: user.id, purpose: 'FEEDBACK_IMAGE', provider: storage.provider,
    storageKey: `feedback/${user.id}/${randomUUID()}${EXTENSIONS[file.mimetype]}`,
    originalName: name, mimeType: file.mimetype, sizeBytes: file.buffer.length,
  } });
  try {
    // Server-owned upload prevents clients overwriting a verified image through a live PUT URL.
    await storage.putObject({ storageKey: asset.storageKey, mimeType: file.mimetype, bytes: file.buffer });
    await db.fileAsset.update({ where: { id: asset.id }, data: { status: 'READY' } });
    return { id: asset.id, name, mimeType: file.mimetype, sizeBytes: file.buffer.length };
  } catch (error) {
    await db.fileAsset.update({ where: { id: asset.id }, data: { status: 'PENDING_DELETE' } }).catch(() => undefined);
    throw error;
  }
};

exports.submit = async ({ userId, submissionId, level, message, pagePath, attachmentIds = [], db = prisma }) => {
  if (typeof submissionId !== 'string' || !UUID.test(submissionId)) throw new ApiError(400, { error: 'Invalid submission ID.' });
  if (!LEVELS.includes(level)) throw new ApiError(400, { error: 'Choose a feedback level.' });
  if (typeof message !== 'string' || !message.trim() || message.trim().length > 5000) throw new ApiError(400, { error: 'Enter feedback using 5,000 characters or fewer.' });
  if (pagePath != null && (typeof pagePath !== 'string' || pagePath.length > 500 || !pagePath.startsWith('/') || pagePath.startsWith('//') || /[\u0000-\u001f?#]/.test(pagePath))) throw new ApiError(400, { error: 'Invalid page path.' });
  if (!Array.isArray(attachmentIds) || attachmentIds.length > 3 || new Set(attachmentIds).size !== attachmentIds.length || attachmentIds.some(id => typeof id !== 'string' || !UUID.test(id))) throw new ApiError(400, { error: 'Attach up to three images.' });
  const input = { id: submissionId, userId: Number(userId), level, message: message.trim(), pagePath: pagePath || null };
  const existingResult = row => {
    if (row.userId !== input.userId || row.level !== input.level || row.message !== input.message || row.pagePath !== input.pagePath || row.attachments.length !== attachmentIds.length || row.attachments.some(item => !attachmentIds.includes(item.asset.id))) throw new ApiError(409, { error: 'This submission ID was already used.' });
    return serialize(row);
  };
  try {
    return await db.$transaction(async tx => {
      await requireUser(tx, userId);
      const existing = await tx.feedback.findUnique({ where: { id: submissionId }, include });
      if (existing) return existingResult(existing);
      const assets = await tx.fileAsset.findMany({ where: { id: { in: attachmentIds }, ownerId: input.userId, purpose: 'FEEDBACK_IMAGE', status: 'READY', feedbackAttachment: null }, select: { id: true } });
      if (assets.length !== attachmentIds.length) throw new ApiError(400, { error: 'An attachment is unavailable or does not belong to you. Remove it and attach it again.' });
      return serialize(await tx.feedback.create({ data: { ...input, attachments: { create: attachmentIds.map(fileAssetId => ({ fileAssetId })) } }, include }));
    });
  } catch (error) {
    if (error.code !== 'P2002') throw error;
    const existing = await db.feedback.findUnique({ where: { id: submissionId }, include });
    if (existing) return existingResult(existing);
    throw new ApiError(409, { error: 'An image is already attached to another feedback report.' });
  }
};

exports.list = async ({ userId, status = 'NEW', level = 'ALL', cursor, db = prisma }) => {
  await requireUser(db, userId, true);
  if (status !== 'ALL' && !STATUSES.includes(status)) throw new ApiError(400, { error: 'Invalid feedback status.' });
  if (level !== 'ALL' && !LEVELS.includes(level)) throw new ApiError(400, { error: 'Invalid feedback level.' });
  let after;
  if (cursor) {
    try {
      if (typeof cursor !== 'string' || cursor.length > 200) throw new Error();
      after = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
      if (!UUID.test(after.id) || typeof after.createdAt !== 'string' || !Number.isFinite(Date.parse(after.createdAt))) throw new Error();
    } catch { throw new ApiError(400, { error: 'Invalid feedback cursor.' }); }
  }
  const rows = await db.feedback.findMany({
    where: { ...(status === 'ALL' ? {} : { status }), ...(level === 'ALL' ? {} : { level }), ...(after ? { OR: [{ createdAt: { lt: new Date(after.createdAt) } }, { createdAt: new Date(after.createdAt), id: { lt: after.id } }] } : {}) },
    include, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: 26,
  });
  const items = rows.slice(0, 25);
  const last = items.at(-1);
  return { items: items.map(serialize), nextCursor: rows.length > 25 ? Buffer.from(JSON.stringify({ createdAt: last.createdAt, id: last.id })).toString('base64url') : null };
};

exports.review = async ({ userId, feedbackId, status, expectedStatus, db = prisma }) => {
  if (typeof feedbackId !== 'string' || !UUID.test(feedbackId) || !STATUSES.includes(status) || !STATUSES.includes(expectedStatus)) throw new ApiError(400, { error: 'Invalid feedback status update.' });
  return db.$transaction(async tx => {
    const admin = await requireUser(tx, userId, true);
    const changed = await tx.feedback.updateMany({ where: { id: feedbackId, status: expectedStatus }, data: { status, reviewedById: admin.id } });
    if (!changed.count) throw new ApiError(409, { error: 'This feedback changed or is unavailable. Refresh before updating it.' });
    return serialize(await tx.feedback.findUnique({ where: { id: feedbackId }, include }));
  });
};

exports.getImage = async ({ userId, fileAssetId, db = prisma, storageFactory = getObjectStorage }) => {
  const user = await requireUser(db, userId);
  if (typeof fileAssetId !== 'string' || !UUID.test(fileAssetId)) throw new ApiError(400, { error: 'Invalid image ID.' });
  const asset = await db.fileAsset.findUnique({ where: { id: fileAssetId }, include: { feedbackAttachment: true } });
  if (!asset || asset.status !== 'READY' || asset.purpose !== 'FEEDBACK_IMAGE') throw new ApiError(404, { error: 'Image not found.' });
  if (asset.ownerId !== user.id && (user.role !== 'ADMIN' || !asset.feedbackAttachment)) throw new ApiError(403, { error: 'You cannot access this image.' });
  return { url: await storageClient(storageFactory).createReadUrl({ storageKey: asset.storageKey, downloadName: asset.originalName }), expiresInSeconds: 300 };
};

exports.MAX_IMAGE_BYTES = MAX_IMAGE_BYTES;
