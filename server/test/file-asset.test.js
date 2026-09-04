const test = require('node:test');
const assert = require('node:assert/strict');
const { _fileAssetHelpers } = require('../src/services/file-asset.service');

test('managed assignment uploads use a bounded MIME allowlist', () => {
  assert.equal(_fileAssetHelpers.ALLOWED_MIME_TYPES.has('application/pdf'), true);
  assert.equal(_fileAssetHelpers.ALLOWED_MIME_TYPES.has('application/x-msdownload'), false);
  assert.equal(_fileAssetHelpers.MAX_FILE_BYTES, 20 * 1024 * 1024);
});

test('uploaded filenames are normalized and bounded', () => {
  assert.equal(_fileAssetHelpers.normalizeName('  report.pdf\u0000  '), 'report.pdf');
  assert.equal(_fileAssetHelpers.normalizeName('a'.repeat(300)).length, 255);
});
