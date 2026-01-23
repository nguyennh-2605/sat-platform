// components/ReviewModal.tsx
import React from 'react';
import { type QuestionResult } from '../ScoreReport';
import BlockRenderer from './BlockRenderer'

interface ReviewModalProps {
  data: QuestionResult;
  onClose: () => void;
  examTitle?: string;
}

const ReviewModal: React.FC<ReviewModalProps> = ({ data, onClose, examTitle }) => {
  // Logic tô màu đáp án (Giữ nguyên logic chuẩn)
  const getOptionStyle = (optText: string, optId: string) => {
    // Backend trả về correctOption là ID hoặc Text, cần so sánh linh hoạt
    const isCorrect = optId === data.correctAnswer || optText === data.correctAnswer;
    const isUserSelected = optId === data.userAnswer || optText === data.userAnswer;

    if (isCorrect) return "border-green-600 bg-green-100 text-gray-900 font-medium ring-1 ring-green-600"; // Đáp án đúng luôn xanh
    if (isUserSelected) return "border-red-300 bg-red-50 text-gray-700 dashed-border"; // (Tuỳ chọn) User chọn sai thì báo đỏ nhẹ
    return "border-gray-300 bg-white hover:bg-gray-50 text-gray-700";
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md p-4 animate-in fade-in duration-200">
      
      {/* Container chính: Bo góc lớn hơn, shadow sâu hơn */}
      <div className="w-full max-w-5xl bg-white rounded-2xl shadow-2xl flex flex-col h-[90vh] overflow-hidden ring-1 ring-gray-900/5">
        
        {/* --- HEADER --- */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-white/80 backdrop-blur z-10">
          <div className="flex items-center gap-3">
            {/* Badge Module màu xanh nhẹ, hiện đại hơn */}
             <span className="bg-blue-50 text-blue-700 ring-1 ring-blue-700/10 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider">
               {data.module}
             </span>
             <h2 className="text-lg font-bold text-gray-800 tracking-tight">
               Question {data.questionNumber}
             </h2>
          </div>
          
          {/* Nút đóng hiện đại bằng SVG */}
          <button 
            onClick={onClose} 
            className="group p-2 rounded-full hover:bg-gray-100 transition-colors"
            aria-label="Close modal"
          >
             <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400 group-hover:text-gray-800 transition-colors">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        {/* --- BODY (Scrollable - GIỮ NGUYÊN CẤU TRÚC) --- */}
        <div className="flex-1 overflow-y-auto bg-white scroll-smooth">
          
          {/* PHẦN TRÊN: ĐỀ BÀI (BLOCKS) - Nền trắng sạch */}
          <div className="bg-white p-8 md:px-12 pt-8 pb-4">
             <div className="max-w-3xl mx-auto">
                {/* Giả sử BlockRenderer render nội dung text/ảnh đẹp rồi */}
                <BlockRenderer blocks={data.blocks} />
             </div>
          </div>

          {/* Đường phân cách mềm mại hơn */ }
          <div className="h-px w-full bg-gradient-to-r from-transparent via-gray-200 to-transparent" /> 

          {/* PHẦN DƯỚI: CÂU HỎI & ĐÁP ÁN - Nền xám nhẹ (Slate) để phân biệt */}
          <div className="bg-slate-50 p-8 md:px-12 pt-6 pb-10">
            <div className="max-w-3xl mx-auto">
            
              {/* Câu hỏi prompt */}
              <div className="font-sans text-xl font-semibold text-gray-900 mb-6 leading-snug">
                {data.questionText}
              </div>

              {/* Danh sách đáp án */}
              <div className="grid grid-cols-1 gap-3">
                {data.choices.map((opt, index) => {
                  const label = String.fromCharCode(65 + index);
                  const styleClass = getOptionStyle(opt.text, opt.id);
                  
                  const isCorrect = opt.id === data.correctAnswer || opt.text === data.correctAnswer;
                  
                  return (
                    // Thêm shadow-sm, bo góc lớn hơn (rounded-xl) và hiệu ứng hover
                    <div key={index} className={`relative flex items-center p-4 border rounded-xl transition-all shadow-sm 
                      ${isCorrect ? 'bg-green-50 border-green-500'
                                  : 'bg-white border-gray-300 hover:border-gray-400'}
                      ${styleClass}`}>
                      
                      {/* Nhãn A/B/C/D */}
                      <div className={`flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full border-[1.5px] text-sm font-bold mr-4 transition-colors
                        ${isCorrect 
                          ? 'bg-green-600 text-white border-green-600 shadow-sm' // Style khi đúng
                          : 'bg-white border-gray-300 text-gray-500 group-hover:border-gray-400' // Style thường
                        }
                      `}>
                        {label}
                      </div>

                      <div className="flex-1 text-base leading-relaxed text-gray-800 pt-0.5 font-normal">
                          {opt.text}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

        </div>

        {/* --- FOOTER --- */}
        <div className="px-6 py-3 bg-white border-t border-gray-100 text-xs font-medium text-gray-400 flex justify-between items-center">
           <span className="flex items-center gap-1">
             <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path d="M9 4.804A7.968 7.968 0 005.5 4c-1.255 0-2.443.29-3.5.804v10A7.969 7.969 0 015.5 14c1.669 0 3.218.51 4.5 1.385A7.962 7.962 0 0114.5 14c1.255 0 2.443.29 3.5.804v-10A7.963 7.963 0 0014.5 4c-1.255 0-2.443.29-3.5.804V12a1 1 0 11-2 0V4.804z"/></svg>
             {examTitle}
           </span>
           <span className="font-mono text-[10px] tracking-wider opacity-70">ID: {data.id}</span>
        </div>

      </div>
    </div>
  );
};

export default ReviewModal;