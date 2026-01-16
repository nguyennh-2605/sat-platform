import React from 'react';
import { useQuizTool } from '../context/QuizToolContext';

const ToolsHeader: React.FC = () => {
  const { isHighlightMode, toggleHighlightMode } = useQuizTool();

  return (
    <div className="flex items-center gap-2 bg-gray-100 p-1.5 rounded-lg border border-gray-200 mr-2">
      <span className="text-xs font-semibold text-gray-600 pl-2">
        {isHighlightMode ? 'Annotation ON' : 'Annotation OFF'}
      </span>
      
      {/* Nút Toggle Switch */}
      <button 
        onClick={toggleHighlightMode}
        className={`
          relative w-12 h-6 rounded-full transition-colors duration-300 ease-in-out focus:outline-none
          ${isHighlightMode ? 'bg-indigo-600' : 'bg-gray-300'}
        `}
      >
        <div 
          className={`
            absolute top-1 left-1 bg-white w-4 h-4 rounded-full shadow transform transition-transform duration-300
            ${isHighlightMode ? 'translate-x-6' : 'translate-x-0'}
          `}
        />
      </button>
      
      {/* Icon Bút chì (Trang trí thêm) */}
      <div className={`p-1.5 rounded-full ${isHighlightMode ? 'bg-indigo-100 text-indigo-600' : 'text-gray-400'}`}>
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
        </svg>
      </div>
    </div>
  );
};

export default ToolsHeader;