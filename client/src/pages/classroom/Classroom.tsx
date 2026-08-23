import { useCallback, useEffect, useMemo, useState, type ElementType, type ReactNode } from 'react';
import { AlertTriangle, BarChart3, Bell, Calendar, Check, ClipboardList, Clock, Copy, GitBranch, Megaphone, Plus, Trash2, Users } from 'lucide-react';
import { compareAsc, format, formatDistanceToNow, isPast, isToday, isTomorrow } from 'date-fns';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import axiosClient from '../../lib/axios';
import { AppHeader, BackButton, Button, Card, Input, Modal, TableShell } from '../../components/ui/AppUI';
import { ui } from '../../components/ui/styles';
import StudentAnalytics from '../../features/analytics/StudentAnalytics';
import NotificationBell from '../../features/notifications/NotificationBell';
import { SatCountdown } from '../../features/sat-countdown/SatCountdown';
import AnnouncementCreator from '../../features/notifications/AnnouncementCreator';
import WeeklyProgress from '../../features/analytics/WeeklyProgress';
import { capitalizeFirstLetter } from '../../utils/text';

type UserRole = 'STUDENT' | 'TEACHER' | 'ADMIN';
type ClassroomTab = 'NOTIFICATIONS' | 'MEMBERS' | 'PROGRESS' | 'PERFORMANCE';
type NotificationFilter = 'all' | 'assignment' | 'announcement';

interface CurrentUser { id: string; name: string; role: UserRole }
interface ClassMember { id: number; name: string | null; email: string; createdAt: string }
interface ClassAssignment {
  id: string;
  title: string;
  type?: 'assignment' | 'announcement';
  content?: string | null;
  deadline?: string | null;
  createdAt: string;
  testIds?: number[];
}
interface ClassDetail {
  id: string;
  name: string;
  color?: string;
  teacher: ClassMember;
  students: ClassMember[];
  assignments: ClassAssignment[];
}
interface AnnouncementData { title: string; content?: string; deadline?: string | null; fileUrls?: string[]; links?: string[] }

const AVATAR_COLORS = ['#1B7A5A', '#0F4D38', '#2563EB', '#A16207', '#8B3A62', '#475569'];
const requestErrorMessage = (error: unknown, fallback: string) => (error as { response?: { data?: { error?: string } } })?.response?.data?.error || fallback;
const plainText = (value?: string | null) => String(value || '').replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
const notificationType = (item: ClassAssignment): 'assignment' | 'announcement' => item.type || (item.deadline || item.testIds?.length ? 'assignment' : 'announcement');

