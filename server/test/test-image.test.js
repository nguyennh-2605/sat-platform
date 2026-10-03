const test = require('node:test');
const assert = require('node:assert/strict');
const service = require('../src/services/test-image.service');
const { previewText } = require('../src/services/test-import.service');

const assetId = '63cdb871-ec7a-45f4-8273-ac6eb8e4fe26';
const imageBlock = { type: 'image', assetId };
const sections = [{ questions: [{ blocks: [imageBlock, imageBlock] }] }];
const png = Buffer.alloc(45);
Buffer.from('89504e470d0a1a0a', 'hex').copy(png);
png.writeUInt32BE(320, 16);
png.writeUInt32BE(180, 20);
Buffer.from('0000000049454e44ae426082', 'hex').copy(png, png.length - 12);

test('managed image markers survive structured import and are deduplicated', () => {
  const preview = previewText({
    text: `QUESTION 1\nDomain: Information and Ideas\nSkill: Inferences\n\n[IMG]\nasset:${assetId}\n\nWhat is shown?\nA. One\nB. Two\nAnswer: A`,
    subject: 'RW', moduleCount: 1,
  });
  assert.deepEqual(preview.modules[0].questions[0].blocks[0], imageBlock);
  assert.deepEqual(service.imageAssetIds(sections), [assetId]);
});

test('test image uploads require staff and use a private object key', async () => {
  let persisted;
  const db = { fileAsset: {
    create: async ({ data }) => { persisted = data; return { id: assetId, status: 'PENDING_UPLOAD' }; },
    delete: async () => undefined,
  } };
  const input = { ownerId: 7, userRole: 'TEACHER', originalName: 'graph.png', mimeType: 'image/png', sizeBytes: png.length };
  await assert.rejects(service.createUpload({ ...input, userRole: 'STUDENT' }, { db }), error => error.statusCode === 403);
  const result = await service.createUpload(input, { db, randomUUID: () => 'upload-id', storageFactory: () => ({ provider: 'R2', createUploadUrl: async () => 'https://example.test/upload' }) });
  assert.equal(persisted.storageKey, 'test-images/7/upload-id.png');
  assert.equal(persisted.purpose, 'TEST_IMAGE');
  assert.equal(result.uploadUrl, 'https://example.test/upload');
});

test('image completion verifies bytes before marking ready', async () => {
  const asset = { id: assetId, ownerId: 7, purpose: 'TEST_IMAGE', status: 'PENDING_UPLOAD', sizeBytes: png.length, mimeType: 'image/png', storageKey: 'image-key' };
  const updates = [];
  const db = { fileAsset: {
    findUnique: async () => asset,
    update: async ({ data }) => { updates.push(data); return { ...asset, ...data }; },
  } };
  const storageFactory = bytes => () => ({ headObject: async () => ({ sizeBytes: png.length, mimeType: 'image/png' }), readObject: async () => bytes });
  const result = await service.completeUpload({ fileAssetId: assetId, ownerId: 7 }, { db, storageFactory: storageFactory(png) });
  assert.equal(result.status, 'READY');
  assert.deepEqual(updates.pop(), { status: 'READY' });
  await assert.rejects(service.completeUpload({ fileAssetId: assetId, ownerId: 7 }, { db, storageFactory: storageFactory(Buffer.alloc(png.length)) }), error => error.statusCode === 400);
  assert.deepEqual(updates.pop(), { status: 'PENDING_DELETE' });
});

test('saving a test rejects images owned by another account', async () => {
  const db = { fileAsset: { findMany: async () => [{ id: assetId, ownerId: 8, testImages: [] }] } };
  await assert.rejects(service.assertUsableImages({ sections, userId: 7, db }), error => error.statusCode === 422);
  db.fileAsset.findMany = async () => [{ id: assetId, ownerId: 8, testImages: [{ testId: 42 }] }];
  assert.deepEqual(await service.assertUsableImages({ sections, userId: 7, existingTestId: 42, db }), [assetId]);
});

test('saving a test accepts an image from the selected published bank question', async () => {
  const bankSections = [{ questions: [{ sourceBankQuestionId: 'bank-question-1', blocks: [imageBlock] }] }];
  const db = { fileAsset: { findMany: async () => [{
    id: assetId,
    ownerId: 8,
    testImages: [],
    bankQuestions: [{
      questionId: 'bank-question-1',
      question: { ownerId: 8, scope: 'SYSTEM', status: 'PUBLISHED' },
    }],
  }] } };
  assert.deepEqual(await service.assertUsableImages({ sections: bankSections, userId: 7, userRole: 'TEACHER', db }), [assetId]);
});

test('question bank images are linked without removing immutable version assets', async () => {
  let createInput;
  const db = { questionBankImageUsage: { createMany: async input => { createInput = input; } } };
  await service.linkQuestionBankImages({ db, questionId: 'bank-question-1', assetIds: [assetId] });
  assert.deepEqual(createInput, {
    data: [{ questionId: 'bank-question-1', fileAssetId: assetId }],
    skipDuplicates: true,
  });
});

test('test copies retain shared image references and removed images become cleanup candidates', async () => {
  const calls = [];
  const db = { testImageUsage: {
    deleteMany: async input => calls.push(['delete', input]),
    createMany: async input => calls.push(['create', input]),
  } };
  await service.syncTestImages({ db, testId: 42, assetIds: [assetId] });
  assert.deepEqual(calls[0][1].where, { testId: 42, fileAssetId: { notIn: [assetId] } });
  assert.deepEqual(calls[1][1].data, [{ testId: 42, fileAssetId: assetId }]);
  await service.syncTestImages({ db, testId: 42, assetIds: [] });
  assert.deepEqual(calls[2][1].where, { testId: 42 });
});

test('image access requires a linked readable test or the uploader', async () => {
  const db = {
    fileAsset: { findUnique: async () => ({ id: assetId, purpose: 'TEST_IMAGE', status: 'READY', ownerId: 7, storageKey: 'image-key', originalName: 'graph.png' }) },
    test: { findFirst: async () => null },
  };
  const storageFactory = () => ({ createReadUrl: async () => 'https://example.test/read' });
  await assert.rejects(service.getAccessUrl({ fileAssetId: assetId, userId: 9, userRole: 'STUDENT' }, { db, storageFactory }), error => error.statusCode === 403);
  let accessWhere;
  db.test.findFirst = async ({ where }) => { accessWhere = where; return { id: 42 }; };
  const result = await service.getAccessUrl({ fileAssetId: assetId, userId: 9, userRole: 'STUDENT' }, { db, storageFactory });
  assert.equal(result.url, 'https://example.test/read');
  assert.equal(accessWhere.images.some.fileAssetId, assetId);
  assert.equal(accessWhere.OR[2].deliveries.some.status, 'PUBLISHED');
});

test('published system bank questions grant managed image access', async () => {
  let testQueries = 0;
  const db = {
    fileAsset: { findUnique: async () => ({
      id: assetId,
      purpose: 'TEST_IMAGE',
      status: 'READY',
      ownerId: 7,
      storageKey: 'image-key',
      originalName: 'graph.png',
      bankQuestions: [{ question: { ownerId: 7, scope: 'SYSTEM', status: 'PUBLISHED' } }],
    }) },
    test: { findFirst: async () => { testQueries += 1; return null; } },
  };
  const result = await service.getAccessUrl({ fileAssetId: assetId, userId: 9, userRole: 'STUDENT' }, { db, storageFactory: () => ({ createReadUrl: async () => 'https://example.test/read' }) });
  assert.equal(result.url, 'https://example.test/read');
  assert.equal(testQueries, 0);
});
