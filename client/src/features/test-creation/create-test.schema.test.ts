import { describe, expect, it } from 'vitest';
import { normalizeTestCategoryForForm } from './create-test.schema';

describe('normalizeTestCategoryForForm', () => {
  it('maps teacher-owned CLASS tests to the editable practice category', () => {
    expect(normalizeTestCategoryForForm('CLASS')).toBe('PRACTICE');
  });

  it('preserves admin-facing practice and official categories', () => {
    expect(normalizeTestCategoryForForm('PRACTICE')).toBe('PRACTICE');
    expect(normalizeTestCategoryForForm('REAL')).toBe('REAL');
  });
});
