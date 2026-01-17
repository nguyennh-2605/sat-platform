import React from 'react';

// 1. Cập nhật Interface dữ liệu đầu vào
export interface QuestionResult {
  id: number | string;
  module: string;           // VD: "Module 1"
  questionNumber: number;   // VD: 5 (Số thứ tự trong module đó)
  correctAnswer: string;
  userAnswer: string | null;
  isCorrect: boolean;
}

interface ScoreReportProps {
  examTitle: string;
  subject: string;
  date: string;
  duration: string;
  questions: QuestionResult[];
  onReview: (questionId: string | number) => void;
  onBackToHome: () => void;
}

const ScoreReport: React.FC<ScoreReportProps> = ({
  examTitle,
  subject,
  date,
  duration,
  questions,
  onReview,
  onBackToHome
}) => {
  const totalQuestions = questions.length;
  const correctCount = questions.filter(q => q.isCorrect).length;
  const incorrectCount = totalQuestions - correctCount;

  // Lấy danh sách câu sai (Format: M1-Q5) để hiển thị header
  // const incorrectList = questions
  //   .filter(q => !q.isCorrect)
  //   .map(q => `${q.module.charAt(0)}1-Q${q.questionNumber}`); // VD: M1-Q5

  return (
    <div className="max-w-5xl mx-auto p-8 bg-white font-sans text-gray-800 min-h-screen">
      {/* --- HEADER (Giữ nguyên) --- */}
      <h1 className="text-3xl font-bold mb-6 text-black">Score Details</h1>
      
      <div className="mb-6 space-y-2 text-sm text-gray-700">
        <div className="flex items-center gap-2 font-semibold">
          <span className="text-lg">📄</span> {examTitle}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-lg">📚</span> {subject}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-lg">📅</span> {date}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-lg">⏱️</span> {duration}
        </div>
      </div>

      <div className="flex justify-end gap-3 mb-8">
        <button className="px-4 py-2 bg-blue-600 text-white font-semibold rounded hover:bg-blue-700 transition shadow-sm">
          CELEBRATE
        </button>
        <button 
          onClick={onBackToHome}
          className="px-4 py-2 border border-blue-600 text-blue-600 font-semibold rounded hover:bg-blue-50 transition shadow-sm"
        >
          BACK TO HOME
        </button>
      </div>

      {/* --- DASHBOARD (Giữ nguyên) --- */}
      <div className="grid grid-cols-3 divide-x divide-gray-300 bg-sky-50/50 border border-gray-200 py-8 mb-10 rounded-sm">
        <div className="text-center">
          <div className="text-5xl font-bold text-gray-700 mb-1">{totalQuestions}</div>
          <div className="text-gray-500 uppercase text-xs tracking-wider">Total Questions</div>
        </div>
        <div className="text-center">
          <div className="text-5xl font-bold text-gray-700 mb-1">{correctCount}</div>
          <div className="text-gray-500 uppercase text-xs tracking-wider">Correct Answers</div>
        </div>
        <div className="text-center">
          <div className="text-5xl font-bold text-gray-700 mb-1">{incorrectCount}</div>
          <div className="text-gray-500 uppercase text-xs tracking-wider">Incorrect Answers</div>
        </div>
      </div>

      {/* --- TABLE (Đã sửa lại cấu trúc cột) --- */}
      <div className="overflow-hidden border border-gray-200 rounded-sm shadow-sm">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-800 text-white text-sm uppercase tracking-wide">
              {/* Cột 1: Thông tin câu hỏi (Module + Số) */}
              <th className="py-4 px-6 font-semibold w-1/4">Question</th> 
              
              {/* Cột 2: Đáp án đúng */}
              <th className="py-4 px-6 font-semibold w-1/4">Correct Answer</th>
              
              {/* Cột 3: Đáp án của bạn */}
              <th className="py-4 px-6 font-semibold w-1/4">Your Answer</th>
              
              {/* Cột 4: Nút bấm */}
              <th className="py-4 px-6 font-semibold text-center w-1/4">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {questions.map((q) => (
              <tr key={q.id} className="hover:bg-gray-50 transition-colors">
                
                {/* 1. Question Info */}
                <td className="py-4 px-6 align-middle">
                   <div className="flex flex-col">
                      <span className="font-bold text-gray-800 text-lg">Question {q.questionNumber}</span>
                      <span className="text-xs text-gray-500 uppercase font-semibold tracking-wide bg-gray-100 px-2 py-0.5 rounded w-fit mt-1">
                        {q.module}
                      </span>
                   </div>
                </td>
                
                {/* 2. Correct Answer */}
                <td className="py-4 px-6 align-middle text-gray-800 font-medium">
                  {q.correctAnswer}
                </td>
                
                {/* 3. Your Answer */}
                <td className="py-4 px-6 align-middle">
                  {q.userAnswer ? (
                    <span className={`font-bold px-2 py-1 rounded ${
                        q.isCorrect 
                        ? "text-green-700 bg-green-50 border border-green-200" 
                        : "text-red-700 bg-red-50 border border-red-200"
                    }`}>
                      {q.userAnswer}
                    </span>
                  ) : (
                    <span className="text-red-800/60 italic border border-dashed border-red-200 px-2 py-1 rounded bg-red-50/30">
                        Omitted
                    </span>
                  )}
                </td>
                
                {/* 4. Actions */}
                <td className="py-4 px-6 align-middle text-center">
                   <button 
                     onClick={() => onReview(q.id)}
                     className="border border-gray-300 text-gray-600 rounded-full px-5 py-1.5 text-sm font-semibold hover:bg-gray-800 hover:text-white transition-all shadow-sm"
                   >
                     Review
                   </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ScoreReport;