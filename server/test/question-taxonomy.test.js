const test = require('node:test');
const assert = require('node:assert/strict');
const { getTaxonomy, validateClassification } = require('../src/utils/question-taxonomy');

test('taxonomy exposes the four official domains for each SAT subject', () => {
  assert.equal(getTaxonomy('RW').length, 4);
  assert.equal(getTaxonomy('MATH').length, 4);
  assert.equal(getTaxonomy('RW')[0].name, 'Information and Ideas');
});

test('taxonomy validation rejects a skill from another domain or subject', () => {
  assert.equal(validateClassification({ subject: 'RW', domainCode: 'RW_INFORMATION_AND_IDEAS', skillCode: 'RW_INFERENCES' }).valid, true);
  assert.equal(validateClassification({ subject: 'RW', domainCode: 'RW_INFORMATION_AND_IDEAS', skillCode: 'RW_WORDS_IN_CONTEXT' }).valid, false);
  assert.equal(validateClassification({ subject: 'RW', domainCode: 'MATH_ALGEBRA', skillCode: 'MATH_LINEAR_FUNCTIONS' }).valid, false);
});
