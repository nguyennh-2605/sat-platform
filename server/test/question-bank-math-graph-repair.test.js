const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');
const zlib = require('node:zlib');
const {
  EXPECTED_BUNDLE_SHA256,
  EXPECTED_IMAGE_COUNT,
  EXPECTED_QUESTION_COUNT,
  readQuestionBankMathGraphBundle,
  _helpers,
} = require('../src/services/question-bank-math-graph-repair.service');

const productionRows = () => {
  const datasetPath = require('../src/services/question-bank-production-import.service').DEFAULT_DATASET_PATH;
  const payload = JSON.parse(zlib.gunzipSync(fs.readFileSync(datasetPath)));
  return new Map(payload.rows.map(row => [row.id, row]));
};

test('bundled Math graphs pass checksum, count, and image validation', () => {
  const bundle = readQuestionBankMathGraphBundle();
  assert.equal(bundle.sha256, EXPECTED_BUNDLE_SHA256);
  assert.equal(bundle.rows.length, EXPECTED_QUESTION_COUNT);
  assert.equal(bundle.rows.reduce((sum, row) => sum + row.images.length, 0), EXPECTED_IMAGE_COUNT);
  assert.equal(new Set(bundle.rows.map(row => row.questionId)).size, EXPECTED_QUESTION_COUNT);

  const scatterplot = bundle.rows.find(row => row.sourceQuestionId === 'b58dbf88');
  assert.ok(scatterplot);
  assert.match(scatterplot.images[0].alt, /Weight of nectarines/);
  assert.deepEqual(scatterplot.replacementBlocks.slice(-2).map(block => block.type), ['text', 'image']);
  assert.match(scatterplot.replacementQuestionText, /What was the weight/);
  assert.doesNotMatch(scatterplot.replacementQuestionText, /data points have the following coordinates/);

  const graphChoices = bundle.rows.find(row => row.sourceQuestionId === '75a32330');
  assert.ok(graphChoices);
  assert.equal(graphChoices.images.length, 4);
  assert.deepEqual(graphChoices.replacementChoices.map(choice => choice.text), [
    '\\text{See choice A above.}',
    '\\text{See choice B above.}',
    '\\text{See choice C above.}',
    '\\text{See choice D above.}',
  ]);
});

test('desired Math graph content replaces build checksums with managed asset ids', () => {
  const row = readQuestionBankMathGraphBundle().rows.find(candidate => candidate.sourceQuestionId === '75a32330');
  const assets = new Map(row.images.map((image, index) => [image.sha256, { id: `asset-${index}` }]));
  const desired = _helpers.desiredContent(row, assets);
  const images = desired.blocks.filter(block => block.type === 'image' && block.assetId);
  assert.equal(images.length, 4);
  assert.ok(images.every(block => !('imageSha256' in block)));
});

test('Math graph inspection accepts legacy content and recognizes repaired content', async () => {
  const row = readQuestionBankMathGraphBundle().rows[0];
  const legacy = productionRows().get(row.questionId);
  const assets = row.images.map((image, index) => ({
    id: `asset-${index}`,
    storageKey: _helpers.storageKeyFor(image),
    status: 'READY',
  }));
  let latest = {
    version: 1,
    blocks: legacy.blocks,
    questionText: legacy.questionText,
    choices: legacy.choices,
  };
  const prisma = {
    questionBankItem: { findUnique: async () => ({
      id: row.questionId,
      ownerId: 1,
      scope: 'SYSTEM',
      subject: 'MATH',
      versions: [latest],
    }) },
    fileAsset: { findMany: async () => assets },
  };
  const pending = await _helpers.inspectQuestionBankMathGraphs({ prisma, bundle: { rows: [row] } });
  assert.equal(pending.pending.length, 1);
  assert.equal(pending.conflicts.length, 0);

  latest = { version: 2, ..._helpers.desiredContent(row, new Map(row.images.map((image, index) => [image.sha256, assets[index]]))) };
  const repaired = await _helpers.inspectQuestionBankMathGraphs({ prisma, bundle: { rows: [row] } });
  assert.equal(repaired.repaired.length, 1);
  assert.equal(repaired.pending.length, 0);
});
