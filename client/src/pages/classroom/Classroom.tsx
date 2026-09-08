import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Check, Copy, ExternalLink, Megaphone, MoreHorizontal, Pencil, Pin, PinOff, Plus, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import axiosClient from '../../lib/axios';
import { Button, Card, Modal, PageHeader, Tabs, type TabItem } from '../../components/ui/AppUI';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Attachment, AttachmentActions, AttachmentContent, AttachmentDescription, AttachmentMedia, AttachmentTitle } from '@/components/ui/attachment';
import { Button as PrimitiveButton } from '@/components/ui/button';
import { DataStateRow, DataSurface, DataToolbar, DataToolbarSearch } from '@/components/ui/data-surface';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Field, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ResourceIcon } from '@/components/resource-icon';
import { RichTextContent } from '@/components/ui/rich-text-content';
import { displayHost, fileNameFromUrl, getLinkPresentation } from '@/lib/resource-presentation';
import { useDashboardBack } from '../../features/navigation/DashboardBackContext';
import StudentAnalytics from '../../features/analytics/StudentAnalytics';
import AnnouncementDialog from '../../features/classroom/AnnouncementDialog';
import WeeklyProgress from '../../features/analytics/WeeklyProgress';
import ClassroomActivities from '../../features/classroom/ClassroomActivities';
import { capitalizeFirstLetter } from '../../utils/text';

type UserRole = 'STUDENT' | 'TEACHER' | 'ADMIN';
type ClassroomTab = 'LESSONS' | 'ACTIVITIES' | 'MEMBERS' | 'ANNOUNCEMENTS';

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
interface ClassAnnouncement { id: string; title: string; content?: string | null; fileUrls: string[]; links: string[]; isPinned: boolean; createdAt: string; updatedAt: string; author: { id: number; name: string | null } }

const MEMBER_SEARCH_THRESHOLD = 20;
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
  const [activeTab, setActiveTab] = useState<ClassroomTab>('ANNOUNCEMENTS');
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
    const aliases: Record<string, ClassroomTab> = { PROGRESS: 'LESSONS', PERFORMANCE: 'ACTIVITIES', RESULTS: 'ACTIVITIES', NOTIFICATIONS: 'ANNOUNCEMENTS' };
    const resolved = aliases[requestedTab || ''] || requestedTab;
    if (requestedTab && aliases[requestedTab]) {
      const next = new URLSearchParams(searchParams);
      next.set('tab', aliases[requestedTab].toLowerCase());
      setSearchParams(next, { replace: true });
    }
    if (resolved === 'LESSONS' || resolved === 'ACTIVITIES' || resolved === 'MEMBERS' || resolved === 'ANNOUNCEMENTS') setActiveTab(resolved);
  }, [searchParams, setSearchParams]);

  const selectTab = (tab: ClassroomTab) => {
    setActiveTab(tab);
    const next = new URLSearchParams(searchParams);
    next.set('tab', tab.toLowerCase());
    if (tab !== 'ACTIVITIES') next.delete('deliveryId');
    setSearchParams(next, { replace: true });
  };

  const openTestPerformance = (deliveryId: string) => {
    setActiveTab('ACTIVITIES');
    const next = new URLSearchParams(searchParams);
    next.set('tab', 'activities');
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
    { value: 'ANNOUNCEMENTS', label: 'Announcements', panelId: 'classroom-announcements-panel' },
    { value: 'LESSONS', label: 'Lessons', panelId: 'classroom-lessons-panel' },
    { value: 'ACTIVITIES', label: 'Activities', panelId: 'classroom-activities-panel' },
    { value: 'MEMBERS', label: 'Members', panelId: 'classroom-members-panel' },
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
      {activeTab === 'ACTIVITIES' && <div id="classroom-activities-panel" role="tabpanel">{canManage && searchParams.get('deliveryId')
        ? <StudentAnalytics key={searchParams.get('deliveryId')} initialDeliveryId={searchParams.get('deliveryId') as string} />
        : <ClassroomActivities classId={classId || ''} students={classDetail.students} canManage={canManage} onOpenPerformance={openTestPerformance} />}
      </div>}
      {activeTab === 'MEMBERS' && <div id="classroom-members-panel" role="tabpanel"><MembersTab classroom={classDetail} canManage={canManage} onInvite={() => setAddStudentOpen(true)} onRemove={setStudentToRemove} /></div>}
      {activeTab === 'ANNOUNCEMENTS' && <div id="classroom-announcements-panel" role="tabpanel"><AnnouncementsTab classId={classDetail.id} selectedAnnouncementId={searchParams.get('announcementId')} refreshKey={announcementVersion} canManage={canManage} onNewAnnouncement={() => setAnnouncementOpen(true)} /></div>}
      </div>

    <AnnouncementDialog open={announcementOpen} onClose={() => setAnnouncementOpen(false)} classId={classDetail.id} onSaved={() => setAnnouncementVersion(value => value + 1)} />
    <AddStudentModal open={addStudentOpen} onClose={() => setAddStudentOpen(false)} onAdd={addStudent} />
    <RemoveStudentModal student={studentToRemove} onClose={() => setStudentToRemove(null)} onRemove={removeStudent} />
    </main>
  </div>;
}

