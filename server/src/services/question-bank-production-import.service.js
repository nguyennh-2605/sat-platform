const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { isDeepStrictEqual } = require('node:util');
const zlib = require('node:zlib');
const { validateClassification } = require('../utils/question-taxonomy');
const { firstMathContentError, isValidSprAnswer } = require('../utils/math-content-validation');

const EXPECTED_DATASET_COUNT = 3_767;
const EXPECTED_GZIP_SHA256 = '11cbffba8cbb7ea0d4be3ea43ce72b027e6aa8c07a5a695819f0c92cd8ed5dc9';
const EXPECTED_DISTRIBUTION = Object.freeze({
  subject: Object.freeze({ MATH: 1_922, RW: 1_845 }),
  type: Object.freeze({ MCQ: 3_303, SPR: 464 }),
  difficulty: Object.freeze({ EASY: 1_295, MEDIUM: 1_253, HARD: 1_219 }),
});
const DEFAULT_DATASET_PATH = path.resolve(__dirname, '../../data/eqb-question-bank-v1.json.gz');
const IMPORT_BATCH_SIZE = 100;
const IMPORT_LOCK_KEY = 2_026_100_301;

const summarizeRows = rows => {
  const summary = { subject: {}, type: {}, difficulty: {} };
  for (const row of rows) {
    summary.subject[row.subject] = (summary.subject[row.subject] || 0) + 1;
    summary.type[row.type] = (summary.type[row.type] || 0) + 1;
    summary.difficulty[row.difficulty] = (summary.difficulty[row.difficulty] || 0) + 1;
  }
  return summary;
};

const validateQuestionBankRow = row => {
  if (!row || typeof row !== 'object' || Array.isArray(row)) return 'Row must be an object';
  if (!/^eqb-[a-f0-9]{32}$/.test(row.id || '')) return 'Invalid deterministic EQB id';

  const classification = validateClassification(row);
  if (!classification.valid) return classification.error;
  if (!['MCQ', 'SPR'].includes(row.type)) return 'Invalid question type';
  if (!['EASY', 'MEDIUM', 'HARD'].includes(row.difficulty)) return 'Invalid difficulty';
  if (!Array.isArray(row.blocks)) return 'Blocks must be an array';
  if (typeof row.questionText !== 'string' || !row.questionText.trim()) return 'Missing question text';
  if (typeof row.explanation !== 'string' || !row.explanation.trim()) return 'Missing explanation';
  if (typeof row.correctAnswer !== 'string' || !row.correctAnswer.trim()) return 'Missing correct answer';
  if (!Array.isArray(row.choices)) return 'Choices must be an array';

  if (row.type === 'MCQ') {
    const choiceIds = row.choices.map(choice => choice?.id).join('');
    if (
      choiceIds !== 'ABCD'
      || row.choices.some(choice => typeof choice?.text !== 'string' || !choice.text.trim())
      || !row.choices.some(choice => choice.id === row.correctAnswer)
    ) {
      return 'Invalid MCQ choices or answer';
    }
  } else if (row.choices.length !== 0) {
    return 'SPR choices must be empty';
  }

  if (row.subject === 'MATH') {
    const mathError = firstMathContentError(row);
    if (mathError) return mathError;
    if (row.type === 'SPR' && !isValidSprAnswer(row.correctAnswer)) return 'Invalid SPR answer';
  }

  return null;
};

