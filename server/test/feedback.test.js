const test = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const service = require('../src/services/feedback.service');
const files = require('../src/services/file-asset.service');

const statusError = status => error => error.statusCode === status;
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=', 'base64');
const image = { originalname: ' screenshot.png ', mimetype: 'image/png', buffer: png };
const input = () => ({ userId: 1, submissionId: randomUUID(), level: 'MAJOR', message: ' The save button does not work. ', pagePath: '/dashboard/classes' });

function fakeDb() {
  let state = { users: [{ id: 1, role: 'STUDENT', name: 'Student', email: 'student@example.test' }, { id: 2, role: 'ADMIN', name: 'Admin' }, { id: 3, role: 'TEACHER' }], feedback: [], assets: [] };
  const matches = (row, where) => Object.entries(where).every(([key, value]) => {
    if (key === 'OR') return value.some(condition => matches(row, condition));
    if (key === 'feedbackAttachment') return row.feedbackAttachment == null;
    if (value instanceof Date) return new Date(row[key]).getTime() === value.getTime();
    if (value && typeof value === 'object') {
      if ('in' in value) return value.in.includes(row[key]);
      if ('lt' in value) return row[key] < value.lt;
    }
    return row[key] === value;
  });
  const withRelations = row => row ? { ...row, user: state.users.find(user => user.id === row.userId), attachments: state.assets.filter(asset => asset.feedbackAttachment?.feedbackId === row.id).map(asset => ({ asset })) } : null;
  let queue = Promise.resolve();
  const db = {
    get state() { return state; },
    user: { findUnique: async ({ where }) => state.users.find(row => matches(row, where)) || null },
    fileAsset: {
      create: async ({ data }) => { const row = { id: randomUUID(), status: 'PENDING_UPLOAD', ...data }; state.assets.push(row); return { ...row }; },
      update: async ({ where, data }) => { const row = state.assets.find(asset => matches(asset, where)); Object.assign(row, data); return { ...row }; },
      findUnique: async ({ where }) => state.assets.find(row => matches(row, where)) || null,
      findMany: async ({ where }) => state.assets.filter(row => matches(row, where)),
    },
    feedback: {
      findUnique: async ({ where }) => withRelations(state.feedback.find(row => matches(row, where))),
      findMany: async ({ where, take }) => state.feedback.filter(row => matches(row, where)).sort((a, b) => b.createdAt - a.createdAt || b.id.localeCompare(a.id)).slice(0, take).map(withRelations),
      create: async ({ data }) => {
        if (state.feedback.some(row => row.id === data.id)) throw Object.assign(new Error('Duplicate'), { code: 'P2002' });
        const { attachments, ...fields } = data;
        const row = { status: 'NEW', createdAt: new Date(), updatedAt: new Date(), ...fields };
        state.feedback.push(row);
        for (const attachment of attachments.create) state.assets.find(asset => asset.id === attachment.fileAssetId).feedbackAttachment = { feedbackId: row.id };
        return withRelations(row);
      },
      updateMany: async ({ where, data }) => { const rows = state.feedback.filter(row => matches(row, where)); rows.forEach(row => Object.assign(row, data)); return { count: rows.length }; },
    },
    $transaction: callback => {
      const run = queue.then(async () => { const before = structuredClone(state); try { return await callback(db); } catch (error) { state = before; throw error; } });
      queue = run.catch(() => {}); return run;
    },
  };
  return db;
}
const storage = { provider: 'TEST', putObject: async () => {}, createReadUrl: async () => 'https://storage.example/signed-image' };

test('all five levels persist authenticated feedback and retries are idempotent', async () => {
  const db = fakeDb();
  for (const level of ['CRITICAL', 'MAJOR', 'MINOR', 'IMPROVEMENT', 'GENERAL']) {
    const request = { ...input(), level, db };
    await service.submit(request);
    await service.submit(request);
  }
  assert.equal(db.state.feedback.length, 5);
  assert.equal(db.state.feedback[0].message, 'The save button does not work.');
  assert.equal(db.state.feedback[0].userId, 1);
  assert.equal(db.state.feedback[0].status, 'NEW');
  const request = { ...input(), db };
  await Promise.all([service.submit(request), service.submit(request)]);
  assert.equal(db.state.feedback.length, 6);
  await assert.rejects(service.submit({ ...request, userId: 3 }), statusError(409));
  await assert.rejects(service.submit({ ...request, message: 'Different content' }), statusError(409));
});

