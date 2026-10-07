const test = require('node:test');
const assert = require('node:assert/strict');
process.env.JWT_SECRET ||= 'test-only-secret-with-sufficient-entropy';
const jwt = require('jsonwebtoken');
const { authenticateToken } = require('../src/middleware/auth.middleware');
const auth = require('../src/services/auth.service');

test('legacy password access tokens must reauthenticate with Google', async () => {
  const token = jwt.sign({ userId: 1, role: 'ADMIN' }, process.env.JWT_SECRET, { expiresIn: '15m' });
  let status;
  let body;
  const res = { status: code => { status = code; return res; }, json: value => { body = value; } };
  authenticateToken({ headers: { authorization: `Bearer ${token}` } }, res, () => assert.fail('legacy access granted'));
  assert.equal(status, 401);
  assert.equal(body.code, 'GOOGLE_SIGN_IN_REQUIRED');
});

test('unlinked legacy accounts cannot refresh or upgrade password sessions', async () => {
  const db = { user: { findUnique: async () => ({ id: 1, googleSubject: null }) }, refreshSession: { findUnique: async () => ({ id: 'session', user: { googleSubject: null } }) } };
  for (const operation of [() => auth.upgrade({ userId: 1 }, { db }), () => auth.refresh({ refreshToken: 'legacy-token' }, { db })]) {
    await assert.rejects(operation(), error => error.statusCode === 401 && error.body.code === 'GOOGLE_SIGN_IN_REQUIRED');
  }
});
