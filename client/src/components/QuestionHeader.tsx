// file: src/components/QuestionHeader.tsx
import React from 'react';

// --- ICONS ---

// 1. Icon Bookmark: Cập nhật logic màu đỏ khi active
const BookmarkIcon = ({ filled }: { filled: boolean }) => (
  <svg 
    xmlns="http://www.w3.org/2000/svg" 
    className="w-5 h-5"
    viewBox="0 0 24 24" 
    fill={filled ? "#991B1B" : "none"} /* Màu đỏ (Red-600) */
    stroke={filled ? "#000" : "currentColor"} 
    strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
  >
    <path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z"/>
  </svg>
);

// 2. Icon ABC: Cập nhật thành gạch chéo
const StrikethroughIcon = () => (
  <div className="
    relative flex items-center justify-center 
    w-5 h-5                        /* Giảm kích thước khung xuống 20px */
    border border-gray-400         /* Viền mỏng lại chút */
    rounded bg-white 
    overflow-hidden                /* Để đường gạch chéo không lòi ra ngoài */
  ">
    <span className="text-[9px] font-bold text-gray-600">
      ABC
    </span>
    {/* Tạo đường gạch chéo bằng thẻ div tuyệt đối */}
    <div className="
        absolute w-[150%] h-[1px] bg-gray-600 
        rotate-[150deg]              /* Xoay chéo */
        top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2
    "></div>
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
    <div className="w-full mb-3">
      <div className="w-full bg-gray-100 h-9 flex items-center border-b border-gray-200 mb-4">
        
        {/* 1. Ô SỐ MÀU ĐEN: Giảm kích thước w-14 -> w-10 */}
        <div className="h-full w-9 bg-black text-white flex items-center justify-center text-base font-bold shrink-0">
          {currentPhase === 'MODULE_2' ? currentIndex - splitIndex + 1 : currentIndex + 1}
        </div>

        {/* 2. NÚT MARK FOR REVIEW */}
        <button 
          onClick={onToggleMark}
          className="flex items-center gap-1 px-3 h-full hover:bg-gray-200 transition-colors text-gray-800 font-medium focus:outline-none"
        >
          <BookmarkIcon filled={isMarked} />
          <span className={`text-sm transition-all ${
              isMarked 
              ? "text-gray-900 font-bold underline"  /* Active: Đỏ, Đậm, Gạch chân */
              : "text-gray-700"
          }`}>
            Mark for Review
          </span>
        </button>

        {/* 3. CÔNG CỤ (BÊN PHẢI) */}
        <div className="ml-auto flex items-center px-3 gap-3">
          <button 
            onClick={onToggleStrikeMode}
            title="Gạch bỏ đáp án"
            className={`
              transition-all duration-200 rounded p-0.5
              ${isStrikeMode 
                ? 'ring-1 ring-indigo-600 bg-indigo-100' // Bỏ scale lớn để trông gọn hơn
                : 'opacity-70 hover:opacity-100 hover:bg-gray-200'
              }
            `}
          >
            <StrikethroughIcon />
          </button>
        </div>
      </div>
      <div className="w-full h-[2px] bg-[linear-gradient(90deg,#374151_90%,transparent_90%)] bg-[length:20px_2px] -mt-[15px] relative z-10"></div>
    </div>
  );
};

export default QuestionHeader;