import { useEffect, useId, useState, type ElementType } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  BarChart3,
  BookA,
  BookOpenCheck,
  GraduationCap,
  LayoutDashboard,
  LogOut,
  Menu,
  Palette,
  X,
} from 'lucide-react';
import toast from 'react-hot-toast';
import axiosClient from '../../lib/axios';
import { BackgroundPicker } from '../../features/backgrounds/BackgroundPicker';
import { backgroundById, normalizeBackgroundId, type BackgroundId } from '../../features/backgrounds/backgroundPresets';
import { DashboardRouteViewport } from '../../features/navigation/DashboardRouteViewport';
import { logoutAuthSession } from '../../lib/authSession';

interface NavItemProps {
  to: string;
  label: string;
  icon: ElementType;
  activePrefixes?: string[];
  exact?: boolean;
  onNavigate?: () => void;
}

const NavItem = ({ to, label, icon: Icon, activePrefixes = [], exact = false, onNavigate }: NavItemProps) => {
  const location = useLocation();
  const sectionActive = activePrefixes.some(prefix => location.pathname.startsWith(prefix));
  const exactActive = exact && location.pathname === to;

  return <NavLink
    to={to}
    end={exact}
    onClick={onNavigate}
    className={({ isActive }) => `flex min-h-10 items-center gap-3 rounded-control px-3 text-body transition-colors ${isActive || exactActive || sectionActive ? 'bg-primary font-semibold text-white shadow-xs' : 'text-sidebar-foreground hover:bg-sidebar-hover hover:text-white'}`}
  >
    <Icon size={19} className="shrink-0" aria-hidden="true" />
    <span className="truncate">{label}</span>
  </NavLink>;
};

function SidebarContent({ onNavigate, onBackground, onLogout }: { onNavigate?: () => void; onBackground: () => void; onLogout: () => void }) {
  const navigate = useNavigate();
  const userName = localStorage.getItem('userName') || 'Student';
  const role = localStorage.getItem('userRole') || 'STUDENT';

  return <>
    <button
      type="button"
      onClick={() => { navigate('/dashboard'); onNavigate?.(); }}
      className="flex min-h-[72px] shrink-0 items-center gap-3 border-b border-sidebar-border px-5 text-left"
      aria-label="Go to dashboard home"
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-control bg-primary text-white shadow-xs">
        <BookOpenCheck size={21} aria-hidden="true" />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-body font-semibold tracking-[0.04em] text-white">SAT MASTER</span>
        <span className="mt-0.5 block truncate text-[0.6875rem] text-sidebar-muted">Learning workspace</span>
      </span>
    </button>

    <nav className="min-h-0 flex-1 overflow-y-auto px-3 py-5" aria-label="Main navigation">
      <p className="mb-2 px-3 text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-sidebar-muted">Workspace</p>
      <div className="space-y-1">
        <NavItem to="/dashboard" label="Overview" icon={LayoutDashboard} exact onNavigate={onNavigate} />
        <NavItem to="/dashboard/practice-test" label="Practice Center" icon={BookOpenCheck} onNavigate={onNavigate} />
        <NavItem to="/dashboard/classes" label="Classroom" icon={GraduationCap} activePrefixes={['/dashboard/class/']} onNavigate={onNavigate} />
        <NavItem to="/dashboard/vocabulary" label="Vocabulary" icon={BookA} onNavigate={onNavigate} />
        <NavItem to="/dashboard/error-log" label="Error Log" icon={AlertCircle} onNavigate={onNavigate} />
        <NavItem to="/dashboard/results-analytics" label="Results & Analytics" icon={BarChart3} onNavigate={onNavigate} />
      </div>
    </nav>

    <div className="border-t border-sidebar-border p-3">
      <div className="mb-2 px-3 py-2">
        <p className="truncate text-body font-medium text-white">{userName}</p>
        <p className="mt-0.5 text-[0.6875rem] uppercase tracking-wide text-sidebar-muted">{role.toLowerCase()}</p>
      </div>
      <button type="button" onClick={onBackground} className="mb-1 flex min-h-10 w-full items-center gap-3 rounded-control px-3 text-body text-sidebar-foreground transition-colors hover:bg-sidebar-hover hover:text-white">
        <Palette size={19} aria-hidden="true" />
        <span>Background</span>
      </button>
      <button type="button" onClick={onLogout} className="flex min-h-10 w-full items-center gap-3 rounded-control px-3 text-body text-sidebar-foreground transition-colors hover:bg-sidebar-hover hover:text-white">
        <LogOut size={19} aria-hidden="true" />
        <span>Log out</span>
      </button>
    </div>
  </>;
}

