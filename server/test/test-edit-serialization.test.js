const test = require('node:test');
const assert = require('node:assert/strict');
const { serializeTest } = require('../src/services/practice-test.service');
const { previewText } = require('../src/services/test-import.service');

test('an existing test can be serialized back into editable structured text', () => {
  const structuredText = serializeTest({
    sections: [{
      order: 1,
      questions: [{
        order: 1,
        type: 'MCQ',
        domainCode: 'MATH_ALGEBRA',
        skillCode: 'MATH_LINEAR_EQUATIONS_ONE_VARIABLE',
        blocks: [{ type: 'table', headers: ['x', 'y'], rows: [['2', '6']] }],
        questionText: '\\text{What is the value of } y/x?',
        choices: [{ id: 'A', text: '2' }, { id: 'B', text: '3' }],
        correctAnswer: 'B',
        explanation: '\\text{Divide }6\\text{ by }2.',
      }],
    }],
  });

  const preview = previewText({ text: structuredText, subject: 'MATH', moduleCount: 1 });
  const question = preview.modules[0].questions[0];
  assert.equal(preview.summary.errorCount, 0);
  assert.equal(question.questionText, '\\text{What is the value of } y/x?');
  assert.equal(question.choices[1].text, '3');
  assert.equal(question.correctAnswer, 'B');
  assert.deepEqual(question.blocks[0].rows, [['2', '6']]);
});
