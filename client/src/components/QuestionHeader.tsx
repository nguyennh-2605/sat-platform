// file: src/components/QuestionHeader.tsx
import React from 'react';

// --- ICONS (Định nghĩa ngay tại đây cho gọn) ---
const BookmarkIcon = ({ filled }: { filled: boolean }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill={filled ? "#CA8A04" : "none"} stroke={filled ? "#CA8A04" : "currentColor"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z"/>
  </svg>
);

const StrikethroughIcon = () => (
  <div className="
    flex items-center justify-center           /* Căn giữa chữ ABC */
    w-6 h-6                                    /* Kích thước hình vuông */
    border-2 border-gray-400                   /* Viền dày 2px màu xám */
    rounded-md                                 /* 👉 Bo tròn góc (Medium) */
    bg-white                                   /* Nền trắng */
  ">
    <span className="
      text-[10px] font-bold text-gray-600      /* Chữ nhỏ, đậm */
      line-through decoration-2 decoration-gray-600 /* 👉 Gạch ngang chữ */
    ">
      ABC
    </span>
  </div>
);

// --- MAIN COMPONENT ---
interface Props {
  currentPhase: string;
  splitIndex: number;
  currentIndex: number;
  isMarked: boolean;
  onToggleMark: () => void;
  isStrikeMode: boolean;
  onToggleStrikeMode: () => void;
}

const QuestionHeader: React.FC<Props> = ({ 
  currentPhase, splitIndex, currentIndex, isMarked, onToggleMark, isStrikeMode, onToggleStrikeMode }) => {
  return (
    <div className="w-full bg-gray-100 h-14 flex items-center border-b border-gray-200 mb-6">
      
      {/* 1. Ô SỐ MÀU ĐEN */}
      <div className="h-full w-14 bg-black text-white flex items-center justify-center text-xl font-bold shrink-0">
        {currentPhase === 'MODULE_2' ? currentIndex - splitIndex + 1 : currentIndex + 1}
      </div>

      {/* 2. NÚT MARK FOR REVIEW */}
      <button 
        onClick={onToggleMark}
        className="flex items-center gap-2 px-4 h-full hover:bg-gray-200 transition-colors text-gray-800 font-medium focus:outline-none"
      >
        <BookmarkIcon filled={isMarked} />
        <span className={`text-sm ${isMarked ? "text-yellow-700 font-bold" : "text-gray-600"}`}>
          {isMarked ? "Marked" : "Mark for Review"}
        </span>
      </button>

      {/* 3. CÔNG CỤ (BÊN PHẢI) */}
      <div className="ml-auto flex items-center px-4 gap-4 sm:gap-6">
        <button 
          onClick={onToggleStrikeMode}
          title="Gạch bỏ đáp án"
          className={`
            transition-all duration-200 rounded-md p-1
            ${isStrikeMode 
              ? 'ring-2 ring-indigo-600 bg-indigo-100 scale-110' // Khi bật
              : 'opacity-70 hover:opacity-100 hover:bg-gray-200'  // Khi tắt
            }
          `}
        >
          <StrikethroughIcon />
        </button>
      </div>
    </div>
  );
};

export default QuestionHeader;