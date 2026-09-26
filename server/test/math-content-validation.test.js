const test = require('node:test');
const assert = require('node:assert/strict');
const {
  firstMathContentError,
  isValidSprAnswer,
  validateStrictLatexValue,
} = require('../src/utils/math-content-validation');

test('strict Math validation accepts formulas and prose inside text commands', () => {
  assert.equal(validateStrictLatexValue('\\text{If } 3x+5=20, \\text{ what is }x?'), null);
  assert.equal(validateStrictLatexValue('\\begin{aligned}x&=1\\\\y&=2\\end{aligned}'), null);
  assert.equal(validateStrictLatexValue('\\mathrm{cm}^2'), null);
});

test('strict Math validation rejects delimiters, malformed syntax, raw prose, and dangling operators', () => {
  assert.match(validateStrictLatexValue('$x+1$'), /delimiters/i);
  assert.match(validateStrictLatexValue('\\frac{1}{'), /syntax/i);
  assert.match(validateStrictLatexValue('If x is 2'), /prose/i);
  assert.match(validateStrictLatexValue('x +'), /operator/i);
});

test('Math question validation includes choices, explanations, and content blocks', () => {
  const error = firstMathContentError({
    questionText: '\\text{What is }x?',
    choices: [{ id: 'A', text: '1' }],
    explanation: '\\text{Use substitution.}',
    blocks: [{ type: 'table', headers: ['raw header'], rows: [['1']] }],
  });
  assert.match(error, /table header:.*prose/i);
});

test('SPR author answers accept finite decimals and nonzero fractions only', () => {
  for (const value of ['12', '-2.5', '.75', '3/4']) assert.equal(isValidSprAnswer(value), true);
  for (const value of ['', 'x', '1/0', '2//3']) assert.equal(isValidSprAnswer(value), false);
});
