import React from 'react';
import InteractiveText from './InteractiveText';
import FormattedTextRenderer from '../../components/content/TextRenderer';
import BlockRenderer from '../../components/content/BlockRenderer';
import type { ContentBlock } from '../../types/quiz';

interface AnswerProps {
  label: string;         // Ví dụ: "A", "B", "C"
  content: string;       // Nội dung đáp án
  blocks?: ContentBlock[];
  isSelected: boolean;   // Selected đáp án này chưa?
  isEliminated: boolean; // Đáp án này có bị gạch không?
  isStrikeMode: boolean; // Chế độ gạch đang BẬT hay TẮT
  onSelect: () => void;  // Hàm khi bấm chọn đáp án
  onEliminate: (e: React.MouseEvent) => void; // Hàm khi bấm nút gạch
  currentSubject: string;
  annotationKey?: string;
}

const AnswerOption: React.FC<AnswerProps> = ({ 
  label, content, blocks = [], isSelected, isEliminated, isStrikeMode, onSelect, onEliminate, currentSubject, annotationKey
}) => {

  // Logic: Hiển thị cột bên phải khi đang bật chế độ Strike HOẶC đáp án này đã bị gạch (để hiện nút Undo)
  const showActionColumn = isStrikeMode || isEliminated;

  return (
    <div className="flex items-start gap-4 w-full group">
      <button
      type="button"
      disabled={isEliminated}
      onClick={onSelect}
      aria-pressed={isSelected}
      className={`
        relative flex-1 flex items-start gap-5 overflow-hidden rounded-xl border bg-white p-2 text-left
        ${isEliminated ? 'cursor-default border-gray-200 bg-white' : 'cursor-pointer hover:shadow-md'}
        ${isSelected && !isEliminated ? 'border-blue-700 border-2' : 'border-gray-600'}
        ${isEliminated ? 'opacity-50 grayscale' : ''}
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700 focus-visible:ring-offset-2
      `}
    >
      
      {/* 1. VÒNG TRÒN CHỮ CÁI (A, B, C...) */}
      <div className={`
        w-6 h-6 mt-1 shrink-0 flex items-center justify-center rounded-full text-sm font-bold border-2 transition-colors
        ${isSelected && !isEliminated ? 'bg-blue-700 text-white border-gray-800'
          : 'bg-white text-gray-500 border-gray-500'}
        ${isEliminated ? 'text-gray-500 border-gray-300' : ''}
      `}>
        {label}
      </div>

      {/* 2. NỘI DUNG ĐÁP ÁN */}
      <span className="exam-content min-w-0 flex-1 font-normal text-[#1a1a1a]">
        {content && (currentSubject === 'RW'
          ? <InteractiveText content={content} inheritTypography annotationKey={annotationKey} />
          : <FormattedTextRenderer text={content} inheritTypography latexOnly />
        )}
        {blocks.length > 0 && <BlockRenderer blocks={blocks} subject={currentSubject} readOnly variant="exam" disableImageActions />}
      </span>

      <div className={`
          absolute inset-0 pointer-events-none flex items-center justify-center
          transition-opacity duration-300
          ${isEliminated ? 'opacity-100' : 'opacity-0'}
      `}>
        {/* Đổi màu đỏ thành màu xám đậm (bg-slate-500) và làm dày hơn chút */}
        <div className={`
          h-[3px] bg-slate-600/80 w-[95%] rounded-full
          transition-all duration-300 origin-left shadow-xs
          ${isEliminated ? 'scale-x-100' : 'scale-x-0'} 
        `}></div>
      </div>
      
    </button>

      {/* 4. NÚT HÀNH ĐỘNG (Undo / Strike) */}
      <button
        type="button"
        onClick={onEliminate}
        className={`
          flex items-start justify-end shrink-0 cursor-pointer overflow-hidden mt-1
          transition-all duration-300 ease-in-out
          ${showActionColumn 
            ? 'w-[50px] opacity-100 ml-1' 
            : 'w-0 opacity-0 ml-0'
          }
        `}
        title={isEliminated ? "Undo elimination" : "Eliminate this option"}
        aria-label={isEliminated ? `Undo elimination for option ${label}` : `Eliminate option ${label}`}
      >
        {/* Dùng div con để cố định kích thước nội dung, tránh bị méo khi div cha co lại */}
        <div className="w-[50px] flex justify-center">
          {isEliminated ? (
            <span className="text-sm font-bold text-slate-900 underline decoration-2 underline-offset-4">
              Undo
            </span>
          ) : (
            <div className={`
              relative w-6 h-6 rounded-full border-2 flex items-center justify-center font-bold text-xs select-none
              transition-all duration-200
              text-slate-500 border-slate-500
            `}>
              {/* Chữ cái A, B, C... */}
              <span className="pb-px">{label}</span>

              {/* Đường gạch ngang đè lên */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="h-[2px] w-[110%] bg-current transform -rotate-12"></div>
              </div>
            </div>
          )}
        </div>
      </button>
    </div>
  );
};

export default AnswerOption;
