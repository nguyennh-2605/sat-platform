const test = require('node:test');
const assert = require('node:assert/strict');
const { parseArgs, normalizeEmail, validatePassword, resolveEnvironment } = require('../scripts/admin-cli');

test('admin CLI parses commands without accepting a password argument', () => {
  assert.deepEqual(parseArgs(['promote', '--email', 'Admin@Example.com', '--environment', 'production', '--confirm-production']), {
    command: 'promote',
    flags: { email: 'Admin@Example.com', environment: 'production', 'confirm-production': true },
  });
  assert.throws(() => parseArgs(['create', '--password', 'unsafe']), /never accepted/);
});

test('admin CLI normalizes email addresses', () => {
  assert.equal(normalizeEmail('  Admin@Example.COM '), 'admin@example.com');
});

test('admin CLI enforces bcrypt-safe strong password length', () => {
  assert.throws(() => validatePassword('short'), /at least 14/);
  assert.throws(() => validatePassword('😀'.repeat(19)), /72 UTF-8 bytes/);
  assert.doesNotThrow(() => validatePassword('a-long-local-password-2026'));
});

test('admin CLI refuses to label a remote database as local', () => {
  assert.throws(() => resolveEnvironment({ requested: 'local', databaseUrl: 'postgresql://user:pass@db.example.com:5432/app' }), /remote host/);
  assert.equal(resolveEnvironment({ requested: 'local', databaseUrl: 'postgresql://user:pass@localhost:5432/app' }), 'local');
});

test('admin CLI refuses production mode for a local database', () => {
  assert.throws(() => resolveEnvironment({ requested: 'production', databaseUrl: 'postgresql://user:pass@127.0.0.1:5432/app' }), /local database/);
  assert.equal(resolveEnvironment({ requested: 'production', databaseUrl: 'postgresql://user:pass@prod.example.com:5432/app' }), 'production');
});
