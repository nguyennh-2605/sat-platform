const test = require('node:test');
const assert = require('node:assert/strict');
const service = require('../src/services/teacher-access.service');
const controller = require('../src/controllers/teacher-access.controller');

test('teacher access ignores user IDs and database values supplied by the caller', async t => {
  let input;
  t.mock.method(service, 'review', async value => { input = value; return { status: 'APPROVED' }; });
  const req = { user: { userId: 7 }, query: { userId: '99', db: 'injected' }, body: { userId: 99, db: 'injected', decision: 'APPROVED', reviewNote: 'Verified' }, params: { requestId: 'request-1' } };
  const res = { json: value => value };
  await controller.review(req, res);
  assert.equal(input.userId, 7);
  assert.equal(input.requestId, 'request-1');
  assert.equal(input.db, undefined);
});
