const test = require('node:test');
const assert = require('node:assert/strict');
const { allocateModuleDurations, moduleTiming } = require('../src/utils/module-timing');

test('two modules split a 70 minute Math test into 35 minutes each', () => {
  assert.deepEqual(allocateModuleDurations(70, 2), [35, 35]);
});

test('an indivisible duration preserves the exact total without losing a minute', () => {
  assert.deepEqual(allocateModuleDurations(65, 2), [32, 33]);
});

test('one module receives the complete configured duration', () => {
  assert.deepEqual(allocateModuleDurations(32, 1), [32]);
});

test('module timing reports the first question index for module two', () => {
  const result = moduleTiming({
    totalDuration: 70,
    moduleNumber: 2,
    sections: [
      { order: 1, questions: Array.from({ length: 22 }, () => ({})) },
      { order: 2, questions: Array.from({ length: 22 }, () => ({})) },
    ],
  });
  assert.deepEqual(result, { durationMinutes: 35, firstQuestionIndex: 22, moduleCount: 2 });
});

test('module allocation rejects unsupported module counts', () => {
  assert.throws(() => allocateModuleDurations(90, 3), /between 1 and 2/);
});