const validateQuestionBankPayload = (
  payload,
  {
    expectedCount = EXPECTED_DATASET_COUNT,
    expectedDistribution = EXPECTED_DISTRIBUTION,
  } = {},
) => {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error('Question bank dataset payload must be an object.');
  }
  if (payload.schemaVersion !== 1) throw new Error('Unsupported question bank dataset schema version.');
  if (payload.sourceCount !== expectedCount) {
    throw new Error(`Dataset source count must be ${expectedCount}; received ${payload.sourceCount}.`);
  }
  if (!Array.isArray(payload.rows) || payload.rows.length !== expectedCount) {
    throw new Error(`Dataset must contain exactly ${expectedCount} rows.`);
  }

  const duplicateIds = [];
  const seenIds = new Set();
  const validationErrors = [];
  payload.rows.forEach((row, index) => {
    if (seenIds.has(row?.id)) duplicateIds.push(row.id);
    seenIds.add(row?.id);
    const error = validateQuestionBankRow(row);
    if (error) validationErrors.push({ id: row?.id || `row-${index + 1}`, error });
  });

  if (duplicateIds.length > 0) {
    throw new Error(`Dataset contains duplicate ids: ${duplicateIds.slice(0, 10).join(', ')}.`);
  }
  if (validationErrors.length > 0) {
    throw new Error(`Dataset validation failed: ${JSON.stringify(validationErrors.slice(0, 20))}`);
  }

  const distribution = summarizeRows(payload.rows);
  if (expectedDistribution && !isDeepStrictEqual(distribution, expectedDistribution)) {
    throw new Error(`Dataset distribution mismatch: ${JSON.stringify(distribution)}.`);
  }

  return { rows: payload.rows, distribution };
};

const readQuestionBankDataset = ({
  datasetPath = DEFAULT_DATASET_PATH,
  expectedSha256 = EXPECTED_GZIP_SHA256,
  expectedCount = EXPECTED_DATASET_COUNT,
  expectedDistribution = EXPECTED_DISTRIBUTION,
} = {}) => {
  const compressed = fs.readFileSync(datasetPath);
  const sha256 = crypto.createHash('sha256').update(compressed).digest('hex');
  if (expectedSha256 && sha256 !== expectedSha256) {
    throw new Error(`Question bank dataset checksum mismatch: received ${sha256}.`);
  }

  let payload;
  try {
    payload = JSON.parse(zlib.gunzipSync(compressed).toString('utf8'));
  } catch (error) {
    throw new Error(`Question bank dataset could not be decoded: ${error.message}`);
  }

  const validated = validateQuestionBankPayload(payload, { expectedCount, expectedDistribution });
  return {
    ...validated,
    datasetPath,
    sha256,
    compressedBytes: compressed.length,
  };
};

const assertExistingRecordsMatch = ({ rows, existingItems, existingVersions }) => {
  const rowsById = new Map(rows.map(row => [row.id, row]));
  const versionsByQuestionId = new Map(existingVersions.map(version => [version.questionId, version]));

  for (const item of existingItems) {
    const row = rowsById.get(item.id);
    if (!row) throw new Error(`Unexpected existing question bank item ${item.id}.`);

    const expectedItem = {
      scope: 'SYSTEM',
      subject: row.subject,
      type: row.type,
      difficulty: row.difficulty,
      domainCode: row.domainCode,
      skillCode: row.skillCode,
    };
    const actualItem = {
      scope: item.scope,
      subject: item.subject,
      type: item.type,
      difficulty: item.difficulty,
      domainCode: item.domainCode,
      skillCode: item.skillCode,
    };
    if (!isDeepStrictEqual(actualItem, expectedItem)) {
      throw new Error(`Existing question bank item ${item.id} does not match the production dataset.`);
    }

    const version = versionsByQuestionId.get(item.id);
    if (!version) throw new Error(`Existing question bank item ${item.id} is missing version 1.`);
    const expectedVersion = {
      blocks: row.blocks,
      questionText: row.questionText,
      choices: row.choices,
      correctAnswer: row.correctAnswer,
      explanation: row.explanation,
    };
    const actualVersion = {
      blocks: version.blocks,
      questionText: version.questionText,
      choices: version.choices,
      correctAnswer: version.correctAnswer,
      explanation: version.explanation,
    };
    if (!isDeepStrictEqual(actualVersion, expectedVersion)) {
      throw new Error(`Existing question bank version ${item.id}:1 does not match the production dataset.`);
    }
  }
};

