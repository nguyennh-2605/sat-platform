import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, LogOut } from 'lucide-react';
import RecallChallenge from './pages/RecallChallenge';

function Dashboard() {
  const navigate = useNavigate();
  // State tab
  const [activeTab, setActiveTab] = useState('practice');
  const [user, setUser] = useState({ name: '', avatar: '' });

  // --- STATE MỚI ĐỂ LƯU DỮ LIỆU TỪ API ---
  const [tests, setTests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // --- GỌI API KHI COMPONENT LOAD ---
  useEffect(() => {
    const userId = localStorage.getItem('userId');

    // Tạo URL: Nếu có userId thì kẹp thêm vào đuôi
    const url = userId ? `${import.meta.env.VITE_API_URL}/api/tests?userId=${userId}` : `${import.meta.env.VITE_API_URL}/api/tests`
    const name = localStorage.getItem('userName') || 'Student';
    const avatar = localStorage.getItem('userAvatar');
    setUser({ name: name, avatar: avatar || '' });

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

  return (
    <div className="flex h-screen bg-gray-50 font-sans">
      
      {/* --- SIDEBAR BÊN TRÁI (GIỮ NGUYÊN) --- */}
      <aside className="w-64 bg-white border-r border-gray-200 flex flex-col">
        {/* Logo khu vực Dashboard */}
        <div className="p-6 border-b border-gray-100 flex items-center gap-2 cursor-pointer" onClick={() => navigate('/')}>
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold">S</div>
          <span className="text-xl font-bold text-slate-800">SAT Master</span>
        </div>

        {/* Menu Items */}
        <nav className="flex-1 p-4 space-y-2">
          
          {/* Mục 1: Practice Test */}
          <button
            onClick={() => setActiveTab('practice')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
              activeTab === 'practice' 
                ? 'bg-blue-50 text-blue-700 font-semibold' 
                : 'text-slate-600 hover:bg-gray-100'
            }`}
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
            </svg>
            Practice Test
          </button>

          {/* Mục 2: Vocabulary */}
          <button
            onClick={() => setActiveTab('vocab')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
              activeTab === 'vocab' 
                ? 'bg-blue-50 text-blue-700 font-semibold' 
                : 'text-slate-600 hover:bg-gray-100'
            }`}
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
            Vocabulary
          </button>

          {/* Mục 3: Homework */}
          <button
            onClick={() => setActiveTab('homework')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
              activeTab === 'homework' 
                ? 'bg-blue-50 text-blue-700 font-semibold' 
                : 'text-slate-600 hover:bg-gray-100'
            }`}
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            Homework
          </button>
          {/* Mục 4: Active Recall (Mới) */}
          <button
            onClick={() => setActiveTab('recall')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
              activeTab === 'recall' 
                ? 'bg-blue-50 text-blue-700 font-semibold' 
                : 'text-slate-600 hover:bg-gray-100'
            }`}
          >
            {/* Icon: Trí tuệ / Bóng đèn sáng */}
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3M3.343 15.657l.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
            Active Recall
          </button>
        </nav>

        {/* User Profile & Logout */}
        <div className="p-4 border-t border-gray-200 flex items-center justify-center">
            <div className="flex items-center gap-4">
              {/* 1. Thông tin Tên & Vai trò (Đẩy sang trái) */}
              <div className="hidden md:block text-left">
                <p className="text-sm font-bold text-gray-900 whitespace-nowrap truncate max-w-[150px]">
                  {user.name}
                </p>
                <p className="text-xs text-gray-500">
                  Học viên
                </p>
              </div>

              {/* 2. Avatar & Nút Logout (Gom lại 1 cụm bên phải) */}
              <div className="flex items-center gap-2 pl-0 pr-0 bg-gray-50 rounded-full border border-gray-100">
                {/* Avatar hình tròn */}
                <div className="relative h-9 w-9 rounded-full overflow-hidden border-2 border-white shadow-sm">
                  {user.avatar ? (
                    <img 
                      src={user.avatar} 
                      alt="Avatar" 
                      className="h-full w-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="h-full w-full bg-blue-100 flex items-center justify-center text-blue-600">
                      <User size={18} />
                    </div>
                  )}
                </div>

                {/* 3. Nút Icon Đăng xuất */}
                <button 
                  onClick={handleLogout}
                  className="group p-1 rounded-full hover:bg-red-50 transition-colors mr-1"
                  title="Đăng xuất" // Hiện chữ khi di chuột vào
                >
                  {/* Icon LogOut màu xám, hover vào chuyển màu đỏ */}
                  <LogOut size={18} className="text-gray-400 group-hover:text-red-600 transition-colors" />
                </button>
              </div>
            </div>
        </div>
      </aside>


      {/* --- NỘI DUNG BÊN PHẢI (MAIN CONTENT) --- */}
      <main className="flex-1 overflow-y-auto p-8">
        
        {/* NỘI DUNG TAB: PRACTICE TEST */}
        {activeTab === 'practice' && (
          <div className="space-y-6">
            <h2 className="text-3xl font-bold text-slate-800">Thư viện đề thi</h2>
            <p className="text-slate-600">Chọn một bài thi để bắt đầu luyện tập.</p>
            
            {/* Hiển thị Loading hoặc Grid danh sách */}
            {loading ? (
              <div className="text-center py-10 text-slate-500">⏳ Đang tải danh sách đề thi...</div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-6">
                
                {/* --- RENDER LIST TỪ API --- */}
                {tests.map((test, index) => (
                  <div key={test.id} className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition">
                    <div className="h-12 w-12 bg-blue-100 rounded-lg flex items-center justify-center text-blue-600 mb-4">
                      <span className="font-bold text-xl">{index + 1}</span>
                    </div>
                    <h3 className="text-lg font-bold text-slate-800 mb-2">{test.title}</h3>
                    <div className="flex gap-2 text-sm text-slate-500 mb-4">
                      <span>⏱ {Math.floor(test.duration)} phút</span>
                      <span>•</span>
                      <span>{test.description || "Reading & Math"}</span>
                    </div>
                    <button 
                      onClick={() => handleStartExam(test)} 
                      className={`w-full py-2 text-white rounded-lg font-medium transition ${
                        test.isDoing
                          ? "bg-yellow-500 hover:bg-yellow-600"
                          : "bg-blue-600 hover:bg-blue-700"   
                      }`}
                    >
                      {/* Kiểm tra: Nếu backend trả về isDoing = true thì hiện chữ khác */}
                      {test.isDoing ? "Tiếp tục làm bài" : "Làm bài ngay"}
                    </button>
                  </div>
                ))}

                {/* Nếu không có bài thi nào */}
                {tests.length === 0 && (
                  <div className="col-span-3 text-center py-10 text-gray-400 italic">
                    Chưa có bài thi nào trong hệ thống.
                  </div>
                )}
                
              </div>
            )}
          </div>
        )}

        {/* NỘI DUNG TAB: VOCABULARY (GIỮ NGUYÊN) */}
        {activeTab === 'vocab' && (
          <div className="space-y-6">
            <h2 className="text-3xl font-bold text-slate-800">Từ vựng (Vocabulary)</h2>
            <div className="p-10 text-center bg-white rounded-xl border border-dashed border-gray-300">
               <p className="text-slate-500">Tính năng đang được phát triển...</p>
            </div>
          </div>
        )}

        {/* NỘI DUNG TAB: HOMEWORK (GIỮ NGUYÊN) */}
        {activeTab === 'homework' && (
          <div className="space-y-6">
             <h2 className="text-3xl font-bold text-slate-800">Bài tập về nhà (Homework)</h2>
             <div className="p-10 text-center bg-white rounded-xl border border-dashed border-gray-300">
               <p className="text-slate-500">Chưa có bài tập nào được giao.</p>
            </div>
          </div>
        )}

        {/* NỘI DUNG TAB: ACTIVE RECALL */}
        {activeTab === 'recall' && (
          <div className="h-full">
            {/* Vì RecallChallenge đã có giao diện hoàn chỉnh, ta chỉ cần gọi nó ra */}
            <RecallChallenge />
          </div>
        )}

      </main>
    </div>
  );
}

export default Dashboard;