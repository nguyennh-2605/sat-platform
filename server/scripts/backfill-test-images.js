require('dotenv').config();

const { createHash } = require('node:crypto');
const prisma = require('../src/config/prisma');
const { getObjectStorage } = require('../src/storage/object-storage');
const { _imageHelpers } = require('../src/services/test-image.service');

const APPLY = process.argv.includes('--apply');
const MIME_EXTENSIONS = { 'image/png': '.png', 'image/jpeg': '.jpg', 'image/webp': '.webp', 'image/gif': '.gif' };
const migrated = new Map();
const totals = { questions: 0, snapshots: 0, questionCandidates: 0, snapshotCandidates: 0, urls: new Set(), migrated: 0, skipped: 0, failed: 0 };

const isCloudinaryImage = value => {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.hostname === 'res.cloudinary.com' && /^\/[^/]+\/image\/upload\//.test(url.pathname);
  } catch { return false; }
};

const readBounded = async response => {
  const reader = response.body.getReader();
  const chunks = [];
  let length = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    length += value.length;
    if (length > _imageHelpers.MAX_IMAGE_BYTES) {
      await reader.cancel();
      throw new Error('Cloudinary image exceeds the 5 MB limit');
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks);
};

const migrateUrl = async (src, ownerId) => {
  if (migrated.has(src)) return migrated.get(src);
  const storageKey = `test-images/legacy/${createHash('sha256').update(src).digest('hex')}`;
  let asset = await prisma.fileAsset.findUnique({ where: { storageKey } });
  if (asset) {
    if (asset.purpose !== 'TEST_IMAGE' || asset.status !== 'READY') throw new Error('Existing legacy image asset is not ready');
    migrated.set(src, asset.id);
    return asset.id;
  }
  const response = await fetch(src, { redirect: 'error', signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error(`Cloudinary returned HTTP ${response.status}`);
  const mimeType = response.headers.get('content-type')?.split(';')[0]?.toLowerCase() || '';
  if (!MIME_EXTENSIONS[mimeType]) throw new Error('Cloudinary returned an unsupported image type');
  const bytes = await readBounded(response);
  const dimensions = _imageHelpers.imageDimensions(bytes, mimeType);
  if (!dimensions || dimensions.some(value => value < 1 || value > 8192) || dimensions[0] * dimensions[1] > 24 * 1024 * 1024) {
    throw new Error('Cloudinary image failed validation');
  }
  const storage = getObjectStorage();
  await storage.putObject({ storageKey, mimeType, bytes });
  asset = await prisma.fileAsset.create({ data: {
    ownerId, provider: storage.provider, storageKey,
    originalName: `Imported test image${MIME_EXTENSIONS[mimeType]}`,
    mimeType, sizeBytes: bytes.length, purpose: 'TEST_IMAGE', status: 'READY',
  } });
  migrated.set(src, asset.id);
  totals.migrated += 1;
  return asset.id;
};

const convertBlocks = async (blocks, ownerId) => {
  let changed = false;
  let candidate = false;
  const converted = [];
  for (const block of Array.isArray(blocks) ? blocks : []) {
    if (block?.type !== 'image' || block.assetId || !isCloudinaryImage(block.src)) {
      converted.push(block);
      continue;
    }
    totals.urls.add(block.src);
    candidate = true;
    if (!APPLY) { converted.push(block); continue; }
    if (!ownerId) { totals.skipped += 1; converted.push(block); continue; }
    try {
      const assetId = await migrateUrl(block.src, ownerId);
      const { src, ...rest } = block;
      converted.push({ ...rest, assetId });
      changed = true;
    } catch (error) {
      totals.failed += 1;
      console.error('Image migration failed:', error.message);
      converted.push(block);
    }
  }
  return { blocks: converted, changed, candidate };
};

const forEachPage = async (model, select, action) => {
  let cursor;
  while (true) {
    const rows = await model.findMany({ take: 100, ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}), orderBy: { id: 'asc' }, select });
    if (!rows.length) break;
    for (const row of rows) await action(row);
    cursor = rows[rows.length - 1].id;
  }
};

async function main() {
  await forEachPage(prisma.question, { id: true, blocks: true, section: { select: { testId: true, test: { select: { authorId: true } } } } }, async question => {
    const { blocks, changed, candidate } = await convertBlocks(question.blocks, question.section.test.authorId);
    if (candidate) totals.questionCandidates += 1;
    if (!changed) return;
    const assetIds = [...new Set(blocks.filter(block => block?.type === 'image' && block.assetId).map(block => block.assetId))];
    await prisma.$transaction(async tx => {
      await tx.question.update({ where: { id: question.id }, data: { blocks } });
      for (const fileAssetId of assetIds) await tx.testImageUsage.upsert({
        where: { testId_fileAssetId: { testId: question.section.testId, fileAssetId } },
        create: { testId: question.section.testId, fileAssetId }, update: {},
      });
    });
    totals.questions += 1;
  });

  await forEachPage(prisma.errorLog, { id: true, questionSnapshot: true, question: { select: { section: { select: { testId: true, test: { select: { authorId: true } } } } } } }, async entry => {
    if (!entry.questionSnapshot?.blocks) return;
    const ownerId = entry.question?.section?.test?.authorId;
    const { blocks, changed, candidate } = await convertBlocks(entry.questionSnapshot.blocks, ownerId);
    if (candidate) totals.snapshotCandidates += 1;
    if (!changed) return;
    await prisma.$transaction(async tx => {
      await tx.errorLog.update({ where: { id: entry.id }, data: { questionSnapshot: { ...entry.questionSnapshot, blocks } } });
      if (entry.question?.section?.testId) {
        const assetIds = [...new Set(blocks.filter(block => block?.type === 'image' && block.assetId).map(block => block.assetId))];
        for (const fileAssetId of assetIds) await tx.testImageUsage.upsert({
          where: { testId_fileAssetId: { testId: entry.question.section.testId, fileAssetId } },
          create: { testId: entry.question.section.testId, fileAssetId }, update: {},
        });
      }
    });
    totals.snapshots += 1;
  });

  console.log(JSON.stringify({ mode: APPLY ? 'apply' : 'dry-run', questionCandidates: totals.questionCandidates, snapshotCandidates: totals.snapshotCandidates, questionsUpdated: totals.questions, snapshotsUpdated: totals.snapshots, distinctLegacyUrls: totals.urls.size, uploadedAssets: totals.migrated, skipped: totals.skipped, failed: totals.failed }));
  if (totals.failed || totals.skipped) process.exitCode = 1;
}

main().catch(error => { console.error('Test image backfill failed:', error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
