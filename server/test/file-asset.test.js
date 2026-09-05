const test = require('node:test');
const assert = require('node:assert/strict');
const fileAssetService = require('../src/services/file-asset.service');

const { _fileAssetHelpers } = fileAssetService;
const eligibleAssignment = {
  deadline: null,
  class: { students: [{ id: 7 }] },
  activity: { activity: { status: 'PUBLISHED', availableAt: null, dueAt: null, assignees: [{ studentId: 7 }] } },
};
const uploadInput = { assignmentId: 'assignment-1', ownerId: 7, originalName: 'answer.pdf', mimeType: 'application/pdf', sizeBytes: 1024 };
const silentLogger = { error() {} };
const expectStatus = statusCode => error => error?.statusCode === statusCode;
const createDb = (overrides = {}) => ({
  assignment: { findUnique: async () => eligibleAssignment },
  fileAsset: {
    create: async ({ data }) => ({ id: 'asset-1', status: 'PENDING_UPLOAD', ...data }),
    findUnique: async () => null,
    update: async ({ data }) => ({ id: 'asset-1', ...data }),
    delete: async () => undefined,
    findMany: async () => [],
  },
  homeworkSubmissionItem: { findFirst: async () => null },
  ...overrides,
});

test('managed assignment uploads use a bounded MIME allowlist', () => {
  assert.equal(_fileAssetHelpers.ALLOWED_MIME_TYPES.has('application/pdf'), true);
  assert.equal(_fileAssetHelpers.ALLOWED_MIME_TYPES.has('application/x-msdownload'), false);
  assert.equal(_fileAssetHelpers.MAX_FILE_BYTES, 20 * 1024 * 1024);
});

test('uploaded filenames are normalized and bounded', () => {
  assert.equal(_fileAssetHelpers.normalizeName('  report.pdf\u0000  '), 'report.pdf');
  assert.equal(_fileAssetHelpers.normalizeName('a'.repeat(300)).length, 255);
});

test('create upload persists a pending asset and returns a bounded presigned request', async () => {
  let persisted;
  const db = createDb();
  db.fileAsset.create = async ({ data }) => {
    persisted = data;
    return { id: 'asset-1', status: 'PENDING_UPLOAD', ...data };
  };
  const result = await fileAssetService.createUpload(uploadInput, {
    db,
    randomUUID: () => 'fixed-uuid',
    storageFactory: () => ({ provider: 'R2', createUploadUrl: async () => 'https://signed.example/upload' }),
    logger: silentLogger,
  });
  assert.equal(persisted.storageKey, 'submissions/7/fixed-uuid.pdf');
  assert.equal(persisted.provider, 'R2');
  assert.equal(result.uploadUrl, 'https://signed.example/upload');
  assert.deepEqual(result.headers, { 'Content-Type': 'application/pdf' });
  assert.equal(result.expiresInSeconds, 900);
});

test('create upload rejects oversized and unsupported files before storage is called', async () => {
  const dependencies = { db: createDb(), storageFactory: () => { throw new Error('must not be called'); } };
  await assert.rejects(fileAssetService.createUpload({ ...uploadInput, sizeBytes: 20 * 1024 * 1024 + 1 }, dependencies), expectStatus(400));
  await assert.rejects(fileAssetService.createUpload({ ...uploadInput, mimeType: 'application/x-msdownload' }, dependencies), expectStatus(400));
});

test('a student cannot create an upload for work they were not assigned', async () => {
  const db = createDb({ assignment: { findUnique: async () => ({ ...eligibleAssignment, class: { students: [] } }) } });
  await assert.rejects(fileAssetService.createUpload(uploadInput, { db }), expectStatus(403));
});

test('only the owner can complete a pending upload', async () => {
  const db = createDb();
  db.fileAsset.findUnique = async () => ({ id: 'asset-1', ownerId: 8, status: 'PENDING_UPLOAD' });
  await assert.rejects(fileAssetService.completeUpload({ fileAssetId: 'asset-1', ownerId: 7 }, { db }), expectStatus(403));
});