function ClassroomHeader({ className, tabs, activeTab, onSelectTab }: { className: string; tabs: Array<TabItem<ClassroomTab>>; activeTab: ClassroomTab; onSelectTab: (tab: ClassroomTab) => void }) {
  return <div className="flex flex-col gap-4">
    <PageHeader title={className} description="Manage lessons, activities, results, members, and announcements." />
    <div className="overflow-x-auto"><Tabs items={tabs} value={activeTab} onValueChange={onSelectTab} ariaLabel="Classroom sections" /></div>
  </div>;
}

function AnnouncementsTab({ classId, selectedAnnouncementId, refreshKey, canManage, onNewAnnouncement }: { classId: string; selectedAnnouncementId: string | null; refreshKey: number; canManage: boolean; onNewAnnouncement: () => void }) {
  const [announcements, setAnnouncements] = useState<ClassAnnouncement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editingAnnouncement, setEditingAnnouncement] = useState<ClassAnnouncement | null>(null);
  const [announcementToDelete, setAnnouncementToDelete] = useState<ClassAnnouncement | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [pinningId, setPinningId] = useState<string | null>(null);
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

  const removeAnnouncement = async () => {
    if (!announcementToDelete) return;
    setDeleting(true);
    try {
      await axiosClient.delete(`/api/classes/${classId}/announcements/${announcementToDelete.id}`);
      toast.success('Announcement deleted');
      setAnnouncementToDelete(null);
      await load();
    } catch (requestError) {
      toast.error(requestErrorMessage(requestError, 'Unable to delete this announcement.'));
    } finally {
      setDeleting(false);
    }
  };

  const togglePinned = async (announcement: ClassAnnouncement) => {
    setPinningId(announcement.id);
    try {
      await axiosClient.patch(`/api/classes/${classId}/announcements/${announcement.id}`, { isPinned: !announcement.isPinned });
      toast.success(announcement.isPinned ? 'Announcement unpinned' : 'Announcement pinned');
      await load();
    } catch (requestError) {
      toast.error(requestErrorMessage(requestError, 'Unable to update the pinned announcement.'));
    } finally {
      setPinningId(null);
    }
  };

  return <>
    <div className="w-full max-w-4xl space-y-5 py-2">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><h2 className="text-base font-semibold text-foreground">Announcements</h2><p className="mt-1 text-sm text-muted-foreground">Share updates and important information with your class.</p></div>
        {canManage && <PrimitiveButton size="sm" onClick={onNewAnnouncement}><Plus aria-hidden="true" />New announcement</PrimitiveButton>}
      </div>
      {loading
        ? <AnnouncementFeedSkeleton />
        : error
          ? <div className="border-y border-ui-border py-14 text-center"><p className="text-sm font-medium text-foreground">Unable to load announcements</p><p className="mt-1 text-xs text-muted-foreground">{error}</p><PrimitiveButton className="mt-4" variant="outline" size="sm" onClick={() => void load()}>Try again</PrimitiveButton></div>
          : announcements.length === 0
            ? <div className="flex min-h-56 flex-col items-center justify-center border-y border-ui-border px-6 py-12 text-center"><Megaphone className="size-5 text-muted-foreground" aria-hidden="true" /><h3 className="mt-3 text-sm font-semibold text-foreground">No announcements yet</h3><p className="mt-1 max-w-sm text-sm text-muted-foreground">{canManage ? 'Post an update when there is something your class should know.' : 'Class updates from your teacher will appear here.'}</p></div>
            : <AnnouncementFeed announcements={announcements} selectedAnnouncementId={selectedAnnouncementId} canManage={canManage} pinningId={pinningId} onTogglePinned={togglePinned} onEdit={setEditingAnnouncement} onDelete={setAnnouncementToDelete} />}
    </div>
    <AnnouncementDialog open={Boolean(editingAnnouncement)} onClose={() => setEditingAnnouncement(null)} classId={classId} announcement={editingAnnouncement} onSaved={load} />
    <Modal open={Boolean(announcementToDelete)} onClose={() => !deleting && setAnnouncementToDelete(null)} closeOnBackdrop={!deleting} presentation="content-dialog" title="Delete announcement?" subtitle="This announcement will be removed for everyone in the class." footer={<><PrimitiveButton variant="outline" disabled={deleting} onClick={() => setAnnouncementToDelete(null)}>Cancel</PrimitiveButton><PrimitiveButton variant="destructive" disabled={deleting} onClick={() => void removeAnnouncement()}>{deleting ? 'Deleting…' : 'Delete announcement'}</PrimitiveButton></>}><p className="text-sm leading-6 text-muted-foreground">Delete <span className="font-medium text-foreground">{announcementToDelete?.title}</span>?</p></Modal>
  </>;
}

