const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeContent } = require('../src/services/question-bank.service');
const { previewText } = require('../src/services/test-import.service');

test('question bank validation normalizes reusable multiple-choice content', () => {
  const result = normalizeContent({
    subject: 'RW',
    type: 'MCQ',
    domainCode: 'RW_INFORMATION_AND_IDEAS',
    skillCode: 'RW_INFERENCES',
    questionText: '  What is best supported? ',
    choices: [
      { id: 'a', text: ' First ' },
      { id: 'b', text: ' Second ' },
      { id: 'c', text: ' Third ' },
      { id: 'd', text: ' Fourth ' },
    ],
    correctAnswer: 'b',
    explanation: ' Evidence supports the second choice. ',
  });

  assert.equal(result.questionText, 'What is best supported?');
  assert.equal(result.correctAnswer, 'B');
  assert.deepEqual(result.choices.map(choice => choice.id), ['A', 'B', 'C', 'D']);
  assert.equal(result.explanation, 'Evidence supports the second choice.');
});

test('question bank validation rejects a skill outside the selected domain', () => {
  assert.throws(() => normalizeContent({
    subject: 'RW',
    type: 'MCQ',
    domainCode: 'RW_INFORMATION_AND_IDEAS',
    skillCode: 'RW_TRANSITIONS',
    questionText: 'What is best supported?',
    choices: 'ABCD'.split('').map(id => ({ id, text: id })),
    correctAnswer: 'A',
  }), error => error.statusCode === 400 && /does not belong/.test(error.body.error));
});

test('question bank validation keeps Math and SPR authoring constraints', () => {
  assert.throws(() => normalizeContent({
    subject: 'MATH',
    type: 'SPR',
    domainCode: 'MATH_ALGEBRA',
    skillCode: 'MATH_LINEAR_EQUATIONS_ONE_VARIABLE',
    questionText: 'Solve x + 1 = 2.',
    choices: [],
    correctAnswer: 'x',
  }), error => error.statusCode === 422 && /invalid Math content|valid decimal or fraction/.test(error.body.error));
});

test('structured edit round-trips question bank snapshot source metadata', () => {
  const preview = previewText({
    subject: 'RW',
    moduleCount: 1,
    text: `QUESTION 1
Domain: Information and Ideas
Skill: Inferences
Source-Bank-Question: bank-question-1
Source-Bank-Version: bank-version-3

[QUESTION]
What is best supported?
A. First
B. Second
C. Third
D. Fourth
Answer: B`,
  });
  const question = preview.modules[0].questions[0];
  assert.equal(question.sourceBankQuestionId, 'bank-question-1');
  assert.equal(question.sourceBankVersionId, 'bank-version-3');
});