test('owner completion verifies metadata before marking an upload ready', async () => {
  let update;
  const asset = { id: 'asset-1', ownerId: 7, status: 'PENDING_UPLOAD', sizeBytes: 1024, mimeType: 'application/pdf' };
  const db = createDb();
  db.fileAsset.findUnique = async () => asset;
  db.fileAsset.update = async input => {
    update = input;
    return { ...asset, ...input.data };
  };
  const result = await fileAssetService.completeUpload(
    { fileAssetId: 'asset-1', ownerId: 7 },
    { db, storageFactory: () => ({ headObject: async () => ({ sizeBytes: 1024, mimeType: 'application/pdf' }) }), logger: silentLogger },
  );
  assert.deepEqual(update, { where: { id: 'asset-1' }, data: { status: 'READY' } });
  assert.equal(result.status, 'READY');
});

test('owners and the teacher of submitted work can get access, unrelated teachers cannot', async () => {
  const asset = { id: 'asset-1', ownerId: 7, status: 'READY', storageKey: 'private-key', originalName: 'answer.pdf' };
  const storageFactory = () => ({ createReadUrl: async () => 'https://signed.example/read' });
  const ownerDb = createDb();
  ownerDb.fileAsset.findUnique = async () => asset;
  const owner = await fileAssetService.getAccessUrl({ fileAssetId: 'asset-1', userId: 7, userRole: 'STUDENT' }, { db: ownerDb, storageFactory });
  assert.equal(owner.url, 'https://signed.example/read');

  const teacherDb = createDb();
  teacherDb.fileAsset.findUnique = async () => asset;
  teacherDb.homeworkSubmissionItem.findFirst = async () => ({ id: 'item-1' });
  const teacher = await fileAssetService.getAccessUrl({ fileAssetId: 'asset-1', userId: 20, userRole: 'TEACHER' }, { db: teacherDb, storageFactory });
  assert.equal(teacher.url, 'https://signed.example/read');

  const unrelatedDb = createDb();
  unrelatedDb.fileAsset.findUnique = async () => asset;
  await assert.rejects(
    fileAssetService.getAccessUrl({ fileAssetId: 'asset-1', userId: 30, userRole: 'TEACHER' }, { db: unrelatedDb, storageFactory }),
    expectStatus(403),
  );
});

test('cleanup deletes orphan assets and keeps failures pending for a retry', async () => {
  const deleted = [];
  const pending = [];
  const db = createDb();
  db.fileAsset.findMany = async () => [
    { id: 'asset-ok', storageKey: 'orphan-ok' },
    { id: 'asset-failed', storageKey: 'orphan-failed' },
  ];
  db.fileAsset.delete = async ({ where }) => deleted.push(where.id);
  db.fileAsset.update = async ({ where, data }) => pending.push({ id: where.id, status: data.status });
  let tick = 1000;
  const result = await fileAssetService.cleanupAssets({
    db,
    storageFactory: () => ({ deleteObject: async ({ storageKey }) => {
      if (storageKey === 'orphan-failed') throw Object.assign(new Error('unavailable'), { code: 'TimeoutError' });
    } }),
    logger: silentLogger,
    clock: () => tick += 25,
  });
  assert.deepEqual(result, { candidates: 2, processed: 1, failed: 1, durationMs: 25 });
  assert.deepEqual(deleted, ['asset-ok']);
  assert.deepEqual(pending, [{ id: 'asset-failed', status: 'PENDING_DELETE' }]);
});

test('cleanup uses bounded concurrency instead of deleting the whole batch at once', async () => {
  const db = createDb();
  db.fileAsset.findMany = async () => Array.from({ length: 8 }, (_, index) => ({
    id: `asset-${index}`,
    storageKey: `orphan-${index}`,
  }));
  db.fileAsset.delete = async () => undefined;
  let active = 0;
  let maximumActive = 0;

  const result = await fileAssetService.cleanupAssets({
    db,
    concurrency: 3,
    storageFactory: () => ({ deleteObject: async () => {
      active += 1;
      maximumActive = Math.max(maximumActive, active);
      await new Promise(resolve => setTimeout(resolve, 5));
      active -= 1;
    } }),
    logger: silentLogger,
    clock: () => 1000,
  });

  assert.equal(maximumActive, 3);
  assert.deepEqual(result, { candidates: 8, processed: 8, failed: 0, durationMs: 0 });
});
