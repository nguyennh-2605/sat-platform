import { useState } from 'react';
import { useNavigate, Outlet, NavLink } from 'react-router-dom';
import { 
  User, LogOut, BookOpen, 
  BrainCircuit, Layout, GraduationCap, AlertCircle,
  BarChart3
} from 'lucide-react';

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

  const handleLogout = () => {
    localStorage.clear();
    navigate('/');
  };

  const SidebarItem = ({ to, label, icon: Icon }: any) => (
    <NavLink
      to={to}
      className={({ isActive }) => 
        `group w-full flex items-center gap-3 px-4 py-3.5 rounded-xl transition-all duration-200 font-medium ${
          isActive 
            ? 'bg-blue-600 text-white shadow-lg shadow-blue-200' 
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
          <SidebarItem to="/dashboard/homework" label="Homework" icon={GraduationCap} />
          <SidebarItem to="/dashboard/error-log" label="Error Log" icon={AlertCircle} />
          <SidebarItem to="/dashboard/logic-lab" label="Logic Lab" icon={BrainCircuit} />
          <SidebarItem to="/dashboard/results-analytics" label="Results & Analytics" icon={BarChart3} />
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
    </div>
  );
}

export default Dashboard;