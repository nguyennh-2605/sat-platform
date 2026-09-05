const path = require('node:path');
const { randomUUID } = require('node:crypto');
const prisma = require('../config/prisma');
const ApiError = require('../utils/ApiError');
const { getObjectStorage } = require('../storage/object-storage');

const MAX_FILE_BYTES = 20 * 1024 * 1024;
const DEFAULT_CLEANUP_CONCURRENCY = 5;
const MAX_CLEANUP_CONCURRENCY = 10;
const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain', 'text/csv', 'image/png', 'image/jpeg', 'image/webp',
]);

const normalizeName = value => String(value || '').trim().replace(/[\u0000-\u001f]/g, '').slice(0, 255);
const currentUserId = value => Number.parseInt(value, 10);
const storageErrorDetails = error => ({
  errorName: error?.name,
  errorCode: error?.Code || error?.code,
  httpStatusCode: error?.$metadata?.httpStatusCode,
});

const assertStudentAssignmentAccess = async (assignmentId, studentId, { db = prisma, now = () => new Date() } = {}) => {
  const assignment = await db.assignment.findUnique({
    where: { id: assignmentId },
    include: {
      class: { select: { students: { where: { id: studentId }, select: { id: true } } } },
      activity: { include: { activity: { select: { status: true, availableAt: true, dueAt: true, assignees: { where: { studentId, excusedAt: null }, select: { studentId: true } } } } } },
    },
  });
  if (!assignment) throw new ApiError(404, { error: 'Assignment not found.' });
  const activity = assignment.activity?.activity || null;
  if (!assignment.class.students.length || (activity && !activity.assignees.length)) throw new ApiError(403, { error: 'You are not assigned this work.' });
  const currentTime = now();
  if (activity && (activity.status !== 'PUBLISHED' || (activity.availableAt && activity.availableAt > currentTime))) throw new ApiError(409, { error: 'This assignment is not available.' });
  const deadline = activity?.dueAt || assignment.deadline;
  if (deadline && deadline < currentTime) throw new ApiError(409, { error: 'The submission deadline has passed.' });
  return assignment;
};

exports.createUpload = async ({ assignmentId, ownerId, originalName, mimeType, sizeBytes }, dependencies = {}) => {
  const db = dependencies.db || prisma;
  const storageFactory = dependencies.storageFactory || getObjectStorage;
  const makeUuid = dependencies.randomUUID || randomUUID;
  const logger = dependencies.logger || console;
  const studentId = currentUserId(ownerId);
  await assertStudentAssignmentAccess(assignmentId, studentId, { db, now: dependencies.now });
  const name = normalizeName(originalName);
  const size = Number(sizeBytes);
  const type = String(mimeType || '').toLowerCase();
  if (!name) throw new ApiError(400, { error: 'File name is required.' });
  if (!Number.isInteger(size) || size <= 0 || size > MAX_FILE_BYTES) throw new ApiError(400, { error: 'Each file must be 20 MB or smaller.' });
  if (!ALLOWED_MIME_TYPES.has(type)) throw new ApiError(400, { error: 'This file type is not supported.' });

  let storage;
  try { storage = storageFactory(); }
  catch { throw new ApiError(503, { error: 'File uploads are not configured yet.' }); }
  const extension = path.extname(name).toLowerCase().replace(/[^.a-z0-9]/g, '').slice(0, 12);
  const storageKey = `submissions/${studentId}/${makeUuid()}${extension}`;
  const asset = await db.fileAsset.create({
    data: { ownerId: studentId, provider: storage.provider, storageKey, originalName: name, mimeType: type, sizeBytes: size },
  });
  try {
    const uploadUrl = await storage.createUploadUrl({ storageKey, mimeType: type });
    return { asset: serializeAsset(asset), uploadUrl, headers: { 'Content-Type': type }, expiresInSeconds: 900 };
  } catch (error) {
    logger.error('Unable to create a presigned upload URL.', { fileAssetId: asset.id, ...storageErrorDetails(error) });
    await db.fileAsset.delete({ where: { id: asset.id } }).catch(() => undefined);
    throw error;
  }
};

