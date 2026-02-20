import { useState, useMemo, useEffect } from 'react';
import { 
  ClipboardList, ArrowLeft, 
  ChevronLeft, ChevronRight, Users, 
  Eye, EyeOff
} from 'lucide-react';
import axiosClient from '../api/axiosClient';

// --- INTERFACES ---
interface ExamItem {
  id: number;
  title: string;
  date: string;
  submissionCount: number;
}

interface StudentStat {
  key: string;
  count: number;
  students: string[];
}

interface QuestionReport {
  id: number;
  correctChoice: string;
  stats: StudentStat[];
}

interface LeaderboardItem {
  id: number;
  name: string;
  score: number;
  time: string;
}

interface ReportResponse {
  leaderboard: LeaderboardItem[]; 
  questions: QuestionReport[];
}

const StudentAnalytics = ({ classId }: { classId?: string }) => {
  const [selectedTestId, setSelectedTestId] = useState<number | null>(null);
  const [examList, setExamList] = useState<ExamItem[]>([]);

  useEffect(() => {
    const fetchExams = async () => {
      if (!classId) return;
      try {
        const data = await axiosClient.get<ExamItem[], ExamItem[]>('/api/classes/list', {
          params: { classId }
        });
        setExamList(data);
      } catch (error) {
        console.error("Lỗi tải danh sách bài thi:", error);
      }
    };
    fetchExams();
  }, [classId]);

  // VIEW 1: DANH SÁCH BÀI THI
  if (!selectedTestId) {
    return (
      <div className="max-w-4xl mx-auto pt-4">
        <h2 className="text-xl font-bold text-gray-800 mb-6 px-2">Bài tập & Kiểm tra</h2>
        <div className="space-y-4">
          {examList.length === 0 ? (
             <div className="text-center text-gray-500 py-8">Chưa có bài kiểm tra nào.</div>
          ) : (
            examList.map((exam) => (
              <div 
                key={exam.id} onClick={() => setSelectedTestId(exam.id)}
                className="group flex items-center gap-4 bg-[#F0F2F5] hover:bg-[#E4E6E9] p-4 rounded-xl cursor-pointer transition-colors"
              >
                <div className="h-10 w-10 rounded-full bg-[#E37400] flex items-center justify-center text-white shadow-sm shrink-0">
                  <ClipboardList size={20} strokeWidth={2.5} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-gray-900 truncate text-[15px]">{exam.title}</div>
                  <div className="text-[13px] text-gray-500 mt-0.5 font-medium">{exam.date}</div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    );
  }

  // VIEW 2: CHI TIẾT BÁO CÁO
  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-300 h-full flex flex-col">
      <div className="flex items-center gap-4 mb-4 pb-4 border-b border-gray-100">
        <button 
            onClick={() => setSelectedTestId(null)} 
            className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-600"
        >
          <ArrowLeft size={24}/>
        </button>
        <div>
          <h2 className="text-xl font-bold text-gray-800">Chi tiết thống kê</h2>
        </div>
      </div>
      <DetailedScoreReport testId={selectedTestId} />
    </div>
  );
};

const DetailedScoreReport = ({ testId }: { testId: number }) => {
  const [leaderboard, setLeaderboard] = useState<LeaderboardItem[]>([]);
  const [questions, setQuestions] = useState<QuestionReport[]>([]);
  
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5; 

  useEffect(() => {
    const fetchReport = async () => {
      try {
        const data = await axiosClient.get<ReportResponse, ReportResponse>(`/api/classes/${testId}/report`);
        
        // Đảm bảo dữ liệu là mảng để tránh lỗi map
        setLeaderboard(Array.isArray(data.leaderboard) ? data.leaderboard : []);
        setQuestions(Array.isArray(data.questions) ? data.questions : []);
        
      } catch (error) {
        console.error("Lỗi tải báo cáo:", error);
      }
    };
    if (testId) fetchReport();
  }, [testId]);

  const totalPages = Math.max(1, Math.ceil(questions.length / itemsPerPage));
  
  const currentQuestions = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return questions.slice(start, start + itemsPerPage);
  }, [questions, currentPage]);

  return (
    <div className="flex flex-col lg:flex-row gap-6 flex-1 min-h-0">
      {/* CỘT TRÁI: LIST CÂU HỎI */}
      <div className="flex-1 flex flex-col bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden min-h-[500px]">
        <div className="flex-1 overflow-y-auto p-4 space-y-6 bg-gray-50/30 custom-scrollbar">
          {currentQuestions.map((q, index) => {
            // Tính số thứ tự thực tế (VD: Trang 2 bắt đầu từ câu 6)
            const realIndex = (currentPage - 1) * itemsPerPage + index + 1;
            return (
                <QuestionAnalyticsItem 
                    key={q.id} 
                    question={q} 
                    index={realIndex} 
                />
            );
          })}
          {currentQuestions.length === 0 && (
              <p className="text-center text-gray-400 mt-10">Đang tải dữ liệu hoặc không có câu hỏi...</p>
          )}
        </div>
        
        {/* Pagination */}
        {questions.length > 0 && (
            <div className="p-3 border-t border-gray-100 bg-white flex justify-between items-center">
                <button disabled={currentPage === 1} onClick={() => setCurrentPage(c => c - 1)} className="p-2 hover:bg-gray-100 rounded-lg disabled:opacity-30 transition-all">
                <ChevronLeft size={20}/>
                </button>
                <span className="text-sm font-bold text-gray-600">Trang {currentPage}/{totalPages}</span>
                <button disabled={currentPage === totalPages} onClick={() => setCurrentPage(c => c + 1)} className="p-2 hover:bg-gray-100 rounded-lg disabled:opacity-30 transition-all">
                <ChevronRight size={20}/>
                </button>
            </div>
        )}
      </div>

      {/* CỘT PHẢI: RANKING */}
      <div className="w-full lg:w-72 flex flex-col bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden h-fit max-h-full">
        <div className="p-3 bg-yellow-50/50 border-b border-gray-100 font-bold text-gray-700 flex items-center gap-2">
            <Users size={16} className="text-yellow-600"/> Bảng xếp hạng
        </div>
        <div className="overflow-y-auto max-h-[500px] custom-scrollbar">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-white shadow-sm text-xs text-gray-400 z-10">
               <tr><th className="p-2 text-left pl-4">HS</th><th className="p-2 text-right pr-4">Điểm</th></tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {leaderboard.map((st, idx) => (
                <tr key={st.id} className="hover:bg-gray-50 transition-colors">
                  <td className="p-2 pl-4">
                    <div className="font-medium text-gray-700 truncate w-32" title={st.name}>{st.name}</div>
                  </td>
                  <td className={`p-2 pr-4 text-right font-bold ${idx < 3 ? 'text-yellow-600' : 'text-gray-600'}`}>
                    {st.score}
                  </td>
                </tr>
              ))}
              {leaderboard.length === 0 && (
                  <tr><td colSpan={2} className="p-4 text-center text-gray-400 text-xs">Chưa có dữ liệu</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

const QuestionAnalyticsItem = ({ question, index }: { question: QuestionReport, index: number }) => {
  // State lưu key của đáp án đang mở 
  const [expandedChoice, setExpandedChoice] = useState<string | null>(null);

  const toggleExpand = (choiceKey: string) => {
    setExpandedChoice(prev => prev === choiceKey ? null : choiceKey);
  };

  // Tính tổng số phiếu trả lời cho câu này để tính %
  const totalVotes = question.stats.reduce((acc, curr) => acc + curr.count, 0);

  return (
    <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm transition-all hover:shadow-md">
      {/* Header câu hỏi */}
      <div className="flex items-center gap-3 mb-4">
        <div className="bg-indigo-100 text-indigo-700 font-bold px-3 py-1 rounded-lg text-sm">
          Câu {index}
        </div>
        <div className="text-xs text-gray-400 font-medium">
          Đáp án đúng: <span className="text-green-600 font-bold text-sm">{question.correctChoice}</span>
        </div>
      </div>

      {/* Danh sách 4 thanh Bar (A, B, C, D) */}
      <div className="space-y-3">
        {question.stats.map((stat) => {
          const isCorrect = stat.key === question.correctChoice;
          const percent = totalVotes > 0 ? Math.round((stat.count / totalVotes) * 100) : 0;
          const hasStudents = stat.students && stat.students.length > 0;
          const isExpanded = expandedChoice === stat.key;

          return (
            <div key={stat.key} className="relative">
              <div className="flex items-center gap-3">
                {/* Label A/B/C/D */}
                <div className={`w-8 h-8 flex items-center justify-center rounded-full font-bold text-sm shrink-0 border transition-colors ${
                  isCorrect 
                    ? 'bg-green-100 text-green-700 border-green-200' 
                    : 'bg-gray-50 text-gray-500 border-gray-200'
                }`}>
                  {stat.key}
                </div>

                {/* Progress Bar */}
                <div className="flex-1 h-8 bg-gray-50 rounded-lg relative overflow-hidden flex items-center px-3 border border-gray-100">
                  <div 
                    className={`absolute top-0 left-0 h-full transition-all duration-500 ease-out ${isCorrect ? 'bg-green-100' : 'bg-indigo-50'}`} 
                    style={{ width: `${percent}%` }}
                  />
                  <div className="relative z-10 flex justify-between w-full text-sm">
                    <span className={`font-medium ${isCorrect ? 'text-green-800' : 'text-gray-700'}`}>
                      {stat.count} học sinh
                    </span>
                    <span className="text-gray-400 text-xs mt-0.5">{percent}%</span>
                  </div>
                </div>

                {/* Button Toggle (Con mắt) */}
                <button
                  onClick={() => toggleExpand(stat.key)}
                  disabled={!hasStudents}
                  className={`p-2 rounded-lg transition-all shrink-0 border ${
                    isExpanded 
                      ? 'bg-indigo-100 text-indigo-600 border-indigo-200' 
                      : hasStudents 
                        ? 'bg-white text-gray-400 hover:text-indigo-600 hover:border-indigo-200 border-gray-200' 
                        : 'bg-gray-50 text-gray-300 border-gray-100 cursor-not-allowed'
                  }`}
                  title={hasStudents ? "Xem danh sách" : "Không có ai chọn"}
                >
                  {isExpanded ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>

              {/* Danh sách học sinh (Accordion) */}
              {isExpanded && hasStudents && (
                <div className="mt-2 ml-11 p-3 bg-gray-50 rounded-lg border border-gray-100 animate-in fade-in slide-in-from-top-1 duration-200">
                   <div className="text-xs font-bold text-gray-400 uppercase mb-2">
                      Danh sách chọn {stat.key}:
                   </div>
                   <div className="flex flex-wrap gap-2">
                     {stat.students.map((name, idx) => (
                       <span key={idx} className="inline-flex items-center px-2 py-1 rounded bg-white border border-gray-200 text-xs font-medium text-gray-700 shadow-sm">
                          <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 mr-1.5"></div>
                          {name}
                       </span>
                     ))}
                   </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default StudentAnalytics;