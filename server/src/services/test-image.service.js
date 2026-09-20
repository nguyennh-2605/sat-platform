const path = require('node:path');
const { randomUUID } = require('node:crypto');
const prisma = require('../config/prisma');
const ApiError = require('../utils/ApiError');
const { getObjectStorage } = require('../storage/object-storage');

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_IMAGE_DIMENSION = 8192;
const MAX_IMAGE_PIXELS = 24 * 1024 * 1024;
const IMAGE_MIME_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp']);
const IMAGE_EXTENSIONS = { 'image/png': '.png', 'image/jpeg': '.jpg', 'image/webp': '.webp' };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const imageDimensions = (buffer, mimeType) => {
  if (mimeType === 'image/gif' && buffer.length >= 13 && ['GIF87a', 'GIF89a'].includes(buffer.toString('ascii', 0, 6))) {
    return [buffer.readUInt16LE(6), buffer.readUInt16LE(8)];
  }
  if (mimeType === 'image/png' && buffer.length >= 24 && buffer.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex')) && buffer.toString('ascii', buffer.length - 8, buffer.length - 4) === 'IEND') {
    return [buffer.readUInt32BE(16), buffer.readUInt32BE(20)];
  }
  if (mimeType === 'image/jpeg' && buffer.length >= 4 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[buffer.length - 2] === 0xff && buffer[buffer.length - 1] === 0xd9) {
    let offset = 2;
    while (offset + 4 < buffer.length) {
      if (buffer[offset] !== 0xff) break;
      const marker = buffer[offset + 1];
      if (marker === 0xff) { offset += 1; continue; }
      if (marker === 0xd9 || marker === 0xda) break;
      const length = buffer.readUInt16BE(offset + 2);
      if (length < 2 || offset + length + 2 > buffer.length) break;
      if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker) && length >= 7) {
        return [buffer.readUInt16BE(offset + 7), buffer.readUInt16BE(offset + 5)];
      }
      offset += length + 2;
    }
  }
  if (mimeType === 'image/webp' && buffer.length >= 30 && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP' && buffer.readUInt32LE(4) + 8 === buffer.length) {
    const variant = buffer.toString('ascii', 12, 16);
    if (variant === 'VP8X') return [1 + buffer.readUIntLE(24, 3), 1 + buffer.readUIntLE(27, 3)];
    if (variant === 'VP8L' && buffer[20] === 0x2f) return [
      1 + (buffer[21] | ((buffer[22] & 0x3f) << 8)),
      1 + ((buffer[22] >> 6) | (buffer[23] << 2) | ((buffer[24] & 0x0f) << 10)),
    ];
    if (variant === 'VP8 ' && buffer.toString('hex', 23, 26) === '9d012a') return [
      buffer.readUInt16LE(26) & 0x3fff,
      buffer.readUInt16LE(28) & 0x3fff,
    ];
  }
  return null;
};

const imageAssetIds = sections => [...new Set((sections || []).flatMap(section =>
  (section.questions || []).flatMap(question =>
    (question.blocks || []).filter(block => block?.type === 'image' && block.assetId).map(block => String(block.assetId)),
  ),
))];

const assertUsableImages = async ({ sections, userId, existingTestId = null, db = prisma }) => {
  const ids = imageAssetIds(sections);
  if (!ids.length) return ids;
  if (ids.some(id => !UUID.test(id))) throw new ApiError(422, { error: 'A question has an invalid image reference.' });
  const assets = await db.fileAsset.findMany({
    where: { id: { in: ids }, purpose: 'TEST_IMAGE', status: 'READY' },
    select: { id: true, ownerId: true, testImages: { select: { testId: true } } },
  });
  if (assets.length !== ids.length || assets.some(asset => asset.ownerId !== Number(userId) && !asset.testImages.some(usage => usage.testId === existingTestId))) {
    throw new ApiError(422, { error: 'An image is unavailable or does not belong to this test.' });
  }
  return ids;
};

const syncTestImages = async ({ db, testId, assetIds }) => {
  await db.testImageUsage.deleteMany({ where: assetIds.length ? { testId, fileAssetId: { notIn: assetIds } } : { testId } });
  if (assetIds.length) await db.testImageUsage.createMany({ data: assetIds.map(fileAssetId => ({ testId, fileAssetId })), skipDuplicates: true });
};

