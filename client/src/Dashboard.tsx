import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, Outlet, NavLink, useLocation } from 'react-router-dom';
import { 
  User, LogOut, BookOpen, 
  BrainCircuit, Layout, GraduationCap, AlertCircle,
  BarChart3,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  Plus,
  X
} from 'lucide-react';
import axiosClient from './api/axiosClient';
import toast from 'react-hot-toast';
import Ripple from './components/RippleButton';

interface ClassItem {
  id: string;
  name: string;
  teacherId?: string;
}

let globalClassesCache: ClassItem[] | null = null;

const SidebarItem = ({ to, label, icon: Icon, isSidebarCollapsed }: any) => (
  <NavLink
    to={to}
    className={({ isActive }) => 
      `group relative flex items-center ${isSidebarCollapsed ? 'justify-center px-0' : 'px-3'} py-2.5 rounded-full transition-all duration-300 font-medium ${
        isActive 
          ? 'bg-slate-900 text-white shadow-md' 
          : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'
      }`
    }
  >
    {({ isActive }) => (
      <>
        <Ripple color={isActive ? 'rgba(255,255,255,0.2)' : 'rgba(148,163,184,0.3)'} />
        <div className={`relative z-10 flex items-center pointer-events-none w-full h-full ${isSidebarCollapsed ? 'justify-center' : ''}`}>
          <Icon size={20} className={`shrink-0 transition-colors duration-200 ${isActive ? 'text-white' : 'text-slate-400 group-hover:text-slate-600'}`} />
          <span className={`overflow-hidden whitespace-nowrap transition-all duration-300 ease-in-out ${
            isSidebarCollapsed ? 'w-0 opacity-0 ml-0' : 'flex-1 w-[120px] opacity-100 ml-3'
          }`}>
            {label}
          </span>
        </div>
        {isSidebarCollapsed && (
          <div className="absolute left-full ml-4 px-3 py-1.5 bg-slate-800 text-white text-sm font-semibold rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all whitespace-nowrap z-50 shadow-lg">
            {label}
          </div>
        )}
      </>
    )}
  </NavLink>
);

const SkeletonClassList = () => (
  <div className="space-y-3 px-4 py-2 w-full">
    {[1, 2, 3].map((i) => (
      <div key={i} className="h-4 bg-slate-200 rounded-md animate-pulse w-full" />
    ))}
  </div>
);

