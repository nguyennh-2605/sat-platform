const test = require('node:test');
const assert = require('node:assert/strict');
const { gradeQuestions, isAnswerCorrect } = require('../src/utils/grading');

test('MCQ compares the displayed A-D label even when choice ids are custom', () => {
  assert.equal(isAnswerCorrect({
    type: 'MCQ',
    choices: [{ id: 'choice-1', text: 'One' }, { id: 'choice-2', text: 'Two' }],
    correctAnswer: 'choice-2',
    userAnswer: 'B'
  }), true);
});

test('MCQ comparison ignores harmless whitespace and letter case', () => {
  assert.equal(isAnswerCorrect({
    type: 'MCQ',
    choices: [{ id: 'A', text: 'One' }, { id: 'B', text: 'Two' }],
    correctAnswer: ' b ',
    userAnswer: 'B'
  }), true);
});

test('SPR accepts equivalent fractions, decimals, rounding and truncation', () => {
  for (const userAnswer of ['2/3', '0.6667', '.6667', '0.6666']) {
    assert.equal(isAnswerCorrect({
      type: 'SPR', choices: [], correctAnswer: '2/3', userAnswer
    }), true, `${userAnswer} should be accepted`);
  }
});

test('SPR rejects invalid or materially different values', () => {
  for (const userAnswer of ['', '1/0', '0.6677', 'abc']) {
    assert.equal(isAnswerCorrect({
      type: 'SPR', choices: [], correctAnswer: '2/3', userAnswer
    }), false, `${userAnswer} should be rejected`);
  }
});

test('grading creates one persisted answer row for every question', () => {
  const questions = [
    { id: 10, type: 'MCQ', correctAnswer: 'A', choices: [{ id: 'A', text: 'x' }] },
    { id: 11, type: 'SPR', correctAnswer: '1/2', choices: [] },
    { id: 12, type: 'MCQ', correctAnswer: 'B', choices: [{ id: 'A' }, { id: 'B' }] }
  ];
  const result = gradeQuestions(questions, { 10: 'A', 11: '.5' });

  assert.equal(result.correctCount, 2);
  assert.equal(result.totalQuestions, 3);
  assert.equal(result.answerRows.length, 3);
  assert.deepEqual(result.answerRows[2], {
    questionId: 12, selectedChoice: null, isCorrect: false
  });
});

test('grading safely treats a missing answers payload as unanswered', () => {
  const result = gradeQuestions([
    { id: 1, type: 'MCQ', correctAnswer: 'A', choices: [{ id: 'A' }] }
  ], null);
  assert.equal(result.correctCount, 0);
  assert.equal(result.answerRows[0].selectedChoice, null);
});
