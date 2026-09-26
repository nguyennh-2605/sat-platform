const test = require('node:test');
const assert = require('node:assert/strict');
const { extractImportFile, previewText } = require('../src/services/test-import.service');

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

test('document extraction returns editable text for TXT uploads', async () => {
  const result = await extractImportFile({
    file: {
      originalname: 'practice-test.txt',
      mimetype: 'text/plain',
      size: Buffer.byteLength(source),
      buffer: Buffer.from(source),
    },
  });

  assert.equal(result.fileName, 'practice-test.txt');
  assert.equal(result.text, source);
});

test('explicit question marker preserves two passage paragraphs and ignores choice-like passage lines', () => {
  const text = `QUESTION 1
Domain: Information and Ideas
Skill: Inferences

[TEXT]
The author wrote an answer: perhaps — but not certainly.

A. historical note appears in the passage.

[QUESTION]
What does the passage suggest?
A. Certainty
B. Caution
Answer: B`;
  const question = previewText({ text, subject: 'RW', moduleCount: 1 }).modules[0].questions[0];
  assert.equal(question.blocks.length, 1);
  assert.equal(question.blocks[0].content, 'The author wrote an answer: perhaps — but not certainly.\n\nA. historical note appears in the passage.');
  assert.equal(question.questionText, 'What does the passage suggest?');
  assert.deepEqual(question.choices.map(choice => choice.id), ['A', 'B']);
  assert.equal(question.correctAnswer, 'B');
});

test('import unwraps source line wrapping in prose while preserving paragraph breaks', () => {
  const text = `QUESTION 1
Domain: Information and Ideas
Skill: Inferences

[TEXT]
The first paragraph was wrapped by the source
document and includes a pressure-
treated material.

The second paragraph describes research that either confirms or

contradicts prior findings while remaining one paragraph.

[QUESTION]
Which conclusion is best
supported by the text?

A. The first answer was wrapped
across source lines.
B. The second answer stays on one
display line when space allows.
Answer: B
Explanation: The source line break is a soft
wrap, not a paragraph boundary.`;
  const question = previewText({ text, subject: 'RW', moduleCount: 1 }).modules[0].questions[0];

  assert.equal(
    question.blocks[0].content,
    'The first paragraph was wrapped by the source document and includes a pressure-treated material.\n\nThe second paragraph describes research that either confirms or contradicts prior findings while remaining one paragraph.',
  );
  assert.equal(question.questionText, 'Which conclusion is best supported by the text?');
  assert.equal(question.choices[0].text, 'The first answer was wrapped across source lines.');
  assert.equal(question.choices[1].text, 'The second answer stays on one display line when space allows.');
  assert.equal(question.explanation, 'The source line break is a soft wrap, not a paragraph boundary.');
});

test('import preserves line-based content in poem, note, and table blocks', () => {
  const text = `QUESTION 1
Domain: Information and Ideas
Skill: Inferences

[POEM]
First line
Second line

[NOTE]
- First note
- Second note

[TABLE]
Label\tValue
Alpha\t1
Beta\t2

[QUESTION]
What is implied?
A. One
B. Two
Answer: A`;
  const question = previewText({ text, subject: 'RW', moduleCount: 1 }).modules[0].questions[0];

  assert.deepEqual(question.blocks[0], { type: 'poem', lines: ['First line', 'Second line'] });
  assert.deepEqual(question.blocks[1], { type: 'note', lines: ['First note', 'Second note'] });
  assert.deepEqual(question.blocks[2], {
    type: 'table',
    headers: ['Label', 'Value'],
    rows: [['Alpha', '1'], ['Beta', '2']],
  });
});

