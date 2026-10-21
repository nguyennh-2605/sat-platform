const path = require('node:path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env'), quiet: true });
const prisma = require('../src/config/prisma');
const { getObjectStorage } = require('../src/storage/object-storage');
const { _imageHelpers } = require('../src/services/test-image.service');
const { EXPECTED_DATASET_COUNT } = require('../src/services/question-bank-production-import.service');
const {
  readQuestionBankRwGraphBundle,
  _helpers: rwHelpers,
} = require('../src/services/question-bank-rw-graph-repair.service');
const {
  readQuestionBankMathGraphBundle,
  _helpers: mathHelpers,
} = require('../src/services/question-bank-math-graph-repair.service');

const BATCH_SIZE = 500;
const CONCURRENCY = 6;

const getAuditFailures = ({ questionCount, invalidBlocks, missingAssetRecords, invalidAssetRecords, invalidObjects, rwInspection, mathInspection }) => {
  const failures = [];
  if (questionCount !== EXPECTED_DATASET_COUNT) {
    failures.push({
      reason: `Expected ${EXPECTED_DATASET_COUNT} bundled System questions, found ${questionCount}. Verify DATABASE_URL; for a new database, create an Admin and run npm run db:prepare:question-bank on Render.`,
    });
  }
  failures.push(
    ...invalidBlocks,
    ...missingAssetRecords.map(id => ({ id, reason: 'Missing FileAsset' })),
    ...invalidAssetRecords.map(asset => ({ ...asset, reason: 'Invalid FileAsset metadata or status' })),
    ...invalidObjects,
  );
  for (const [subject, inspection] of [['RW', rwInspection], ['MATH', mathInspection]]) {
    failures.push(
      ...inspection.conflicts.map(({ row, reason }) => ({ questionId: row.questionId, subject, reason })),
      ...inspection.pending.map(({ row }) => ({ questionId: row.questionId, subject, reason: 'Graph repair is pending' })),
    );
  }
  return failures;
};

const decodeInlineImage = src => {
  const match = /^data:(image\/(?:png|jpeg|webp));base64,([a-z0-9+/=\s]+)$/i.exec(String(src || ''));
  if (!match) return null;
  const mimeType = match[1].toLowerCase();
  const bytes = Buffer.from(match[2].replace(/\s+/g, ''), 'base64');
  const dimensions = _imageHelpers.imageDimensions(bytes, mimeType);
  if (!bytes.length || bytes.length > _imageHelpers.MAX_IMAGE_BYTES || !dimensions) return null;
  return { mimeType, bytes, dimensions };
};

const inBatches = async (values, action) => {
  const output = [];
  for (let index = 0; index < values.length; index += BATCH_SIZE) {
    output.push(...await action(values.slice(index, index + BATCH_SIZE)));
  }
  return output;
};

const mapConcurrent = async (values, action) => {
  let next = 0;
  const results = new Array(values.length);
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, values.length) }, async () => {
    while (next < values.length) {
      const index = next;
      next += 1;
      results[index] = await action(values[index]);
    }
  }));
  return results;
};

const main = async () => {
  if (process.argv.includes('--require-render') && process.env.RENDER !== 'true') throw new Error('Refusing production audit outside Render.');
  const items = await prisma.questionBankItem.findMany({
    where: { scope: 'SYSTEM', id: { startsWith: 'eqb-' } },
    select: { id: true, versions: { orderBy: { version: 'desc' }, take: 1, select: { id: true, blocks: true } } },
  });

  const managedIds = new Set();
  const invalidBlocks = [];
  let inlineImageBlocks = 0;
  let managedImageBlocks = 0;
  let questionsWithImages = 0;
  for (const item of items) {
    const blocks = item.versions[0]?.blocks || [];
    const images = blocks.filter(block => block?.type === 'image');
    if (images.length) questionsWithImages += 1;
    for (const block of images) {
      if (block.assetId) {
        managedImageBlocks += 1;
        managedIds.add(String(block.assetId));
      } else if (decodeInlineImage(block.src)) {
        inlineImageBlocks += 1;
      } else {
        invalidBlocks.push({ questionId: item.id, reason: 'Image block has neither a valid inline image nor a managed asset id' });
      }
    }
  }

  const assetIds = [...managedIds];
  const assets = await inBatches(assetIds, ids => prisma.fileAsset.findMany({ where: { id: { in: ids } } }));
  const assetsById = new Map(assets.map(asset => [asset.id, asset]));
  const missingAssetRecords = assetIds.filter(id => !assetsById.has(id));
  const invalidAssetRecords = assets.filter(asset => (
    asset.purpose !== 'TEST_IMAGE'
    || asset.status !== 'READY'
    || !String(asset.mimeType || '').startsWith('image/')
    || asset.sizeBytes < 1
  )).map(asset => ({ id: asset.id, status: asset.status, purpose: asset.purpose }));
  const storage = assets.length ? getObjectStorage() : null;
  const objectChecks = await mapConcurrent(assets.filter(asset => !invalidAssetRecords.some(row => row.id === asset.id)), async asset => {
    try {
      const metadata = await storage.headObject({ storageKey: asset.storageKey });
      if (metadata.sizeBytes !== asset.sizeBytes || metadata.mimeType !== asset.mimeType) {
        return { id: asset.id, storageKey: asset.storageKey, reason: 'Object metadata differs from FileAsset' };
      }
      return null;
    } catch (error) {
      return { id: asset.id, storageKey: asset.storageKey, reason: error.message };
    }
  });
  const invalidObjects = objectChecks.filter(Boolean);

  const rwBundle = readQuestionBankRwGraphBundle();
  const mathBundle = readQuestionBankMathGraphBundle();
  const [rwInspection, mathInspection] = await Promise.all([
    rwHelpers.inspectQuestionBankRwGraphs({ prisma, bundle: rwBundle }),
    mathHelpers.inspectQuestionBankMathGraphs({ prisma, bundle: mathBundle }),
  ]);

  const failures = getAuditFailures({
    questionCount: items.length, invalidBlocks, missingAssetRecords, invalidAssetRecords,
    invalidObjects, rwInspection, mathInspection,
  });
  const report = {
    event: 'question_bank.image_audit.completed',
    questionCount: items.length,
    expectedQuestionCount: EXPECTED_DATASET_COUNT,
    questionsWithImages,
    inlineImageBlocks,
    managedImageBlocks,
    distinctManagedAssets: managedIds.size,
    invalidBlocks: invalidBlocks.length,
    missingAssetRecords: missingAssetRecords.length,
    invalidAssetRecords: invalidAssetRecords.length,
    invalidObjects: invalidObjects.length,
    readingGraphs: {
      expected: rwBundle.rows.length,
      repaired: rwInspection.repaired.length,
      pending: rwInspection.pending.length,
      conflicts: rwInspection.conflicts.length,
    },
    mathGraphs: {
      expectedQuestions: mathBundle.rows.length,
      expectedImages: mathBundle.imageCount,
      repaired: mathInspection.repaired.length,
      pending: mathInspection.pending.length,
      conflicts: mathInspection.conflicts.length,
    },
    failures: failures.slice(0, 20),
  };
  console.log(JSON.stringify(report));
  if (failures.length) process.exitCode = 1;
};

if (require.main === module) {
  main()
    .catch(error => {
      console.error(JSON.stringify({ event: 'question_bank.image_audit.failed', message: error.message }));
      process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
}

module.exports = { getAuditFailures };
