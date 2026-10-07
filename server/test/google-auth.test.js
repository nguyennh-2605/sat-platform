const test = require('node:test');
const assert = require('node:assert/strict');

process.env.JWT_SECRET ||= 'test-only-secret-with-sufficient-entropy';
const ApiError = require('../src/utils/ApiError');
const { _private, login, register } = require('../src/services/auth.service');
const { createRateLimiter } = require('../src/middleware/rate-limit.middleware');

const googlePayload = {
  sub: 'google-user-123',
  email: 'Student@Gmail.com ',
  name: 'Student',
  picture: 'https://example.com/avatar.png',
};

const fakeDatabase = ({ subjectUser = null, emailUser = null } = {}) => {
  const calls = { create: [], update: [], revoke: [] };
  return {
    calls,
    refreshSession: { updateMany: async input => { calls.revoke.push(input); return { count: 1 }; } },
    user: {
      findUnique: async () => subjectUser,
      findFirst: async () => emailUser,
      create: async input => {
        calls.create.push(input);
        return { id: 3, role: 'STUDENT', ...input.data };
      },
      update: async input => {
        calls.update.push(input);
        return { ...(emailUser || subjectUser), ...input.data };
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
    data: { googleSubject: googlePayload.sub, password: null },
  });
});

test('Google-only migration links authoritative email, preserves teacher role and revokes old sessions', async () => {
  const database = fakeDatabase({
    emailUser: { id: 2, email: 'student@gmail.com', password: 'password-hash', googleSubject: null, role: 'TEACHER' },
  });
  const user = await _private.resolveGoogleUser(googlePayload, database);
  assert.equal(user.role, 'TEACHER');
  assert.equal(user.password, null);
  assert.equal(database.calls.revoke[0].where.userId, 2);
});

test('a new Google account stores normalized email and stable subject', async () => {
  const database = fakeDatabase();
  const user = await _private.resolveGoogleUser(googlePayload, database);
  assert.equal(user.email, 'student@gmail.com');
  assert.equal(user.googleSubject, googlePayload.sub);
  assert.equal(user.password, null);
  assert.equal(database.calls.create[0].data.role, 'STUDENT');
});

test('a returning Google identity clears a legacy application password without changing its role', async () => {
  const database = fakeDatabase({ subjectUser: { id: 8, role: 'ADMIN', email: 'admin@gmail.com', googleSubject: googlePayload.sub, password: 'old-hash' } });
  const user = await _private.resolveGoogleUser(googlePayload, database);
  assert.equal(user.id, 8);
  assert.equal(user.role, 'ADMIN');
  assert.equal(user.password, null);
  assert.equal(database.calls.revoke[0].where.userId, 8);
});

test('password login and self-registration are disabled including teacher/admin role injection', async () => {
  for (const method of [login, register]) for (const role of ['STUDENT', 'TEACHER', 'ADMIN']) {
    await assert.rejects(method({ email: 'student@gmail.com', password: 'old-password', role }), error => error.statusCode === 410 && error.body.code === 'GOOGLE_SIGN_IN_REQUIRED');
  }
});

test('an existing Google subject cannot be replaced by a different subject using the same email', async () => {
  const database = fakeDatabase({ emailUser: { id: 2, email: 'student@gmail.com', googleSubject: 'different-subject' } });
  await assert.rejects(_private.resolveGoogleUser(googlePayload, database), error => error.body.code === 'GOOGLE_ACCOUNT_CONFLICT');
  assert.equal(database.calls.update.length, 0);
});

