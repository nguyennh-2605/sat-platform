const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');
const { getObjectStorage } = require('../storage/object-storage');
const { _imageHelpers } = require('./test-image.service');

const EXPECTED_GRAPH_COUNT = 62;
const EXPECTED_BUNDLE_SHA256 = '148b75670d742f2be0f579fc7346bdff18951c341071f8aa0b8d5c3bb5a4f2e4';
const DEFAULT_BUNDLE_PATH = path.resolve(__dirname, '../../data/eqb-rw-graph-assets-v1.json.gz');
const REPAIR_LOCK_KEY = 2_026_100_302;

const sha256 = value => crypto.createHash('sha256').update(value).digest('hex');

const canonicalJson = value => {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
};

const canonicalHash = value => sha256(canonicalJson(value));

const materializeBlocks = (row, blocks, assetId) => blocks.map(block => {
  if (block.type !== 'image') return block;
  const { imageSha256, ...imageBlock } = block;
  if (imageSha256 !== row.image.sha256) throw new Error(`Image checksum reference mismatch for ${row.questionId}.`);
  return { ...imageBlock, assetId };
});

const desiredBlocks = (row, assetId) => materializeBlocks(row, row.replacementBlocks, assetId);

const validateRow = row => {
  if (!row || !/^eqb-[a-f0-9]{32}$/.test(row.questionId || '')) return 'Invalid question id';
  if (!/^[a-f0-9]{64}$/.test(row.expectedLegacyBlocksSha256 || '')) return 'Invalid legacy blocks checksum';
  if (!Array.isArray(row.replacementBlocks) || row.replacementBlocks.length < 1) return 'Replacement blocks are required';
  if (row.replacementBlocks.filter(block => block?.type === 'image').length !== 1) return 'Exactly one image block is required';
  if (!Array.isArray(row.previousReplacementBlocks) || row.previousReplacementBlocks.filter(block => block?.type === 'image').length !== 1) {
    return 'Previous replacement blocks are required';
  }
  if (row.image?.mimeType !== 'image/png' || !/^[a-f0-9]{64}$/.test(row.image?.sha256 || '')) return 'Invalid PNG metadata';
  let bytes;
  try { bytes = Buffer.from(row.image.bytesBase64, 'base64'); }
  catch { return 'Invalid PNG encoding'; }
  if (!bytes.length || bytes.length > _imageHelpers.MAX_IMAGE_BYTES || sha256(bytes) !== row.image.sha256) return 'PNG checksum or size mismatch';
  const dimensions = _imageHelpers.imageDimensions(bytes, 'image/png');
  if (!dimensions || dimensions[0] !== row.image.width || dimensions[1] !== row.image.height) return 'PNG dimensions mismatch';
  try {
    desiredBlocks(row, '00000000-0000-0000-0000-000000000000');
    materializeBlocks(row, row.previousReplacementBlocks, '00000000-0000-0000-0000-000000000000');
  }
  catch (error) { return error.message; }
  return null;
};

const readQuestionBankRwGraphBundle = ({
  bundlePath = DEFAULT_BUNDLE_PATH,
  expectedSha256 = EXPECTED_BUNDLE_SHA256,
  expectedCount = EXPECTED_GRAPH_COUNT,
} = {}) => {
  const compressed = fs.readFileSync(bundlePath);
  const checksum = sha256(compressed);
  if (expectedSha256 && checksum !== expectedSha256) {
    throw new Error(`Reading and Writing graph bundle checksum mismatch: received ${checksum}.`);
  }
  let payload;
  try { payload = JSON.parse(zlib.gunzipSync(compressed).toString('utf8')); }
  catch (error) { throw new Error(`Reading and Writing graph bundle could not be decoded: ${error.message}`); }
  if (payload?.schemaVersion !== 2 || payload?.sourceCount !== expectedCount || payload?.rows?.length !== expectedCount) {
    throw new Error(`Reading and Writing graph bundle must contain exactly ${expectedCount} rows.`);
  }
  const seenQuestions = new Set();
  const errors = [];
  payload.rows.forEach(row => {
    if (seenQuestions.has(row.questionId)) errors.push({ questionId: row.questionId, error: 'Duplicate question id' });
    seenQuestions.add(row.questionId);
    const error = validateRow(row);
    if (error) errors.push({ questionId: row?.questionId, error });
  });
  if (errors.length) throw new Error(`Reading and Writing graph bundle validation failed: ${JSON.stringify(errors.slice(0, 20))}`);
  return { rows: payload.rows, bundlePath, sha256: checksum, compressedBytes: compressed.length };
};

const storageKeyFor = row => `test-images/question-bank/rw-graphs/${row.image.sha256}.png`;

const inspectQuestion = async ({ db, row }) => {
  const item = await db.questionBankItem.findUnique({
    where: { id: row.questionId },
    select: {
      id: true,
      ownerId: true,
      scope: true,
      subject: true,
      versions: { orderBy: { version: 'desc' }, take: 1 },
    },
  });
  if (!item) return { state: 'conflict', reason: 'Question is missing' };
  if (item.scope !== 'SYSTEM' || item.subject !== 'RW') return { state: 'conflict', reason: 'Question is not a System Reading and Writing item' };
  const latest = item.versions[0];
  if (!latest) return { state: 'conflict', reason: 'Question has no content version' };
  const asset = await db.fileAsset.findUnique({ where: { storageKey: storageKeyFor(row) } });
  if (asset && canonicalHash(latest.blocks) === canonicalHash(desiredBlocks(row, asset.id))) {
    return { state: 'repaired', item, latest, asset };
  }
  if (asset && canonicalHash(latest.blocks) === canonicalHash(materializeBlocks(row, row.previousReplacementBlocks, asset.id))) {
    return { state: 'pending', item, latest, asset };
  }
  if (canonicalHash(latest.blocks) !== row.expectedLegacyBlocksSha256) {
    return { state: 'conflict', reason: 'Latest blocks differ from the legacy, previous repaired, and cleaned content', item, latest, asset };
  }
  return { state: 'pending', item, latest, asset };
};

