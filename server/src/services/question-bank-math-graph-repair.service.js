const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');
const { getObjectStorage } = require('../storage/object-storage');
const { _imageHelpers } = require('./test-image.service');

const EXPECTED_QUESTION_COUNT = 250;
const EXPECTED_IMAGE_COUNT = 272;
const EXPECTED_BUNDLE_SHA256 = 'c2fee648d986e1e22222acfce3dbc604070451a89f3982ca21e0d13b95c5755d';
const DEFAULT_BUNDLE_PATH = path.resolve(__dirname, '../../data/eqb-math-graph-assets-v1.json.gz');
const REPAIR_LOCK_KEY = 2_026_100_304;

const sha256 = value => crypto.createHash('sha256').update(value).digest('hex');

const canonicalJson = value => {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
};

const canonicalHash = value => sha256(canonicalJson(value));
const storageKeyFor = image => `test-images/question-bank/math-graphs/${image.sha256}.png`;

const desiredContent = (row, assetsBySha) => ({
  blocks: row.replacementBlocks.map(block => {
    if (block?.type !== 'image' || !block.imageSha256) return block;
    const asset = assetsBySha.get(block.imageSha256);
    if (!asset) throw new Error(`Missing managed asset ${block.imageSha256} for ${row.questionId}.`);
    const { imageSha256, ...imageBlock } = block;
    return { ...imageBlock, assetId: asset.id };
  }),
  questionText: row.replacementQuestionText,
  choices: row.replacementChoices,
});

const validateImage = image => {
  if (!image || image.mimeType !== 'image/png' || !/^[a-f0-9]{64}$/.test(image.sha256 || '')) return 'Invalid PNG metadata';
  if (!/^(?:stem|choice-[A-D])$/.test(image.field || '')) return 'Invalid image field';
  let bytes;
  try { bytes = Buffer.from(image.bytesBase64, 'base64'); }
  catch { return 'Invalid PNG encoding'; }
  if (!bytes.length || bytes.length > _imageHelpers.MAX_IMAGE_BYTES || sha256(bytes) !== image.sha256) return 'PNG checksum or size mismatch';
  const dimensions = _imageHelpers.imageDimensions(bytes, 'image/png');
  if (!dimensions || dimensions[0] !== image.width || dimensions[1] !== image.height) return 'PNG dimensions mismatch';
  if (typeof image.alt !== 'string' || image.alt.trim().length < 10) return 'Image alt text is missing';
  return null;
};

const validateRow = row => {
  if (!row || !/^eqb-[a-f0-9]{32}$/.test(row.questionId || '')) return 'Invalid question id';
  if (!/^[a-f0-9]{64}$/.test(row.expectedLegacyContentSha256 || '')) return 'Invalid legacy content checksum';
  if (!Array.isArray(row.replacementBlocks) || !Array.isArray(row.replacementChoices)) return 'Replacement content is missing';
  if (typeof row.replacementQuestionText !== 'string' || !row.replacementQuestionText.trim()) return 'Replacement question text is missing';
  if (!Array.isArray(row.images) || row.images.length < 1) return 'At least one graph image is required';
  const imageShas = new Set(row.images.map(image => image.sha256));
  if (imageShas.size !== row.images.length) return 'Question image checksums must be unique';
  const placeholderShas = row.replacementBlocks
    .filter(block => block?.type === 'image' && block.imageSha256)
    .map(block => block.imageSha256);
  if (placeholderShas.length !== row.images.length || placeholderShas.some(hash => !imageShas.has(hash))) {
    return 'Replacement image references do not match image payloads';
  }
  for (const image of row.images) {
    const error = validateImage(image);
    if (error) return error;
  }
  return null;
};

const readQuestionBankMathGraphBundle = ({
  bundlePath = DEFAULT_BUNDLE_PATH,
  expectedSha256 = EXPECTED_BUNDLE_SHA256,
  expectedQuestionCount = EXPECTED_QUESTION_COUNT,
  expectedImageCount = EXPECTED_IMAGE_COUNT,
} = {}) => {
  const compressed = fs.readFileSync(bundlePath);
  const checksum = sha256(compressed);
  if (expectedSha256 && checksum !== expectedSha256) throw new Error(`Math graph bundle checksum mismatch: received ${checksum}.`);
  let payload;
  try { payload = JSON.parse(zlib.gunzipSync(compressed).toString('utf8')); }
  catch (error) { throw new Error(`Math graph bundle could not be decoded: ${error.message}`); }
  if (
    payload?.schemaVersion !== 1
    || payload?.sourceCount !== expectedQuestionCount
    || payload?.rows?.length !== expectedQuestionCount
    || payload?.imageCount !== expectedImageCount
  ) {
    throw new Error(`Math graph bundle must contain ${expectedQuestionCount} questions and ${expectedImageCount} images.`);
  }
  const seenQuestions = new Set();
  const errors = [];
  for (const row of payload.rows) {
    if (seenQuestions.has(row.questionId)) errors.push({ questionId: row.questionId, error: 'Duplicate question id' });
    seenQuestions.add(row.questionId);
    const error = validateRow(row);
    if (error) errors.push({ questionId: row.questionId, error });
  }
  if (errors.length) throw new Error(`Math graph bundle validation failed: ${JSON.stringify(errors.slice(0, 20))}`);
  return { rows: payload.rows, bundlePath, sha256: checksum, compressedBytes: compressed.length, imageCount: payload.imageCount };
};

