import katex from 'katex';
import type { ImportQuestion } from './create-test.types';

const textArgumentCommands = new Set([
  'text', 'operatorname', 'mathrm', 'mathbf', 'mathit', 'mathsf', 'mathtt', 'begin', 'end',
]);

const skipBracedArgument = (value: string, start: number) => {
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

export const latexOutsideTextArguments = (value: string) => {
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
    if (textArgumentCommands.has(command) && value[index] === '{') index = skipBracedArgument(value, index);
  }
  return result;
};

export const strictLatexError = (value: string) => {
  const text = String(value || '').trim();
  if (!text) return null;
  if (text.includes('$')) return 'Remove $ delimiters.';
  try {
    katex.renderToString(text, { throwOnError: true, strict: false, trust: false });
  } catch {
    return 'Fix the invalid LaTeX syntax.';
  }

  const outsideText = latexOutsideTextArguments(text);
  const rawWords = outsideText.match(/[A-Za-z]{2,}/g) || [];
  if (rawWords.length >= 2 || rawWords.some(word => word.length >= 4)) return 'Put prose and units inside \\text{...}.';
  if (/(?:[+\-*/=<>]|\\(?:times|div|cdot|pm|mp|le|ge|neq))\s*$/.test(outsideText.trim())) {
    return 'Complete the expression; it ends with an operator.';
  }
  return null;
};

const mathLatexValues = (question: ImportQuestion) => {
  const values = [question.questionText, ...question.choices.map(choice => choice.text), question.explanation || ''];
  question.blocks.forEach(block => {
    if (block.type === 'text') values.push(block.content);
    if (block.type === 'table') values.push(block.title || '', ...block.headers, ...block.rows.flat(), block.note || '');
    if (block.type === 'poem') values.push(block.title || '', ...block.lines, block.author || '');
    if (block.type === 'note') values.push(...block.lines);
    if (block.type === 'image') values.push(block.caption || '');
  });
  return values.filter(value => value.trim());
};

export const hasInvalidStrictLatex = (question: ImportQuestion) => mathLatexValues(question).some(value => strictLatexError(value));

export const isValidSprAnswer = (value: string) => {
  const normalized = value.trim().replace(/\s+/g, '');
  if (/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(normalized)) return Number.isFinite(Number(normalized));
  const fraction = normalized.match(/^([+-]?\d+)\/([+-]?\d+)$/);
  return Boolean(fraction && Number(fraction[2]) !== 0);
};
