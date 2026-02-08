import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { type ContentBlock } from './types/quiz';
import { CheckCircle2, BookmarkPlus, Loader2 } from 'lucide-react';
import ReviewModal from './components/ReviewModal';
import axios from 'axios';
import toast from 'react-hot-toast';

const API_URL = import.meta.env.VITE_API_URL;

// 1. Cập nhật Interface dữ liệu đầu vào
export interface QuestionResult {
  id: number | string;
  module: string;           // VD: "Module 1"
  questionNumber: number;   // VD: 5 (Số thứ tự trong module đó)
  blocks: ContentBlock[];
  questionText: string;
  choices: {
    id: string;
    text: string;
    label?: string
  }[];
  correctAnswer: string;
  userAnswer: string | null;
  isCorrect: boolean;
}

interface ScoreReportProps {
  initialData?: {
    examTitle: string;
    subject: string;
    date: string;
    duration: string;
    questions: QuestionResult[];
  }
  onBackToHome?: () => void;
}

const ScoreReport: React.FC<ScoreReportProps> = ({ initialData, onBackToHome }) => {
  const navigate = useNavigate();
  const location = useLocation();

  const [data, setData] = useState(initialData || null);
  const [loading, setLoading] = useState(!initialData);
  const [reviewingQuestion, setReviewingQuestion] = useState<QuestionResult | null>(null);
  const [addedQuestions, setAddedQuestions] = useState<Set<number | string>>(new Set());

  const resultIdFromState = location.state?.resultId;

  useEffect(() => {
    // Nếu ĐÃ CÓ dữ liệu từ props (từ ExamRoom truyền sang), thì KHÔNG gọi API nữa
    if (initialData) {
      return;
    }
    // Nếu KHÔNG có props, thì mới đi gọi API (trường hợp xem từ Dashboard)
    const fetchDetail = async () => {
      if (!resultIdFromState) return;

      try {
        setLoading(true);
        const token = localStorage.getItem('token');
        const res = await axios.get(`${import.meta.env.VITE_API_URL}/api/results-analytics/submission/${resultIdFromState}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        // Map dữ liệu API vào state
        setData({
          examTitle: res.data.examTitle,
          subject: res.data.subject,
          date: res.data.date, // Nhớ format ngày
          duration: res.data.duration,
          questions: res.data.questions
        });
      } catch (error) {
        console.error("Lỗi:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchDetail();
  }, [initialData, resultIdFromState]);

  const handleBack = () => {
    if (onBackToHome) {
      onBackToHome(); // Ưu tiên dùng hàm props truyền vào (logic xóa localStorage của ExamRoom)
    } else {
      navigate('/dashboard/results-analytics'); // Mặc định quay về dashboard
    }
  };

  if (loading) return <div className="flex justify-center p-10"><Loader2 className="animate-spin"/></div>;
  if (!data) return <div>Không tìm thấy dữ liệu</div>;

  const handleAddToErrorLog = async (q: QuestionResult) => {
    if (addedQuestions.has(q.id)) return;

    try {
      const token = localStorage.getItem('token');
      
      const payload = {
        source: `${data.examTitle}`, 
        userAnswer: q.userAnswer || 'Omitted',
        category: 'General',
        correctAnswer: q.correctAnswer,
        whyWrong: '', 
        whyRight: ''
      };

      const response = await axios.post(
        `${API_URL}/api/error-logs`, 
        payload, 
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (response.status === 201 || response.status === 200) {
        toast.success(`Đã thêm Câu ${q.questionNumber} vào Error Log!`);
        setAddedQuestions(prev => new Set(prev).add(q.id));
      }
    } catch (error) {
      console.error("Error adding to log:", error);
      toast.error("Không thể thêm vào Error Log!");
    }
  };

  const totalQuestions = data.questions.length;
  const correctCount = data.questions.filter(q => q.isCorrect).length;
  const incorrectCount = totalQuestions - correctCount;

  return (
    <div className="max-w-5xl mx-auto p-8 bg-white font-sans text-gray-800 min-h-screen">
      {/*  HEADER SECTION */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        
        {/* Bên trái: Thông tin bài thi */}
        <div>
          <div className="flex items-center gap-3 mb-2">
            <span className="bg-blue-100 text-blue-700 text-xs font-bold px-2.5 py-0.5 rounded border border-blue-200 uppercase tracking-wide">
              Result
            </span>
            <h2 className="text-xl md:text-2xl font-bold text-gray-900 leading-tight">
              {data.examTitle}
            </h2>
          </div>

          <div className="text-gray-500 text-sm flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 mt-1">
            {/* Subject */}
            <div className="flex items-center gap-1.5 font-medium text-gray-700">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-500"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/></svg>
              {data.subject}
            </div>

            <span className="hidden sm:inline-block w-1 h-1 bg-gray-300 rounded-full"></span>

            {/* Date */}
            <div className="flex items-center gap-1.5">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
              {data.date}
            </div>

            <span className="hidden sm:inline-block w-1 h-1 bg-gray-300 rounded-full"></span>

            {/* Duration */}
            <div className="flex items-center gap-1.5">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
              Time Used: <span className="font-semibold text-gray-700">{data.duration}</span>
            </div>
          </div>
        </div>

        {/* Bên phải: Nút bấm */}
        <div>
          <button 
            onClick={() => handleBack()}
            className="group flex items-center gap-2 px-5 py-2.5 bg-gray-900 text-white font-medium text-sm rounded-lg hover:bg-gray-800 transition-all shadow-md hover:shadow-lg active:scale-95"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="group-hover:-translate-x-1 transition-transform">
              <line x1="19" y1="12" x2="5" y2="12"></line>
              <polyline points="12 19 5 12 12 5"></polyline>
            </svg>
            Back
          </button>
        </div>
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
            {data.questions.map((q) => (
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
                  <div className="flex gap-2 justify-center items-center">
                    <button 
                      onClick={() => setReviewingQuestion(q)}
                      className="border border-slate-200 text-slate-600 rounded-lg px-3 py-1.5 text-xs font-semibold hover:bg-slate-800 hover:text-white transition-all"
                    >
                      Review
                    </button>
                    <button 
                      onClick={() => handleAddToErrorLog(q)}
                      disabled={addedQuestions.has(q.id)}
                      title={addedQuestions.has(q.id) ? "Đã thêm vào log" : "Thêm vào Error Log để ôn tập"} 
                      className={`
                        flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border shadow-sm
                        ${addedQuestions.has(q.id)
                          ? "bg-emerald-50 text-emerald-600 border-emerald-100 cursor-default" // Style khi đã add
                          : "bg-white text-slate-500 border-slate-200 hover:border-indigo-200 hover:text-indigo-600 hover:bg-indigo-50" // Style mặc định
                        }
                      `}
                    >
                      {addedQuestions.has(q.id) ? (
                          <>
                            <CheckCircle2 size={14} /> <span>Saved</span>
                          </>
                      ) : (
                          <>
                            <BookmarkPlus size={14} /> <span>Log</span>
                          </>
                      )}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {reviewingQuestion && (
        <ReviewModal 
          data={reviewingQuestion} 
          onClose={() => setReviewingQuestion(null)} // Đóng modal thì set về null
        />
      )}
    </div>
  );
};

export default ScoreReport;