const findAssets = async ({ db, row }) => {
  const keys = row.images.map(storageKeyFor);
  const assets = await db.fileAsset.findMany({ where: { storageKey: { in: keys } } });
  return new Map(assets.map(asset => [asset.storageKey.split('/').at(-1).replace(/\.png$/, ''), asset]));
};

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
  if (item.scope !== 'SYSTEM' || item.subject !== 'MATH') return { state: 'conflict', reason: 'Question is not a System Math item' };
  const latest = item.versions[0];
  if (!latest) return { state: 'conflict', reason: 'Question has no content version' };
  const assetsBySha = await findAssets({ db, row });
  if (assetsBySha.size === row.images.length) {
    const desired = desiredContent(row, assetsBySha);
    if (canonicalHash({ blocks: latest.blocks, questionText: latest.questionText, choices: latest.choices }) === canonicalHash(desired)) {
      return { state: 'repaired', item, latest, assetsBySha };
    }
  }
  const legacyHash = canonicalHash({ blocks: latest.blocks, questionText: latest.questionText, choices: latest.choices });
  if (legacyHash !== row.expectedLegacyContentSha256) {
    return { state: 'conflict', reason: 'Latest content differs from both the legacy and repaired content', item, latest, assetsBySha };
  }
  return { state: 'pending', item, latest, assetsBySha };
};

const inspectQuestionBankMathGraphs = async ({ prisma, bundle }) => {
  const report = { pending: [], repaired: [], conflicts: [] };
  for (const row of bundle.rows) {
    const result = await inspectQuestion({ db: prisma, row });
    report[result.state === 'conflict' ? 'conflicts' : result.state].push({ row, ...result });
  }
  return report;
};

const ensureAsset = async ({ prisma, storage, image, ownerId }) => {
  const storageKey = storageKeyFor(image);
  const bytes = Buffer.from(image.bytesBase64, 'base64');
  let asset = await prisma.fileAsset.findUnique({ where: { storageKey } });
  if (asset?.status === 'READY') {
    if (asset.purpose !== 'TEST_IMAGE' || asset.mimeType !== 'image/png' || asset.sizeBytes !== bytes.length) {
      throw new Error(`Existing graph asset metadata does not match ${image.sha256}.`);
    }
    return asset;
  }
  if (!asset) {
    asset = await prisma.fileAsset.create({ data: {
      ownerId,
      provider: storage.provider,
      storageKey,
      originalName: `Math graph ${image.sha256.slice(0, 12)}.png`,
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

const repairQuestionBankMathGraphs = async ({ prisma, storage = null, apply = false, bundlePath } = {}) => {
  if (!prisma) throw new Error('Prisma client is required for Math graph repair.');
  const bundle = readQuestionBankMathGraphBundle({ bundlePath });
  const inspection = await inspectQuestionBankMathGraphs({ prisma, bundle });
  if (inspection.conflicts.length) {
    throw new Error(`Math graph repair found conflicts: ${JSON.stringify(inspection.conflicts.slice(0, 20).map(({ row, reason }) => ({ questionId: row.questionId, reason })))}`);
  }
  if (!apply) return {
    mode: 'dry-run',
    pending: inspection.pending.length,
    repaired: inspection.repaired.length,
    conflicts: 0,
    images: bundle.imageCount,
    sha256: bundle.sha256,
  };

  const objectStorage = storage || getObjectStorage();
  const assetsBySha = new Map();
  for (const entry of inspection.pending) {
    for (const image of entry.row.images) {
      if (!assetsBySha.has(image.sha256)) assetsBySha.set(image.sha256, await ensureAsset({
        prisma,
        storage: objectStorage,
        image,
        ownerId: entry.item.ownerId,
      }));
    }
  }

  const created = await prisma.$transaction(async tx => {
    await tx.$executeRawUnsafe(`SELECT pg_advisory_xact_lock(${REPAIR_LOCK_KEY})`);
    let count = 0;
    for (const entry of inspection.pending) {
      const rowAssets = new Map(entry.row.images.map(image => [image.sha256, assetsBySha.get(image.sha256)]));
      const current = await inspectQuestion({ db: tx, row: entry.row });
      if (current.state === 'repaired') continue;
      if (current.state !== 'pending') throw new Error(`Question changed during Math graph repair: ${entry.row.questionId}.`);
      const desired = desiredContent(entry.row, rowAssets);
      await tx.questionBankVersion.create({ data: {
        questionId: entry.row.questionId,
        version: current.latest.version + 1,
        blocks: desired.blocks,
        questionText: desired.questionText,
        choices: desired.choices,
        correctAnswer: current.latest.correctAnswer,
        explanation: current.latest.explanation,
        createdById: current.item.ownerId,
      } });
      await tx.questionBankImageUsage.createMany({
        data: [...rowAssets.values()].map(asset => ({ questionId: entry.row.questionId, fileAssetId: asset.id })),
        skipDuplicates: true,
      });
      await tx.questionBankItem.update({ where: { id: entry.row.questionId }, data: { updatedAt: new Date() } });
      count += 1;
    }
    return count;
  }, { isolationLevel: 'Serializable', maxWait: 30_000, timeout: 300_000 });

  return {
    mode: 'apply',
    createdVersions: created,
    managedAssets: assetsBySha.size,
    alreadyRepaired: inspection.repaired.length,
    conflicts: 0,
    sha256: bundle.sha256,
  };
};

module.exports = {
  DEFAULT_BUNDLE_PATH,
  EXPECTED_BUNDLE_SHA256,
  EXPECTED_IMAGE_COUNT,
  EXPECTED_QUESTION_COUNT,
  readQuestionBankMathGraphBundle,
  repairQuestionBankMathGraphs,
  _helpers: { canonicalHash, desiredContent, inspectQuestionBankMathGraphs, storageKeyFor, validateRow },
};
