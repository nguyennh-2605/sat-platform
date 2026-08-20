const test = require('node:test');
const assert = require('node:assert/strict');
const { previewText } = require('../src/services/test-import.service');

const source = `=== MODULE 1 ===

QUESTION 1
Domain: Information and Ideas
Skill: Inferences

[TEXT]
Bird populations declined after a construction project began.

Which conclusion is best supported by the text?
A. Birds increased in number.
B. Construction may be related to the decline.
C. The project was cancelled.
D. Birds moved to another planet.
Answer: B
Explanation: The text supports a cautious inference.

QUESTION 2
Domain: Craft and Structure
Skill: Words in Context

In this context, what does “declined” most nearly mean?
A. Increased
B. Fell
C. Celebrated
D. Repeated
Answer: B`;

test('deterministic import parses tagged questions without an AI service', () => {
  const preview = previewText({ text: source, subject: 'RW', moduleCount: 1 });

  assert.equal(preview.summary.questionCount, 2);
  assert.equal(preview.summary.classifiedCount, 2);
  assert.equal(preview.summary.errorCount, 0);
  assert.equal(preview.modules[0].questions[0].domainCode, 'RW_INFORMATION_AND_IDEAS');
  assert.equal(preview.modules[0].questions[0].skillCode, 'RW_INFERENCES');
  assert.equal(preview.modules[0].questions[0].correctAnswer, 'B');
  assert.equal(preview.modules[0].questions[0].choices.length, 4);
});

test('deterministic import leaves missing taxonomy for review instead of guessing', () => {
  const preview = previewText({ text: source.replace(/Domain: Craft and Structure\nSkill: Words in Context\n\n/, ''), subject: 'RW', moduleCount: 1 });
  const second = preview.modules[0].questions[1];

  assert.equal(second.domainCode, '');
  assert.equal(second.skillCode, '');
  assert.equal(second.issues.some(item => item.code === 'MISSING_DOMAIN'), true);
  assert.equal(second.issues.some(item => item.code === 'MISSING_SKILL'), true);
});
