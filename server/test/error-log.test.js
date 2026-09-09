const test = require('node:test');
const assert = require('node:assert/strict');
const { _errorLogHelpers } = require('../src/services/error-log.service');

const { buildAutomaticErrorLogRows, isReviewComplete, normalizeAnalysis, normalizeManualEntry, normalizeMarkReviewed, normalizeRequestData } = _errorLogHelpers;

test('automatic error logs include only wrong answers with objective question context', () => {
  const rows = buildAutomaticErrorLogRows({
    userId: 7,
    submissionId: 42,
    test: {
      title: 'Practice Test 4',
      subject: 'RW',
      sections: [{
        order: 2,
        questions: [
          { id: 10, order: 4, correctAnswer: 'B', domainCode: 'RW_CRAFT_AND_STRUCTURE', skillCode: 'RW_WORDS_IN_CONTEXT' },
          { id: 11, order: 5, correctAnswer: 'D', domainCode: 'RW_CRAFT_AND_STRUCTURE', skillCode: 'RW_TEXT_STRUCTURE_AND_PURPOSE' },
        ],
      }],
    },
    answerRows: [
      { questionId: 10, selectedChoice: 'D', isCorrect: false },
      { questionId: 11, selectedChoice: 'D', isCorrect: true },
    ],
  });

  assert.deepEqual(rows, [{
    userId: 7,
    submissionId: 42,
    questionId: 10,
    source: 'Practice Test 4 · Module 2 · Question 4',
    category: 'Words in Context',
    userAnswer: 'D',
    correctAnswer: 'B',
  }]);
});

test('an omitted wrong answer is preserved as an explicit answer label', () => {
  const [row] = buildAutomaticErrorLogRows({
    userId: 7,
    submissionId: 42,
    test: {
      title: 'Math Practice',
      subject: 'MATH',
      sections: [{ order: 1, questions: [{ id: 20, order: 1, correctAnswer: '12', domainCode: null, skillCode: null }] }],
    },
    answerRows: [{ questionId: 20, selectedChoice: null, isCorrect: false }],
  });

  assert.equal(row.userAnswer, 'Omitted');
  assert.equal(row.category, 'General');
});

test('a review requires the decision process, diagnosis, correct reasoning, takeaway, and root cause', () => {
  const complete = {
    whyChosen: 'I matched two words that looked similar.',
    whyWrong: 'The words have different meanings in context.',
    whyRight: 'The correct word means to cause the event.',
    takeaway: 'Predict the logical role before checking choices.',
    rootCause: 'KNOWLEDGE_GAP',
  };
  assert.equal(isReviewComplete(complete), true);
  assert.equal(isReviewComplete({ ...complete, takeaway: '' }), false);
  assert.equal(isReviewComplete({ ...complete, rootCause: null }), false);
});

test('manual entries trim input and reject invalid root causes', () => {
  const entry = normalizeManualEntry({
    source: '  Outside worksheet  ',
    category: ' Algebra ',
    userAnswer: ' 3 ',
    correctAnswer: ' 4 ',
    whyChosen: '  I copied the coefficient. ',
  });
  assert.equal(entry.source, 'Outside worksheet');
  assert.equal(entry.whyChosen, 'I copied the coefficient.');
  assert.throws(
    () => normalizeAnalysis({ rootCause: 'OTHER' }),
    error => error.statusCode === 400 && /valid root cause/.test(error.body.message),
  );
});

test('error log commands reject malformed bodies and ambiguous review state values', () => {
  assert.throws(() => normalizeRequestData(null), error => error.statusCode === 400);
  assert.throws(() => normalizeRequestData([]), error => error.statusCode === 400);
  assert.throws(() => normalizeMarkReviewed('true'), error => error.statusCode === 400);
  assert.equal(normalizeMarkReviewed(true), true);
});
