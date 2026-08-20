import { useCallback, useEffect, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  BarChart3,
  BookOpenCheck,
  ChevronDown,
  GraduationCap,
  LogOut,
  Plus,
  X,
} from 'lucide-react';
import toast from 'react-hot-toast';
import axiosClient from '../../lib/axios';

interface ClassItem {
  id: string;
  name: string;
}

interface NavItemProps {
  to: string;
  label: string;
  icon: React.ElementType;
}

const NavItem = ({ to, label, icon: Icon }: NavItemProps) => (
  <NavLink
    to={to}
    className={({ isActive }) => `flex h-10 items-center gap-3 rounded-lg px-3 text-sm transition-colors ${isActive ? 'bg-[#1B7A5A] font-medium text-white' : 'text-[#D6EDE4] hover:bg-[#174030] hover:text-white'}`}
  >
    <Icon size={19} className="shrink-0" />
    <span className="truncate">{label}</span>
  </NavLink>
);

const Dashboard = () => {
  const navigate = useNavigate();
  const [userRole] = useState(() => localStorage.getItem('userRole') || 'STUDENT');
  const canManage = userRole === 'TEACHER' || userRole === 'ADMIN';
  const [classroomOpen, setClassroomOpen] = useState(true);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [createClassOpen, setCreateClassOpen] = useState(false);
  const [newClassName, setNewClassName] = useState('');

  const fetchClasses = useCallback(async () => {
    try {
      setLoading(true);
      const result = await axiosClient.get<ClassItem[], ClassItem[]>('/api/classes');
      setClasses(result);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchClasses();
  }, [fetchClasses]);

  const logout = () => {
    localStorage.clear();
    navigate('/');
  };

  const createClass = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!newClassName.trim()) return;
    try {
      await axiosClient.post('/api/classes', { name: newClassName.trim() });
      toast.success('Class created');
      setNewClassName('');
      setCreateClassOpen(false);
      await fetchClasses();
    } catch (error: unknown) {
      const requestError = error as { response?: { data?: { error?: string } } };
      toast.error(requestError.response?.data?.error || 'Unable to create class');
    }
  };

  return (
    <div className="flex h-screen overflow-hidden bg-[#F2F8F5] font-sans text-[#1A1A1A]">
      <aside className="z-40 flex w-56 shrink-0 flex-col border-r border-[#174030] bg-[#0F4D38] text-[#D6EDE4]">
        <button onClick={() => navigate('/dashboard/practice-test')} className="flex h-[72px] shrink-0 items-center gap-3 border-b border-[#174030] px-5 text-left">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#1B7A5A] text-white">
            <BookOpenCheck size={21} />
          </span>
          <span>
            <span className="block text-sm font-semibold tracking-[0.04em] text-white">SAT MASTER</span>
            <span className="mt-0.5 block text-[10px] text-[#A3C9B8]">Learning Management</span>
          </span>
        </button>

        <nav className="min-h-0 flex-1 overflow-y-auto px-3 py-5">
          <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#A3C9B8]">Modules</p>
          <div className="space-y-1">
            <NavItem to="/dashboard/practice-test" label="Practice Center" icon={BookOpenCheck} />

            <button
              onClick={() => setClassroomOpen(current => !current)}
              className="flex h-10 w-full items-center gap-3 rounded-lg px-3 text-sm text-[#D6EDE4] transition-colors hover:bg-[#174030] hover:text-white"
            >
              <GraduationCap size={19} />
              <span className="flex-1 text-left">Classroom</span><ChevronDown size={16} className={`transition-transform ${classroomOpen ? 'rotate-180' : ''}`} />
            </button>

            {classroomOpen && (
              <div className="ml-[21px] space-y-1 border-l border-[#2A624E] pb-2 pl-4 pt-1">
                {loading ? (
                  <div className="space-y-2 py-2"><div className="h-4 w-28 animate-pulse rounded bg-[#174030]" /><div className="h-4 w-20 animate-pulse rounded bg-[#174030]" /></div>
                ) : classes.map(item => (
                  <NavLink
                    key={item.id}
                    to={`/dashboard/class/${item.id}`}
                    className={({ isActive }) => `block truncate rounded-lg px-3 py-2 text-xs transition-colors ${isActive ? 'bg-[#1B7A5A] font-medium text-white' : 'text-[#A3C9B8] hover:bg-[#174030] hover:text-white'}`}
                  >
                    {item.name}
                  </NavLink>
                ))}
                {canManage && (
                  <button onClick={() => setCreateClassOpen(true)} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-[#E8C040] hover:bg-[#174030]">
                    <Plus size={14} /> Create class
                  </button>
                )}
              </div>
            )}

            <NavItem to="/dashboard/error-log" label="Error Log" icon={AlertCircle} />
            <NavItem to="/dashboard/results-analytics" label="Results & Analytics" icon={BarChart3} />
          </div>
        </nav>

        <div className="border-t border-[#174030] p-3">
          <button onClick={logout} className="flex h-10 w-full items-center gap-3 rounded-lg px-3 text-sm text-[#D6EDE4] transition-colors hover:bg-[#174030] hover:text-white">
            <LogOut size={19} />
            <span>Log out</span>
          </button>
        </div>
      </aside>

      <main className="relative min-w-0 flex-1 overflow-hidden"><Outlet /></main>

      {createClassOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-[#0A1F16]/50 p-4 backdrop-blur-sm">
          <div className="app-modal w-full max-w-md">
            <div className="flex items-center justify-between border-b border-[#E2EDE9] px-6 py-5">
              <div><h3 className="text-lg font-semibold">Create class</h3><p className="mt-1 text-sm text-[#6B7280]">Add a new learning space.</p></div>
              <button className="app-icon-button" onClick={() => setCreateClassOpen(false)}><X size={18} /></button>
            </div>
            <form onSubmit={createClass} className="p-6">
              <label className="mb-2 block text-sm font-medium text-[#1A1A1A]">Class name</label>
              <input autoFocus value={newClassName} onChange={event => setNewClassName(event.target.value)} placeholder="e.g. SAT Math 12A1" className="app-input w-full" />
              <div className="mt-6 flex justify-end gap-3"><button type="button" className="app-button app-button-secondary" onClick={() => setCreateClassOpen(false)}>Cancel</button><button type="submit" className="app-button app-button-primary" disabled={!newClassName.trim()}>Create class</button></div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