export default function Classroom() {
  const { classId } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [currentUser] = useState<CurrentUser | null>(() => {
    const id = localStorage.getItem('userId');
    if (!id) return null;
    return { id, name: localStorage.getItem('userName') || 'User', role: (localStorage.getItem('userRole') || 'STUDENT') as UserRole };
  });
  const [classDetail, setClassDetail] = useState<ClassDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [activeTab, setActiveTab] = useState<ClassroomTab>('NOTIFICATIONS');
  const [announcementOpen, setAnnouncementOpen] = useState(false);
  const [addStudentOpen, setAddStudentOpen] = useState(false);
  const [studentToRemove, setStudentToRemove] = useState<ClassMember | null>(null);

  const fetchClassDetail = useCallback(async () => {
    if (!classId) return;
    setLoading(true);
    setLoadError('');
    try {
      const result = await axiosClient.get<ClassDetail, ClassDetail>(`/api/classes/${classId}`);
      setClassDetail({ ...result, name: capitalizeFirstLetter(result.name) });
    } catch (error) {
      console.error(error);
      setLoadError(requestErrorMessage(error, 'Unable to load class details.'));
    } finally {
      setLoading(false);
    }
  }, [classId]);

  useEffect(() => {
    void fetchClassDetail();
  }, [fetchClassDetail]);

  const canManage = currentUser?.role === 'TEACHER' || currentUser?.role === 'ADMIN';

  useEffect(() => {
    const requestedTab = searchParams.get('tab')?.toUpperCase();
    if (requestedTab === 'NOTIFICATIONS' || requestedTab === 'MEMBERS' || requestedTab === 'PROGRESS') setActiveTab(requestedTab);
    if (canManage && requestedTab === 'PERFORMANCE') setActiveTab(requestedTab);
  }, [canManage, searchParams]);

  const selectTab = (tab: ClassroomTab) => {
    setActiveTab(tab);
    const next = new URLSearchParams(searchParams);
    next.set('tab', tab.toLowerCase());
    if (tab !== 'PERFORMANCE') next.delete('deliveryId');
    setSearchParams(next, { replace: true });
  };

  const createAnnouncement = async (data: AnnouncementData) => {
    if (!classId) return;
    try {
      const type = data.deadline ? 'assignment' : 'announcement';
      await axiosClient.post('/api/classes/posts', { classId, title: data.title, content: data.content, type, deadline: data.deadline || null, driveFiles: data.fileUrls || [], externalLinks: data.links || [], testIds: [] });
      toast.success(type === 'assignment' ? 'Assignment posted' : 'Announcement posted');
      setAnnouncementOpen(false);
      await fetchClassDetail();
    } catch (error) {
      toast.error(requestErrorMessage(error, 'Unable to publish announcement.'));
    }
  };

  const addStudent = async (email: string) => {
    if (!classId) return;
    await axiosClient.post(`/api/classes/${classId}/students`, { email });
    await fetchClassDetail();
  };

  const removeStudent = async () => {
    if (!classId || !studentToRemove) return;
    await axiosClient.delete(`/api/classes/${classId}/students/${studentToRemove.id}`);
    setStudentToRemove(null);
    await fetchClassDetail();
  };

  if (!currentUser || loading) return <ClassroomLoading />;
  if (!classDetail || loadError) return <ClassroomError message={loadError} onBack={() => navigate('/dashboard/classes')} onRetry={() => void fetchClassDetail()} />;

  const tabs: Array<{ id: ClassroomTab; label: string; icon: ElementType }> = [
    { id: 'NOTIFICATIONS', label: 'Notifications', icon: Bell },
    { id: 'MEMBERS', label: 'Members', icon: Users },
    { id: 'PROGRESS', label: 'Progress Timeline', icon: GitBranch },
    ...(canManage ? [{ id: 'PERFORMANCE' as ClassroomTab, label: 'Performance', icon: BarChart3 }] : []),
  ];

  return <div className={ui.page}>
    <ClassroomHeader
      className={classDetail.name}
      tabs={tabs}
      activeTab={activeTab}
      onSelectTab={selectTab}
      onBack={() => navigate('/dashboard/classes')}
      currentUser={currentUser}
    />

    <main className="min-h-0 flex-1 overflow-y-auto"><div className="mx-auto w-full max-w-[1200px]">
      {activeTab === 'NOTIFICATIONS' && <NotificationsTab classroom={classDetail} canManage={canManage} onNewAnnouncement={() => setAnnouncementOpen(true)} onOpenAssignment={assignmentId => navigate(`/dashboard/class/${classId}/assignment/${assignmentId}`)} />}
      {activeTab === 'MEMBERS' && <MembersTab classroom={classDetail} canManage={canManage} onInvite={() => setAddStudentOpen(true)} onRemove={setStudentToRemove} />}
      {activeTab === 'PROGRESS' && <div className="p-6 lg:p-8"><WeeklyProgress canManage={canManage} /></div>}
      {activeTab === 'PERFORMANCE' && canManage && <div className="p-6 lg:p-8"><StudentAnalytics classId={classId} initialDeliveryId={searchParams.get('deliveryId')} /></div>}
    </div></main>

    {announcementOpen && <AnnouncementCreator onClose={() => setAnnouncementOpen(false)} onSubmit={data => void createAnnouncement(data)} />}
    <AddStudentModal open={addStudentOpen} onClose={() => setAddStudentOpen(false)} onAdd={addStudent} />
    <RemoveStudentModal student={studentToRemove} onClose={() => setStudentToRemove(null)} onRemove={removeStudent} />
  </div>;
}