test('feedback validation rejects blank, oversized and malformed inputs', async () => {
  const db = fakeDb();
  for (const change of [{ message: '' }, { message: ' ' }, { message: 'x'.repeat(5001) }, { message: {} }, { level: 'URGENT' }, { submissionId: 'invalid' }, { pagePath: '//external.test' }, { pagePath: '/dashboard?token=secret' }, { pagePath: 'x'.repeat(501) }, { attachmentIds: 'bad' }, { attachmentIds: [randomUUID(), randomUUID(), randomUUID(), randomUUID()] }]) {
    await assert.rejects(service.submit({ ...input(), ...change, db }), statusError(400));
  }
  await assert.rejects(service.submit({ ...input(), userId: 99, db }), statusError(401));
  assert.equal(db.state.feedback.length, 0);
});

test('uploads validate actual image bytes and only link ready, owned feedback images once', async () => {
  const db = fakeDb();
  let upload;
  const asset = await service.uploadImage({ userId: 1, file: image, db, storageFactory: () => ({ ...storage, putObject: async args => { upload = args; } }) });
  assert.equal(asset.name, 'screenshot.png');
  assert.equal(db.state.assets[0].purpose, 'FEEDBACK_IMAGE');
  assert.equal(db.state.assets[0].status, 'READY');
  assert.equal(upload.mimeType, 'image/png');
  assert.deepEqual(upload.bytes, png);
  const request = { ...input(), attachmentIds: [asset.id], db };
  for (const change of [{ userId: 3 }, { attachmentIds: [asset.id, asset.id] }, { attachmentIds: [randomUUID()] }]) await assert.rejects(service.submit({ ...request, ...change }), statusError(400));
  db.state.assets[0].status = 'PENDING_UPLOAD';
  await assert.rejects(service.submit(request), statusError(400));
  db.state.assets[0].status = 'READY'; db.state.assets[0].purpose = 'GENERAL';
  await assert.rejects(service.submit(request), statusError(400));
  db.state.assets[0].purpose = 'FEEDBACK_IMAGE';
  const report = await service.submit(request);
  assert.deepEqual(report.attachments, [asset]);
  await service.submit(request);
  await assert.rejects(service.submit({ ...request, submissionId: randomUUID() }), statusError(400));
});

test('invalid images never reach storage; failed writes remain available to cleanup', async () => {
  const db = fakeDb();
  for (const file of [null, { ...image, mimetype: 'image/svg+xml' }, { ...image, buffer: Buffer.from('<script>') }, { ...image, buffer: Buffer.alloc(service.MAX_IMAGE_BYTES + 1) }]) {
    await assert.rejects(service.uploadImage({ userId: 1, file, db, storageFactory: () => { throw new Error('Must not touch storage'); } }), statusError(400));
  }
  await assert.rejects(service.uploadImage({ userId: 1, file: image, db, storageFactory: () => { throw new Error('Not configured'); } }), statusError(503));
  assert.equal(db.state.assets.length, 0);
  await assert.rejects(service.uploadImage({ userId: 1, file: image, db, storageFactory: () => ({ ...storage, putObject: async () => { throw new Error('Storage failed'); } }) }), /Storage failed/);
  assert.equal(db.state.assets[0].status, 'PENDING_DELETE');
});

test('only sender and current admin can access linked screenshots; generic file endpoints cannot bypass this', async () => {
  const db = fakeDb();
  const asset = await service.uploadImage({ userId: 1, file: image, db, storageFactory: () => storage });
  const args = { fileAssetId: asset.id, db, storageFactory: () => storage };
  await assert.rejects(service.getImage({ ...args, userId: 2 }), statusError(403));
  await service.submit({ ...input(), attachmentIds: [asset.id], db });
  assert.equal((await service.getImage({ ...args, userId: 1 })).expiresInSeconds, 300);
  await service.getImage({ ...args, userId: 2 });
  await assert.rejects(service.getImage({ ...args, userId: 3 }), statusError(403));
  db.state.users[1].role = 'STUDENT';
  await assert.rejects(service.getImage({ ...args, userId: 2 }), statusError(403));
  await assert.rejects(files.getAccessUrl({ ...args, userId: 2, userRole: 'ADMIN' }, { db }), statusError(404));
  await assert.rejects(files.completeUpload({ fileAssetId: asset.id, ownerId: 1 }, { db }), statusError(404));
});

