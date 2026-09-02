import { useEffect, useState, type CSSProperties, type ElementType } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  BarChart3,
  BookA,
  BookOpenCheck,
  GraduationCap,
  LayoutDashboard,
  ArrowLeft,
  EllipsisVertical,
  LogOut,
  Moon,
  Search,
  Sun,
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
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
import { DashboardRouteViewport } from '../../features/navigation/DashboardRouteViewport';
import { DashboardBackProvider, useDashboardBackAction } from '../../features/navigation/DashboardBackContext';
import NotificationBell from '../../features/notifications/NotificationBell';
import { logoutAuthSession } from '../../lib/authSession';

const navigation = [
  { to: '/dashboard', label: 'Overview', icon: LayoutDashboard, exact: true },
  { to: '/dashboard/practice-test', label: 'Practice Center', icon: BookOpenCheck },
  { to: '/dashboard/classes', label: 'Classroom', icon: GraduationCap, activePrefixes: ['/dashboard/class/'] },
  { to: '/dashboard/vocabulary', label: 'Vocabulary', icon: BookA },
  { to: '/dashboard/error-log', label: 'Error Log', icon: AlertCircle },
  { to: '/dashboard/results-analytics', label: 'Results & Analytics', icon: BarChart3 },
] as const;

const navigationForRole = (role: string) => navigation
  .filter(item => role === 'STUDENT' || !['/dashboard/error-log', '/dashboard/results-analytics'].includes(item.to))
  .map(item => {
    if (item.to === '/dashboard/practice-test') return { ...item, label: role === 'ADMIN' ? 'Test Management' : role === 'TEACHER' ? 'Test Library' : item.label };
    if (item.to === '/dashboard/classes' && role === 'TEACHER') return { ...item, label: 'Classrooms' };
    return item;
  });

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

function AppSidebar({ onLogout }: { onLogout: () => void }) {
  const role = localStorage.getItem('userRole') || 'STUDENT';

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="flex-row items-center gap-1">
        <SidebarMenu className="min-w-0 flex-1 group-data-[collapsible=icon]:hidden">
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
        <SidebarTrigger className="ml-auto shrink-0" />
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Workspace</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navigationForRole(role).map(item => <NavigationItem key={item.to} {...item} />)}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarAccountMenu onLogout={onLogout} />
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}

function DashboardHeaderNavigation() {
  const backAction = useDashboardBackAction();
  return (
    <div className="flex min-w-0 items-center gap-2">
      <SidebarTrigger className="-ml-1 md:hidden" />
      <Button
        variant="ghost"
        size="sm"
        disabled={!backAction}
        onClick={() => backAction?.()}
        className={backAction ? 'font-semibold text-foreground' : 'font-normal text-muted-foreground'}
        aria-label={backAction ? 'Back' : 'Back is unavailable on this page'}
      >
        <ArrowLeft aria-hidden="true" />
        <span className="hidden sm:inline">Back</span>
      </Button>
      <Separator orientation="vertical" className="mx-1 h-4" />
      <DashboardSearch />
    </div>
  );
}

