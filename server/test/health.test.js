const test = require('node:test');
const assert = require('node:assert/strict');
const { createHealthHandlers } = require('../src/controllers/health.controller');

const response = () => ({
  statusCode: null,
  body: null,
  status(code) {
    this.statusCode = code;
    return this;
  },
  json(body) {
    this.body = body;
    return this;
  },
});

test('liveness reports the process without touching the database', () => {
  const database = { $queryRawUnsafe: () => assert.fail('liveness must not query the database') };
  const { liveness } = createHealthHandlers({ database });
  const res = response();

  liveness({ requestId: 'req-live' }, res);

  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, { status: 'ok', requestId: 'req-live' });
});

test('readiness succeeds only after PostgreSQL responds', async () => {
  const queries = [];
  const database = { $queryRawUnsafe: async query => queries.push(query) };
  const { readiness } = createHealthHandlers({ database });
  const res = response();

  await readiness({ requestId: 'req-ready' }, res);

  assert.deepEqual(queries, ['SELECT 1']);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, { status: 'ready', requestId: 'req-ready' });
});

test('readiness returns a safe 503 when PostgreSQL is unavailable', async () => {
  const logged = [];
  const database = { $queryRawUnsafe: async () => { throw new Error('password=do-not-leak'); } };
  const { readiness } = createHealthHandlers({ database });
  const res = response();

  await readiness({ requestId: 'req-down', log: { error: value => logged.push(value) } }, res);

  assert.equal(logged.length, 1);
  assert.deepEqual(logged[0], { requestId: 'req-down', errorName: 'Error', errorCode: undefined });
  assert.equal(res.statusCode, 503);
  assert.deepEqual(res.body, { status: 'unavailable', requestId: 'req-down' });
  assert.equal(JSON.stringify(res.body).includes('do-not-leak'), false);
});
