import { useEffect, useState, type CSSProperties, type ElementType } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  BarChart3,
  BookA,
  BookOpenCheck,
  ChevronsUpDown,
  GraduationCap,
  LayoutDashboard,
  LogOut,
  Moon,
  Palette,
  Sun,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Separator } from '@/components/ui/separator';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
  useSidebar,
} from '@/components/ui/sidebar';
import { BackgroundPicker } from '../../features/backgrounds/BackgroundPicker';
import { backgroundById, normalizeBackgroundId, type BackgroundId } from '../../features/backgrounds/backgroundPresets';
import { DashboardRouteViewport } from '../../features/navigation/DashboardRouteViewport';
import NotificationBell from '../../features/notifications/NotificationBell';
import axiosClient from '../../lib/axios';
import { logoutAuthSession } from '../../lib/authSession';

const navigation = [
  { to: '/dashboard', label: 'Overview', icon: LayoutDashboard, exact: true },
  { to: '/dashboard/practice-test', label: 'Practice Center', icon: BookOpenCheck },
  { to: '/dashboard/classes', label: 'Classroom', icon: GraduationCap, activePrefixes: ['/dashboard/class/'] },
  { to: '/dashboard/vocabulary', label: 'Vocabulary', icon: BookA },
  { to: '/dashboard/error-log', label: 'Error Log', icon: AlertCircle },
  { to: '/dashboard/results-analytics', label: 'Results & Analytics', icon: BarChart3 },
] as const;

const pageTitle = (pathname: string) => {
  if (pathname === '/dashboard') return 'Overview';
  if (pathname.startsWith('/dashboard/practice-test')) return 'Practice Center';
  if (pathname.startsWith('/dashboard/class')) return 'Classroom';
  if (pathname.startsWith('/dashboard/vocabulary')) return 'Vocabulary';
  if (pathname.startsWith('/dashboard/error-log')) return 'Error Log';
  if (pathname.startsWith('/dashboard/results-analytics')) return 'Results & Analytics';
  if (pathname.startsWith('/dashboard/score-report')) return 'Score Report';
  return 'SAT Master';
};

interface NavigationItemProps {
  to: string;
  label: string;
  icon: ElementType;
  exact?: boolean;
  activePrefixes?: readonly string[];
}