const inspectQuestionBankRwGraphs = async ({ prisma, bundle }) => {
  const report = { pending: [], repaired: [], conflicts: [] };
  for (const row of bundle.rows) {
    const result = await inspectQuestion({ db: prisma, row });
    report[result.state === 'conflict' ? 'conflicts' : result.state].push({ row, ...result });
  }
  return report;
};

const ensureAsset = async ({ prisma, storage, row, ownerId }) => {
  const storageKey = storageKeyFor(row);
  const bytes = Buffer.from(row.image.bytesBase64, 'base64');
  let asset = await prisma.fileAsset.findUnique({ where: { storageKey } });
  if (asset?.status === 'READY') {
    if (asset.purpose !== 'TEST_IMAGE' || asset.mimeType !== 'image/png' || asset.sizeBytes !== bytes.length) {
      throw new Error(`Existing graph asset metadata does not match ${row.questionId}.`);
    }
    return asset;
  }
  if (!asset) {
    asset = await prisma.fileAsset.create({ data: {
      ownerId,
      provider: storage.provider,
      storageKey,
      originalName: `Reading and Writing graph ${row.sourceQuestionId}.png`,
      mimeType: 'image/png',
      sizeBytes: bytes.length,
      purpose: 'TEST_IMAGE',
    } });
  } else {
    asset = await prisma.fileAsset.update({
      where: { id: asset.id },
      data: { ownerId, provider: storage.provider, mimeType: 'image/png', sizeBytes: bytes.length, purpose: 'TEST_IMAGE', status: 'PENDING_UPLOAD' },
    });
  }
  try {
    await storage.putObject({ storageKey, mimeType: 'image/png', bytes });
    return await prisma.fileAsset.update({ where: { id: asset.id }, data: { status: 'READY' } });
  } catch (error) {
    await prisma.fileAsset.update({ where: { id: asset.id }, data: { status: 'PENDING_DELETE' } }).catch(() => undefined);
    throw error;
  }
};

const repairQuestionBankRwGraphs = async ({ prisma, storage = null, apply = false, bundlePath } = {}) => {
  if (!prisma) throw new Error('Prisma client is required for Reading and Writing graph repair.');
  const bundle = readQuestionBankRwGraphBundle({ bundlePath });
  const inspection = await inspectQuestionBankRwGraphs({ prisma, bundle });
  if (inspection.conflicts.length) {
    throw new Error(`Reading and Writing graph repair found conflicts: ${JSON.stringify(inspection.conflicts.slice(0, 20).map(({ row, reason }) => ({ questionId: row.questionId, reason })))}`);
  }
  if (!apply) return {
    mode: 'dry-run',
    pending: inspection.pending.length,
    repaired: inspection.repaired.length,
    conflicts: 0,
    sha256: bundle.sha256,
  };
  const objectStorage = storage || getObjectStorage();
  const assets = new Map();
  for (const entry of inspection.pending) {
    const key = entry.row.image.sha256;
    if (!assets.has(key)) assets.set(key, await ensureAsset({
      prisma,
      storage: objectStorage,
      row: entry.row,
      ownerId: entry.item.ownerId,
    }));
  }

  const created = await prisma.$transaction(async tx => {
    await tx.$executeRawUnsafe(`SELECT pg_advisory_xact_lock(${REPAIR_LOCK_KEY})`);
    let count = 0;
    for (const entry of inspection.pending) {
      const row = entry.row;
      const asset = assets.get(row.image.sha256);
      const current = await inspectQuestion({ db: tx, row });
      if (current.state === 'repaired') continue;
      if (current.state !== 'pending') throw new Error(`Question changed during graph repair: ${row.questionId}.`);
      await tx.questionBankVersion.create({ data: {
        questionId: row.questionId,
        version: current.latest.version + 1,
        blocks: desiredBlocks(row, asset.id),
        questionText: current.latest.questionText,
        choices: current.latest.choices,
        correctAnswer: current.latest.correctAnswer,
        explanation: current.latest.explanation,
        createdById: current.item.ownerId,
      } });
      await tx.questionBankImageUsage.createMany({
        data: [{ questionId: row.questionId, fileAssetId: asset.id }],
        skipDuplicates: true,
      });
      await tx.questionBankItem.update({ where: { id: row.questionId }, data: { updatedAt: new Date() } });
      count += 1;
    }
    return count;
  }, { isolationLevel: 'Serializable', maxWait: 30_000, timeout: 300_000 });

  return {
    mode: 'apply',
    createdVersions: created,
    uploadedAssets: assets.size,
    alreadyRepaired: inspection.repaired.length,
    conflicts: 0,
    sha256: bundle.sha256,
  };
};

module.exports = {
  DEFAULT_BUNDLE_PATH,
  EXPECTED_BUNDLE_SHA256,
  EXPECTED_GRAPH_COUNT,
  readQuestionBankRwGraphBundle,
  repairQuestionBankRwGraphs,
  _helpers: { canonicalHash, desiredBlocks, inspectQuestionBankRwGraphs, materializeBlocks, storageKeyFor, validateRow },
};