function Dashboard() {
  const navigate = useNavigate();
  const location = useLocation(); 
  const [user] = useState(() => {
    const name = localStorage.getItem('userName') || 'Student';
    const avatar = localStorage.getItem('userAvatar');
    const role = localStorage.getItem('userRole');
    return { name, avatar: avatar || '', role: role || 'STUDENT' };
  });

  // --- UI STATES ---
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false); 
  const [isClassroomOpen, setIsClassroomOpen] = useState(true); 
  const [isFlyoutOpen, setIsFlyoutOpen] = useState(false); 
  
  // --- DATA STATES ---
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [loading, setLoading] = useState(true); 
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newClassName, setNewClassName] = useState('');

  // Tối ưu API với AbortController
  const fetchClasses = useCallback(async (signal?: AbortSignal, forceUpdate = false) => {
    const token = localStorage.getItem('token');  
    if (!token) return navigate('/login');

    if (globalClassesCache && !forceUpdate) {
      setClasses(globalClassesCache);
      setLoading(false);
      return;
    }

    try {
      if (!globalClassesCache) setLoading(true);
      const data = await axiosClient.get<ClassItem[], ClassItem[]>('/api/classes', { signal });
      globalClassesCache = data;
      setClasses(data); 
    } catch (error: any) {
      if (error.name !== 'CanceledError') {
        console.error("Lỗi tải lớp học:", error);
      }
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  useEffect(() => { 
    const controller = new AbortController();
    fetchClasses(controller.signal); 
    return () => controller.abort(); // Dọn dẹp request nếu unmount
  }, [fetchClasses]);

  const handleLogout = () => {
    localStorage.clear();
    navigate('/');
  };

  const handleCreateClass = async (e: React.FormEvent) => {
    e.preventDefault(); 
    if (!newClassName.trim()) return alert("Tên lớp không được để trống");
    try {
      setLoading(true);
      await axiosClient.post(`/api/classes`, { name: newClassName });
      toast.success("Tạo lớp thành công!"); 
      setIsModalOpen(false); 
      setNewClassName('');  
      fetchClasses(undefined, true);
      setIsFlyoutOpen(false); 
    } catch (error: any) {
      const msg = error.response?.data?.error || "Lỗi khi tạo lớp";
      alert(msg);
    } finally {
      setLoading(false);
    }
  };

  // Tối ưu re-render danh sách lớp dạng cây bằng useMemo
  const renderedClassesTree = useMemo(() => classes.map((cls) => (
    <NavLink
      key={cls.id}
      to={`/dashboard/class/${cls.id}`}
      className="group flex items-center py-2 relative z-10 rounded-r-lg hover:bg-slate-50"
    >
      {({ isActive }) => (
        <>
          <div className={`w-[3px] absolute left-[-1px] rounded-r-md transition-all duration-300 ease-in-out ${
            isActive 
              ? 'h-6 bg-slate-800 opacity-100' 
              : 'h-0 bg-slate-300 opacity-0 group-hover:h-4 group-hover:opacity-100'
          }`} />
          <span className={`ml-4 text-[13px] truncate transition-all duration-200 ${
            isActive ? 'text-slate-900 font-bold' : 'text-slate-500 font-medium group-hover:text-slate-800'
          }`}>
            {cls.name}
          </span>
        </>
      )}
    </NavLink>
  )), [classes]);

  // Tối ưu re-render danh sách lớp dạng Flyout bằng useMemo
  const renderedClassesFlyout = useMemo(() => classes.map(cls => (
    <NavLink
      key={cls.id}
      to={`/dashboard/class/${cls.id}`}
      onClick={() => setIsFlyoutOpen(false)}
      className={({ isActive }) => 
        `group relative flex items-center px-3 py-2 text-[13px] truncate transition-colors rounded-lg mb-1 ${
          isActive ? 'bg-slate-100 text-slate-900 font-bold' : 'text-slate-600 font-medium hover:bg-slate-50 hover:text-slate-900'
        }`
      }
    >
      {({ isActive }) => (
        <>
          <div className={`absolute left-0 top-1/2 -translate-y-1/2 w-[3px] rounded-r-md transition-all duration-300 ${
            isActive 
              ? 'h-5 bg-slate-800 opacity-100' 
              : 'h-0 bg-slate-300 opacity-0 group-hover:h-3 group-hover:opacity-100'
          }`} />
          <span className="ml-1">{cls.name}</span>
        </>
      )}
    </NavLink>
  )), [classes]);

  return (
    <div className="flex h-screen bg-[#F8FAFC] font-sans overflow-hidden">
      
      {/* --- MÀN CHẮN ẨN --- */}
      {isSidebarCollapsed && isFlyoutOpen && (
        <div className="fixed inset-0 z-30" onClick={() => setIsFlyoutOpen(false)} />
      )}

      {/* --- SIDEBAR --- */}
      <aside 
        className={`relative transition-all duration-300 ease-in-out will-change-[width] ${
          isSidebarCollapsed ? 'w-20' : 'w-72'
        } bg-white border-r border-slate-200 flex flex-col shadow-sm z-40`}
      >
        <button 
          onClick={() => {
            setIsSidebarCollapsed(!isSidebarCollapsed);
            setIsFlyoutOpen(false); 
          }}
          className="absolute -right-3.5 top-8 flex items-center justify-center w-6 h-6 bg-white border border-slate-400 rounded-full text-slate-400 hover:text-slate-800 hover:bg-slate-50 shadow-sm z-50 transition-colors cursor-pointer">
          {isSidebarCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </button>

        <div className={`p-6 pb-2 flex items-center ${isSidebarCollapsed ? 'justify-center px-0' : 'px-6 gap-3'} cursor-pointer transition-all duration-300`} onClick={() => navigate('/')}>
          <div className="w-10 h-10 shrink-0 min-w-[2.5rem] bg-slate-900 rounded-xl flex items-center justify-center text-white shadow-md">
            <BookOpen size={20} strokeWidth={2.5} />
          </div>
          <div className={`overflow-hidden transition-all duration-300 ease-in-out whitespace-nowrap ${
            isSidebarCollapsed ? 'w-0 opacity-0' : 'w-[120px] opacity-100'
          }`}>
            <h1 className="text-xl font-extrabold text-slate-800 tracking-tight">SAT Master</h1>
          </div>
        </div>

        <div className="mt-4 border-t border-slate-200 mx-4" />

        <nav className={`flex-1 px-4 py-4 space-y-1.5 scrollbar-hide ${
          isSidebarCollapsed ? 'overflow-visible' : 'overflow-y-auto overflow-x-hidden'
        }`}>
          <div className={`text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-3 px-2 transition-all duration-300 overflow-hidden whitespace-nowrap ${isSidebarCollapsed ? 'h-0 opacity-0 mb-0' : 'h-4 opacity-100'}`}>
            Menu
          </div>
          
          <SidebarItem to="/dashboard/practice-test" label="Practice Test" icon={Layout} isSidebarCollapsed={isSidebarCollapsed} />
          <SidebarItem to="/dashboard/error-log" label="Error Log" icon={AlertCircle} isSidebarCollapsed={isSidebarCollapsed}/>
          <SidebarItem to="/dashboard/logic-lab" label="Logic Lab" icon={BrainCircuit} isSidebarCollapsed={isSidebarCollapsed}/>
          <SidebarItem to="/dashboard/results-analytics" label="Results & Analytics" icon={BarChart3} isSidebarCollapsed={isSidebarCollapsed}/>
          
          {/* --- CLASSROOM GROUP --- */}
          <div className="relative pt-2 z-40">
            {/* Tối ưu CSS Flexbox Grouping để không bị lệch Icon */}
            <div 
              className={`group relative overflow-hidden flex items-center ${isSidebarCollapsed ? 'justify-center px-0' : 'px-3'} py-2.5 rounded-full cursor-pointer transition-all duration-300 font-medium ${
                  location.pathname.includes('/class') ? 'bg-slate-900 text-white shadow-md' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'
              }`}
              onClick={() => {
                if (isSidebarCollapsed) setIsFlyoutOpen(!isFlyoutOpen); 
                else setIsClassroomOpen(!isClassroomOpen); 
              }}
            >
              <Ripple color={location.pathname.includes('/class') ? 'rgba(255,255,255,0.2)' : 'rgba(148,163,184,0.3)'} />
              <div className={`relative z-10 flex items-center pointer-events-none w-full h-full ${isSidebarCollapsed ? 'justify-center' : ''}`}>
                <GraduationCap size={20} className={`shrink-0 transition-colors ${location.pathname.includes('/class') ? 'text-white' : 'text-slate-400'}`} />
                
                <div className={`flex items-center overflow-hidden transition-all duration-300 ease-in-out ${
                  isSidebarCollapsed ? 'w-0 opacity-0 ml-0' : 'flex-1 ml-3 opacity-100'
                }`}>
                  <span className="flex-1 truncate">Classroom</span>
                  <ChevronDown size={16} className={`shrink-0 transition-transform duration-200 ${isClassroomOpen && !isSidebarCollapsed ? 'rotate-180' : ''}`} />
                </div>
              </div>
            </div>  

            {/* 1. DẠNG ĐẦY ĐỦ: Nhánh cây */}
            {!isSidebarCollapsed && isClassroomOpen && (
              <div className="mt-1 relative ml-5 pl-2 border-l border-slate-500 space-y-0.5">
                {loading ? <SkeletonClassList /> : renderedClassesTree}

                {(user.role === 'TEACHER' || user.role === 'ADMIN') && (
                  <button 
                    onClick={() => setIsModalOpen(true)}
                    className="group flex items-center py-2 relative z-10 w-full text-left mt-1 hover:bg-slate-50"
                  >
                     <div className="w-[3px] h-0 group-hover:h-4 rounded-r-md bg-slate-300 transition-all duration-300 ease-in-out absolute left-[-1px]" />
                     <div className="ml-4 flex items-center gap-2 text-[13px] font-medium text-slate-500 group-hover:text-slate-900 transition-colors">
                       <Plus size={14} className="text-slate-400 group-hover:text-slate-900 transition-colors" />
                       <span>Add class</span>
                     </div>
                  </button>
                )}
              </div>
            )}

            {/* 2. DẠNG THU GỌN: Flyout */}
            {isSidebarCollapsed && isFlyoutOpen && (
              <div className="absolute left-full top-0 ml-4 w-60 bg-white border border-slate-200 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.1)] z-[100] py-2 animate-in fade-in zoom-in-95 duration-200 origin-top-left">
                <div className="px-4 py-2 text-[11px] font-bold text-slate-600 uppercase tracking-wider border-b border-slate-300 mb-2">
                  Classroom
                </div>
                
                <div className="max-h-60 overflow-y-auto scrollbar-hide px-2">
                  {loading ? <SkeletonClassList /> : renderedClassesFlyout}
                </div>

                {(user.role === 'TEACHER' || user.role === 'ADMIN') && (
                  <div className="px-2 pt-2 mt-1 border-t border-slate-300">
                    <button 
                      onClick={() => {
                        setIsModalOpen(true);
                        setIsFlyoutOpen(false); 
                      }}
                      className="flex items-center justify-center px-3 py-2 w-full text-[13px] font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-50 rounded-lg transition-all"
                    >
                      <Plus size={16} className="text-slate-600" /> 
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </nav>

        {/* --- USER PROFILE CARD --- */}
        <div className="p-4 border-t border-slate-200 bg-white z-50">
          <div className={`flex items-center p-2 rounded-xl transition-all duration-300 ${
            isSidebarCollapsed ? 'flex-col justify-center gap-2' : 'gap-3'
          }`}>
            <div className="relative h-10 w-10 min-w-[2.5rem] shrink-0 rounded-full overflow-hidden shadow-sm border border-slate-200">
              {user.avatar ? (
                <img src={user.avatar} alt="Avatar" className="h-full w-full object-cover" />
              ) : (
                <div className="h-full w-full bg-slate-100 flex items-center justify-center text-slate-500">
                  <User size={20} />
                </div>
              )}
            </div>
            
            <div className={`overflow-hidden transition-all duration-300 ease-in-out whitespace-nowrap ${
              isSidebarCollapsed ? 'w-0 h-0 opacity-0' : 'flex-1 w-[120px] h-[36px] opacity-100'
            }`}>
              <p className="text-sm font-bold text-slate-800 truncate">{user.name}</p>
              <p className="text-xs font-medium text-slate-400 truncate">
                {user.role === 'STUDENT' ? "Học sinh" : user.role === 'TEACHER' ? 'Giáo viên' : 'Admin'}
              </p>
            </div>
            
            <button 
              onClick={handleLogout}
              className={`shrink-0 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-all ${
                isSidebarCollapsed ? 'p-1.5' : 'p-2'
              }`}
              title="Đăng xuất"
            >
              <LogOut size={isSidebarCollapsed ? 16 : 18} />
            </button>
          </div>
        </div>
      </aside>

      {/* --- MAIN CONTENT --- */}
      <main id="dashboard-main" className="flex-1 overflow-y-auto relative scroll-smooth bg-white/50 z-10">
        <div className="max-w-7xl mx-auto p-8 relative">
          <Outlet />
        </div>
      </main>

      {/* --- MODAL TẠO LỚP HỌC --- */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center bg-slate-900/40 p-4">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <h3 className="font-bold text-lg text-slate-800">Create new class</h3>
              
              {/* --- 1. NÚT X (ĐÓNG) --- */}
              <button 
                onClick={() => setIsModalOpen(false)} 
                className="relative overflow-hidden text-slate-400 hover:text-slate-700 hover:bg-slate-200 p-1 rounded-md transition-colors"
              >
                <Ripple color="rgba(15, 23, 42, 0.1)" />
                <span className="relative z-10 pointer-events-none flex items-center justify-center">
                  <X size={20} />
                </span>
              </button>
            </div>
            
            <form onSubmit={handleCreateClass} className="p-6 space-y-5">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Class Name <span className="text-red-500">*</span></label>
                <input 
                  type="text" 
                  value={newClassName}
                  onChange={(e) => setNewClassName(e.target.value)}
                  placeholder="e.g. SAT Math Fall 2024"
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#1E293B] focus:border-[#1E293B] outline-none transition-all shadow-sm"
                  autoFocus
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                
                {/* --- 2. NÚT CANCEL --- */}
                <button 
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="relative overflow-hidden px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
                >
                  <Ripple color="rgba(15, 23, 42, 0.1)" />
                  <span className="relative z-10 pointer-events-none flex items-center justify-center w-full h-full">
                    Cancel
                  </span>
                </button>
                
                {/* --- 3. NÚT CREATE CLASS --- */}
                <button 
                  type="submit" 
                  disabled={loading}
                  className="relative overflow-hidden px-5 py-2.5 text-sm font-bold text-white bg-[#1E293B] hover:bg-slate-800 rounded-full shadow-md transition-all"
                >
                  <Ripple color="rgba(255, 255, 255, 0.2)" />
                  <span className="relative z-10 pointer-events-none flex items-center gap-2 justify-center w-full h-full">
                    {loading ? 'Creating...' : 'Create'}
                  </span>
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