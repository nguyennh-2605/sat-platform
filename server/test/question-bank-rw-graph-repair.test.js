const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');
const zlib = require('node:zlib');
const {
  EXPECTED_BUNDLE_SHA256,
  EXPECTED_GRAPH_COUNT,
  readQuestionBankRwGraphBundle,
  _helpers,
} = require('../src/services/question-bank-rw-graph-repair.service');

const productionRows = () => {
  const payload = JSON.parse(zlib.gunzipSync(fs.readFileSync(require('../src/services/question-bank-production-import.service').DEFAULT_DATASET_PATH)));
  return new Map(payload.rows.map(row => [row.id, row]));
};

test('bundled Reading and Writing graphs pass checksum and image validation', () => {
  const bundle = readQuestionBankRwGraphBundle();
  assert.equal(bundle.sha256, EXPECTED_BUNDLE_SHA256);
  assert.equal(bundle.rows.length, EXPECTED_GRAPH_COUNT);
  assert.equal(new Set(bundle.rows.map(row => row.questionId)).size, EXPECTED_GRAPH_COUNT);
  const municipalityGraph = bundle.rows.find(row => row.sourceQuestionId === 'a15b3219');
  assert.ok(municipalityGraph);
  assert.deepEqual(municipalityGraph.replacementBlocks.map(block => block.type), ['image', 'text']);
  assert.match(municipalityGraph.replacementBlocks[0].alt, /Municipalities’ Responses to Inquiries/);
  assert.match(municipalityGraph.replacementBlocks[1].content, /^In the United States, firms often seek incentives/);
  assert.ok(municipalityGraph.image.width >= 800);
  assert.ok(municipalityGraph.image.height >= 1_100);
});

test('desired graph blocks replace build-only checksums with managed asset ids', () => {
  const row = readQuestionBankRwGraphBundle().rows[0];
  const blocks = _helpers.desiredBlocks(row, '11111111-1111-1111-1111-111111111111');
  assert.equal(blocks[0].type, 'image');
  assert.equal(blocks[0].assetId, '11111111-1111-1111-1111-111111111111');
  assert.equal('imageSha256' in blocks[0], false);
});

test('repair inspection accepts legacy blocks and recognizes an idempotent repaired version', async () => {
  const row = readQuestionBankRwGraphBundle().rows[0];
  const legacy = productionRows().get(row.questionId);
  const asset = {
    id: '22222222-2222-2222-2222-222222222222',
    storageKey: _helpers.storageKeyFor(row),
    status: 'READY',
  };
  let latestBlocks = legacy.blocks;
  const prisma = {
    questionBankItem: { findUnique: async () => ({
      id: row.questionId,
      ownerId: 1,
      scope: 'SYSTEM',
      subject: 'RW',
      versions: [{ version: 1, blocks: latestBlocks }],
    }) },
    fileAsset: { findUnique: async () => asset },
  };
  const pending = await _helpers.inspectQuestionBankRwGraphs({ prisma, bundle: { rows: [row] } });
  assert.equal(pending.pending.length, 1);
  assert.equal(pending.conflicts.length, 0);

  latestBlocks = _helpers.desiredBlocks(row, asset.id);
  const repaired = await _helpers.inspectQuestionBankRwGraphs({ prisma, bundle: { rows: [row] } });
  assert.equal(repaired.repaired.length, 1);
  assert.equal(repaired.pending.length, 0);
});