const importQuestionBankDataset = async ({
  prisma,
  datasetPath = DEFAULT_DATASET_PATH,
  logger,
} = {}) => {
  if (!prisma) throw new Error('Prisma client is required for question bank import.');
  const dataset = readQuestionBankDataset({ datasetPath });
  const ids = dataset.rows.map(row => row.id);

  const result = await prisma.$transaction(async tx => {
    await tx.$executeRawUnsafe(`SELECT pg_advisory_xact_lock(${IMPORT_LOCK_KEY})`);

    const admin = await tx.user.findFirst({
      where: { role: 'ADMIN' },
      orderBy: { id: 'asc' },
      select: { id: true },
    });
    if (!admin) throw new Error('Production question bank import requires an Admin user.');

    const existingItems = await tx.questionBankItem.findMany({
      where: { id: { in: ids } },
      select: {
        id: true,
        scope: true,
        subject: true,
        type: true,
        difficulty: true,
        domainCode: true,
        skillCode: true,
      },
    });
    const existingIds = new Set(existingItems.map(item => item.id));
    const existingVersions = existingItems.length === 0
      ? []
      : await tx.questionBankVersion.findMany({
        where: { questionId: { in: [...existingIds] }, version: 1 },
        select: {
          questionId: true,
          blocks: true,
          questionText: true,
          choices: true,
          correctAnswer: true,
          explanation: true,
        },
      });

    assertExistingRecordsMatch({ rows: dataset.rows, existingItems, existingVersions });
    const pendingRows = dataset.rows.filter(row => !existingIds.has(row.id));

    for (let start = 0; start < pendingRows.length; start += IMPORT_BATCH_SIZE) {
      const batch = pendingRows.slice(start, start + IMPORT_BATCH_SIZE);
      await tx.questionBankItem.createMany({
        data: batch.map(row => ({
          id: row.id,
          ownerId: admin.id,
          scope: 'SYSTEM',
          status: 'DRAFT',
          subject: row.subject,
          type: row.type,
          difficulty: row.difficulty,
          domainCode: row.domainCode,
          skillCode: row.skillCode,
        })),
      });
      await tx.questionBankVersion.createMany({
        data: batch.map(row => ({
          questionId: row.id,
          version: 1,
          blocks: row.blocks,
          questionText: row.questionText,
          choices: row.choices,
          correctAnswer: row.correctAnswer,
          explanation: row.explanation,
          createdById: admin.id,
        })),
      });
      logger?.info?.({
        event: 'question_bank.production_import.progress',
        imported: Math.min(start + IMPORT_BATCH_SIZE, pendingRows.length),
        pending: pendingRows.length,
      }, 'Production question bank import progress');
    }

    const [itemCount, versionCount] = await Promise.all([
      tx.questionBankItem.count({ where: { id: { in: ids } } }),
      tx.questionBankVersion.count({ where: { questionId: { in: ids }, version: 1 } }),
    ]);
    if (itemCount !== EXPECTED_DATASET_COUNT || versionCount !== EXPECTED_DATASET_COUNT) {
      throw new Error(
        `Post-import verification failed: ${itemCount} items and ${versionCount} versions found.`,
      );
    }

    return {
      created: pendingRows.length,
      existing: existingItems.length,
      itemCount,
      versionCount,
    };
  }, {
    isolationLevel: 'Serializable',
    maxWait: 30_000,
    timeout: 300_000,
  });

  return {
    ...result,
    sha256: dataset.sha256,
    distribution: dataset.distribution,
  };
};

module.exports = {
  DEFAULT_DATASET_PATH,
  EXPECTED_DATASET_COUNT,
  EXPECTED_DISTRIBUTION,
  EXPECTED_GZIP_SHA256,
  assertExistingRecordsMatch,
  importQuestionBankDataset,
  readQuestionBankDataset,
  summarizeRows,
  validateQuestionBankPayload,
  validateQuestionBankRow,
};
