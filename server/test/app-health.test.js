const test = require('node:test');
const assert = require('node:assert/strict');

process.env.JWT_SECRET ||= 'test-only-secret-with-sufficient-entropy';
const app = require('../src/app');

let server;
let baseUrl;

test.before(async () => {
  await new Promise(resolve => {
    server = app.listen(0, '127.0.0.1', () => {
      baseUrl = `http://127.0.0.1:${server.address().port}`;
      resolve();
    });
  });
});

test.after(async () => {
  await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
});

test('health endpoint preserves request correlation and security headers', async () => {
  const response = await fetch(`${baseUrl}/health`, {
    headers: { 'x-request-id': 'health-test-request' },
  });

  assert.equal(response.status, 200);
  assert.equal(response.headers.get('x-request-id'), 'health-test-request');
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
  assert.deepEqual(await response.json(), { status: 'ok', requestId: 'health-test-request' });
});

test('unknown routes return a safe correlated 404 response', async () => {
  const response = await fetch(`${baseUrl}/not-a-route`);
  const body = await response.json();

  assert.equal(response.status, 404);
  assert.equal(body.error, 'Route not found.');
  assert.equal(body.requestId, response.headers.get('x-request-id'));
  assert.match(body.requestId, /^[0-9a-f-]{36}$/);
});
