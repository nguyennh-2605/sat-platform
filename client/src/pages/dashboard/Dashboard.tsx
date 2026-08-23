import { useEffect, useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  BarChart3,
  BookOpenCheck,
  GraduationCap,
  LogOut,
  Palette,
} from 'lucide-react';
import toast from 'react-hot-toast';
import axiosClient from '../../lib/axios';
import { BackgroundPicker } from '../../features/backgrounds/BackgroundPicker';
import { backgroundById, normalizeBackgroundId, type BackgroundId } from '../../features/backgrounds/backgroundPresets';
import { DashboardRouteViewport } from '../../features/navigation/DashboardRouteViewport';
import { clearAuthSession } from '../../lib/authSession';

interface NavItemProps {
  to: string;
  label: string;
  icon: React.ElementType;
  activePrefixes?: string[];
}

const NavItem = ({ to, label, icon: Icon, activePrefixes = [] }: NavItemProps) => {
  const location = useLocation();
  const sectionActive = activePrefixes.some(prefix => location.pathname.startsWith(prefix));
  return <NavLink
      to={to}
      className={({ isActive }) => `flex h-10 items-center gap-3 rounded-lg px-3 text-sm transition-colors ${isActive || sectionActive ? 'bg-[#1B7A5A] font-medium text-white' : 'text-[#D6EDE4] hover:bg-[#174030] hover:text-white'}`}
    >
      <Icon size={19} className="shrink-0" />
      <span className="truncate">{label}</span>
    </NavLink>;
};

const Dashboard = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const userId = localStorage.getItem('userId') || 'guest';
  const storageKey = `dashboardBackground:${userId}`;
  const [backgroundId, setBackgroundId] = useState<BackgroundId>(() => normalizeBackgroundId(localStorage.getItem(storageKey)));
  const [backgroundOpen, setBackgroundOpen] = useState(false);
  const [backgroundSaving, setBackgroundSaving] = useState(false);

  useEffect(() => {
    let active = true;
    axiosClient.get<{ backgroundId: BackgroundId }, { backgroundId: BackgroundId }>('/api/user-preferences/dashboard-background')
      .then(response => {
        if (!active) return;
        const nextId = normalizeBackgroundId(response.backgroundId);
        setBackgroundId(nextId);
        localStorage.setItem(storageKey, nextId);
      })
      .catch(error => console.error('Unable to load dashboard background.', error));
    return () => { active = false; };
  }, [storageKey]);

  const chooseBackground = async (nextId: BackgroundId) => {
    const previousId = backgroundId;
    setBackgroundId(nextId);
    localStorage.setItem(storageKey, nextId);
    setBackgroundSaving(true);
    try {
      await axiosClient.put('/api/user-preferences/dashboard-background', { backgroundId: nextId });
    } catch (error) {
      console.error(error);
      setBackgroundId(previousId);
      localStorage.setItem(storageKey, previousId);
      toast.error('Unable to save background.');
    } finally {
      setBackgroundSaving(false);
    }
  };

  const logout = () => {
    clearAuthSession();
    navigate('/auth', { replace: true });
  };

  const selectedBackground = backgroundById(backgroundId);

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
            <NavItem to="/dashboard/classes" label="Classroom" icon={GraduationCap} activePrefixes={['/dashboard/class/']} />

            <NavItem to="/dashboard/error-log" label="Error Log" icon={AlertCircle} />
            <NavItem to="/dashboard/results-analytics" label="Results & Analytics" icon={BarChart3} />
          </div>
        </nav>

        <div className="border-t border-[#174030] p-3">
          <button onClick={() => setBackgroundOpen(true)} className="mb-1 flex h-10 w-full items-center gap-3 rounded-lg px-3 text-sm text-[#D6EDE4] transition-colors hover:bg-[#174030] hover:text-white">
            <Palette size={19} />
            <span>Background</span>
          </button>
          <button onClick={logout} className="flex h-10 w-full items-center gap-3 rounded-lg px-3 text-sm text-[#D6EDE4] transition-colors hover:bg-[#174030] hover:text-white">
            <LogOut size={19} />
            <span>Log out</span>
          </button>
        </div>
      </aside>

      <main
        className="dashboard-surface relative min-w-0 flex-1 overflow-hidden bg-[#F2F8F5] bg-cover bg-center"
        data-background-active={selectedBackground ? 'true' : 'false'}
        style={selectedBackground ? { backgroundImage: `linear-gradient(rgba(232,245,239,.64), rgba(242,248,245,.78)), url(${selectedBackground.image})` } : undefined}
      ><DashboardRouteViewport key={location.pathname} /></main>

      <BackgroundPicker open={backgroundOpen} selectedId={backgroundId} saving={backgroundSaving} onSelect={id => void chooseBackground(id)} onClose={() => setBackgroundOpen(false)} />

    </div>
  );
};

export default Dashboard;
