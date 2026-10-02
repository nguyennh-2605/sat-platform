require('dotenv').config();

const { createHash } = require('node:crypto');
const prisma = require('../src/config/prisma');
const { getObjectStorage } = require('../src/storage/object-storage');
const { _imageHelpers } = require('../src/services/test-image.service');

const APPLY = process.argv.includes('--apply');
const MIME_EXTENSIONS = { 'image/png': '.png', 'image/jpeg': '.jpg', 'image/webp': '.webp' };
const migrated = new Map();
const totals = {
  versionsScanned: 0,
  versionsWithInlineImages: 0,
  versionsUpdated: 0,
  testQuestionsScanned: 0,
  testQuestionsWithInlineImages: 0,
  testQuestionsUpdated: 0,
  inlineImageBlocks: 0,
  distinctImages: new Set(),
  uploadedAssets: 0,
  reusedAssets: 0,
  failed: 0,
};

const decodeDataImage = src => {
  const match = /^data:(image\/(?:png|jpeg|webp));base64,([a-z0-9+/=\s]+)$/i.exec(String(src || ''));
  if (!match) return null;
  const mimeType = match[1].toLowerCase();
  const bytes = Buffer.from(match[2].replace(/\s+/g, ''), 'base64');
  if (!bytes.length || bytes.length > _imageHelpers.MAX_IMAGE_BYTES) throw new Error('Inline image exceeds the supported size');
  const dimensions = _imageHelpers.imageDimensions(bytes, mimeType);
  if (!dimensions || dimensions.some(value => value < 1 || value > 8192) || dimensions[0] * dimensions[1] > 24 * 1024 * 1024) {
    throw new Error('Inline image failed validation');
  }
  return { mimeType, bytes };
};

const migrateImage = async ({ src, ownerId }) => {
  const decoded = decodeDataImage(src);
  if (!decoded) return null;
  const hash = createHash('sha256').update(decoded.bytes).digest('hex');
  totals.distinctImages.add(hash);
  if (migrated.has(hash)) return migrated.get(hash);
  const storageKey = `test-images/question-bank/${hash}${MIME_EXTENSIONS[decoded.mimeType]}`;
  let asset = await prisma.fileAsset.findUnique({ where: { storageKey } });
  if (asset) {
    if (asset.purpose !== 'TEST_IMAGE' || asset.status !== 'READY') throw new Error('Existing question image asset is not ready');
    totals.reusedAssets += 1;
    migrated.set(hash, asset.id);
    return asset.id;
  }
  const storage = getObjectStorage();
  await storage.putObject({ storageKey, mimeType: decoded.mimeType, bytes: decoded.bytes });
  asset = await prisma.fileAsset.create({ data: {
    ownerId,
    provider: storage.provider,
    storageKey,
    originalName: `Question bank graph${MIME_EXTENSIONS[decoded.mimeType]}`,
    mimeType: decoded.mimeType,
    sizeBytes: decoded.bytes.length,
    purpose: 'TEST_IMAGE',
    status: 'READY',
  } });
  totals.uploadedAssets += 1;
  migrated.set(hash, asset.id);
  return asset.id;
};

const convertBlocks = async ({ blocks, ownerId }) => {
  let changed = false;
  let hasInlineImages = false;
  const converted = [];
  for (const block of Array.isArray(blocks) ? blocks : []) {
    if (block?.type !== 'image' || block.assetId || !String(block.src || '').startsWith('data:image/')) {
      converted.push(block);
      continue;
    }
    hasInlineImages = true;
    totals.inlineImageBlocks += 1;
    try {
      const decoded = decodeDataImage(block.src);
      if (!decoded) throw new Error('Unsupported inline image');
      totals.distinctImages.add(createHash('sha256').update(decoded.bytes).digest('hex'));
      if (!APPLY) {
        converted.push(block);
        continue;
      }
      const assetId = await migrateImage({ src: block.src, ownerId });
      const { src, ...rest } = block;
      converted.push({ ...rest, assetId });
      changed = true;
    } catch (error) {
      totals.failed += 1;
      console.error(JSON.stringify({ event: 'question-bank-image.failed', message: error.message }));
      converted.push(block);
    }
  }
  return { blocks: converted, changed, hasInlineImages };
};

const assetIds = blocks => [...new Set((Array.isArray(blocks) ? blocks : [])
  .filter(block => block?.type === 'image' && block.assetId)
  .map(block => String(block.assetId)))];

const forEachPage = async ({ model, select, action, take = 50 }) => {
  let cursor;
  while (true) {
    const rows = await model.findMany({
      take,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      orderBy: { id: 'asc' },
      select,
    });
    if (!rows.length) break;
    for (const row of rows) await action(row);
    cursor = rows.at(-1).id;
  }
};

async function main() {
  await forEachPage({
    model: prisma.questionBankVersion,
    select: { id: true, questionId: true, blocks: true, question: { select: { ownerId: true } } },
    action: async version => {
      totals.versionsScanned += 1;
      const result = await convertBlocks({ blocks: version.blocks, ownerId: version.question.ownerId });
      if (result.hasInlineImages) totals.versionsWithInlineImages += 1;
      if (!APPLY) return;
      const ids = assetIds(result.blocks);
      await prisma.$transaction(async tx => {
        if (result.changed) await tx.questionBankVersion.update({ where: { id: version.id }, data: { blocks: result.blocks } });
        if (ids.length) await tx.questionBankImageUsage.createMany({
          data: ids.map(fileAssetId => ({ questionId: version.questionId, fileAssetId })),
          skipDuplicates: true,
        });
      });
      if (result.changed) totals.versionsUpdated += 1;
    },
  });

  await forEachPage({
    model: prisma.question,
    select: {
      id: true,
      blocks: true,
      sourceBankQuestionId: true,
      section: { select: { testId: true, test: { select: { authorId: true } } } },
    },
    action: async question => {
      if (!question.sourceBankQuestionId) return;
      totals.testQuestionsScanned += 1;
      const result = await convertBlocks({ blocks: question.blocks, ownerId: question.section.test.authorId });
      if (result.hasInlineImages) totals.testQuestionsWithInlineImages += 1;
      if (!APPLY || !result.changed) return;
      const ids = assetIds(result.blocks);
      await prisma.$transaction(async tx => {
        await tx.question.update({ where: { id: question.id }, data: { blocks: result.blocks } });
        if (ids.length) await tx.testImageUsage.createMany({
          data: ids.map(fileAssetId => ({ testId: question.section.testId, fileAssetId })),
          skipDuplicates: true,
        });
      });
      totals.testQuestionsUpdated += 1;
    },
  });

  console.log(JSON.stringify({
    mode: APPLY ? 'apply' : 'dry-run',
    versionsScanned: totals.versionsScanned,
    versionsWithInlineImages: totals.versionsWithInlineImages,
    versionsUpdated: totals.versionsUpdated,
    testQuestionsScanned: totals.testQuestionsScanned,
    testQuestionsWithInlineImages: totals.testQuestionsWithInlineImages,
    testQuestionsUpdated: totals.testQuestionsUpdated,
    inlineImageBlocks: totals.inlineImageBlocks,
    distinctImages: totals.distinctImages.size,
    uploadedAssets: totals.uploadedAssets,
    reusedAssets: totals.reusedAssets,
    failed: totals.failed,
  }));
  if (totals.failed) process.exitCode = 1;
}

main()
  .catch(error => {
    console.error('Question bank image backfill failed:', error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