function AnnouncementFeed({ announcements, selectedAnnouncementId, canManage, pinningId, onTogglePinned, onEdit, onDelete }: { announcements: ClassAnnouncement[]; selectedAnnouncementId: string | null; canManage: boolean; pinningId: string | null; onTogglePinned: (item: ClassAnnouncement) => void; onEdit: (item: ClassAnnouncement) => void; onDelete: (item: ClassAnnouncement) => void }) {
  const pinned = announcements.filter(item => item.isPinned);
  const recent = announcements.filter(item => !item.isPinned);
  return <div className="divide-y divide-ui-border border-y border-ui-border">
    {pinned.length > 0 && <div className="flex items-center gap-1.5 bg-muted/20 px-2 py-2 text-xs font-medium text-muted-foreground"><Pin className="size-3.5" aria-hidden="true" />Pinned</div>}
    {pinned.map(item => <AnnouncementFeedItem key={item.id} item={item} selected={selectedAnnouncementId === item.id} canManage={canManage} pinning={pinningId === item.id} onTogglePinned={() => onTogglePinned(item)} onEdit={() => onEdit(item)} onDelete={() => onDelete(item)} />)}
    {pinned.length > 0 && recent.length > 0 && <div className="bg-muted/20 px-2 py-2 text-xs font-medium text-muted-foreground">Recent</div>}
    {recent.map(item => <AnnouncementFeedItem key={item.id} item={item} selected={selectedAnnouncementId === item.id} canManage={canManage} pinning={pinningId === item.id} onTogglePinned={() => onTogglePinned(item)} onEdit={() => onEdit(item)} onDelete={() => onDelete(item)} />)}
  </div>;
}

