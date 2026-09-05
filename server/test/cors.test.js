const test = require('node:test');
const assert = require('node:assert/strict');
const { corsOptions, parseCorsOrigins } = require('../src/config/cors');

test('CORS origins are trimmed, empty values removed, and duplicates collapsed', () => {
  assert.deepEqual(
    parseCorsOrigins(' https://app.example.com, http://localhost:5173,https://app.example.com '),
    ['https://app.example.com', 'http://localhost:5173'],
  );
});

test('development has a localhost-only fallback', () => {
  assert.deepEqual(parseCorsOrigins('', 'development'), ['http://localhost:5173', 'http://localhost:5174']);
});

test('production refuses to start without explicit CORS origins', () => {
  assert.throws(() => parseCorsOrigins('', 'production'), /CORS_ORIGINS is required/);
});

test('CORS configuration rejects paths and production loopback origins', () => {
  assert.throws(() => parseCorsOrigins('https://app.example.com/path', 'production'), /exact http\(s\) origins/);
  assert.throws(() => parseCorsOrigins('http://localhost:5173', 'production'), /loopback origin/);
});

test('CORS preflight responses can be reused for ten minutes', () => {
  assert.equal(corsOptions.maxAge, 600);
});
