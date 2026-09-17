import React, { useState, type ReactNode, useMemo, useCallback } from 'react';
import { QuizToolContext } from './quiz-tool-context';

export const QuizToolProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [isHighlightMode, setIsHighlightMode] = useState(false);
  const [isCalculatorOpen, setIsCalculatorOpen] = useState(false);

  const toggleHighlightMode = useCallback(() => {
    setIsHighlightMode(prev => {
      const next = !prev;
      if (!next) {
        window.getSelection()?.removeAllRanges();
      }
      return next;
    });
  }, []);

  const toggleCalculator = useCallback(() => {
    setIsCalculatorOpen(prev => !prev);
  }, []);

  // SỬ DỤNG USEMEMO ĐỂ NGĂN CHẶN RENDER THỪA
  const value = useMemo(() => ({
    isHighlightMode,
    toggleHighlightMode,
    isCalculatorOpen,
    toggleCalculator
  }), [isHighlightMode, isCalculatorOpen, toggleHighlightMode, toggleCalculator]);

  return (
    <QuizToolContext.Provider value={value}>
      {children}
    </QuizToolContext.Provider>
  );
};