function AnnouncementFeedItem({ item, selected, canManage, pinning, onTogglePinned, onEdit, onDelete }: { item: ClassAnnouncement; selected: boolean; canManage: boolean; pinning: boolean; onTogglePinned: () => void; onEdit: () => void; onDelete: () => void }) {
  const publishedAt = format(new Date(item.createdAt), 'MMM d, yyyy · HH:mm');
  const wasEdited = item.updatedAt && new Date(item.updatedAt).getTime() - new Date(item.createdAt).getTime() > 1000;
  return <article id={`announcement-${item.id}`} className={`px-1 py-5 transition-colors sm:px-2 sm:py-6 ${selected ? 'bg-muted/50 ring-2 ring-inset ring-primary/30' : 'hover:bg-muted/20'}`}>
    <div className="flex min-w-0 items-start gap-3 sm:gap-4">
      <Avatar className="mt-0.5"><AvatarFallback className="text-xs font-semibold">{initials(item.author.name || 'Teacher')}</AvatarFallback></Avatar>
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-start justify-between gap-3">
          <p className="min-w-0 text-sm"><span className="font-medium text-foreground">{item.author.name || 'Teacher'}</span><span className="text-muted-foreground"> · <time dateTime={item.createdAt} title={publishedAt}>{publishedAt}</time>{wasEdited ? ' · Edited' : ''}</span></p>
          {canManage && <DropdownMenu><DropdownMenuTrigger asChild><PrimitiveButton variant="ghost" size="icon-sm" className="-mr-1 -mt-1 text-muted-foreground" disabled={pinning} aria-label={`Actions for ${item.title}`}><MoreHorizontal aria-hidden="true" /></PrimitiveButton></DropdownMenuTrigger><DropdownMenuContent align="end" className="w-48"><DropdownMenuItem onSelect={onEdit}><Pencil aria-hidden="true" />Edit announcement</DropdownMenuItem><DropdownMenuItem onSelect={onTogglePinned}>{item.isPinned ? <PinOff aria-hidden="true" /> : <Pin aria-hidden="true" />}{item.isPinned ? 'Unpin announcement' : 'Pin announcement'}</DropdownMenuItem><DropdownMenuSeparator /><DropdownMenuItem variant="destructive" onSelect={onDelete}><Trash2 aria-hidden="true" />Delete announcement</DropdownMenuItem></DropdownMenuContent></DropdownMenu>}
        </div>
        <h3 className="mt-3 text-base font-semibold leading-6 text-foreground [overflow-wrap:anywhere]">{item.title}</h3>
        {item.content && <RichTextContent html={item.content} className="mt-2 whitespace-pre-wrap" />}
        {(item.fileUrls.length > 0 || item.links.length > 0) && <AnnouncementResources fileUrls={item.fileUrls} links={item.links} />}
      </div>
    </div>
  </article>;
}

function AnnouncementResources({ fileUrls, links }: { fileUrls: string[]; links: string[] }) {
  return <div className="mt-4 grid gap-2 sm:grid-cols-2">
    {fileUrls.map((url, index) => { const fileName = fileNameFromUrl(url, index); return <Attachment key={`file-${url}`} asChild className="hover:bg-muted/30"><a href={url} target="_blank" rel="noreferrer"><AttachmentMedia><ResourceIcon fileName={fileName} /></AttachmentMedia><AttachmentContent><AttachmentTitle>{fileName}</AttachmentTitle><AttachmentDescription>Attachment</AttachmentDescription></AttachmentContent><AttachmentActions><ExternalLink className="size-4 text-muted-foreground" aria-hidden="true" /></AttachmentActions></a></Attachment>; })}
    {links.map(url => { const presentation = getLinkPresentation(url); return <Attachment key={`link-${url}`} asChild className="hover:bg-muted/30"><a href={url} target="_blank" rel="noreferrer"><AttachmentMedia><ResourceIcon url={url} /></AttachmentMedia><AttachmentContent><AttachmentTitle>{presentation.label}</AttachmentTitle><AttachmentDescription>{displayHost(url)}</AttachmentDescription></AttachmentContent><AttachmentActions><ExternalLink className="size-4 text-muted-foreground" aria-hidden="true" /></AttachmentActions></a></Attachment>; })}
  </div>;
}

function AnnouncementFeedSkeleton() {
  return <div className="divide-y divide-ui-border border-y border-ui-border" aria-label="Loading announcements">{Array.from({ length: 3 }, (_, index) => <div key={index} className="flex gap-4 px-2 py-6"><div className="size-8 shrink-0 animate-pulse rounded-full bg-muted" /><div className="flex-1 space-y-3"><div className="h-3 w-44 animate-pulse rounded bg-muted" /><div className="h-4 w-2/3 animate-pulse rounded bg-muted" /><div className="h-3 w-full animate-pulse rounded bg-muted" /></div></div>)}</div>;
}

function InviteCodeWidget({ classId }: { classId: string }) {
  const [copied, setCopied] = useState(false);
  const code = classId.slice(0, 8).toUpperCase();
  const copy = async () => { await navigator.clipboard.writeText(classId); setCopied(true); window.setTimeout(() => setCopied(false), 1600); };
  return <div className="flex h-8 items-center gap-2 rounded-lg border border-ui-border bg-surface pl-2.5 pr-1"><span className="text-xs text-muted-foreground">Invite code</span><code className="font-mono text-xs font-semibold tracking-wider text-foreground">{code}</code><PrimitiveButton type="button" variant="ghost" size="icon-xs" onClick={() => void copy()} aria-label="Copy class invite code">{copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}</PrimitiveButton></div>;
}