test('import keeps cross-text passages separate and normalizes source wrapping', () => {
  const text = `QUESTION 1
Domain: Craft and Structure
Skill: Cross-Text Connections

[TEXT]
Text 1
The first passage was wrapped by the
source document.
Text 2:
The second passage remains visually
separate from the first.

[QUESTION]
How do the texts differ?
A. One
B. Two
C. Three
D. Four
Answer: A`;
  const question = previewText({ text, subject: 'RW', moduleCount: 1 }).modules[0].questions[0];

  assert.equal(question.blocks[0].content,
    'Text 1\n\nThe first passage was wrapped by the source document.\n\nText 2\n\nThe second passage remains visually separate from the first.',
  );
});

test('import joins wrapped note lines without merging separate notes', () => {
  const text = `QUESTION 1
Domain: Expression of Ideas
Skill: Rhetorical Synthesis

[NOTE]
While researching a topic, a student took the following notes:
The first note wraps onto the
next source line.
The second note lost its bullet during extraction.
— The third note keeps an alternate bullet marker.

[QUESTION]
Which choice best uses the notes?
A. One
B. Two
C. Three
D. Four
Answer: A`;
  const question = previewText({ text, subject: 'RW', moduleCount: 1 }).modules[0].questions[0];

  assert.deepEqual(question.blocks[0].lines, [
    'While researching a topic, a student took the following notes:',
    'The first note wraps onto the next source line.',
    'The second note lost its bullet during extraction.',
    'The third note keeps an alternate bullet marker.',
  ]);
});

test('import discards empty and duplicated note bullet markers', () => {
  const text = `QUESTION 1
Domain: Expression of Ideas
Skill: Rhetorical Synthesis

[NOTE]
While researching a topic, a student has taken the following notes:
•
•
• • A fact that follows duplicated extraction markers.
• A second fact.

[QUESTION]
Which choice best uses the notes?
A. One
B. Two
C. Three
D. Four
Answer: A`;
  const question = previewText({ text, subject: 'RW', moduleCount: 1 }).modules[0].questions[0];

  assert.deepEqual(question.blocks[0].lines, [
    'While researching a topic, a student has taken the following notes:',
    'A fact that follows duplicated extraction markers.',
    'A second fact.',
  ]);
});

test('import recognizes note content extracted under a text tag', () => {
  const text = `QUESTION 1
Domain: Expression of Ideas
Skill: Rhetorical Synthesis

[TEXT]
While researching a topic, a student took the following notes: • First fact. • Second fact wraps
onto another source line. • Third fact.

[QUESTION]
Which choice best uses the notes?
A. One
B. Two
C. Three
D. Four
Answer: A`;
  const question = previewText({ text, subject: 'RW', moduleCount: 1 }).modules[0].questions[0];

  assert.deepEqual(question.blocks[0], {
    type: 'note',
    lines: [
      'While researching a topic, a student took the following notes:',
      'First fact.',
      'Second fact wraps onto another source line.',
      'Third fact.',
    ],
  });
});

test('import rejects a completion question when OCR dropped the passage blank', () => {
  const text = `QUESTION 1
Domain: Craft and Structure
Skill: Words in Context

[TEXT]
The source text lost the intended position for the answer.

[QUESTION]
Which choice completes the text with the most logical and precise word or phrase?
A. One
B. Two
C. Three
D. Four
Answer: A`;
  const question = previewText({ text, subject: 'RW', moduleCount: 1 }).modules[0].questions[0];

  assert.ok(question.issues.some(item => item.code === 'MISSING_COMPLETION_BLANK'));
});

test('import reports malformed reading markers without discarding the question', () => {
  const text = `QUESTION 1
Domain: Information and Ideas
Skill: Inferences

[TEYT]
One ==unfinished underline.

[QUESTION]
What is implied?
A. One
B. Two
Answer: A`;
  const question = previewText({ text, subject: 'RW', moduleCount: 1 }).modules[0].questions[0];
  assert.ok(question.issues.some(item => item.code === 'UNMATCHED_UNDERLINE'));
  assert.ok(question.issues.some(item => item.code === 'UNKNOWN_CONTENT_TAG'));
  assert.equal(question.questionText, 'What is implied?');
});

