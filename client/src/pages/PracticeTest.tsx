import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, Clock, ChevronRight, BookOpen } from 'lucide-react';
import CreateTestWizard from '../components/CreateTestWizard';
import toast from 'react-hot-toast';

const PracticeTest = () => {
  const navigate = useNavigate();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [user, setUser] = useState({ name: '', role: '' });
  const [tests, setTests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const userId = localStorage.getItem('userId');
    const url = userId ? `${import.meta.env.VITE_API_URL}/api/tests?userId=${userId}` : `${import.meta.env.VITE_API_URL}/api/tests`
    const name = localStorage.getItem('userName') || 'Student';
    const role = localStorage.getItem('userRole');
    setUser({ name: name, role: role || 'STUDENT'});

    fetch(url)
      .then(res => res.json())
      .then(data => {
        setTests(data);
        setLoading(false);
      })
      .catch(err => {
        toast.error("Lỗi tải danh sách bài thi:", err);
        setLoading(false);
      });
  }, []);

  const handleStartExam = (exam: any) => {
    const examInfo = {
      id: exam.id,
      title: exam.title,
      description: exam.description,
      duration: exam.duration
    };
    localStorage.setItem('current_exam_info', JSON.stringify(examInfo));
    navigate(`/test/${exam.id}`);
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="text-3xl font-extrabold text-slate-800 mb-2">
            Xin chào, {user.name.split(' ').pop()}! 👋
          </h2>
          <p className="text-slate-500 text-lg">Hôm nay bạn muốn luyện tập kỹ năng nào?</p>
        </div>
        
        {user.role === 'TEACHER' && (
          <button 
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 bg-slate-900 text-white px-5 py-3 rounded-xl font-semibold hover:bg-slate-800 hover:shadow-lg hover:-translate-y-0.5 transition-all"
          >
            <Plus size={20} /> 
            <span>Tạo đề thi mới</span>
          </button>
        )}
      </div>

      {/* Search / Filter Bar (Mockup UI) */}
      <div className="bg-white p-2 rounded-2xl shadow-sm border border-slate-200 flex items-center gap-2 max-w-md">
        <div className="p-2 text-slate-400">
          <Search size={20} />
        </div>
        <input 
          type="text" 
          placeholder="Tìm kiếm bài thi..." 
          className="w-full outline-none text-slate-700 placeholder-slate-400 bg-transparent"
        />
      </div>

      {/* List Cards */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 opacity-60">
          <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4"></div>
          <p className="text-slate-500 font-medium">Đang tải dữ liệu...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 gap-6">
          {tests.map((test, index) => (
            <div 
              key={test.id} 
              className="group bg-white rounded-2xl p-5 border border-slate-100 shadow-[0_2px_10px_-4px_rgba(6,81,237,0.1)] hover:shadow-[0_8px_30px_-6px_rgba(6,81,237,0.15)] hover:border-blue-100 transition-all duration-300 flex flex-col"
            >
              {/* Card Header */}
              <div className="flex justify-between items-start mb-4">
                <div className="h-12 w-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center font-bold text-lg group-hover:scale-110 group-hover:bg-blue-600 group-hover:text-white transition-all duration-300">
                  {String(index + 1).padStart(2, '0')}
                </div>
                {/* Góc phải: Thời gian + Explanation */}
                <div className="flex flex-col items-end gap-1.5">
                  {/* Thời gian */}
                  <div className="flex items-center gap-1.5 text-slate-500 text-xs font-semibold bg-slate-50 px-2 py-1 rounded-md border border-slate-100">
                    <Clock size={12} className="text-slate-400"/>
                    <span>{Math.floor(test.duration)} phút</span>
                  </div>
                  
                  {/* Explanation Tag */}
                  <div className="flex items-center gap-1 text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
                    <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></div>
                    <span>Explanations included</span>
                  </div>
                </div>
              </div>

              {/* Card Content */}
              <div className="flex-1">
                <h3 className="text-lg font-bold text-slate-800 mb-2 line-clamp-2 group-hover:text-blue-600 transition-colors">
                  {test.title}
                </h3>
                <p className="text-slate-500 text-sm mb-4 line-clamp-2">
                  {test.description || "Bài kiểm tra tổng hợp Reading & Math chuẩn SAT."}
                </p>
              </div>

              {/* Action Button */}
              <button 
                onClick={() => handleStartExam(test)} 
                className={`w-full py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all transform active:scale-95 ${
                  test.isDoing
                    ? "bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200"
                    : "bg-slate-900 text-white hover:bg-blue-600 shadow-lg shadow-slate-200 hover:shadow-blue-200"
                }`}
              >
                {test.isDoing ? "Tiếp tục bài thi" : "Bắt đầu làm bài"}
                {!test.isDoing && <ChevronRight size={18} />}
              </button>
            </div>
          ))}

          {/* Empty State */}
          {tests.length === 0 && (
            <div className="col-span-full py-20 flex flex-col items-center justify-center text-center bg-white rounded-3xl border border-dashed border-slate-300">
              <div className="bg-slate-50 p-4 rounded-full mb-4">
                <BookOpen size={32} className="text-slate-300" />
              </div>
              <h3 className="text-lg font-bold text-slate-700">Chưa có đề thi nào</h3>
              <p className="text-slate-500 max-w-xs mx-auto mt-2">Hiện tại hệ thống chưa có đề thi nào khả dụng. Vui lòng quay lại sau.</p>
            </div>
          )}
        </div>
      )}
      {/* WIZARD MODAL */}
        {showCreateModal && (
          <CreateTestWizard 
            onClose={() => setShowCreateModal(false)}
            onUploadSuccess={() => {
              window.location.reload(); // Reload đơn giản để cập nhật data
            }}
          />
        )}
    </div>
  );
};

export default PracticeTest;