function DashboardSearch() {
  const navigate = useNavigate();
  const role = localStorage.getItem('userRole') || 'STUDENT';
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'j') {
        event.preventDefault();
        setOpen(value => !value);
      }
    };
    document.addEventListener('keydown', handleShortcut);
    return () => document.removeEventListener('keydown', handleShortcut);
  }, []);

  const matches = navigationForRole(role).filter(item => item.label.toLowerCase().includes(query.trim().toLowerCase()));
  const openRoute = (to: string) => {
    navigate(to);
    setOpen(false);
    setQuery('');
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" className="h-8 justify-start gap-2 px-2 text-muted-foreground sm:w-52" aria-label="Search workspace">
          <Search className="size-4" aria-hidden="true" />
          <span className="hidden sm:inline">Search</span>
          <kbd className="ml-auto hidden rounded border bg-muted px-1.5 py-0.5 font-mono text-[10px] sm:inline">Ctrl J</kbd>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Search workspace</DialogTitle>
          <DialogDescription>Jump to a SAT Master section.</DialogDescription>
        </DialogHeader>
        <label className="relative block">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input autoFocus value={query} onChange={event => setQuery(event.target.value)} placeholder="Search sections..." className="pl-9" />
        </label>
        <div className="grid gap-1">
          {matches.map(item => <Button key={item.to} variant="ghost" className="justify-start" onClick={() => openRoute(item.to)}><item.icon aria-hidden="true" />{item.label}</Button>)}
          {matches.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">No matching section.</p>}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function SidebarAccountMenu({ onLogout }: { onLogout: () => void }) {
  const userName = localStorage.getItem('userName') || 'Student';
  const userAvatar = localStorage.getItem('userAvatar') || '';
  const role = localStorage.getItem('userRole') || 'STUDENT';
  const initials = userName.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join('').toUpperCase() || 'S';
  const { isMobile } = useSidebar();

  return (
    <SidebarMenu><SidebarMenuItem><DropdownMenu>
        <DropdownMenuTrigger asChild>
          <SidebarMenuButton size="lg" className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground" tooltip={userName}>
            <Avatar className="size-8 rounded-lg grayscale"><AvatarImage src={userAvatar || undefined} alt={userName} /><AvatarFallback className="rounded-lg">{initials}</AvatarFallback></Avatar>
            <div className="grid min-w-0 flex-1 text-left text-sm leading-tight"><span className="truncate font-medium">{userName}</span><span className="truncate text-xs capitalize text-muted-foreground">{role.toLowerCase()}</span></div>
            <EllipsisVertical className="ml-auto size-4" aria-hidden="true" />
          </SidebarMenuButton>
        </DropdownMenuTrigger>
        <DropdownMenuContent side={isMobile ? 'bottom' : 'right'} align="end" sideOffset={4} className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg">
          <DropdownMenuLabel className="p-0 font-normal"><div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm"><Avatar className="size-8 rounded-lg"><AvatarImage src={userAvatar || undefined} alt={userName} /><AvatarFallback className="rounded-lg">{initials}</AvatarFallback></Avatar><div className="grid min-w-0 flex-1 text-left text-sm leading-tight"><span className="truncate font-medium">{userName}</span><span className="truncate text-xs capitalize text-muted-foreground">{role.toLowerCase()}</span></div></div></DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onSelect={onLogout}><LogOut aria-hidden="true" />Log out</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu></SidebarMenuItem></SidebarMenu>
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
  const userId = localStorage.getItem('userId') || 'guest';
  const [sidebarOpen, setSidebarOpen] = useState(true);

  useEffect(() => {
    document.documentElement.style.setProperty('--dashboard-sidebar-offset', sidebarOpen ? '17rem' : '3rem');
    return () => {
      document.documentElement.style.removeProperty('--dashboard-sidebar-offset');
    };
  }, [sidebarOpen]);

  const logout = async () => {
    await logoutAuthSession();
    navigate('/auth', { replace: true });
  };

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
      <DashboardBackProvider>
        <AppSidebar onLogout={() => void logout()} />
        <SidebarInset className="min-h-0 min-w-0 overflow-hidden">
          <header className="flex h-12 shrink-0 items-center justify-between gap-2 border-b bg-background/80 px-4 backdrop-blur-sm">
            <DashboardHeaderNavigation />
            <div className="flex items-center gap-1">
              <ThemeToggle />
              <NotificationBell currentUserId={userId} />
            </div>
          </header>

          <div id="dashboard-content" tabIndex={-1} className="dashboard-surface relative min-h-0 min-w-0 flex-1 overflow-hidden bg-muted/30 outline-hidden">
            <DashboardRouteViewport />
          </div>
        </SidebarInset>
      </DashboardBackProvider>
    </SidebarProvider>
  );
}
