const test = require('node:test');
const assert = require('node:assert/strict');
const {
  PDF_BLANK_CANDIDATE,
  renderLayoutText,
  renderPdfPageWithBlankLines,
  restorePdfBlankCandidates,
} = require('../src/utils/pdf-layout-text');

const textItem = ({ str, x, y = 700, width, height = 12 }) => ({
  str,
  width,
  height,
  transform: [1, 0, 0, height, x, y],
});

const strokedLine = (x1, y1, x2, y2) => ({
  fnArray: [91, 20],
  argsArray: [
    [[13, 14], [x1, y1, x2, y2]],
    [],
  ],
});

test('PDF layout extraction restores a vector blank between text items', () => {
  const items = [
    textItem({ str: 'In the 1980s, Australian diners initially ', x: 40, width: 235 }),
    textItem({ str: ' major fast-food chains from the United States.', x: 330, width: 270 }),
  ];

  assert.equal(
    restorePdfBlankCandidates(`${renderLayoutText(items, strokedLine(282, 699, 320, 699))}\nWhich choice completes the text?`)
      .split('\n')[0],
    'In the 1980s, Australian diners initially _____ major fast-food chains from the United States.',
  );
});

test('PDF layout extraction restores a vector blank embedded inside one text item', () => {
  const items = [
    textItem({
      str: 'Australian diners initially major fast-food chains.',
      x: 40,
      width: 360,
    }),
  ];

  assert.equal(
    restorePdfBlankCandidates(`${renderLayoutText(items, strokedLine(195, 699, 245, 699))}\nWhich choice completes the text?`)
      .split('\n')[0],
    'Australian diners initially _____ major fast-food chains.',
  );
});

test('PDF layout extraction does not infer a blank from spacing alone', () => {
  const items = [
    textItem({ str: 'Text before ', x: 40, width: 65 }),
    textItem({ str: ' text after.', x: 180, width: 70 }),
  ];

  assert.equal(renderLayoutText(items), 'Text before  text after.');
});

test('PDF page renderer reads the text and vector layers together', async () => {
  const items = [
    textItem({ str: 'The answer is ', x: 40, width: 78 }),
    textItem({ str: ' correct.', x: 160, width: 45 }),
  ];
  const pageData = {
    getTextContent: async () => ({ items }),
    getOperatorList: async () => strokedLine(125, 699, 153, 699),
  };

  assert.equal(await renderPdfPageWithBlankLines(pageData), `The answer is${PDF_BLANK_CANDIDATE}correct.`);
});

test('PDF page renderer keeps text when a page vector layer is unreadable', async () => {
  const pageData = {
    getTextContent: async () => ({ items: [textItem({ str: 'Readable text', x: 40, width: 75 })] }),
    getOperatorList: async () => { throw new Error('Malformed vector stream'); },
  };

  assert.equal(await renderPdfPageWithBlankLines(pageData), 'Readable text');
});

test('PDF blank candidates are discarded outside completion questions', () => {
  assert.equal(
    restorePdfBlankCandidates(`Trace 1${PDF_BLANK_CANDIDATE}Trace 2\nFigure 6. Linked traces.`),
    'Trace 1 Trace 2\nFigure 6. Linked traces.',
  );
});

test('PDF blank candidates do not leak from a previous multiple-choice question', () => {
  const text = `Figure label${PDF_BLANK_CANDIDATE}Figure value
A. First answer
B. Second answer
Which choice completes the text?`;

  assert.equal(restorePdfBlankCandidates(text), text.replace(PDF_BLANK_CANDIDATE, ' '));
});