test('admin filtering and stable cursor pagination bound pages, including equal submission times', async () => {
  const db = fakeDb();
  db.state.feedback = Array.from({ length: 28 }, (_, index) => ({ id: `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`, userId: 1, level: index === 0 ? 'MINOR' : 'CRITICAL', status: 'NEW', message: 'Issue', createdAt: new Date('2026-10-14T00:00:00Z') }));
  const first = await service.list({ userId: 2, db });
  assert.equal(first.items.length, 25);
  assert.ok(first.nextCursor);
  const second = await service.list({ userId: 2, cursor: first.nextCursor, db });
  assert.equal(second.items.length, 3);
  assert.equal(new Set([...first.items, ...second.items].map(item => item.id)).size, 28);
  assert.equal(second.nextCursor, null);
  assert.equal((await service.list({ userId: 2, level: 'MINOR', db })).items.length, 1);
  assert.equal((await service.list({ userId: 2, status: 'RESOLVED', db })).items.length, 0);
  for (const change of [{ status: 'INVALID' }, { level: [] }, { cursor: 'invalid' }]) await assert.rejects(service.list({ userId: 2, ...change, db }), statusError(400));
});

test('admin reviews use current database role and reject stale or conflicting updates', async () => {
  const db = fakeDb();
  const report = await service.submit({ ...input(), db });
  const args = { feedbackId: report.id, status: 'RESOLVED', expectedStatus: 'NEW', db };
  for (const userId of [1, 3]) {
    await assert.rejects(service.list({ userId, db }), statusError(403));
    await assert.rejects(service.review({ ...args, userId }), statusError(403));
  }
  const results = await Promise.allSettled(['IN_PROGRESS', 'RESOLVED'].map(status => service.review({ ...args, status, userId: 2 })));
  assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
  assert.equal(results.find(result => result.status === 'rejected').reason.statusCode, 409);
  assert.equal(db.state.feedback[0].reviewedById, 2);
  db.state.users[1].role = 'STUDENT';
  await assert.rejects(service.list({ userId: 2, db }), statusError(403));
  await assert.rejects(service.review({ ...args, userId: 2 }), statusError(403));
});

test('HTTP routes enforce authentication, admin access, upload limits and server-owned identity', async t => {
  const express = require('express');
  const jwt = require('jsonwebtoken');
  const { JWT_SECRET } = require('../src/config/jwt');
  const originals = { submit: service.submit, list: service.list, review: service.review, uploadImage: service.uploadImage };
  let received;
  let uploadCalls = 0;
  service.submit = async args => { received = args; return { id: args.submissionId }; };
  service.list = async () => ({ items: [], nextCursor: null });
  service.review = async () => ({ status: 'RESOLVED' });
  service.uploadImage = async args => { uploadCalls += 1; received = args; return { id: 'uploaded' }; };
  const app = express();
  app.use(express.json());
  app.use('/api/feedback', require('../src/routes/feedback.routes'));
  app.use('/api/admin', require('../src/routes/admin.routes'));
  const server = await new Promise(resolve => { const listener = app.listen(0, '127.0.0.1', () => resolve(listener)); });
  t.after(async () => { Object.assign(service, originals); await new Promise(resolve => server.close(resolve)); });
  const base = `http://127.0.0.1:${server.address().port}`;
  const headers = role => ({ Authorization: `Bearer ${jwt.sign({ userId: 7, role, authMethod: 'GOOGLE' }, JWT_SECRET, { expiresIn: '5m' })}` });
  const body = JSON.stringify({ ...input(), userId: 999, role: 'ADMIN', status: 'RESOLVED' });
  assert.equal((await fetch(`${base}/api/feedback`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body })).status, 401);
  for (const role of ['STUDENT', 'TEACHER', 'ADMIN']) {
    const result = await fetch(`${base}/api/feedback`, { method: 'POST', headers: { ...headers(role), 'Content-Type': 'application/json' }, body });
    assert.equal(result.status, 201);
    assert.equal(received.userId, 7);
    assert.equal(received.role, undefined);
  }
  assert.equal((await fetch(`${base}/api/admin/feedback`, { headers: headers('STUDENT') })).status, 403);
  assert.equal((await fetch(`${base}/api/admin/feedback`, { headers: headers('ADMIN') })).status, 200);
  const upload = async (bytes, name = 'screenshot.png') => {
    const form = new FormData(); form.append('image', new Blob([bytes], { type: 'image/png' }), name);
    return fetch(`${base}/api/feedback/images`, { method: 'POST', headers: headers('STUDENT'), body: form });
  };
  assert.equal((await upload(png)).status, 201);
  assert.equal(received.userId, 7);
  assert.deepEqual(received.file.buffer, png);
  assert.equal((await upload(Buffer.alloc(service.MAX_IMAGE_BYTES + 1))).status, 400);
  assert.equal(uploadCalls, 1);
});