function ClassroomHeader({ className, tabs, activeTab, onSelectTab, onBack, currentUser }: { className: string; tabs: Array<{ id: ClassroomTab; label: string; icon: ElementType }>; activeTab: ClassroomTab; onSelectTab: (tab: ClassroomTab) => void; onBack: () => void; currentUser: CurrentUser }) {
  const profileInitials = initials(currentUser.name);
  return <header className="sticky top-0 z-30 grid h-[68px] shrink-0 grid-cols-[minmax(180px,1fr)_auto_minmax(88px,1fr)] items-center border-b border-[#B9CBC4] bg-white px-4 lg:px-6">
    <div className="flex min-w-0 items-center gap-2.5">
      <BackButton onClick={onBack} />
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold leading-5 text-[#1A1A1A]">Classroom</p>
        <p className="truncate text-xs leading-4 text-[#6B7280]">{className}</p>
      </div>
    </div>
    <nav className="flex h-full min-w-0 overflow-x-auto" aria-label="Classroom sections">{tabs.map(tab => <ClassTabButton key={tab.id} {...tab} active={activeTab === tab.id} onSelect={onSelectTab} />)}</nav>
    <div className="flex items-center justify-end gap-4">
      {currentUser.role === 'STUDENT' && <SatCountdown />}
      <NotificationBell currentUserId={currentUser.id} />
      <div className="flex h-8 min-h-8 w-8 min-w-8 shrink-0 items-center justify-center rounded-full bg-[#1B7A5A] text-xs font-semibold text-white" title={currentUser.name}>{profileInitials}</div>
    </div>
  </header>;
}

function ClassTabButton({ id, label, icon: Icon, active, onSelect }: { id: ClassroomTab; label: string; icon: ElementType; active: boolean; onSelect: (tab: ClassroomTab) => void }) {
  return <button type="button" onClick={() => onSelect(id)} className={`relative flex h-full shrink-0 items-center gap-1.5 border-0 px-4 text-sm transition-colors ${active ? 'font-medium text-[#1B7A5A]' : 'text-[#6B7280] hover:text-[#1A1A1A]'}`}><Icon size={14} />{label}{active && <span aria-hidden className="absolute inset-x-0 bottom-0 h-0.5 bg-[#1B7A5A]" />}</button>;
}

function NotificationsTab({ classroom, canManage, onNewAnnouncement, onOpenAssignment }: { classroom: ClassDetail; canManage: boolean; onNewAnnouncement: () => void; onOpenAssignment: (assignmentId: string) => void }) {
  const [filter, setFilter] = useState<NotificationFilter>('all');
  const assignments = useMemo(() => classroom.assignments || [], [classroom.assignments]);
  const counts = useMemo(() => ({ all: assignments.length, assignment: assignments.filter(item => notificationType(item) === 'assignment').length, announcement: assignments.filter(item => notificationType(item) === 'announcement').length }), [assignments]);
  const filtered = assignments.filter(item => filter === 'all' || notificationType(item) === filter);
  const attention = assignments.filter(item => notificationType(item) === 'assignment' && item.deadline).sort((a, b) => compareAsc(new Date(a.deadline as string), new Date(b.deadline as string))).slice(0, 2);

  return <div className="p-5 md:p-6 lg:p-8"><div className="flex min-w-0 flex-col gap-6">
    {canManage && <div className="flex flex-wrap items-center justify-between gap-4"><InviteCodeWidget classId={classroom.id} /><Button size="sm" onClick={onNewAnnouncement}><Plus size={14} />New announcement</Button></div>}
    <div className="grid min-w-0 grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(220px,300px)_minmax(0,1fr)] lg:gap-8">
      <aside className="flex min-w-0 flex-col gap-5">
        <Card className="flex flex-col gap-1 p-3"><FilterButton active={filter === 'all'} icon={Bell} label="All Notifications" count={counts.all} onClick={() => setFilter('all')} /><FilterButton active={filter === 'assignment'} icon={ClipboardList} label="Assignments" count={counts.assignment} onClick={() => setFilter('assignment')} /><FilterButton active={filter === 'announcement'} icon={Megaphone} label="Announcements" count={counts.announcement} onClick={() => setFilter('announcement')} /></Card>
        <Card className="relative overflow-hidden p-5"><div className="pointer-events-none absolute right-0 top-0 h-24 w-24 rounded-bl-full bg-[#E8F5EF] opacity-60" /><h3 className="relative z-10 mb-4 text-sm font-bold text-[#1A1A1A]">Needs Attention</h3><div className="relative z-10 flex flex-col gap-4">{attention.length === 0 ? <p className="text-xs leading-5 text-[#6B7280]">You're all caught up.</p> : attention.map(item => { const urgent = Boolean(item.deadline && (isPast(new Date(item.deadline)) || isToday(new Date(item.deadline)))); return <button key={item.id} type="button" onClick={() => onOpenAssignment(item.id)} className="relative flex gap-3 border-0 py-0 pl-3 text-left"><span aria-hidden className={`absolute inset-y-0 left-0 w-0.5 ${urgent ? 'bg-rose-500' : 'bg-amber-500'}`} /><div className="flex min-w-0 flex-col gap-0.5"><p className="line-clamp-1 text-xs font-semibold text-[#1A1A1A]">{item.title}</p><span className={`flex items-center gap-1 text-[11px] font-medium ${urgent ? 'text-rose-600' : 'text-[#6B7280]'}`}>{urgent ? <AlertTriangle size={11} /> : <Clock size={11} />}{formatAttentionDueDate(item.deadline)}</span></div></button>; })}</div></Card>
      </aside>
      <section className="flex min-w-0 flex-col gap-4">{filtered.length === 0 ? <Card className="flex min-h-56 flex-col items-center justify-center p-8 text-center"><Bell size={22} className="text-[#1B7A5A]" /><h3 className="mt-3 text-sm font-semibold text-[#1A1A1A]">No notifications</h3><p className="mt-1 text-xs text-[#6B7280]">New announcements and assignments will appear here.</p></Card> : filtered.map(item => <NotificationCard key={item.id} item={item} onOpen={() => onOpenAssignment(item.id)} />)}</section>
    </div>
  </div></div>;
}

function FilterButton({ active, icon: Icon, label, count, onClick }: { active: boolean; icon: ElementType; label: string; count: number; onClick: () => void }) {
  return <button type="button" onClick={onClick} className={`flex items-center justify-between rounded-lg px-3 py-2.5 text-xs font-medium transition-colors ${active ? 'bg-[#E8F5EF] text-[#145F47]' : 'text-[#5E6B66] hover:bg-[#F2F8F5] hover:text-[#1A1A1A]'}`}><span className="flex items-center gap-2.5"><Icon size={14} />{label}</span><span className="rounded-full bg-black/5 px-2 py-0.5 text-[11px] font-semibold">{count}</span></button>;
}

function NotificationCard({ item, onOpen }: { item: ClassAssignment; onOpen: () => void }) {
  const type = notificationType(item);
  const assignment = type === 'assignment';
  const body = plainText(item.content);
  return <Card className={`flex min-w-0 gap-4 overflow-hidden border-l-4 p-4 sm:p-5 ${assignment ? 'border-l-[#1B7A5A]' : 'border-l-[#E8C040]'}`}><span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${assignment ? 'bg-[#E8F5EF] text-[#1B7A5A]' : 'bg-[#FEF9E7] text-[#92640A]'}`}>{assignment ? <ClipboardList size={16} /> : <Megaphone size={16} />}</span><div className="min-w-0 flex-1"><div className="flex min-w-0 flex-wrap items-center justify-between gap-x-3 gap-y-1"><span className={`text-[10px] font-semibold tracking-[0.1em] ${assignment ? 'text-[#1B7A5A]' : 'text-[#92640A]'}`}>{assignment ? 'ASSIGNMENT' : 'ANNOUNCEMENT'}</span><span className="text-xs text-[#6B7280]">{formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })}</span></div><h3 className="mt-1 break-words text-sm font-semibold leading-5 text-[#1A1A1A]">{item.title}</h3>{body && <p className="mt-1.5 line-clamp-2 break-words text-xs leading-5 text-[#5E6B66]">{body}</p>}<div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[#D2DED9] pt-3">{item.deadline ? <span className={`flex items-center gap-1.5 text-xs font-medium ${isPast(new Date(item.deadline)) ? 'text-red-700' : 'text-[#7A5600]'}`}><Calendar size={13} />{formatDueDate(item.deadline)}</span> : <span />}<button type="button" onClick={onOpen} className="flex items-center gap-1 text-xs font-semibold text-[#1B7A5A] hover:underline">{assignment ? 'View assignment' : 'Read more'}<span aria-hidden>→</span></button></div></div></Card>;
}

function InviteCodeWidget({ classId }: { classId: string }) {
  const [copied, setCopied] = useState(false);
  const code = classId.slice(0, 8).toUpperCase();
  const copy = async () => { await navigator.clipboard.writeText(classId); setCopied(true); window.setTimeout(() => setCopied(false), 1600); };
  return <div className="flex max-w-[280px] items-center justify-between gap-3 rounded-xl border border-[#C2DDD4] bg-[#E8F5EF] px-3 py-2"><div><p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[#1B7A5A]/80">Class invite code</p><p className="mt-0.5 font-mono text-sm font-semibold tracking-[0.14em] text-[#145F47]">{code}</p></div><button type="button" onClick={() => void copy()} className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#1B7A5A]/10 text-[#1B7A5A] hover:bg-[#1B7A5A]/20" aria-label="Copy class code">{copied ? <Check size={14} /> : <Copy size={14} />}</button></div>;
}

function MembersTab({ classroom, canManage, onInvite, onRemove }: { classroom: ClassDetail; canManage: boolean; onInvite: () => void; onRemove: (student: ClassMember) => void }) {
  return <div className="flex flex-col gap-8 p-5 md:p-6 lg:p-8">
    <MemberSection title="Teachers" count={1}>
      <MemberTable label="Teacher" members={[classroom.teacher]} canManage={false} />
    </MemberSection>

    <MemberSection
      title="Students"
      count={classroom.students.length}
      action={canManage ? <Button size="sm" onClick={onInvite}><Plus size={14} />Invite student</Button> : undefined}
    >
      <MemberTable label="Student" members={classroom.students} canManage={canManage} onRemove={onRemove} />
    </MemberSection>
  </div>;
}

function MemberSection({ title, count, action, children }: { title: string; count: number; action?: ReactNode; children: ReactNode }) {
  return <section>
    <div className="mb-4 flex items-center justify-between gap-4">
      <div className="flex items-baseline gap-2"><h2 className="text-base font-semibold text-[#1A1A1A]">{title}</h2><span className="text-xs text-[#6B7280]">{count}</span></div>
      {action}
    </div>
    {children}
  </section>;
}

function MemberTable({ label, members, canManage, onRemove }: { label: 'Teacher' | 'Student'; members: ClassMember[]; canManage: boolean; onRemove?: (student: ClassMember) => void }) {
  return <TableShell className="!border-[#C9D8D2] !shadow-none"><div className="overflow-x-auto"><table className="w-full min-w-[680px] table-fixed text-sm">
    <thead><tr className="border-b border-[#C9D8D2] bg-[#F5FAF7]"><th className="w-[30%] px-5 py-3 text-left text-xs font-medium text-[#5E6B66]">{label}</th><th className="w-[34%] px-4 py-3 text-left text-xs font-medium text-[#5E6B66]">Email</th><th className="w-[24%] px-4 py-3 text-left text-xs font-medium text-[#5E6B66]">Joined</th><th className="w-[12%] px-5 py-3 text-right text-xs font-medium text-[#5E6B66]">Actions</th></tr></thead>
    <tbody>{members.length === 0 ? <tr><td colSpan={4} className="px-5 py-14 text-center text-sm text-[#6B7280]">No students have joined this class yet.</td></tr> : members.map((member, index) => <tr key={member.id} className={`${index < members.length - 1 ? 'border-b border-[#D2DED9]' : ''} transition-colors hover:bg-[#F9FCFA]`}>
      <td className="px-5 py-3"><div className="flex min-w-0 items-center gap-2.5"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white" style={{ backgroundColor: AVATAR_COLORS[index % AVATAR_COLORS.length] }}>{initials(member.name)}</span><span className="truncate font-medium text-[#1A1A1A]">{member.name || `Unknown ${label.toLowerCase()}`}</span></div></td>
      <td className="truncate px-4 py-3 text-[#4B5563]" title={member.email}>{member.email}</td>
      <td className="px-4 py-3 text-[#5E6B66]">{formatMemberSince(member.createdAt)}</td>
      <td className="px-5 py-3 text-right">{canManage && onRemove ? <button type="button" onClick={() => onRemove(member)} className="app-icon-button ml-auto h-8 w-8 text-[#6B7280] hover:bg-red-50 hover:text-red-700" aria-label={`Remove ${member.name || 'student'}`} title="Remove student"><Trash2 size={15} /></button> : <span className="text-[#9CA3AF]">—</span>}</td>
    </tr>)}</tbody>
  </table></div></TableShell>;
}

function AddStudentModal({ open, onClose, onAdd }: { open: boolean; onClose: () => void; onAdd: (email: string) => Promise<void> }) {
  const [email, setEmail] = useState('');
  const [saving, setSaving] = useState(false);
  const submit = async (event: React.FormEvent) => { event.preventDefault(); if (!email.trim()) return; setSaving(true); try { await onAdd(email.trim()); toast.success('Student added'); setEmail(''); onClose(); } catch (error) { toast.error(requestErrorMessage(error, 'This student could not be added.')); } finally { setSaving(false); } };
  return <Modal open={open} onClose={onClose} closeOnBackdrop title="Invite a student" subtitle="Add a student to this class using their account email." footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button disabled={saving || !email.trim()} onClick={submit}>{saving ? 'Adding…' : 'Add student'}</Button></>}><form onSubmit={submit}><label className="block"><span className="mb-2 block text-sm font-medium text-[#1A1A1A]">Student email</span><Input autoFocus type="email" className="w-full" value={email} onChange={event => setEmail(event.target.value)} placeholder="student@example.com" /></label></form></Modal>;
}

function RemoveStudentModal({ student, onClose, onRemove }: { student: ClassMember | null; onClose: () => void; onRemove: () => Promise<void> }) {
  const [removing, setRemoving] = useState(false);
  const submit = async () => { setRemoving(true); try { await onRemove(); toast.success('Student removed'); } catch (error) { toast.error(requestErrorMessage(error, 'Unable to remove this student.')); } finally { setRemoving(false); } };
  return <Modal open={Boolean(student)} onClose={onClose} closeOnBackdrop title="Remove student" subtitle="This student will lose access to the class and its assigned tests." footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button variant="destructive" disabled={removing} onClick={() => void submit()}>{removing ? 'Removing…' : 'Remove student'}</Button></>}><p className="text-sm leading-6 text-[#4B5563]">Remove <span className="font-semibold text-[#1A1A1A]">{student?.name || student?.email}</span> from this class?</p></Modal>;
}

function ClassroomLoading() {
  return <div className={ui.page}><div className="h-[60px] animate-pulse border-b border-[#C9D8D2] bg-white" /><div className="mx-auto grid w-full max-w-[1200px] gap-8 p-8 lg:grid-cols-12"><div className="h-56 animate-pulse rounded-xl bg-[#DDE9E4] lg:col-span-4" /><div className="h-80 animate-pulse rounded-xl bg-[#DDE9E4] lg:col-span-8" /></div></div>;
}

function ClassroomError({ message, onBack, onRetry }: { message: string; onBack: () => void; onRetry: () => void }) {
  return <div className={ui.page}><AppHeader title="Classroom" showProfile={false} /><main className="flex flex-1 items-center justify-center p-6"><Card className="w-full max-w-md p-8 text-center"><h2 className="text-base font-semibold text-[#1A1A1A]">Class could not be loaded</h2><p className="mt-2 text-sm text-[#6B7280]">{message}</p><div className="mt-5 flex justify-center gap-2"><BackButton onClick={onBack} /><Button variant="outline" onClick={onRetry}>Try again</Button></div></Card></main></div>;
}

const initials = (name: string | null) => String(name || 'Student').split(/\s+/).filter(Boolean).slice(-2).map(part => part[0]).join('').toUpperCase();
const formatDueDate = (value?: string | null) => value ? `${isPast(new Date(value)) ? 'Overdue' : 'Due'} ${format(new Date(value), 'MMM d')}` : '';
const formatAttentionDueDate = (value?: string | null) => {
  if (!value) return '';
  const dueDate = new Date(value);
  if (isToday(dueDate)) return 'Due Today';
  if (isTomorrow(dueDate)) return 'Due Tomorrow';
  if (isPast(dueDate)) return `Overdue ${format(dueDate, 'MMM d')}`;
  return `Due ${format(dueDate, 'MMM d')}`;
};
const formatMemberSince = (value?: string | null) => value ? format(new Date(value), 'MMM d, yyyy') : '—';