function MembersTab({ classroom, canManage, onInvite, onRemove }: { classroom: ClassDetail; canManage: boolean; onInvite: () => void; onRemove: (student: ClassMember) => void }) {
  const [studentSearch, setStudentSearch] = useState('');
  const showStudentSearch = classroom.students.length >= MEMBER_SEARCH_THRESHOLD;
  const normalizedSearch = studentSearch.trim().toLowerCase();
  const visibleStudents = showStudentSearch && normalizedSearch
    ? classroom.students.filter(student => `${student.name || ''} ${student.email}`.toLowerCase().includes(normalizedSearch))
    : classroom.students;

  return <div className="flex flex-col gap-8 py-2">
    <MemberSection title="Teachers" count={1}>
      <MemberTable label="Teacher" members={[classroom.teacher]} />
    </MemberSection>

    <MemberSection
      title="Students"
      count={classroom.students.length}
      action={canManage ? <div className="flex flex-wrap items-center justify-end gap-2"><InviteCodeWidget classId={classroom.id} /><PrimitiveButton size="sm" onClick={onInvite}><Plus aria-hidden="true" />Invite student</PrimitiveButton></div> : undefined}
    >
      <MemberTable
        label="Student"
        members={visibleStudents}
        canManage={canManage}
        onRemove={onRemove}
        search={showStudentSearch ? { value: studentSearch, onChange: setStudentSearch } : undefined}
      />
    </MemberSection>
  </div>;
}

function MemberSection({ title, count, action, children }: { title: string; count: number; action?: ReactNode; children: ReactNode }) {
  return <section>
    <div className="mb-4 flex items-center justify-between gap-4">
      <div className="flex items-baseline gap-2"><h2 className="text-base font-semibold text-foreground">{title}</h2><span className="text-sm font-normal tabular-nums text-muted-foreground">{count}</span></div>
      {action}
    </div>
    {children}
  </section>;
}

interface MemberSearchControl {
  value: string;
  onChange: (value: string) => void;
}

function MemberTable({ label, members, canManage = false, onRemove, search }: { label: 'Teacher' | 'Student'; members: ClassMember[]; canManage?: boolean; onRemove?: (student: ClassMember) => void; search?: MemberSearchControl }) {
  const hasActions = label === 'Student' && canManage && Boolean(onRemove);
  const columnCount = hasActions ? 4 : 3;
  const isFiltered = Boolean(search?.value.trim());

  return <DataSurface>
    {search && <DataToolbar>
      <DataToolbarSearch
        label="Search students"
        placeholder="Search students..."
        value={search.value}
        onChange={event => search.onChange(event.target.value)}
      />
    </DataToolbar>}
    <Table className={hasActions ? 'min-w-[680px] table-fixed' : 'min-w-[620px] table-fixed'}>
    <TableCaption className="sr-only">{label}s in this class</TableCaption>
    <TableHeader><TableRow><TableHead className="w-[32%]">{label}</TableHead><TableHead className="w-[40%]">Email</TableHead><TableHead>Joined</TableHead>{hasActions && <TableHead className="w-12 text-right"><span className="sr-only">Actions</span></TableHead>}</TableRow></TableHeader>
    <TableBody>{members.length === 0 ? <DataStateRow colSpan={columnCount}><div className="mx-auto max-w-sm"><p className="text-sm font-medium text-foreground">{isFiltered ? 'No students found' : label === 'Student' ? 'No students yet' : 'No teachers yet'}</p><p className="mt-1 text-xs text-muted-foreground">{isFiltered ? 'Try a different name or email address.' : label === 'Student' ? 'Students who join this class will appear here.' : 'Teachers assigned to this class will appear here.'}</p>{isFiltered && search && <PrimitiveButton variant="ghost" size="sm" className="mt-3" onClick={() => search.onChange('')}>Clear search</PrimitiveButton>}</div></DataStateRow> : members.map(member => <TableRow key={member.id}>
      <TableCell><div className="flex min-w-0 items-center gap-2.5"><Avatar><AvatarFallback className="text-xs font-semibold">{initials(member.name)}</AvatarFallback></Avatar><span className="truncate font-medium text-foreground">{member.name || `Unknown ${label.toLowerCase()}`}</span></div></TableCell>
      <TableCell className="truncate text-muted-foreground" title={member.email}>{member.email}</TableCell>
      <TableCell className="text-muted-foreground">{formatMemberSince(member.createdAt)}</TableCell>
      {hasActions && onRemove && <TableCell className="text-right"><DropdownMenu><DropdownMenuTrigger asChild><PrimitiveButton variant="ghost" size="icon-sm" className="ml-auto text-muted-foreground" aria-label={`Actions for ${member.name || 'student'}`}><MoreHorizontal aria-hidden="true" /></PrimitiveButton></DropdownMenuTrigger><DropdownMenuContent align="end" className="w-44"><DropdownMenuItem variant="destructive" onSelect={() => onRemove(member)}><Trash2 aria-hidden="true" />Remove from class</DropdownMenuItem></DropdownMenuContent></DropdownMenu></TableCell>}
    </TableRow>)}</TableBody>
  </Table></DataSurface>;
}

