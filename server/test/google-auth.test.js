const test = require('node:test');
const assert = require('node:assert/strict');

process.env.JWT_SECRET ||= 'test-only-secret-with-sufficient-entropy';
const ApiError = require('../src/utils/ApiError');
const { _private } = require('../src/services/auth.service');
const { createRateLimiter } = require('../src/middleware/rate-limit.middleware');

const googlePayload = {
  sub: 'google-user-123',
  email: 'Student@Gmail.com ',
  name: 'Student',
  picture: 'https://example.com/avatar.png',
};

const fakeDatabase = ({ subjectUser = null, emailUser = null } = {}) => {
  const calls = { create: [], update: [] };
  return {
    calls,
    user: {
      findUnique: async () => subjectUser,
      findFirst: async () => emailUser,
      create: async input => {
        calls.create.push(input);
        return { id: 3, role: 'STUDENT', ...input.data };
      },
      update: async input => {
        calls.update.push(input);
        return { ...emailUser, ...input.data };
      },
    },
  };
};

test('Google identity uses sub before email and does not create a duplicate user', async () => {
  const existing = { id: 1, email: 'old-address@gmail.com', googleSubject: googlePayload.sub, role: 'STUDENT' };
  const database = fakeDatabase({ subjectUser: existing });
  const user = await _private.resolveGoogleUser(googlePayload, database);
  assert.equal(user, existing);
  assert.equal(database.calls.create.length, 0);
  assert.equal(database.calls.update.length, 0);
});

test('a legacy passwordless Google account is upgraded with its stable subject', async () => {
  const legacy = { id: 2, email: 'student@gmail.com', password: null, googleSubject: null, role: 'STUDENT' };
  const database = fakeDatabase({ emailUser: legacy });
  const user = await _private.resolveGoogleUser(googlePayload, database);
  assert.equal(user.googleSubject, googlePayload.sub);
  assert.deepEqual(database.calls.update[0], {
    where: { id: legacy.id },
    data: { googleSubject: googlePayload.sub },
  });
});

test('Google sign-in cannot silently take over an account that has a password', async () => {
  const database = fakeDatabase({
    emailUser: { id: 2, email: 'student@gmail.com', password: 'password-hash', googleSubject: null },
  });
  await assert.rejects(
    _private.resolveGoogleUser(googlePayload, database),
    error => error instanceof ApiError && error.statusCode === 409 && error.body.code === 'GOOGLE_ACCOUNT_LINK_REQUIRED',
  );
  assert.equal(database.calls.update.length, 0);
});

test('a new Google account stores normalized email and stable subject', async () => {
  const database = fakeDatabase();
  const user = await _private.resolveGoogleUser(googlePayload, database);
  assert.equal(user.email, 'student@gmail.com');
  assert.equal(user.googleSubject, googlePayload.sub);
  assert.equal(user.password, null);
});

test('email normalization is stable across registration and login casing', () => {
  assert.equal(_private.normalizeEmail('  Student@Example.COM '), 'student@example.com');
});

test('legacy auto-linking trusts Gmail and Google Workspace but not an external email provider', async () => {
  assert.equal(_private.isGoogleAuthoritativeForEmail({ email: 'student@gmail.com' }), true);
  assert.equal(_private.isGoogleAuthoritativeForEmail({ email: 'student@school.edu', hd: 'school.edu' }), true);
  assert.equal(_private.isGoogleAuthoritativeForEmail({ email: 'student@example.com' }), false);

  const database = fakeDatabase({
    emailUser: { id: 2, email: 'student@example.com', password: null, googleSubject: null },
  });
  await assert.rejects(
    _private.resolveGoogleUser({ ...googlePayload, email: 'student@example.com' }, database),
    error => error instanceof ApiError && error.body.code === 'GOOGLE_LEGACY_REAUTH_REQUIRED',
  );
});

test('Google login limiter returns 429 after the configured request budget', () => {
  const limiter = createRateLimiter({ windowMs: 60_000, max: 1, message: 'Slow down.' });
  const request = { ip: '127.0.0.1' };
  let nextCalls = 0;
  const response = {
    statusCode: 200,
    headers: {},
    set(name, value) { this.headers[name] = value; },
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
  limiter(request, response, () => { nextCalls += 1; });
  limiter(request, response, () => { nextCalls += 1; });
  assert.equal(nextCalls, 1);
  assert.equal(response.statusCode, 429);
  assert.equal(response.body.code, 'RATE_LIMITED');
});
