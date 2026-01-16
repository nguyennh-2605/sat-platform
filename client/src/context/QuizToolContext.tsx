import React, { createContext, useContext, useState, type ReactNode, useMemo } from 'react';

interface QuizToolContextType {
  isHighlightMode: boolean;
  toggleHighlightMode: () => void;
}

const QuizToolContext = createContext<QuizToolContextType | undefined>(undefined);

export const QuizToolProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [isHighlightMode, setIsHighlightMode] = useState(false);

  // 👇 SỬ DỤNG USEMEMO ĐỂ NGĂN CHẶN RENDER THỪA
  const value = useMemo(() => {
    return {
      isHighlightMode,
      toggleHighlightMode: () => {
        setIsHighlightMode((prev) => !prev);
        if (isHighlightMode) { // Lưu ý: logic này chạy dựa trên state cũ
             window.getSelection()?.removeAllRanges();
        }
      }
    };
  }, [isHighlightMode]);

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