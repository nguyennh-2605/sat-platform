import { createContext, useContext } from 'react';

export interface QuizToolContextValue {
  isHighlightMode: boolean;
  toggleHighlightMode: () => void;
  isCalculatorOpen: boolean;
  toggleCalculator: () => void;
}

export const QuizToolContext = createContext<QuizToolContextValue | undefined>(undefined);

export const useQuizTool = () => {
  const context = useContext(QuizToolContext);
  if (!context) throw new Error('useQuizTool must be used within a QuizToolProvider');
  return context;
};
