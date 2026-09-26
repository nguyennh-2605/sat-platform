import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { QuizToolContext } from '../../context/quiz-tool-context';
import type { TableBlock } from '../../types/quiz';
import BlockRenderer from './BlockRenderer';

const tableBlock: TableBlock = {
  type: 'table',
  title: 'Sample results',
  headers: ['Group', 'Score'],
  rows: [['A', '42'], ['B', '37']],
  note: 'Scores are rounded.',
};

const tableShellClasses = (variant: 'preview' | 'exam') => {
  const { container } = render(
    <QuizToolContext.Provider value={{ isHighlightMode: false, toggleHighlightMode: () => undefined, isCalculatorOpen: false, toggleCalculator: () => undefined }}>
      <BlockRenderer blocks={[tableBlock]} subject="RW" readOnly variant={variant} />
    </QuizToolContext.Provider>,
  );
  return container.querySelector('table')?.parentElement?.parentElement?.className;
};

describe('BlockRenderer tables', () => {
  it('uses the Exam Room table presentation in teacher previews', () => {
    const previewClasses = tableShellClasses('preview');
    const examClasses = tableShellClasses('exam');

    expect(previewClasses).toBe(examClasses);
    expect(previewClasses).toContain('exam-content');
    expect(previewClasses).toContain('border-[#4B5563]');
    expect(previewClasses).toContain('rounded-none');
    expect(previewClasses).not.toContain('bg-[#E8F5EF]');
  });
});