function NavigationItem({ to, label, icon: Icon, exact = false, activePrefixes = [] }: NavigationItemProps) {
  const location = useLocation();
  const { setOpenMobile } = useSidebar();
  const active = exact
    ? location.pathname === to
    : location.pathname === to || location.pathname.startsWith(`${to}/`) || activePrefixes.some(prefix => location.pathname.startsWith(prefix));

  return (
    <SidebarMenuItem>
      <SidebarMenuButton asChild isActive={active} tooltip={label}>
        <NavLink to={to} end={exact} onClick={() => setOpenMobile(false)}>
          <Icon aria-hidden="true" />
          <span>{label}</span>
        </NavLink>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

function AppSidebar({ onBackground, onLogout }: { onBackground: () => void; onLogout: () => void }) {
  const userName = localStorage.getItem('userName') || 'Student';
  const userAvatar = localStorage.getItem('userAvatar') || '';
  const role = localStorage.getItem('userRole') || 'STUDENT';
  const initials = userName.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join('').toUpperCase() || 'S';
  const { isMobile } = useSidebar();

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild size="lg" tooltip="SAT Master">
              <NavLink to="/dashboard">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                  <BookOpenCheck className="size-4" aria-hidden="true" />
                </span>
                <span className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-semibold">SAT Master</span>
                  <span className="truncate text-xs text-sidebar-foreground/65">Learning workspace</span>
                </span>
              </NavLink>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Workspace</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navigation.map(item => <NavigationItem key={item.to} {...item} />)}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton size="lg" className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground">
                  <Avatar className="size-8 rounded-lg grayscale">
                    <AvatarImage src={userAvatar || undefined} alt={userName} />
                    <AvatarFallback className="rounded-lg">{initials}</AvatarFallback>
                  </Avatar>
                  <span className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-medium">{userName}</span>
                    <span className="truncate text-xs text-sidebar-foreground/65">{role.toLowerCase()}</span>
                  </span>
                  <ChevronsUpDown className="ml-auto size-4" aria-hidden="true" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                className="w-(--radix-dropdown-menu-trigger-width) min-w-56"
                side={isMobile ? 'bottom' : 'right'}
                align="end"
                sideOffset={4}
              >
                <DropdownMenuLabel>
                  <p className="truncate text-sm font-medium">{userName}</p>
                  <p className="truncate text-xs font-normal text-muted-foreground">{role.toLowerCase()}</p>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={onBackground}>
                  <Palette aria-hidden="true" />
                  Background
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive" onSelect={onLogout}>
                  <LogOut aria-hidden="true" />
                  Log out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}

function ThemeToggle() {
  const [dark, setDark] = useState(() => localStorage.getItem('dashboardTheme') === 'dark');

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
    localStorage.setItem('dashboardTheme', dark ? 'dark' : 'light');
  }, [dark]);

  return (
    <Button variant="ghost" size="icon" onClick={() => setDark(value => !value)} aria-label={dark ? 'Use light theme' : 'Use dark theme'}>
      {dark ? <Sun aria-hidden="true" /> : <Moon aria-hidden="true" />}
    </Button>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const location = useLocation();
  const userId = localStorage.getItem('userId') || 'guest';
  const storageKey = `dashboardBackground:${userId}`;
  const [backgroundId, setBackgroundId] = useState<BackgroundId>(() => normalizeBackgroundId(localStorage.getItem(storageKey)));
  const [backgroundOpen, setBackgroundOpen] = useState(false);
  const [backgroundSaving, setBackgroundSaving] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);

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

  useEffect(() => {
    document.documentElement.style.setProperty('--dashboard-sidebar-offset', sidebarOpen ? '17rem' : '3rem');
    return () => {
      document.documentElement.style.removeProperty('--dashboard-sidebar-offset');
    };
  }, [sidebarOpen]);

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

  return (
    <SidebarProvider
      open={sidebarOpen}
      onOpenChange={setSidebarOpen}
      style={{ '--sidebar-width': '17rem' } as CSSProperties}
      className="h-dvh min-h-0 overflow-hidden bg-background font-sans text-foreground"
    >
      <a href="#dashboard-content" className="fixed left-3 top-3 z-300 -translate-y-20 rounded-lg bg-popover px-3 py-2 text-sm font-medium text-popover-foreground shadow-md focus:translate-y-0">
        Skip to content
      </a>
      <AppSidebar onBackground={() => setBackgroundOpen(true)} onLogout={() => void logout()} />
      <SidebarInset className="min-h-0 min-w-0 overflow-hidden">
        <header className="flex h-12 shrink-0 items-center justify-between gap-2 border-b bg-background/80 px-4 backdrop-blur-sm">
          <div className="flex min-w-0 items-center gap-2">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="mx-1 h-4" />
            <p className="truncate text-sm font-medium">{pageTitle(location.pathname)}</p>
          </div>
          <div className="flex items-center gap-1">
            <ThemeToggle />
            <NotificationBell currentUserId={userId} />
          </div>
        </header>

        <div
          id="dashboard-content"
          tabIndex={-1}
          className="dashboard-surface relative min-h-0 min-w-0 flex-1 overflow-hidden bg-background bg-cover bg-center outline-hidden"
          data-background-active={selectedBackground ? 'true' : 'false'}
          style={selectedBackground ? {
            backgroundImage: `linear-gradient(color-mix(in oklch, var(--background) 84%, transparent), color-mix(in oklch, var(--background) 90%, transparent)), url(${selectedBackground.image})`,
          } : undefined}
        >
          <DashboardRouteViewport />
        </div>
      </SidebarInset>

      <BackgroundPicker
        open={backgroundOpen}
        selectedId={backgroundId}
        saving={backgroundSaving}
        onSelect={id => void chooseBackground(id)}
        onClose={() => setBackgroundOpen(false)}
      />
    </SidebarProvider>
  );
}