exports.completeUpload = async ({ fileAssetId, ownerId }, dependencies = {}) => {
  const db = dependencies.db || prisma;
  const storageFactory = dependencies.storageFactory || getObjectStorage;
  const logger = dependencies.logger || console;
  const studentId = currentUserId(ownerId);
  const asset = await db.fileAsset.findUnique({ where: { id: fileAssetId } });
  if (!asset) throw new ApiError(404, { error: 'Uploaded file was not found.' });
  if (asset.ownerId !== studentId) throw new ApiError(403, { error: 'You cannot complete this upload.' });
  if (asset.status === 'READY') return serializeAsset(asset);
  if (asset.status !== 'PENDING_UPLOAD') throw new ApiError(409, { error: 'This upload is no longer active.' });

  const storage = storageFactory();
  let metadata;
  try { metadata = await storage.headObject({ storageKey: asset.storageKey }); }
  catch (error) {
    logger.error('Unable to verify uploaded object.', {
      fileAssetId: asset.id,
      ...storageErrorDetails(error),
    });
    throw new ApiError(409, { error: 'The uploaded object could not be verified.' });
  }
  if (metadata.sizeBytes !== asset.sizeBytes || metadata.sizeBytes > MAX_FILE_BYTES || (metadata.mimeType && metadata.mimeType !== asset.mimeType)) {
    await db.fileAsset.update({ where: { id: asset.id }, data: { status: 'PENDING_DELETE' } });
    throw new ApiError(400, { error: 'The uploaded file does not match the expected size or type.' });
  }
  const ready = await db.fileAsset.update({ where: { id: asset.id }, data: { status: 'READY' } });
  return serializeAsset(ready);
};

exports.getAccessUrl = async ({ fileAssetId, userId, userRole }, dependencies = {}) => {
  const db = dependencies.db || prisma;
  const storageFactory = dependencies.storageFactory || getObjectStorage;
  const requesterId = currentUserId(userId);
  const asset = await db.fileAsset.findUnique({ where: { id: fileAssetId } });
  if (!asset || asset.status !== 'READY') throw new ApiError(404, { error: 'File not found.' });
  if (asset.ownerId !== requesterId && userRole !== 'ADMIN') {
    const accessibleItem = await db.homeworkSubmissionItem.findFirst({
      where: { fileAssetId, content: { slot: 'SUBMITTED', submission: { assignment: { class: { teacherId: requesterId } } } } },
      select: { id: true },
    });
    if (!accessibleItem) throw new ApiError(403, { error: 'You cannot access this file.' });
  }
  const url = await storageFactory().createReadUrl({ storageKey: asset.storageKey, downloadName: asset.originalName });
  return { url, expiresInSeconds: 300 };
};

exports.cleanupAssets = async ({
  olderThan = new Date(Date.now() - 24 * 60 * 60 * 1000),
  batchSize = 200,
  concurrency = DEFAULT_CLEANUP_CONCURRENCY,
  db = prisma,
  storageFactory = getObjectStorage,
  logger = console,
  clock = Date.now,
} = {}) => {
  const startedAt = clock();
  const assets = await db.fileAsset.findMany({
    where: { OR: [
      { status: 'PENDING_UPLOAD', createdAt: { lt: olderThan } },
      { status: 'READY', createdAt: { lt: olderThan }, items: { none: {} } },
      { status: 'PENDING_DELETE' },
    ] },
    take: batchSize,
  });
  if (!assets.length) return { candidates: 0, processed: 0, failed: 0, durationMs: clock() - startedAt };
  const storage = storageFactory();
  const requestedConcurrency = Number.parseInt(concurrency, 10);
  const workerCount = Math.min(
    assets.length,
    Math.max(1, Math.min(Number.isInteger(requestedConcurrency) ? requestedConcurrency : DEFAULT_CLEANUP_CONCURRENCY, MAX_CLEANUP_CONCURRENCY)),
  );
  let processed = 0;
  let failed = 0;
  let nextIndex = 0;

  const cleanAsset = async asset => {
    try {
      await storage.deleteObject({ storageKey: asset.storageKey });
      await db.fileAsset.delete({ where: { id: asset.id } });
      processed += 1;
    } catch (error) {
      failed += 1;
      logger.error('Unable to delete a stale object.', { fileAssetId: asset.id, ...storageErrorDetails(error) });
      await db.fileAsset.update({ where: { id: asset.id }, data: { status: 'PENDING_DELETE' } }).catch(() => undefined);
    }
  };

  const runWorker = async () => {
    while (nextIndex < assets.length) {
      const asset = assets[nextIndex];
      nextIndex += 1;
      await cleanAsset(asset);
    }
  };

  await Promise.all(Array.from({ length: workerCount }, runWorker));
  return { candidates: assets.length, processed, failed, durationMs: clock() - startedAt };
};

function serializeAsset(asset) {
  return { id: asset.id, name: asset.originalName, mimeType: asset.mimeType, sizeBytes: asset.sizeBytes, status: asset.status };
}

exports._fileAssetHelpers = {
  ALLOWED_MIME_TYPES,
  MAX_FILE_BYTES,
  DEFAULT_CLEANUP_CONCURRENCY,
  MAX_CLEANUP_CONCURRENCY,
  normalizeName,
  assertStudentAssignmentAccess,
  storageErrorDetails,
};
