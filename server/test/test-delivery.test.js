const test = require('node:test');
const assert = require('node:assert/strict');
const { chooseAttempt, percentageScore } = require('../src/services/test-delivery.service');

const attempts = [
  { id: 1, status: 'COMPLETED', score: 7, attemptNo: 1 },
  { id: 2, status: 'COMPLETED', score: 9, attemptNo: 2 },
  { id: 3, status: 'DOING', score: 10, attemptNo: 3 },
];

test('delivery score policy selects first, best, or latest completed attempt', () => {
  assert.equal(chooseAttempt(attempts, 'FIRST').id, 1);
  assert.equal(chooseAttempt(attempts, 'BEST').id, 2);
  assert.equal(chooseAttempt(attempts, 'LATEST').id, 2);
});

test('delivery percentage score uses the test question count', () => {
  assert.equal(percentageScore(9, 10), 90);
  assert.equal(percentageScore(null, 10), 0);
  assert.equal(percentageScore(9, 0), null);
});