test('import rejects duplicate or incomplete A-D choice labels', () => {
  const text = `QUESTION 1
Domain: Information and Ideas
Skill: Inferences

[QUESTION]
What is implied?
A. One
A. Duplicate
B. Two
Answer: A`;
  const question = previewText({ text, subject: 'RW', moduleCount: 1 }).modules[0].questions[0];
  assert.ok(question.issues.some(item => item.code === 'INVALID_CHOICES' && item.severity === 'error'));
});

test('import rejects Reading and Writing questions without A-D choices', () => {
  const text = `QUESTION 1
Domain: Information and Ideas
Skill: Inferences

[QUESTION]
What is implied?
Answer: 12`;
  const question = previewText({ text, subject: 'RW', moduleCount: 1 }).modules[0].questions[0];
  assert.equal(question.type, 'SPR');
  assert.ok(question.issues.some(item => item.code === 'RW_REQUIRES_CHOICES' && item.severity === 'error'));
});

test('import rejects duplicate question numbers while keeping editor ids unique', () => {
  const question = number => `QUESTION ${number}
Domain: Information and Ideas
Skill: Inferences

[QUESTION]
What is implied?
A. One
B. Two
C. Three
D. Four
Answer: A`;
  const preview = previewText({ text: `${question(1)}\n\n${question(1)}`, subject: 'RW', moduleCount: 1 });
  assert.ok(preview.issues.some(item => item.code === 'INVALID_QUESTION_ORDER' && item.severity === 'error'));
  assert.notEqual(preview.modules[0].questions[0].clientId, preview.modules[0].questions[1].clientId);
});

test('import rejects ragged tab-separated tables', () => {
  const text = `QUESTION 1
Domain: Information and Ideas
Skill: Inferences

[TABLE]
Group\tValue
A

[QUESTION]
What is implied?
A. One
B. Two
C. Three
D. Four
Answer: A`;
  const question = previewText({ text, subject: 'RW', moduleCount: 1 }).modules[0].questions[0];
  assert.ok(question.issues.some(item => item.code === 'INVALID_TABLE_SHAPE' && item.severity === 'error'));
});

test('Math import rejects raw prose outside text commands and invalid SPR answers', () => {
  const text = `QUESTION 1
Domain: Algebra
Skill: Linear Equations in One Variable

If x is 2, what is x?
Answer: x`;
  const question = previewText({ text, subject: 'MATH', moduleCount: 1 }).modules[0].questions[0];
  assert.ok(question.issues.some(item => item.code === 'INVALID_LATEX' && item.severity === 'error'));
  assert.ok(question.issues.some(item => item.code === 'INVALID_SPR_ANSWER' && item.severity === 'error'));
});

test('missing and external images block publishing validation', () => {
  const base = source => `QUESTION 1
Domain: Information and Ideas
Skill: Inferences

[IMG]
${source}

[QUESTION]
What is implied?
A. One
B. Two
C. Three
D. Four
Answer: A`;
  const missing = previewText({ text: base(''), subject: 'RW', moduleCount: 1 }).modules[0].questions[0];
  const external = previewText({ text: base('https://example.com/image.png'), subject: 'RW', moduleCount: 1 }).modules[0].questions[0];
  assert.ok(missing.issues.some(item => item.code === 'IMAGE_REQUIRED' && item.severity === 'error'));
  assert.ok(external.issues.some(item => item.code === 'MANAGED_IMAGE_REQUIRED' && item.severity === 'error'));
});

test('import reports content that would otherwise be discarded before markers', () => {
  const text = `Document heading
=== MODULE 1 ===
Module directions
QUESTION 1
Domain: Information and Ideas
Skill: Inferences

[QUESTION]
What is implied?
A. One
B. Two
C. Three
D. Four
Answer: A`;
  const preview = previewText({ text, subject: 'RW', moduleCount: 1 });
  assert.ok(preview.issues.some(item => item.code === 'IGNORED_DOCUMENT_PREAMBLE'));
  assert.ok(preview.issues.some(item => item.code === 'IGNORED_MODULE_PREAMBLE'));
});
