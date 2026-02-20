import React, { createContext, useContext, useState, type ReactNode, useMemo, useCallback } from 'react';

interface QuizToolContextType {
  isHighlightMode: boolean;
  toggleHighlightMode: () => void;
  isCalculatorOpen: boolean;
  toggleCalculator: () => void;
}

const QuizToolContext = createContext<QuizToolContextType | undefined>(undefined);

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

export const useQuizTool = () => {
  const context = useContext(QuizToolContext);
  if (!context) {
    throw new Error('useQuizTool must be used within a QuizToolProvider');
  }
  return context;
};