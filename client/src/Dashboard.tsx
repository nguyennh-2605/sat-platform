import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  User, LogOut, Plus, BookOpen, 
  BrainCircuit, Layout, GraduationCap, 
  Clock, ChevronRight, Search 
} from 'lucide-react';
import RecallChallenge from './pages/LogicLab';
import HomeworkModule from './pages/HomeworkModule';
import CreateTestWizard from './components/CreateTestWizard';

function Dashboard() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('practice');
  const [user, setUser] = useState({ name: '', avatar: '', role: '' });
  const [tests, setTests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);

  // --- LOGIC GIỮ NGUYÊN ---
  useEffect(() => {
    const userId = localStorage.getItem('userId');
    const url = userId ? `${import.meta.env.VITE_API_URL}/api/tests?userId=${userId}` : `${import.meta.env.VITE_API_URL}/api/tests`
    const name = localStorage.getItem('userName') || 'Student';
    const avatar = localStorage.getItem('userAvatar');
    const role = localStorage.getItem('userRole');
    setUser({ name: name, avatar: avatar || '',  role: role || 'STUDENT'});

    fetch(url)
      .then(res => res.json())
      .then(data => {
        setTests(data);
        setLoading(false);
      })
      .catch(err => {
        console.error("Lỗi tải danh sách bài thi:", err);
        setLoading(false);
      });
  }, []);

  const handleLogout = () => {
    localStorage.clear();
    navigate('/');
  };

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

  // Component Menu Item nhỏ gọn để tái sử dụng
  const MenuItem = ({ id, label, icon: Icon }: any) => (
    <button
      onClick={() => setActiveTab(id)}
      className={`group w-full flex items-center gap-3 px-4 py-3.5 rounded-xl transition-all duration-200 font-medium ${
        activeTab === id 
          ? 'bg-blue-600 text-white shadow-lg shadow-blue-200' 
          : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'
      }`}
    >
      <Icon size={20} className={activeTab === id ? 'text-white' : 'text-slate-400 group-hover:text-slate-600'} />
      <span>{label}</span>
      {activeTab === id && <ChevronRight size={16} className="ml-auto opacity-50" />}
    </button>
  );

  return (
    <div className="flex h-screen bg-[#F8FAFC] font-sans overflow-hidden">
      
      {/* --- SIDEBAR HIỆN ĐẠI --- */}
      <aside className="w-72 bg-white border-r border-slate-200 flex flex-col shadow-sm z-10">
        {/* Logo */}
        <div className="p-8 pb-4">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate('/')}>
            <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center text-white shadow-md">
              <BookOpen size={20} strokeWidth={3} />
            </div>
            <div>
              <h1 className="text-xl font-extrabold text-slate-800 tracking-tight">SAT Master</h1>
              <p className="text-xs text-slate-400 font-medium">Luyện thi thông minh</p>
            </div>
          </div>
        </div>

        {/* Menu Navigation */}
        <nav className="flex-1 px-4 py-6 space-y-2">
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4 px-4">Menu</div>
          <MenuItem id="practice" label="Practice Test" icon={Layout} />
          <MenuItem id="homework" label="Homework" icon={GraduationCap} />
          <MenuItem id="vocab" label="Vocabulary" icon={BookOpen} />
          <MenuItem id="recall" label="Logic Lab" icon={BrainCircuit} />
        </nav>

        {/* User Profile Card */}
        <div className="p-4 border-t border-slate-100">
          <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100">
            <div className="relative h-10 w-10 min-w-[2.5rem] rounded-full overflow-hidden border border-white shadow-sm">
              {user.avatar ? (
                <img src={user.avatar} alt="Avatar" className="h-full w-full object-cover" />
              ) : (
                <div className="h-full w-full bg-indigo-100 flex items-center justify-center text-indigo-600">
                  <User size={20} />
                </div>
              )}
            </div>
            <div className="flex-1 overflow-hidden">
              <p className="text-sm font-bold text-slate-800 truncate">{user.name}</p>
              <p className="text-xs text-slate-500 truncate">{user.role === 'STUDENT' ? "Học viên" : "Giáo viên"}</p>
            </div>
            <button 
              onClick={handleLogout}
              className="p-2 rounded-lg hover:bg-white hover:text-red-500 hover:shadow-sm text-slate-400 transition-all"
              title="Đăng xuất"
            >
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </aside>

      {/* --- MAIN CONTENT --- */}
      <main className="flex-1 overflow-y-auto relative scroll-smooth">
        {/* Header Background Decoration */}
        <div className="absolute top-0 left-0 w-full h-64 bg-gradient-to-b from-blue-50/50 to-transparent pointer-events-none" />

        <div className="max-w-7xl mx-auto p-8 relative">
          
          {/* TAB: PRACTICE TEST */}
          {activeTab === 'practice' && (
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
                        {/* 2. Góc phải: Thời gian + Explanation */}
                        <div className="flex flex-col items-end gap-1.5">
                          {/* Thời gian */}
                          <div className="flex items-center gap-1.5 text-slate-500 text-xs font-semibold bg-slate-50 px-2 py-1 rounded-md border border-slate-100">
                            <Clock size={12} className="text-slate-400"/>
                            <span>{Math.floor(test.duration)} phút</span>
                          </div>
                          
                          {/* Bạn có thể thay true bằng test.hasExplanation nếu backend có trả về */}
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
            </div>
          )}

          {/* CÁC TAB KHÁC GIỮ NGUYÊN WRAPPER ĐỂ ĐỒNG BỘ STYLE */}
          {activeTab === 'vocab' && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
               <h2 className="text-3xl font-extrabold text-slate-800 mb-6">Kho Từ Vựng</h2>
               <div className="bg-white rounded-3xl p-12 text-center shadow-sm border border-slate-200">
                  <div className="inline-flex bg-indigo-50 p-6 rounded-full mb-6">
                    <BookOpen size={48} className="text-indigo-500" />
                  </div>
                  <h3 className="text-xl font-bold text-slate-800">Tính năng đang phát triển</h3>
                  <p className="text-slate-500 mt-2">Chúng tôi đang xây dựng bộ từ vựng SAT 3000 từ phổ biến nhất.</p>
               </div>
            </div>
          )}

          {activeTab === 'homework' && (
             <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 h-full">
               <HomeworkModule />
             </div>
          )}

          {activeTab === 'recall' && (
             <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 h-full">
               <RecallChallenge />
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
      </main>
    </div>
  );
}

export default Dashboard;