test('Google sign-in verifies audience and email before creating a student, ignoring claimed roles', async t => {
  const { OAuth2Client } = require('google-auth-library');
  const { googleLogin } = require('../src/services/auth.service');
  const previousClientId = process.env.GOOGLE_CLIENT_ID;
  process.env.GOOGLE_CLIENT_ID = 'test-audience.apps.googleusercontent.com';
  t.after(() => { if (previousClientId === undefined) delete process.env.GOOGLE_CLIENT_ID; else process.env.GOOGLE_CLIENT_ID = previousClientId; });
  const db = fakeDatabase();
  db.auditEvent = { create: async () => ({}) };
  const verify = t.mock.method(OAuth2Client.prototype, 'verifyIdToken', async () => ({ getPayload: () => ({ ...googlePayload, email_verified: true, role: 'ADMIN' }) }));
  db.$transaction = async callback => callback(db);
  db.refreshSession.deleteMany = async () => ({ count: 0 });
  db.refreshSession.create = async () => ({});
  const result = await googleLogin({ token: 'verified-google-token', role: 'TEACHER' }, { db });
  assert.deepEqual(verify.mock.calls[0].arguments[0], { idToken: 'verified-google-token', audience: process.env.GOOGLE_CLIENT_ID });
  assert.equal(result.user.role, 'STUDENT');
  assert.ok(result.accessToken);
  verify.mock.mockImplementation(async () => ({ getPayload: () => ({ ...googlePayload, email_verified: false }) }));
  await assert.rejects(googleLogin({ token: 'unverified-token' }, { db }), error => error.statusCode === 403);
  assert.equal(db.calls.create.length, 1);
  verify.mock.mockImplementation(async () => { throw new Error('Invalid raw-token detail'); });
  await assert.rejects(googleLogin({ token: 'invalid-token' }, { db }), error => error.statusCode === 401 && error.body.code === 'GOOGLE_TOKEN_INVALID' && !error.message.includes('raw-token'));
});

test('email normalization is stable across registration and login casing', () => {
  assert.equal(_private.normalizeEmail('  Student@Example.COM '), 'student@example.com');
});

test('Google certificate network failures are retryable and never create a session or leak the credential', async t => {
  const { googleLogin } = require('../src/services/auth.service');
  const previousClientId = process.env.GOOGLE_CLIENT_ID;
  process.env.GOOGLE_CLIENT_ID = 'test-audience.apps.googleusercontent.com';
  t.after(() => { if (previousClientId === undefined) delete process.env.GOOGLE_CLIENT_ID; else process.env.GOOGLE_CLIENT_ID = previousClientId; });
  let databaseTouched = false;
  const db = { $transaction: async () => { databaseTouched = true; } };
  const googleClient = { verifyIdToken: async () => { throw new Error('Failed to retrieve verification certificates: network blocked raw-token-detail'); } };
  await assert.rejects(googleLogin({ token: 'google-token' }, { db, googleClient }), error => {
    assert.equal(error.statusCode, 503);
    assert.equal(error.body.code, 'GOOGLE_VERIFICATION_UNAVAILABLE');
    assert.ok(!JSON.stringify(error.body).includes('raw-token-detail'));
    return true;
  });
  assert.equal(databaseTouched, false);
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

test('rate limiter emits client hints and resets the budget after its window', () => {
  let now = 1_000;
  const limiter = createRateLimiter({ windowMs: 10_000, max: 2, message: 'Slow down.', clock: () => now });
  const request = { ip: '127.0.0.1' };
  const response = {
    headers: {},
    set(name, value) { this.headers[name] = value; },
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
  let nextCalls = 0;

  limiter(request, response, () => { nextCalls += 1; });
  assert.equal(response.headers['RateLimit-Limit'], '2');
  assert.equal(response.headers['RateLimit-Remaining'], '1');
  limiter(request, response, () => { nextCalls += 1; });
  limiter(request, response, () => { nextCalls += 1; });
  assert.equal(response.statusCode, 429);
  assert.equal(response.headers['RateLimit-Remaining'], '0');

  now += 10_001;
  limiter(request, response, () => { nextCalls += 1; });
  assert.equal(nextCalls, 3);
  assert.equal(response.headers['RateLimit-Remaining'], '1');
});

test('rate limiter bounds stored client keys', () => {
  const limiter = createRateLimiter({ windowMs: 60_000, max: 1, maxKeys: 2, message: 'Slow down.' });
  const response = {
    set() {},
    status() { return this; },
    json() { return this; },
  };
  let nextCalls = 0;
  for (const ip of ['client-a', 'client-b', 'client-c', 'client-a']) {
    limiter({ ip }, response, () => { nextCalls += 1; });
  }
  assert.equal(nextCalls, 4);
});