function AddStudentModal({ open, onClose, onAdd }: { open: boolean; onClose: () => void; onAdd: (email: string) => Promise<void> }) {
  const [email, setEmail] = useState('');
  const [saving, setSaving] = useState(false);
  const submit = async (event: React.FormEvent) => { event.preventDefault(); if (!email.trim()) return; setSaving(true); try { await onAdd(email.trim()); toast.success('Student added'); setEmail(''); onClose(); } catch (error) { toast.error(requestErrorMessage(error, 'This student could not be added.')); } finally { setSaving(false); } };
  return <Modal
    open={open}
    onClose={onClose}
    closeOnBackdrop
    presentation="content-dialog"
    title="Invite a student"
    subtitle="Add a student to this class using their account email."
    footer={<><PrimitiveButton variant="outline" disabled={saving} onClick={onClose}>Cancel</PrimitiveButton><PrimitiveButton type="submit" form="invite-student-form" disabled={saving || !email.trim()}>{saving ? 'Adding…' : 'Add student'}</PrimitiveButton></>}
  >
    <form id="invite-student-form" onSubmit={submit}>
      <Field>
        <FieldLabel htmlFor="student-email">Student email</FieldLabel>
        <Input id="student-email" autoFocus type="email" value={email} onChange={event => setEmail(event.target.value)} placeholder="student@example.com" autoComplete="email" />
      </Field>
    </form>
  </Modal>;
}

function RemoveStudentModal({ student, onClose, onRemove }: { student: ClassMember | null; onClose: () => void; onRemove: () => Promise<void> }) {
  const [removing, setRemoving] = useState(false);
  const submit = async () => { setRemoving(true); try { await onRemove(); toast.success('Student removed'); } catch (error) { toast.error(requestErrorMessage(error, 'Unable to remove this student.')); } finally { setRemoving(false); } };
  return <Modal open={Boolean(student)} onClose={onClose} closeOnBackdrop presentation="content-dialog" title="Remove student" subtitle="This student will lose access to the class and its assigned tests." footer={<><PrimitiveButton variant="outline" disabled={removing} onClick={onClose}>Cancel</PrimitiveButton><PrimitiveButton variant="destructive" disabled={removing} onClick={() => void submit()}>{removing ? 'Removing…' : 'Remove student'}</PrimitiveButton></>}><p className="text-sm leading-6 text-muted-foreground">Remove <span className="font-semibold text-foreground">{student?.name || student?.email}</span> from this class?</p></Modal>;
}

function ClassroomLoading() {
  return <div className="h-full bg-background"><div className="h-24 animate-pulse border-b bg-muted/50" /><div className="mx-auto grid w-full max-w-[1400px] gap-8 p-8 lg:grid-cols-12"><div className="h-56 animate-pulse rounded-xl bg-muted lg:col-span-4" /><div className="h-80 animate-pulse rounded-xl bg-muted lg:col-span-8" /></div></div>;
}

function ClassroomError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return <div className="flex h-full items-center justify-center bg-background p-6"><Card className="w-full max-w-md p-8 text-center"><h2 className="text-base font-semibold text-foreground">Class could not be loaded</h2><p className="mt-2 text-sm text-muted-foreground">{message}</p><div className="mt-5 flex justify-center"><Button variant="outline" onClick={onRetry}>Try again</Button></div></Card></div>;
}

const initials = (name: string | null) => String(name || 'Student').split(/\s+/).filter(Boolean).slice(-2).map(part => part[0]).join('').toUpperCase();
const formatMemberSince = (value?: string | null) => value ? format(new Date(value), 'MMM d, yyyy') : '—';
