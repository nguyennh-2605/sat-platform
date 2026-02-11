import React, { useState } from 'react';
import { useQuizTool } from '../context/QuizToolContext';

interface ToolsHeaderProps {
  onSaveAction: () => Promise<void>;
  currentMode: string;
}

const ToolsHeader: React.FC<ToolsHeaderProps> = ({ onSaveAction, currentMode }) => {
  const { isHighlightMode, toggleHighlightMode } = useQuizTool();
  const [isSaving, setIsSaving] = useState(false);

  const handleSaveAndExit = async () => {
    try {
      setIsSaving(true);
      await onSaveAction();
    } catch (error) {
      console.error("Lỗi khi lưu:", error);
      alert("Lỗi khi lưu bài. Vui lòng thử lại!");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex items-center gap-3">
      <button 
        onClick={toggleHighlightMode}
        className={`
          group flex flex-col items-center gap-1 focus:outline-none
          transition-colors duration-200 
          rounded-lg px-2 py-1 -my-1 
          hover:bg-green-50      
        `}
        title={isHighlightMode ? "Turn off Highlights & Notes" : "Turn on Highlights & Notes"}
      >
        {/* 1. ICON CUSTOM (Thấp hơn & Rộng hơn) */}
        <div className={`
            w-6 h-6 transition-colors duration-200 
            text-slate-700'
          `}>
            <svg 
              viewBox="0 0 24 24" 
              fill="none" 
              stroke="currentColor" 
              strokeWidth="2" 
              strokeLinecap="round" 
              strokeLinejoin="round"
            >
              {/* 1. ĐƯỜNG GẠCH CHÂN (Stroke Line) */}
              {/* Nằm ở y=22 (sát đáy), từ x=3 đến x=21 */}
              <line x1="3" y1="22" x2="21" y2="22" />

              {/* 2. THÂN BÚT (Pen Body) */}
              {/* Vẽ hình chữ nhật nghiêng, đầu nhọn hướng về (3, 19) */}
              {/* M 15 4: Điểm trên cùng */}
              {/* L 20 9: Góc phải trên */}
              {/* L 6 23: Xuống gần ngòi (chỉnh lại chút cho khớp nét gạch) */}
              {/* Logic: Ngòi nằm ở khoảng (3, 19) */}
              
              <path d="M16 3L21 8L7.5 21.5L3 21.5L3 17L16 3Z" />
              
              {/* 3. CHI TIẾT (Nắp/Ngấn bút) */}
              <line x1="11" y1="8" x2="16" y2="13" />
            </svg>
          </div>

        {/* 2. TEXT & UNDERLINE */}
        <div className="flex flex-col items-center">
          <span className={`
            text-sm font-sans transition-all duration-200 text-slate-700 font-bold
          `}>
            Highlights & Notes
          </span>

          {/* Đường gạch chân */}
          <div className={`
            h-[2px] bg-slate-900 mt-0.5 transition-all duration-200
            ${isHighlightMode ? 'w-full opacity-100' : 'w-0 opacity-0'}
          `}></div>
        </div>
      </button>
      {/* -----------------------------------------------------------------
          BUTTON 2: SAVE & EXIT
      ------------------------------------------------------------------ */}
      {currentMode != 'EXAM' && (
        <button 
          onClick={handleSaveAndExit}
          disabled={isSaving}
          className={`
            group flex flex-col items-center gap-1 focus:outline-none
            transition-colors duration-200 
            rounded-lg px-2 py-1 -my-1
            hover:bg-green-50
          `}
          title="Save your progress and exit"
        >
        <div className="w-6 h-6 text-slate-700">
            <svg 
              viewBox="0 0 24 24" 
              fill="none" 
              stroke="currentColor" 
              strokeWidth="2"     /* Độ dày nét vẽ */
              strokeLinecap="round" 
              strokeLinejoin="round"
            >
              {/* 1. Vòng tròn bên ngoài */}
              <circle cx="12" cy="12" r="10" />

              {/* 2. Mũi tên hướng sang phải */}
              {/* Thân mũi tên: từ x=8 đến x=16 */}
              {/* Đầu mũi tên: toạ độ (16, 12) giật về 2 bên */}
              <path d="M8 12h8" />
              <path d="M12 16l4-4-4-4" />
            </svg>
          </div>

          <div className="flex flex-col items-center">
            <span className="text-sm font-sans font-bold text-slate-700">
              Save & Exit
            </span>
            <div className="h-[2px] w-0 bg-transparent mt-0.5"></div>
          </div>
        </button>
      )}
    </div>
  );
};

export default ToolsHeader;