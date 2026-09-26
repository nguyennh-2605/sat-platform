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
        choices: [{ id: 'A', text: '2' }, { id: 'B', text: '3' }, { id: 'C', text: '4' }, { id: 'D', text: '5' }],
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

test('reading passages with multiple paragraphs survive edit serialization', () => {
  const structuredText = serializeTest({ sections: [{ order: 1, questions: [{
    order: 1,
    type: 'MCQ',
    domainCode: 'RW_INFORMATION_AND_IDEAS',
    skillCode: 'RW_INFERENCES',
    blocks: [{ type: 'text', content: 'First paragraph.\n\nSecond paragraph.' }],
    questionText: 'Which inference follows?',
    choices: [{ id: 'A', text: 'One' }, { id: 'B', text: 'Two' }, { id: 'C', text: 'Three' }, { id: 'D', text: 'Four' }],
    correctAnswer: 'A',
  }] }] });
  assert.match(structuredText, /\[QUESTION\]/);
  const question = previewText({ text: structuredText, subject: 'RW', moduleCount: 1 }).modules[0].questions[0];
  assert.equal(question.blocks[0].content, 'First paragraph.\n\nSecond paragraph.');
  assert.equal(question.questionText, 'Which inference follows?');
  assert.equal(question.issues.length, 0);
});

test('block metadata survives edit serialization', () => {
  const structuredText = serializeTest({ sections: [{ order: 1, questions: [{
    order: 1,
    type: 'MCQ',
    domainCode: 'RW_INFORMATION_AND_IDEAS',
    skillCode: 'RW_INFERENCES',
    blocks: [
      { type: 'table', title: 'Results', headers: ['Group', 'Value'], rows: [['A', '2']], note: 'Source: study' },
      { type: 'poem', title: 'A Poem', lines: ['First line'], author: 'Author Name' },
      { type: 'image', src: 'https://example.com/chart.png', alt: 'A chart', caption: 'Figure 1' },
    ],
    questionText: 'Which inference follows?',
    choices: [{ id: 'A', text: 'One' }, { id: 'B', text: 'Two' }, { id: 'C', text: 'Three' }, { id: 'D', text: 'Four' }],
    correctAnswer: 'A',
  }] }] });
  const question = previewText({ text: structuredText, subject: 'RW', moduleCount: 1 }).modules[0].questions[0];
  assert.deepEqual(question.blocks[0], { type: 'table', title: 'Results', headers: ['Group', 'Value'], rows: [['A', '2']], note: 'Source: study' });
  assert.deepEqual(question.blocks[1], { type: 'poem', title: 'A Poem', lines: ['First line'], author: 'Author Name' });
  assert.deepEqual(question.blocks[2], { type: 'image', src: 'https://example.com/chart.png', alt: 'A chart', caption: 'Figure 1' });
});