exports.createUpload = async ({ ownerId, userRole, originalName, mimeType, sizeBytes }, dependencies = {}) => {
  if (!['TEACHER', 'ADMIN'].includes(userRole)) throw new ApiError(403, { error: 'Only staff can upload test images.' });
  const db = dependencies.db || prisma;
  const storageFactory = dependencies.storageFactory || getObjectStorage;
  const name = path.basename(String(originalName || '').trim()).replace(/[\u0000-\u001f]/g, '').slice(0, 255);
  const type = String(mimeType || '').toLowerCase();
  const size = Number(sizeBytes);
  if (!name || !IMAGE_MIME_TYPES.has(type) || !Number.isInteger(size) || size < 1 || size > MAX_IMAGE_BYTES) {
    throw new ApiError(400, { error: 'Choose a PNG, JPEG, or WebP image up to 5 MB.' });
  }
  let storage;
  try { storage = storageFactory(); }
  catch { throw new ApiError(503, { error: 'Image uploads are not configured yet.' }); }
  const storageKey = `test-images/${Number(ownerId)}/${(dependencies.randomUUID || randomUUID)()}${IMAGE_EXTENSIONS[type]}`;
  const asset = await db.fileAsset.create({ data: {
    ownerId: Number(ownerId), provider: storage.provider, storageKey,
    originalName: name, mimeType: type, sizeBytes: size, purpose: 'TEST_IMAGE',
  } });
  try {
    return {
      asset: { id: asset.id, status: asset.status },
      uploadUrl: await storage.createUploadUrl({ storageKey, mimeType: type }),
      headers: { 'Content-Type': type },
      expiresInSeconds: 900,
    };
  } catch (error) {
    await db.fileAsset.delete({ where: { id: asset.id } }).catch(() => undefined);
    throw error;
  }
};

exports.completeUpload = async ({ fileAssetId, ownerId }, dependencies = {}) => {
  const db = dependencies.db || prisma;
  const storageFactory = dependencies.storageFactory || getObjectStorage;
  const asset = await db.fileAsset.findUnique({ where: { id: fileAssetId } });
  if (!asset || asset.purpose !== 'TEST_IMAGE') throw new ApiError(404, { error: 'Image upload not found.' });
  if (asset.ownerId !== Number(ownerId)) throw new ApiError(403, { error: 'You cannot complete this upload.' });
  if (asset.status === 'READY') return { id: asset.id, status: 'READY' };
  if (asset.status !== 'PENDING_UPLOAD') throw new ApiError(409, { error: 'This upload is no longer active.' });
  const storage = storageFactory();
  let metadata;
  let bytes;
  try {
    metadata = await storage.headObject({ storageKey: asset.storageKey });
    if (metadata.sizeBytes !== asset.sizeBytes || metadata.sizeBytes > MAX_IMAGE_BYTES || metadata.mimeType !== asset.mimeType) throw new ApiError(400, { error: 'The uploaded image does not match the selected file.' });
    bytes = await storage.readObject({ storageKey: asset.storageKey, maxBytes: MAX_IMAGE_BYTES });
  } catch (error) {
    if (error instanceof ApiError) {
      await db.fileAsset.update({ where: { id: asset.id }, data: { status: 'PENDING_DELETE' } });
      throw error;
    }
    throw new ApiError(409, { error: 'The uploaded image could not be verified.' });
  }
  const dimensions = bytes.length === asset.sizeBytes && imageDimensions(bytes, asset.mimeType);
  if (!dimensions || dimensions.some(value => value < 1 || value > MAX_IMAGE_DIMENSION) || dimensions[0] * dimensions[1] > MAX_IMAGE_PIXELS) {
    await db.fileAsset.update({ where: { id: asset.id }, data: { status: 'PENDING_DELETE' } });
    throw new ApiError(400, { error: 'Image contents or dimensions are not supported.' });
  }
  await db.fileAsset.update({ where: { id: asset.id }, data: { status: 'READY' } });
  return { id: asset.id, status: 'READY' };
};

exports.getAccessUrl = async ({ fileAssetId, userId, userRole }, dependencies = {}) => {
  const db = dependencies.db || prisma;
  const storageFactory = dependencies.storageFactory || getObjectStorage;
  const asset = await db.fileAsset.findUnique({ where: { id: fileAssetId } });
  if (!asset || asset.purpose !== 'TEST_IMAGE' || asset.status !== 'READY') throw new ApiError(404, { error: 'Image not found.' });
  const requesterId = Number(userId);
  const isUploader = asset.ownerId === requesterId && ['TEACHER', 'ADMIN'].includes(userRole);
  if (!isUploader) {
    const accessibleTest = await db.test.findFirst({
      where: {
        images: { some: { fileAssetId } },
        ...(userRole === 'ADMIN' ? {} : userRole === 'TEACHER' ? { OR: [
          { scope: 'PERSONAL', authorId: requesterId }, { scope: 'SYSTEM', status: 'PUBLISHED' },
        ] } : { OR: [
          { scope: 'SYSTEM', status: 'PUBLISHED' },
          { submissions: { some: { userId: requesterId } } },
          { deliveries: { some: { status: 'PUBLISHED', assignees: { some: { studentId: requesterId, excusedAt: null } } } } },
        ] }),
      },
      select: { id: true },
    });
    if (!accessibleTest) throw new ApiError(403, { error: 'You cannot access this image.' });
  }
  return { url: await storageFactory().createReadUrl({ storageKey: asset.storageKey, downloadName: asset.originalName }), expiresInSeconds: 300 };
};

exports.assertUsableImages = assertUsableImages;
exports.imageAssetIds = imageAssetIds;
exports.syncTestImages = syncTestImages;
exports._imageHelpers = { imageDimensions, MAX_IMAGE_BYTES };