const Dashboard = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const drawerId = useId();
  const userId = localStorage.getItem('userId') || 'guest';
  const storageKey = `dashboardBackground:${userId}`;
  const [backgroundId, setBackgroundId] = useState<BackgroundId>(() => normalizeBackgroundId(localStorage.getItem(storageKey)));
  const [backgroundOpen, setBackgroundOpen] = useState(false);
  const [backgroundSaving, setBackgroundSaving] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

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

  useEffect(() => { setMobileNavOpen(false); }, [location.pathname]);
  useEffect(() => {
    if (!mobileNavOpen) return;
    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') setMobileNavOpen(false); };
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [mobileNavOpen]);

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

  const logout = async () => {
    await logoutAuthSession();
    navigate('/auth', { replace: true });
  };

  const selectedBackground = backgroundById(backgroundId);
  const openBackground = () => { setMobileNavOpen(false); setBackgroundOpen(true); };

  return (
    <div className="flex h-dvh overflow-hidden bg-background font-sans text-foreground">
      <a href="#dashboard-content" className="fixed left-3 top-3 z-300 -translate-y-20 rounded-control bg-surface px-4 py-2 text-body font-semibold text-primary shadow-elevated transition-transform focus:translate-y-0">Skip to content</a>

      <aside className="z-40 hidden w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground lg:flex">
        <SidebarContent onBackground={openBackground} onLogout={() => void logout()} />
      </aside>

      <header className="fixed inset-x-0 top-0 z-40 flex h-14 items-center justify-between border-b border-ui-border-strong bg-sidebar px-4 text-white lg:hidden">
        <button type="button" onClick={() => navigate('/dashboard')} className="flex min-w-0 items-center gap-2" aria-label="Go to dashboard home">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-control bg-primary"><BookOpenCheck size={18} aria-hidden="true" /></span>
          <span className="truncate text-body font-semibold tracking-wide">SAT MASTER</span>
        </button>
        <button
          type="button"
          onClick={() => setMobileNavOpen(true)}
          aria-label="Open navigation"
          aria-expanded={mobileNavOpen}
          aria-controls={drawerId}
          className="flex h-10 w-10 items-center justify-center rounded-control text-sidebar-foreground hover:bg-sidebar-hover hover:text-white"
        ><Menu size={22} aria-hidden="true" /></button>
      </header>

      {mobileNavOpen && <div className="fixed inset-0 z-100 lg:hidden">
        <button type="button" className="absolute inset-0 bg-(--ui-overlay)" onClick={() => setMobileNavOpen(false)} aria-label="Close navigation" />
        <aside id={drawerId} role="dialog" aria-modal="true" aria-label="Navigation" className="relative flex h-full w-[min(20rem,88vw)] flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground shadow-elevated">
          <button type="button" onClick={() => setMobileNavOpen(false)} aria-label="Close navigation" className="absolute right-3 top-4 z-10 flex h-10 w-10 items-center justify-center rounded-control text-sidebar-foreground hover:bg-sidebar-hover hover:text-white">
            <X size={20} aria-hidden="true" />
          </button>
          <SidebarContent onNavigate={() => setMobileNavOpen(false)} onBackground={openBackground} onLogout={() => void logout()} />
        </aside>
      </div>}

      <main
        id="dashboard-content"
        tabIndex={-1}
        className="dashboard-surface relative min-w-0 flex-1 overflow-hidden bg-background bg-cover bg-center pt-14 outline-hidden lg:pt-0"
        data-background-active={selectedBackground ? 'true' : 'false'}
        style={selectedBackground ? { backgroundImage: `linear-gradient(rgba(232,245,239,.64), rgba(242,248,245,.78)), url(${selectedBackground.image})` } : undefined}
      ><DashboardRouteViewport /></main>

      <BackgroundPicker open={backgroundOpen} selectedId={backgroundId} saving={backgroundSaving} onSelect={id => void chooseBackground(id)} onClose={() => setBackgroundOpen(false)} />
    </div>
  );
};

export default Dashboard;
