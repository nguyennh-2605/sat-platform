const assert = require('node:assert/strict');
const test = require('node:test');
const { getAuditFailures } = require('../scripts/audit-question-bank-images');
const { EXPECTED_DATASET_COUNT } = require('../src/services/question-bank-production-import.service');

const cleanAudit = () => ({
  questionCount: EXPECTED_DATASET_COUNT,
  invalidBlocks: [],
  missingAssetRecords: [],
  invalidAssetRecords: [],
  invalidObjects: [],
  rwInspection: { pending: [], conflicts: [] },
  mathInspection: { pending: [], conflicts: [] },
});

test('empty database audit explains missing dataset instead of reporting no failures', () => {
  const input = cleanAudit();
  input.questionCount = 0;
  input.rwInspection.conflicts.push({ row: { questionId: 'eqb-missing' }, reason: 'Question is missing' });
  const failures = getAuditFailures(input);
  assert.match(failures[0].reason, /found 0/);
  assert.match(failures[0].reason, /DATABASE_URL/);
  assert.match(failures[0].reason, /Admin.*db:prepare:question-bank/);
  assert.deepEqual(failures[1], { questionId: 'eqb-missing', subject: 'RW', reason: 'Question is missing' });
});

test('complete dataset still fails for pending or conflicting graph content', () => {
  const input = cleanAudit();
  input.rwInspection.pending.push({ row: { questionId: 'eqb-rw' } });
  input.mathInspection.conflicts.push({ row: { questionId: 'eqb-math' }, reason: 'Content differs' });
  assert.deepEqual(getAuditFailures(input), [
    { questionId: 'eqb-rw', subject: 'RW', reason: 'Graph repair is pending' },
    { questionId: 'eqb-math', subject: 'MATH', reason: 'Content differs' },
  ]);
});

test('image audit retains failures for missing, invalid and inaccessible assets', () => {
  const input = cleanAudit();
  input.invalidBlocks.push({ questionId: 'eqb-bad', reason: 'Invalid image' });
  input.missingAssetRecords.push('missing');
  input.invalidAssetRecords.push({ id: 'invalid', status: 'PENDING_UPLOAD' });
  input.invalidObjects.push({ id: 'unreachable', reason: 'Object not found' });
  const failures = getAuditFailures(input);
  assert.equal(failures.length, 4);
  assert.ok(failures.every(failure => failure.reason));
});

test('complete question bank with repaired graphs and valid images passes audit', () => {
  assert.deepEqual(getAuditFailures(cleanAudit()), []);
});
