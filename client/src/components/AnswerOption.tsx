// FILE: src/components/AnswerOption.tsx
import React from 'react';
import InteractiveText from './InteractiveText';

interface AnswerProps {
  label: string;         // Ví dụ: "A", "B", "C"
  content: string;       // Nội dung đáp án
  isSelected: boolean;   // Đã chọn đáp án này chưa?
  isEliminated: boolean; // Đáp án này có bị gạch không?
  isStrikeMode: boolean; // Chế độ gạch đang BẬT hay TẮT
  onSelect: () => void;  // Hàm khi bấm chọn đáp án
  onEliminate: (e: React.MouseEvent) => void; // Hàm khi bấm nút gạch
}

const AnswerOption: React.FC<AnswerProps> = ({ 
  label, content, isSelected, isEliminated, isStrikeMode, onSelect, onEliminate 
}) => {

  // Logic: Hiển thị cột bên phải khi đang bật chế độ Strike HOẶC đáp án này đã bị gạch (để hiện nút Undo)
  const showActionColumn = isStrikeMode || isEliminated;

  return (
    <div className="flex items-center gap-4 w-full group">
      <div 
      // Nếu bị gạch thì disable click, ngược lại thì cho chọn
      onClick={!isEliminated ? onSelect : undefined} 
      className={`
        relative flex-1 flex items-center gap-3 p-4 border-2 rounded-2xl bg-white
        transition-all duration-200 ease-in-out overflow-hidden
        ${isEliminated ? 'cursor-default border-gray-200 bg-white' : 'cursor-pointer hover:bg-indigo-50/50 hover:border-indigo-300 hover:shadow-md'}
        ${isSelected && !isEliminated ? 'border-indigo-600 bg-indigo-50 ring-2 ring-indigo-200 ring-offset-1' : 'border-gray-400'}
        active:scale-[0.99]
        ${isEliminated ? 'opacity-50 grayscale' : ''}
      `}
    >
      
      {/* 1. VÒNG TRÒN CHỮ CÁI (A, B, C...) */}
      <div className={`
        w-8 h-8 shrink-0 flex items-center justify-center rounded-full text-sm font-bold border transition-colors
        ${isSelected && !isEliminated ? 'bg-indigo-600 text-white border-indigo-600'
          : 'bg-white text-gray-500 border-gray-500 group-hover:border-indigo-400 group-hover:text-indigo-500'}
        ${isEliminated ? 'text-gray-500 border-gray-300' : ''}
      `}>
        {label}
      </div>

      {/* 2. NỘI DUNG ĐÁP ÁN */}
      <span className="font-sans text-[1.05rem] font-normal tracking-[-0.005em]">
        <InteractiveText content={content} />
      </span>

      <div className={`
          absolute inset-0 pointer-events-none flex items-center justify-center
          transition-opacity duration-300
          ${isEliminated ? 'opacity-100' : 'opacity-0'}
      `}>
        {/* Đổi màu đỏ thành màu xám đậm (bg-slate-500) và làm dày hơn chút */}
        <div className={`
          h-[3px] bg-slate-600/80 w-[95%] rounded-full
          transition-all duration-300 origin-left shadow-sm
          ${isEliminated ? 'scale-x-100' : 'scale-x-0'} 
        `}></div>
      </div>
      
    </div>

      {/* 4. NÚT HÀNH ĐỘNG (Undo / Strike) */}
      <div 
        onClick={onEliminate}
        // 👇 Quan trọng: Chỉ để margin, xóa hết background và padding
        className={`
          flex items-center justify-end shrink-0 cursor-pointer overflow-hidden
          transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]
          ${showActionColumn 
            ? 'w-[50px] opacity-100 ml-1' 
            : 'w-0 opacity-0 ml-0'
          }
        `}
        title={isEliminated ? "Bỏ gạch (Undo)" : "Gạch bỏ đáp án này"}
      >
        {/* Dùng div con để cố định kích thước nội dung, tránh bị méo khi div cha co lại */}
        <div className="w-[50px] flex justify-center">
          {isEliminated ? (
            // 👇 SỬA: Chữ luôn màu đen (slate-900), BỎ class hover đổi màu
            <span className="text-sm font-bold text-slate-900 underline decoration-2 underline-offset-4">
              Undo
            </span>
          ) : (
            <div className={`
              relative w-7 h-7 rounded-full border-2 flex items-center justify-center font-bold text-xs select-none
              transition-all duration-200
              text-slate-500 border-slate-400
            `}>
              {/* Chữ cái A, B, C... */}
              <span className="pb-[1px]">{label}</span>

              {/* Đường gạch ngang đè lên */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="h-[2px] w-[110%] bg-current transform -rotate-12"></div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AnswerOption;