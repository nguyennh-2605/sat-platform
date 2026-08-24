const test = require('node:test');
const assert = require('node:assert/strict');

process.env.JWT_SECRET ||= 'test-only-secret-with-sufficient-entropy';
const jwt = require('jsonwebtoken');
const { _private } = require('../src/services/auth.service');

test('refresh tokens are stored as deterministic hashes rather than plaintext', () => {
  const token = 'opaque-refresh-token';
  const hash = _private.hashRefreshToken(token);
  assert.equal(hash, _private.hashRefreshToken(token));
  assert.notEqual(hash, token);
  assert.equal(hash.length, 64);
});

test('access tokens are short lived and contain the authenticated identity', () => {
  const token = _private.signAccessToken({ id: 7, email: 'student@example.com', role: 'STUDENT' });
  const payload = jwt.verify(token, process.env.JWT_SECRET);
  assert.equal(payload.userId, 7);
  assert.equal(payload.role, 'STUDENT');
  assert.ok(payload.exp - payload.iat <= 15 * 60);
});
