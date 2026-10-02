const test = require('node:test');
const assert = require('node:assert/strict');
const ApiError = require('../src/utils/ApiError');
const { _testContentValidationHelpers } = require('../src/services/practice-test.service');

const { assertOfficialTestShape, validateSections } = _testContentValidationHelpers;

const rwQuestion = (overrides = {}) => ({
  questionText: 'Which inference follows?',
  type: 'MCQ',
  choices: [
    { id: 'A', text: 'One' },
    { id: 'B', text: 'Two' },
    { id: 'C', text: 'Three' },
    { id: 'D', text: 'Four' },
  ],
  correctAnswer: 'A',
  domainCode: 'RW_INFORMATION_AND_IDEAS',
  skillCode: 'RW_INFERENCES',
  blocks: [],
  ...overrides,
});

test('server content validation rejects malformed choices and module order', () => {
  assert.throws(() => validateSections({
    subject: 'RW',
    sections: [{ order: 1, questions: [rwQuestion({ choices: [{ id: 'A', text: 'One' }, { id: 'B', text: 'Two' }] })] }],
  }), error => error instanceof ApiError && /A, B, C, and D/.test(error.body.error));

  assert.throws(() => validateSections({
    subject: 'RW',
    sections: [{ order: 2, questions: [rwQuestion()] }],
  }), error => error instanceof ApiError && /invalid order/.test(error.body.error));
});

test('drafts may keep image placeholders but published tests require managed assets', () => {
  const sections = [{ order: 1, questions: [rwQuestion({ blocks: [{ type: 'image', src: '' }] })] }];
  assert.equal(validateSections({ sections, subject: 'RW', status: 'DRAFT' }).length, 1);
  assert.throws(
    () => validateSections({ sections, subject: 'RW', status: 'PUBLISHED' }),
    error => error instanceof ApiError && /platform-hosted image/.test(error.body.error),
  );
});

test('published bank snapshots may temporarily retain imported inline images', () => {
  const question = rwQuestion({
    sourceBankQuestionId: 'bank-question-1',
    blocks: [{ type: 'image', src: 'data:image/png;base64,legacy' }],
  });
  assert.doesNotThrow(() => validateSections({ sections: [{ order: 1, questions: [question] }], subject: 'RW', status: 'PUBLISHED' }));
});

test('published official tests enforce canonical module counts and duration', () => {
  const sections = [{ order: 1, questions: Array.from({ length: 27 }, () => rwQuestion()) }];
  assert.throws(
    () => assertOfficialTestShape({ sections, subject: 'RW', duration: 64, category: 'REAL', status: 'PUBLISHED' }),
    error => error instanceof ApiError && /2 modules/.test(error.body.error),
  );
  assert.doesNotThrow(() => assertOfficialTestShape({
    sections: [
      { order: 1, questions: Array.from({ length: 27 }, () => rwQuestion()) },
      { order: 2, questions: Array.from({ length: 27 }, () => rwQuestion()) },
    ],
    subject: 'RW',
    duration: 64,
    category: 'REAL',
    status: 'PUBLISHED',
  }));
});
