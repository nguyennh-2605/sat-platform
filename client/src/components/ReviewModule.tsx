import React from 'react';

// 1. Định nghĩa kiểu dữ liệu cho một Câu hỏi (cơ bản)
interface Question {
  id: number | string;
  // Bạn có thể thêm các trường khác nếu cần, ví dụ: questionText: string;
  [key: string]: any; // Cho phép các trường khác tùy ý để đỡ bị lỗi
}

// 2. Định nghĩa kiểu dữ liệu cho toàn bộ Props của component này
interface ReviewScreenProps {
  phase: 'REVIEW_1' | 'REVIEW_2'; // Chỉ cho phép 2 giá trị này (giúp autocomplete cực sướng)
  questions: Question[];          // Mảng các câu hỏi
  answers: Record<string, any>;   // Object chứa đáp án: { "1": "A", "2": "B" }
  markedQuestions: (number | string)[]; // Mảng chứa ID các câu đã bookmark
  splitIndex: number;             // Số nguyên
  onQuestionClick: (index: number) => void; // Hàm nhận vào số, không trả về gì
  description: string
}

// 3. Gán kiểu ReviewScreenProps vào component
const ReviewScreen: React.FC<ReviewScreenProps> = ({ 
  phase,             
  questions,         
  answers,           
  markedQuestions,   
  splitIndex,        
  onQuestionClick,   
  description
}) => {

  const isMod1 = phase === 'REVIEW_1';
  const startIndex = isMod1 ? 0 : splitIndex;
  const endIndex = isMod1 ? splitIndex : questions.length;
  const moduleTitle = `Section 1, ${isMod1 ? 'Module 1' : 'Module 2'}: ${description}`;
  const currentModuleQuestions = questions.slice(startIndex, endIndex);

  return (
    <div className="flex-1 overflow-y-auto bg-white h-full">
      {/* --- HEADER --- */}
      <div className="max-w-5xl mx-auto pt-10 pb-6 px-4 text-center">
        <h1 className="text-3xl md:text-4xl font-normal text-gray-900 mb-4">Check Your Work</h1>
        <div className="text-base md:text-lg text-gray-800 space-y-1 font-normal">
          <p>On test day, you won't be able to move on to the next module until time expires</p>
          <p>For these practice questions, you can click <b>Next</b> when you're ready to move on.</p>
        </div>
      </div>
      <div className="max-w-3xl mx-auto bg-white md:rounded-xl shadow-xl border border-gray-200 p-6 md:p-8 mb-20">
        
        {/* Card Header & Legend */}
        <div className="flex flex-col md:flex-row justify-between items-center border-b border-gray-400 pb-4 mb-6">
          <h2 className="text-lg font-bold text-gray-900">
             {moduleTitle}
          </h2>
          
          {/* Legend */}
          <div className="flex gap-4 mt-2 md:mt-0 text-sm text-gray-700 font-medium">
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 border border-dashed border-gray-600 rounded-sm"></div>
                <span>Unanswered</span>
              </div>
              <div className="flex items-center gap-1">
                <svg className="w-5 h-5 text-red-700 fill-current" viewBox="0 0 24 24">
                  <path d="M17 3H7c-1.1 0-1.99.9-1.99 2L5 21l7-3 7 3V5c0-1.1-.9-2-2-2z"/>
                </svg>
                <span>For Review</span>
              </div>
          </div>
        </div>

        {/* --- GRID CÂU HỎI --- */}
        {/* Thay đổi grid-cols để phù hợp với chiều rộng hẹp hơn 
           md:grid-cols-5 (5 ô 1 hàng) sẽ đẹp hơn 8 ô khi khung nhỏ
        */}
        <div className="grid grid-cols-10 gap-7">
          {currentModuleQuestions.map((q, idx) => {
            const realIndex = startIndex + idx;
            const answerVal = answers[q.id];
            const hasAnswer = answerVal !== undefined && answerVal !== null && String(answerVal).length > 0;
            const isMarked = markedQuestions.includes(q.id);

            return (
              <button
                key={q.id}
                onClick={() => onQuestionClick(realIndex)}
                className={
                  `w-full aspect-square flex items-center justify-center text-2xl font-semibold transition-all rounded-sm
                  ${hasAnswer
                    ? 'text-white font-bold hover:border-gray-600 bg-blue-700 hover:bg-blue-800'
                    : 'border border-dashed border-gray-600 text-blue-700 font-bold hover:bg-gray-100'
                  }
                  `
                }
              >
                {idx + 1}
                {isMarked && (
                  <div className="absolute -top-1.5 -right-1.5 z-20 pointer-events-none">
                    <svg className="w-4 h-4 text-red-700 fill-current drop-shadow-md" viewBox="0 0 24 24">
                      <path d="M17 3H7c-1.1 0-1.99.9-1.99 2L5 21l7-3 7 3V5c0-1.1-.9-2-2-2z"/>
                    </svg>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default ReviewScreen;