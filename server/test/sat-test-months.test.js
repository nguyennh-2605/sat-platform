const test = require('node:test');
const assert = require('node:assert/strict');
const { SAT_TEST_MONTHS, normalizeSatTestMonth, testMonthWhere } = require('../src/utils/sat-test-months');

test('SAT test months are the fixed College Board testing months', () => {
  assert.deepEqual(SAT_TEST_MONTHS, ['03', '05', '06', '08', '10', '11', '12']);
});

test('official test months normalize legacy ISO dates without keeping the day', () => {
  assert.equal(normalizeSatTestMonth('10'), '10');
  assert.equal(normalizeSatTestMonth('2026-10-03'), '10');
  assert.equal(normalizeSatTestMonth('2026-04-12'), '');
});

test('month filters target official tests and support new and legacy values', () => {
  assert.deepEqual(testMonthWhere('08'), {
    category: 'REAL',
    OR: [
      { testDate: '08' },
      { testDate: { startsWith: '08-' } },
      { testDate: { contains: '-08-' } },
      { testDate: { endsWith: '-08' } },
    ],
  });
  assert.equal(testMonthWhere('04'), null);
});
