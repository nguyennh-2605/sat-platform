const assert = require('node:assert/strict');
const test = require('node:test');
const {
  EXPECTED_DATASET_COUNT,
  EXPECTED_DISTRIBUTION,
  EXPECTED_GZIP_SHA256,
  assertExistingRecordsMatch,
  readQuestionBankDataset,
  validateQuestionBankPayload,
} = require('../src/services/question-bank-production-import.service');

test('bundled production question bank dataset passes checksum and full validation', () => {
  const dataset = readQuestionBankDataset();

  assert.equal(dataset.rows.length, EXPECTED_DATASET_COUNT);
  assert.equal(dataset.sha256, EXPECTED_GZIP_SHA256);
  assert.deepEqual(dataset.distribution, EXPECTED_DISTRIBUTION);
});

test('dataset validation rejects a malformed row before database work can start', () => {
  const malformed = {
    id: 'not-an-eqb-id',
    subject: 'RW',
    type: 'MCQ',
    difficulty: 'EASY',
    domainCode: 'RW_INFORMATION_AND_IDEAS',
    skillCode: 'RW_CENTRAL_IDEAS_AND_DETAILS',
    blocks: [],
    questionText: '',
    choices: [],
    correctAnswer: '',
    explanation: '',
  };

  assert.throws(
    () => validateQuestionBankPayload(
      { schemaVersion: 1, sourceCount: 1, rows: [malformed] },
      { expectedCount: 1, expectedDistribution: null },
    ),
    /Dataset validation failed/,
  );
});

test('existing deterministic ids must match the bundled version exactly', () => {
  const dataset = readQuestionBankDataset();
  const row = dataset.rows[0];
  const existingItem = {
    id: row.id,
    scope: 'SYSTEM',
    subject: row.subject,
    type: row.type,
    difficulty: row.difficulty,
    domainCode: row.domainCode,
    skillCode: row.skillCode,
  };
  const existingVersion = {
    questionId: row.id,
    blocks: row.blocks,
    questionText: `${row.questionText} changed`,
    choices: row.choices,
    correctAnswer: row.correctAnswer,
    explanation: row.explanation,
  };

  assert.throws(
    () => assertExistingRecordsMatch({
      rows: [row],
      existingItems: [existingItem],
      existingVersions: [existingVersion],
    }),
    /does not match the production dataset/,
  );
});
