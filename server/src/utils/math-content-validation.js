const katex = require('katex');
const { parseNumericAnswer } = require('./grading');

const TEXT_ARGUMENT_COMMANDS = new Set([
  'text', 'operatorname', 'mathrm', 'mathbf', 'mathit', 'mathsf', 'mathtt', 'begin', 'end',
]);

const skipBracedArgument = (value, start) => {
  if (value[start] !== '{') return start;
  let depth = 1;
  let index = start + 1;
  while (index < value.length && depth > 0) {
    if (value[index] === '\\') {
      index += 2;
      continue;
    }
    if (value[index] === '{') depth += 1;
    if (value[index] === '}') depth -= 1;
    index += 1;
  }
  return index;
};

const latexOutsideTextArguments = (value) => {
  let result = '';
  let index = 0;
  while (index < value.length) {
    if (value[index] !== '\\') {
      result += value[index];
      index += 1;
      continue;
    }

    const command = value.slice(index + 1).match(/^[A-Za-z]+/)?.[0];
    if (!command) {
      index += Math.min(2, value.length - index);
      continue;
    }
    index += command.length + 1;
    while (/\s/.test(value[index] || '')) index += 1;
    if (TEXT_ARGUMENT_COMMANDS.has(command) && value[index] === '{') {
      index = skipBracedArgument(value, index);
    }
  }
  return result;
};

const validateStrictLatexValue = (value) => {
  const text = String(value || '').trim();
  if (!text) return null;
  if (text.includes('$')) return 'Remove $ delimiters; Math content must be raw LaTeX.';

  try {
    katex.renderToString(text, { throwOnError: true, strict: false, trust: false });
  } catch {
    return 'Fix the invalid LaTeX syntax.';
  }

  const outsideText = latexOutsideTextArguments(text);
  const rawWords = outsideText.match(/[A-Za-z]{2,}/g) || [];
  if (rawWords.length >= 2 || rawWords.some(word => word.length >= 4)) {
    return 'Put prose and units inside \\text{...}.';
  }
  if (/(?:[+\-*/=<>]|\\(?:times|div|cdot|pm|mp|le|ge|neq))\s*$/.test(outsideText.trim())) {
    return 'Complete the expression; it ends with an operator.';
  }
  return null;
};

const mathContentValues = (question) => {
  const values = [
    ['question text', question?.questionText],
    ...(Array.isArray(question?.choices) ? question.choices.map(choice => [`choice ${choice?.id || ''}`.trim(), choice?.text]) : []),
    ['explanation', question?.explanation],
  ];

  for (const block of Array.isArray(question?.blocks) ? question.blocks : []) {
    if (block?.type === 'text') values.push(['text block', block.content]);
    if (block?.type === 'table') {
      values.push(['table title', block.title], ...((block.headers || []).map(value => ['table header', value])));
      for (const row of block.rows || []) values.push(...row.map(value => ['table cell', value]));
      values.push(['table note', block.note]);
    }
    if (block?.type === 'poem') {
      values.push(['poem title', block.title], ...((block.lines || []).map(value => ['poem line', value])), ['poem author', block.author]);
    }
    if (block?.type === 'note') values.push(...((block.lines || []).map(value => ['note line', value])));
    if (block?.type === 'image') values.push(['image caption', block.caption]);
  }

  return values.filter(([, value]) => String(value || '').trim());
};

const firstMathContentError = (question) => {
  for (const [field, value] of mathContentValues(question)) {
    const error = validateStrictLatexValue(value);
    if (error) return `${field}: ${error}`;
  }
  return null;
};

const isValidSprAnswer = value => parseNumericAnswer(value) !== null;

module.exports = {
  firstMathContentError,
  isValidSprAnswer,
  latexOutsideTextArguments,
  mathContentValues,
  validateStrictLatexValue,
};
