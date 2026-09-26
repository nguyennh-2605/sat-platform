import { describe, expect, it } from 'vitest';
import { isValidSprAnswer, strictLatexError } from './math-content-validation';

describe('Math content validation', () => {
  it('accepts strict LaTeX and rejects raw prose or incomplete expressions', () => {
    expect(strictLatexError('\\text{If }x=2\\text{, find }x.')).toBeNull();
    expect(strictLatexError('If x is 2')).toMatch(/prose/i);
    expect(strictLatexError('x +')).toMatch(/operator/i);
    expect(strictLatexError('$x+1$')).toMatch(/delimiters/i);
  });

  it('validates author-provided SPR answers', () => {
    expect(isValidSprAnswer('2/3')).toBe(true);
    expect(isValidSprAnswer('.6667')).toBe(true);
    expect(isValidSprAnswer('1/0')).toBe(false);
    expect(isValidSprAnswer('x')).toBe(false);
  });
});
