const test = require('node:test');
const assert = require('node:assert/strict');
const {
  resolveAttemptConfiguration,
  standardModuleSeconds,
  timingSnapshotFor,
} = require('../src/utils/attempt-configuration');

const testRecord = {
  mode: 'PRACTICE',
  duration: 70,
  sections: [
    { order: 1, duration: 35 },
    { order: 2, duration: 35 },
  ],
};

test('standard timing uses the authored module durations', () => {
  assert.deepEqual(standardModuleSeconds(testRecord), [2100, 2100]);
});

test('a self-study practice attempt can use half time', () => {
  const config = resolveAttemptConfiguration({
    test: testRecord,
    requestedMode: 'PRACTICE',
    requestedTimingPreset: 'HALF_TIME',
    canCustomize: true,
  });
  assert.equal(config.attemptMode, 'PRACTICE');
  assert.equal(config.allowedDurationSeconds, 2100);
  assert.deepEqual(config.moduleTimingSnapshot.map(item => item.allowedSeconds), [1050, 1050]);
});

test('custom duration is distributed across modules without losing seconds', () => {
  const config = resolveAttemptConfiguration({
    test: testRecord,
    requestedMode: 'PRACTICE',
    requestedTimingPreset: 'CUSTOM',
    customDurationMinutes: 73,
    canCustomize: true,
  });
  assert.equal(config.allowedDurationSeconds, 4380);
  assert.equal(config.moduleTimingSnapshot.reduce((total, item) => total + item.allowedSeconds, 0), 4380);
});

test('exam simulation rejects nonstandard custom timing', () => {
  assert.throws(() => resolveAttemptConfiguration({
    test: testRecord,
    requestedMode: 'EXAM',
    requestedTimingPreset: 'CUSTOM',
    customDurationMinutes: 45,
    canCustomize: true,
  }), /Exam simulation supports/);
});

test('assigned attempts ignore student timing overrides', () => {
  const config = resolveAttemptConfiguration({
    test: { ...testRecord, mode: 'EXAM' },
    requestedMode: 'PRACTICE',
    requestedTimingPreset: 'UNTIMED',
    canCustomize: false,
  });
  assert.equal(config.attemptMode, 'EXAM');
  assert.equal(config.timingPreset, 'STANDARD');
});

test('legacy submissions fall back to standard timing', () => {
  assert.deepEqual(timingSnapshotFor({}, testRecord), [
    { standardSeconds: 2100, allowedSeconds: 2100 },
    { standardSeconds: 2100, allowedSeconds: 2100 },
  ]);
});
