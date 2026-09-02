import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { BarChart3, Bell, Check, ClipboardList, Copy, ExternalLink, GitBranch, Megaphone, Plus, Trash2, Users } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import axiosClient from '../../lib/axios';
import { Button, Card, Input, Modal, PageHeader, TableShell, Tabs, type TabItem } from '../../components/ui/AppUI';
import { useDashboardBack } from '../../features/navigation/DashboardBackContext';
import StudentAnalytics from '../../features/analytics/StudentAnalytics';
import AnnouncementDialog from '../../features/classroom/AnnouncementDialog';
import WeeklyProgress from '../../features/analytics/WeeklyProgress';
import ClassroomActivities from '../../features/classroom/ClassroomActivities';
import { capitalizeFirstLetter } from '../../utils/text';

type UserRole = 'STUDENT' | 'TEACHER' | 'ADMIN';
type ClassroomTab = 'LESSONS' | 'ACTIVITIES' | 'PERFORMANCE' | 'MEMBERS' | 'ANNOUNCEMENTS';

interface CurrentUser { id: string; name: string; role: UserRole }
interface ClassMember { id: number; name: string | null; email: string; createdAt: string }
interface ClassDetail {
  id: string;
  name: string;
  color?: string;
  teacher: ClassMember;
  students: ClassMember[];
  assignments: unknown[];
}
interface ClassAnnouncement { id: string; title: string; content?: string | null; fileUrls: string[]; links: string[]; createdAt: string; author: { id: number; name: string | null } }

const AVATAR_COLORS = ['#1B7A5A', '#0F4D38', '#2563EB', '#A16207', '#8B3A62', '#475569'];
const requestErrorMessage = (error: unknown, fallback: string) => (error as { response?: { data?: { error?: string } } })?.response?.data?.error || fallback;

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
  const [activeTab, setActiveTab] = useState<ClassroomTab>('LESSONS');
  const [announcementOpen, setAnnouncementOpen] = useState(false);
  const [announcementVersion, setAnnouncementVersion] = useState(0);
  const [addStudentOpen, setAddStudentOpen] = useState(false);
  const [studentToRemove, setStudentToRemove] = useState<ClassMember | null>(null);
  useDashboardBack(() => navigate('/dashboard/classes'));

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
    const aliases: Record<string, ClassroomTab> = { PROGRESS: 'LESSONS', NOTIFICATIONS: 'ANNOUNCEMENTS' };
    const resolved = aliases[requestedTab || ''] || requestedTab;
    if (requestedTab && aliases[requestedTab]) {
      const next = new URLSearchParams(searchParams);
      next.set('tab', aliases[requestedTab].toLowerCase());
      setSearchParams(next, { replace: true });
    }
    if (resolved === 'LESSONS' || resolved === 'ACTIVITIES' || resolved === 'MEMBERS' || resolved === 'ANNOUNCEMENTS') setActiveTab(resolved);
    if (canManage && resolved === 'PERFORMANCE') setActiveTab(resolved);
  }, [canManage, searchParams, setSearchParams]);

  const selectTab = (tab: ClassroomTab) => {
    setActiveTab(tab);
    const next = new URLSearchParams(searchParams);
    next.set('tab', tab.toLowerCase());
    if (tab !== 'PERFORMANCE') next.delete('deliveryId');
    setSearchParams(next, { replace: true });
  };

  const openTestPerformance = (deliveryId: string) => {
    setActiveTab('PERFORMANCE');
    const next = new URLSearchParams(searchParams);
    next.set('tab', 'performance');
    next.set('deliveryId', deliveryId);
    setSearchParams(next, { replace: true });
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
  if (!classDetail || loadError) return <ClassroomError message={loadError} onRetry={() => void fetchClassDetail()} />;

  const tabs: Array<TabItem<ClassroomTab>> = [
    { value: 'LESSONS', label: 'Lessons', icon: GitBranch, panelId: 'classroom-lessons-panel' },
    { value: 'ACTIVITIES', label: 'Activities', icon: ClipboardList, panelId: 'classroom-activities-panel' },
    ...(canManage ? [{ value: 'PERFORMANCE' as ClassroomTab, label: 'Performance', icon: BarChart3, panelId: 'classroom-performance-panel' }] : []),
    { value: 'MEMBERS', label: 'Members', icon: Users, panelId: 'classroom-members-panel' },
    { value: 'ANNOUNCEMENTS', label: 'Announcements', icon: Bell, panelId: 'classroom-announcements-panel' },
  ];

  return <div className="h-full overflow-y-auto">
    <main className="mx-auto flex w-full max-w-screen-2xl flex-col gap-4 p-4 md:p-6">
      <ClassroomHeader
        className={classDetail.name}
        tabs={tabs}
        activeTab={activeTab}
        onSelectTab={selectTab}
      />

      <div>
      {activeTab === 'LESSONS' && <div id="classroom-lessons-panel" role="tabpanel" className="py-2"><WeeklyProgress canManage={canManage} students={classDetail.students} /></div>}
      {activeTab === 'ACTIVITIES' && <div id="classroom-activities-panel" role="tabpanel"><ClassroomActivities classId={classId || ''} students={classDetail.students} canManage={canManage} onOpenPerformance={openTestPerformance} /></div>}
      {activeTab === 'PERFORMANCE' && canManage && <div id="classroom-performance-panel" role="tabpanel" className="py-2"><StudentAnalytics classId={classId} initialDeliveryId={searchParams.get('deliveryId')} /></div>}
      {activeTab === 'MEMBERS' && <div id="classroom-members-panel" role="tabpanel"><MembersTab classroom={classDetail} canManage={canManage} onInvite={() => setAddStudentOpen(true)} onRemove={setStudentToRemove} /></div>}
      {activeTab === 'ANNOUNCEMENTS' && <div id="classroom-announcements-panel" role="tabpanel"><AnnouncementsTab classId={classDetail.id} selectedAnnouncementId={searchParams.get('announcementId')} refreshKey={announcementVersion} canManage={canManage} onNewAnnouncement={() => setAnnouncementOpen(true)} /></div>}
      </div>

    <AnnouncementDialog open={announcementOpen} onClose={() => setAnnouncementOpen(false)} classId={classDetail.id} onCreated={() => setAnnouncementVersion(value => value + 1)} />
    <AddStudentModal open={addStudentOpen} onClose={() => setAddStudentOpen(false)} onAdd={addStudent} />
    <RemoveStudentModal student={studentToRemove} onClose={() => setStudentToRemove(null)} onRemove={removeStudent} />
    </main>
  </div>;
}

