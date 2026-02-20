import { useCallback, useEffect, useState } from 'react';
import { useNavigate, Outlet, NavLink } from 'react-router-dom';
import { 
  User, LogOut, BookOpen, 
  BrainCircuit, Layout, GraduationCap, AlertCircle,
  BarChart3,
  ChevronDown,
  ChevronRight,
  Loader2,
  Plus,
  X
} from 'lucide-react';
import axiosClient from './api/axiosClient';
import toast from 'react-hot-toast';

interface ClassItem {
  id: string;
  name: string;
  teacherId?: string;
  // Thêm các trường khác nếu cần
}

function Dashboard() {
  const navigate = useNavigate();
  const [user] = useState(() => {
    const name = localStorage.getItem('userName') || 'Student';
    const avatar = localStorage.getItem('userAvatar');
    const role = localStorage.getItem('userRole');
    return { 
      name: name, 
      avatar: avatar || '', 
      role: role || 'STUDENT' 
    };
  });

  const [isClassroomOpen, setIsClassroomOpen] = useState(true);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [loading, setLoading] = useState(true); // Trạng thái đang tải
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newClassName, setNewClassName] = useState('');

  const fetchClasses = useCallback(async () => {
    const token = localStorage.getItem('token'); 
    if (!token) {
      navigate('/login');
      return;
    }

    try {
      setLoading(true);
      const data = await axiosClient.get<ClassItem[], ClassItem[]>('/api/classes');
      setClasses(data); // Lưu dữ liệu vào state
    } catch (error) {
      console.error("Lỗi tải lớp học:", error);
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  useEffect(() => {
    fetchClasses();
  }, [fetchClasses]);

  const handleLogout = () => {
    localStorage.clear();
    navigate('/');
  };

  const handleCreateClass = async (e: React.FormEvent) => {
    e.preventDefault(); // Chặn reload trang
    
    if (!newClassName.trim()) {
      alert("Tên lớp không được để trống");
      return;
    }

    try {
      setLoading(true);
      await axiosClient.post(`/api/classes`, {
        name: newClassName
      });

      toast.success("Tạo lớp thành công!"); // Hoặc alert("Thành công")
      setIsModalOpen(false); // Đóng modal
      setNewClassName('');   // Reset form
      
      fetchClasses();
    } catch (error: any) {
      console.error(error);
      const msg = error.response?.data?.error || "Lỗi khi tạo lớp";
      alert(msg);
    } finally {
      setLoading(false);
    }
  };

  const SidebarItem = ({ to, label, icon: Icon }: any) => (
    <NavLink
      to={to}
      className={({ isActive }) => 
        `group w-full flex items-center gap-3 px-4 py-3.5 rounded-xl transition-all duration-200 font-medium ${
          isActive 
            ? 'bg-blue-700 text-white shadow-lg' 
            : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'
        }`
      }
    >
      {({ isActive }) => (
        <>
          <Icon size={20} className={isActive ? 'text-white' : 'text-slate-400 group-hover:text-slate-600'} />
          <span>{label}</span>
        </>
      )}
    </NavLink>
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
          <SidebarItem to="/dashboard/practice-test" label="Practice Test" icon={Layout} />
          <SidebarItem to="/dashboard/error-log" label="Error Log" icon={AlertCircle} />
          <SidebarItem to="/dashboard/logic-lab" label="Logic Lab" icon={BrainCircuit} />
          <SidebarItem to="/dashboard/results-analytics" label="Results & Analytics" icon={BarChart3} />
          {/* <SidebarItem to="/dashboard/homework" label="Classroom" icon={GraduationCap} /> */}
          <div className="py-1">
            {/* 1. Item Cha (Classroom) - Click để đóng mở */}
            <div 
              className={`group flex items-center gap-3 px-4 py-3 rounded-xl cursor-pointer transition-all duration-200 font-medium ${
                 // Kiểm tra xem có đang ở trong trang con nào của Classroom không để highlight item cha
                 location.pathname.includes('/class') ? 'text-blue-700 bg-blue-50' : 'text-slate-500 hover:bg-slate-50'
              }`}
              onClick={() => setIsClassroomOpen(!isClassroomOpen)}
            >
              <GraduationCap size={20} className={location.pathname.includes('/class') ? 'text-blue-600' : 'text-slate-400'} />
              <span className="flex-1">Classroom</span>
              {/* Icon mũi tên xoay */}
              {isClassroomOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            </div>

            {/* 2. List Item Con (Danh sách lớp) - Hiệu ứng Tree View */}
            {isClassroomOpen && (
              <div className="ml-9 pl-4 border-l-2 border-slate-100 space-y-1 mt-1">
                {loading ? (
                   <div className="py-2 px-3 text-sm text-slate-400 flex items-center gap-2">
                     <Loader2 size={14} className="animate-spin" /> Đang tải lớp...
                   </div>
                ) : (
                  // 2. Có dữ liệu: Map qua mảng classes
                  classes.map((cls) => (
                    <NavLink
                      key={cls.id}
                      to={`/dashboard/class/${cls.id}`}
                      className={({ isActive }) => 
                        `block py-2 px-3 rounded-lg text-sm transition-all truncate ${
                          isActive 
                            ? 'text-blue-700 font-semibold bg-blue-50' 
                            : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
                        }`
                      }
                      title={cls.name} // Hover vào sẽ hiện tên đầy đủ nếu bị cắt
                    >
                      {cls.name}
                    </NavLink>
                  ))
                )}
                {(user.role === 'TEACHER' || user.role === 'ADMIN') && (
                  <div 
                    className="mt-2 mx-3 py-2 px-3 flex items-center gap-2 text-xs font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg cursor-pointer transition-colors border border-blue-200 border-dashed"
                    onClick={() => setIsModalOpen(true)}
                  >
                    <Plus size={14} />
                    <span>Tạo lớp học mới</span>
                  </div>
                )}
              </div>
            )}
          </div>
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
              <p className="text-xs text-slate-500 truncate">{user.role === 'STUDENT' ? "Học viên" : user.role === 'TEACHER' ? 'Giáo viên' : 'Admin'}</p>
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
          <Outlet />
        </div>
      </main>
      {/* --- MODAL TẠO LỚP HỌC --- */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            
            {/* Header Modal */}
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <h3 className="font-bold text-lg text-slate-800">Tạo lớp học mới</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-red-500 transition-colors">
                <X size={20} />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleCreateClass} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Tên lớp học <span className="text-red-500">*</span></label>
                <input 
                  type="text" 
                  value={newClassName}
                  onChange={(e) => setNewClassName(e.target.value)}
                  placeholder="VD: SAT Math - K15"
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                  autoFocus
                />
              </div>

              {/* Footer Buttons */}
              <div className="flex justify-end gap-3 pt-2">
                <button 
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  Hủy bỏ
                </button>
                <button 
                  type="submit" 
                  disabled={loading}
                  className="px-4 py-2 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-md hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {loading ? 'Đang tạo...' : 'Tạo lớp ngay'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default Dashboard;