function ClassroomHeader({ className, tabs, activeTab, onSelectTab }: { className: string; tabs: Array<TabItem<ClassroomTab>>; activeTab: ClassroomTab; onSelectTab: (tab: ClassroomTab) => void }) {
  return <div className="flex flex-col gap-4">
    <PageHeader title={className} description="Manage lessons, activities, members, and class performance." />
    <div className="overflow-x-auto"><Tabs items={tabs} value={activeTab} onValueChange={onSelectTab} ariaLabel="Classroom sections" /></div>
  </div>;
}

function AnnouncementsTab({ classId, selectedAnnouncementId, refreshKey, canManage, onNewAnnouncement }: { classId: string; selectedAnnouncementId: string | null; refreshKey: number; canManage: boolean; onNewAnnouncement: () => void }) {
  const [announcements, setAnnouncements] = useState<ClassAnnouncement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    setLoading(true); setError('');
    try { setAnnouncements(await axiosClient.get<ClassAnnouncement[], ClassAnnouncement[]>(`/api/classes/${classId}/announcements`)); }
    catch (requestError) { setError(requestErrorMessage(requestError, 'Announcements could not be loaded.')); }
    finally { setLoading(false); }
  }, [classId]);
  useEffect(() => { void load(); }, [load, refreshKey]);
  useEffect(() => {
    if (loading || !selectedAnnouncementId) return;
    window.requestAnimationFrame(() => document.getElementById(`announcement-${selectedAnnouncementId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }));
  }, [loading, selectedAnnouncementId]);

  return <div className="space-y-4 py-2">
    <div className="flex flex-wrap items-center justify-between gap-3"><InviteCodeWidget classId={classId} />{canManage && <Button size="sm" onClick={onNewAnnouncement}><Plus size={14} />New announcement</Button>}</div>
    {loading ? <Card className="h-40 animate-pulse bg-muted/40" /> : error ? <Card className="p-8 text-center"><p className="text-sm font-medium text-foreground">Unable to load announcements</p><p className="mt-1 text-xs text-muted-foreground">{error}</p><Button className="mt-4" variant="outline" size="sm" onClick={() => void load()}>Try again</Button></Card> : announcements.length === 0 ? <Card className="flex min-h-56 flex-col items-center justify-center p-8 text-center"><Megaphone size={22} className="text-muted-foreground" /><h3 className="mt-3 text-sm font-semibold text-foreground">No announcements yet</h3><p className="mt-1 text-xs text-muted-foreground">Class updates from the teacher will appear here.</p></Card> : <div className="grid gap-4">{announcements.map(item => <Card key={item.id} id={`announcement-${item.id}`} className={`p-5 transition-shadow ${selectedAnnouncementId === item.id ? 'ring-2 ring-primary/35' : ''}`}><div className="flex min-w-0 items-start gap-3"><span className="flex size-9 shrink-0 items-center justify-center rounded-control bg-primary/10 text-primary"><Megaphone size={16} /></span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-start justify-between gap-2"><div><h3 className="text-sm font-semibold text-foreground">{item.title}</h3><p className="mt-0.5 text-xs text-muted-foreground">{item.author.name || 'Teacher'} · {formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })}</p></div></div>{item.content && <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{item.content}</p>}{(item.fileUrls.length > 0 || item.links.length > 0) && <div className="mt-4 flex flex-wrap gap-2">{[...item.fileUrls, ...item.links].map(url => <a key={url} href={url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-control border border-ui-border px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-muted"><ExternalLink size={12} />Open link</a>)}</div>}</div></div></Card>)}</div>}
  </div>;
}

function InviteCodeWidget({ classId }: { classId: string }) {
  const [copied, setCopied] = useState(false);
  const code = classId.slice(0, 8).toUpperCase();
  const copy = async () => { await navigator.clipboard.writeText(classId); setCopied(true); window.setTimeout(() => setCopied(false), 1600); };
  return <div className="flex max-w-[280px] items-center justify-between gap-3 rounded-xl border bg-muted/50 px-3 py-2"><div><p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Class invite code</p><p className="mt-0.5 font-mono text-sm font-semibold tracking-[0.14em] text-foreground">{code}</p></div><button type="button" onClick={() => void copy()} className="flex h-8 w-8 items-center justify-center rounded-lg bg-background text-muted-foreground shadow-xs hover:text-foreground" aria-label="Copy class code">{copied ? <Check size={14} /> : <Copy size={14} />}</button></div>;
}

function MembersTab({ classroom, canManage, onInvite, onRemove }: { classroom: ClassDetail; canManage: boolean; onInvite: () => void; onRemove: (student: ClassMember) => void }) {
  return <div className="flex flex-col gap-8 py-2">
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
      <div className="flex items-baseline gap-2"><h2 className="text-base font-semibold text-foreground">{title}</h2><span className="text-xs text-muted-foreground">{count}</span></div>
      {action}
    </div>
    {children}
  </section>;
}

function MemberTable({ label, members, canManage, onRemove }: { label: 'Teacher' | 'Student'; members: ClassMember[]; canManage: boolean; onRemove?: (student: ClassMember) => void }) {
  return <TableShell className="shadow-none!"><div className="overflow-x-auto"><table className="w-full min-w-[680px] table-fixed text-sm">
    <thead><tr className="border-b bg-muted/50"><th className="w-[30%] px-5 py-3 text-left text-xs font-medium text-muted-foreground">{label}</th><th className="w-[34%] px-4 py-3 text-left text-xs font-medium text-muted-foreground">Email</th><th className="w-[24%] px-4 py-3 text-left text-xs font-medium text-muted-foreground">Joined</th><th className="w-[12%] px-5 py-3 text-right text-xs font-medium text-muted-foreground">Actions</th></tr></thead>
    <tbody>{members.length === 0 ? <tr><td colSpan={4} className="px-5 py-14 text-center text-sm text-muted-foreground">No students have joined this class yet.</td></tr> : members.map((member, index) => <tr key={member.id} className={`${index < members.length - 1 ? 'border-b' : ''} transition-colors hover:bg-muted/30`}>
      <td className="px-5 py-3"><div className="flex min-w-0 items-center gap-2.5"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white" style={{ backgroundColor: AVATAR_COLORS[index % AVATAR_COLORS.length] }}>{initials(member.name)}</span><span className="truncate font-medium text-foreground">{member.name || `Unknown ${label.toLowerCase()}`}</span></div></td>
      <td className="truncate px-4 py-3 text-muted-foreground" title={member.email}>{member.email}</td>
      <td className="px-4 py-3 text-muted-foreground">{formatMemberSince(member.createdAt)}</td>
      <td className="px-5 py-3 text-right">{canManage && onRemove ? <button type="button" onClick={() => onRemove(member)} className="app-icon-button ml-auto h-8 w-8 text-muted-foreground hover:bg-destructive/10 hover:text-destructive" aria-label={`Remove ${member.name || 'student'}`} title="Remove student"><Trash2 size={15} /></button> : <span className="text-muted-foreground">—</span>}</td>
    </tr>)}</tbody>
  </table></div></TableShell>;
}

function AddStudentModal({ open, onClose, onAdd }: { open: boolean; onClose: () => void; onAdd: (email: string) => Promise<void> }) {
  const [email, setEmail] = useState('');
  const [saving, setSaving] = useState(false);
  const submit = async (event: React.FormEvent) => { event.preventDefault(); if (!email.trim()) return; setSaving(true); try { await onAdd(email.trim()); toast.success('Student added'); setEmail(''); onClose(); } catch (error) { toast.error(requestErrorMessage(error, 'This student could not be added.')); } finally { setSaving(false); } };
  return <Modal open={open} onClose={onClose} closeOnBackdrop title="Invite a student" subtitle="Add a student to this class using their account email." footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button disabled={saving || !email.trim()} onClick={submit}>{saving ? 'Adding…' : 'Add student'}</Button></>}><form onSubmit={submit}><label className="block"><span className="mb-2 block text-sm font-medium text-foreground">Student email</span><Input autoFocus type="email" className="w-full" value={email} onChange={event => setEmail(event.target.value)} placeholder="student@example.com" /></label></form></Modal>;
}

function RemoveStudentModal({ student, onClose, onRemove }: { student: ClassMember | null; onClose: () => void; onRemove: () => Promise<void> }) {
  const [removing, setRemoving] = useState(false);
  const submit = async () => { setRemoving(true); try { await onRemove(); toast.success('Student removed'); } catch (error) { toast.error(requestErrorMessage(error, 'Unable to remove this student.')); } finally { setRemoving(false); } };
  return <Modal open={Boolean(student)} onClose={onClose} closeOnBackdrop title="Remove student" subtitle="This student will lose access to the class and its assigned tests." footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button variant="destructive" disabled={removing} onClick={() => void submit()}>{removing ? 'Removing…' : 'Remove student'}</Button></>}><p className="text-sm leading-6 text-muted-foreground">Remove <span className="font-semibold text-foreground">{student?.name || student?.email}</span> from this class?</p></Modal>;
}

function ClassroomLoading() {
  return <div className="h-full bg-background"><div className="h-24 animate-pulse border-b bg-muted/50" /><div className="mx-auto grid w-full max-w-[1400px] gap-8 p-8 lg:grid-cols-12"><div className="h-56 animate-pulse rounded-xl bg-muted lg:col-span-4" /><div className="h-80 animate-pulse rounded-xl bg-muted lg:col-span-8" /></div></div>;
}

function ClassroomError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return <div className="flex h-full items-center justify-center bg-background p-6"><Card className="w-full max-w-md p-8 text-center"><h2 className="text-base font-semibold text-foreground">Class could not be loaded</h2><p className="mt-2 text-sm text-muted-foreground">{message}</p><div className="mt-5 flex justify-center"><Button variant="outline" onClick={onRetry}>Try again</Button></div></Card></div>;
}

const initials = (name: string | null) => String(name || 'Student').split(/\s+/).filter(Boolean).slice(-2).map(part => part[0]).join('').toUpperCase();
const formatMemberSince = (value?: string | null) => value ? format(new Date(value), 'MMM d, yyyy') : '—';
