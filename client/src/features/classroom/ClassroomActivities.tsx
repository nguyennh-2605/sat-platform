import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { format, isPast } from 'date-fns';
import { BookA, BookOpenCheck, Check, ChevronRight, ClipboardList, FileText, LoaderCircle, Plus, Search, Users } from 'lucide-react';
import toast from 'react-hot-toast';
import { Checkbox } from '@/components/ui/checkbox';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Badge, Button, EmptyState, Input, Modal, Select, TableShell, Tabs } from '@/components/ui/AppUI';
import { DateTimePicker } from '@/components/ui/DateTimePicker';
import axiosClient from '@/lib/axios';
import { capitalizeFirstLetter } from '@/utils/text';

type ActivityType = 'TEST' | 'VOCABULARY' | 'HOMEWORK' | 'RESOURCE';
type ActivityFilter = 'ALL' | ActivityType;
type LibrarySource = 'MY' | 'SYSTEM';

interface Student { id: number; name: string | null; email: string }
interface ActivityAssignee { studentId: number; status: 'ASSIGNED' | 'IN_PROGRESS' | 'COMPLETED' | 'MISSING' | 'EXCUSED'; bestScore: number | null; attemptCount: number; excusedAt: string | null }
interface ClassActivity {
  id: string; type: ActivityType; status: 'DRAFT' | 'PUBLISHED' | 'CLOSED'; title: string; instructions?: string | null;
  availableAt?: string | null; dueAt?: string | null; maxAttempts: number; scorePolicy: 'FIRST' | 'BEST' | 'LATEST'; createdAt: string;
  assignees: ActivityAssignee[];
  test?: { testDeliveryId: string; testDelivery: { testId: number; test: { title: string; subject: 'RW' | 'MATH'; mode: 'PRACTICE' | 'EXAM'; duration: number; sections: Array<{ _count: { questions: number } }> } } } | null;
  vocabulary?: { vocabularySetId: string; vocabularySet: { title: string }; _count: { items: number } } | null;
  homework?: { assignmentId: string } | null;
}
interface LibraryTest { id: number; title: string; duration: number; subject: 'RW' | 'MATH'; mode: 'PRACTICE' | 'EXAM'; questionCount: number }
interface TestPage { items: LibraryTest[] }

export default function ClassroomActivities({ classId, students, canManage, onOpenPerformance, onNewHomework }: { classId: string; students: Student[]; canManage: boolean; onOpenPerformance: (deliveryId: string) => void; onNewHomework: () => void }) {
  const navigate = useNavigate();
  const [activities, setActivities] = useState<ClassActivity[]>([]);
  const [filter, setFilter] = useState<ActivityFilter>('ALL');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [assignOpen, setAssignOpen] = useState(false);

  const loadActivities = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setActivities(await axiosClient.get<ClassActivity[], ClassActivity[]>(`/api/class-activities/class/${classId}`));
    } catch (requestError) {
      console.error(requestError);
      setError('Class activities could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, [classId]);

  useEffect(() => { void loadActivities(); }, [loadActivities]);

  const filtered = useMemo(() => activities.filter(activity => {
    if (filter !== 'ALL' && activity.type !== filter) return false;
    return !search.trim() || activity.title.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase());
  }), [activities, filter, search]);

  const counts = useMemo(() => ({
    ALL: activities.length,
    TEST: activities.filter(item => item.type === 'TEST').length,
    VOCABULARY: activities.filter(item => item.type === 'VOCABULARY').length,
    HOMEWORK: activities.filter(item => item.type === 'HOMEWORK').length,
    RESOURCE: activities.filter(item => item.type === 'RESOURCE').length,
  }), [activities]);

  const openActivity = (activity: ClassActivity) => {
    if (activity.type === 'TEST' && activity.test) {
      if (canManage) onOpenPerformance(activity.test.testDeliveryId);
      else navigate(`/test/${activity.test.testDelivery.testId}?deliveryId=${activity.test.testDeliveryId}`);
      return;
    }
    if (activity.type === 'VOCABULARY' && activity.vocabulary) {
      navigate(`/dashboard/vocabulary?activity=${activity.id}`);
      return;
    }
    if (activity.type === 'HOMEWORK' && activity.homework) navigate(`/dashboard/class/${classId}/assignment/${activity.homework.assignmentId}`);
  };

  return <div className="space-y-4 py-2">
    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:gap-2"><label className="relative min-w-0 flex-1"><Search size={16} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" /><Input controlSize="sm" value={search} onChange={event => setSearch(event.target.value)} placeholder="Search activities…" aria-label="Search activities" className="w-full pl-8" /></label><div className="flex flex-wrap items-center gap-2"><ActivityFilterMenu value={filter} onChange={setFilter} counts={counts} />{canManage && <DropdownMenu><DropdownMenuTrigger asChild><Button size="sm"><Plus size={16} />Add activity</Button></DropdownMenuTrigger><DropdownMenuContent align="end" className="w-52"><DropdownMenuLabel>Activity type</DropdownMenuLabel><DropdownMenuSeparator /><DropdownMenuItem onSelect={() => setAssignOpen(true)}><BookOpenCheck />Test</DropdownMenuItem><DropdownMenuItem onSelect={() => navigate(`/dashboard/vocabulary?classId=${classId}`)}><BookA />Vocabulary</DropdownMenuItem><DropdownMenuItem onSelect={onNewHomework}><FileText />Homework</DropdownMenuItem></DropdownMenuContent></DropdownMenu>}</div></div>

    {loading ? <ActivitySkeleton /> : error ? <EmptyState icon={<ClipboardList size={22} />} title="Unable to load activities" description={error} action={<Button variant="outline" onClick={() => void loadActivities()}>Try again</Button>} /> : filtered.length === 0 ? <EmptyState icon={<ClipboardList size={22} />} title="No activities found" description={activities.length ? 'Adjust the search or activity filter.' : canManage ? 'Add a test, vocabulary set, or homework activity for this class.' : 'Your teacher has not published any activities yet.'} action={canManage && activities.length === 0 ? <Button onClick={() => setAssignOpen(true)}><Plus size={16} />Add test activity</Button> : undefined} /> : <TableShell className="shadow-none"><div className="divide-y divide-ui-border">{filtered.map(activity => <ActivityRow key={activity.id} activity={activity} canManage={canManage} onOpen={() => openActivity(activity)} />)}</div></TableShell>}

    <AssignTestActivity open={assignOpen} onClose={() => setAssignOpen(false)} classId={classId} students={students} onCreated={async () => { setAssignOpen(false); await loadActivities(); }} />
  </div>;
}

function ActivityFilterMenu({ value, onChange, counts }: { value: ActivityFilter; onChange: (value: ActivityFilter) => void; counts: Record<ActivityFilter, number> }) {
  const labels: Record<ActivityFilter, string> = { ALL: 'All activities', TEST: 'Tests', VOCABULARY: 'Vocabulary', HOMEWORK: 'Homework', RESOURCE: 'Resources' };
  return <DropdownMenu><DropdownMenuTrigger asChild><Button variant="outline" size="sm"><ClipboardList size={15} />{labels[value]}</Button></DropdownMenuTrigger><DropdownMenuContent align="end" className="w-48"><DropdownMenuLabel>Filter activities</DropdownMenuLabel><DropdownMenuSeparator />{(['ALL', 'TEST', 'VOCABULARY', 'HOMEWORK'] as ActivityFilter[]).map(item => <DropdownMenuItem key={item} onSelect={() => onChange(item)}><span className="flex-1">{labels[item]}</span><span className="text-muted-foreground">{counts[item]}</span>{value === item && <Check size={14} />}</DropdownMenuItem>)}</DropdownMenuContent></DropdownMenu>;
}

function ActivityRow({ activity, canManage, onOpen }: { activity: ClassActivity; canManage: boolean; onOpen: () => void }) {
  const activeAssignees = activity.assignees.filter(item => !item.excusedAt);
  const completed = activeAssignees.filter(item => item.status === 'COMPLETED').length;
  const inProgress = activeAssignees.filter(item => item.status === 'IN_PROGRESS').length;
  const duePast = Boolean(activity.dueAt && isPast(new Date(activity.dueAt)));
  const notAvailable = Boolean(!canManage && activity.availableAt && new Date(activity.availableAt) > new Date());
  const metadata = activityMetadata(activity);
  const Icon = activity.type === 'TEST' ? BookOpenCheck : activity.type === 'VOCABULARY' ? BookA : FileText;
  const statusText = activity.status === 'CLOSED' ? 'Closed' : activity.status === 'DRAFT' ? 'Draft' : 'Published';
  return <div className="flex flex-col gap-4 px-4 py-4 transition-colors hover:bg-muted/20 sm:flex-row sm:items-center"><span className="flex size-10 shrink-0 items-center justify-center rounded-control border border-ui-border bg-muted text-muted-foreground"><Icon size={18} /></span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h3 className="truncate text-body font-semibold text-foreground">{activity.title}</h3><Badge className="gap-1 px-1.5 text-muted-foreground">{activity.status === 'PUBLISHED' ? <Check size={12} /> : null}{statusText}</Badge></div><p className="mt-1 text-caption text-muted-foreground">{metadata}{activity.dueAt ? ` · Due ${format(new Date(activity.dueAt), 'MMM d, yyyy · HH:mm')}` : ' · No deadline'}</p>{notAvailable && <p className="mt-1 text-caption text-subtle">Available {format(new Date(activity.availableAt as string), 'MMM d, yyyy · HH:mm')}</p>}{canManage && <p className="mt-1 text-caption text-subtle">{completed} of {activeAssignees.length} completed{inProgress ? ` · ${inProgress} in progress` : ''}{duePast && completed < activeAssignees.length ? ` · ${activeAssignees.length - completed} missing` : ''}</p>}</div><div className="flex items-center gap-2 self-end sm:self-auto">{canManage && <Badge className="gap-1.5"><Users size={12} />{activeAssignees.length}</Badge>}<Button variant="outline" size="sm" disabled={notAvailable} onClick={onOpen}>{notAvailable ? 'Not available yet' : canManage && activity.type === 'TEST' ? 'View performance' : activity.type === 'HOMEWORK' ? 'Open homework' : 'Open activity'}{!notAvailable && <ChevronRight size={15} />}</Button></div></div>;
}

function activityMetadata(activity: ClassActivity) {
  if (activity.type === 'TEST' && activity.test) {
    const test = activity.test.testDelivery.test;
    const questions = test.sections.reduce((sum, section) => sum + section._count.questions, 0);
    return `${test.subject === 'MATH' ? 'Math' : 'Reading & Writing'} · ${test.mode === 'EXAM' ? 'Exam' : 'Practice'} · ${questions} questions · ${activity.maxAttempts} attempt${activity.maxAttempts === 1 ? '' : 's'}`;
  }
  if (activity.type === 'VOCABULARY' && activity.vocabulary) return `Vocabulary · ${activity.vocabulary._count.items} words`;
  if (activity.type === 'HOMEWORK') return 'Homework';
  return 'Learning resource';
}

function AssignTestActivity({ open, onClose, classId, students, onCreated }: { open: boolean; onClose: () => void; classId: string; students: Student[]; onCreated: () => Promise<void> }) {
  const [source, setSource] = useState<LibrarySource>('MY');
  const [tests, setTests] = useState<LibraryTest[]>([]);
  const [testSearch, setTestSearch] = useState('');
  const [selectedTest, setSelectedTest] = useState<LibraryTest | null>(null);
  const [title, setTitle] = useState('');
  const [availableAt, setAvailableAt] = useState('');
  const [dueAt, setDueAt] = useState('');
  const [maxAttempts, setMaxAttempts] = useState(1);
  const [scorePolicy, setScorePolicy] = useState<'FIRST' | 'BEST' | 'LATEST'>('FIRST');
  const [allStudents, setAllStudents] = useState(true);
  const [studentIds, setStudentIds] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const loadTests = useCallback(async () => {
    if (!open) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ source, status: 'PUBLISHED', pageSize: '48', sort: 'NEWEST' });
      if (testSearch.trim()) params.set('search', testSearch.trim());
      const page = await axiosClient.get<TestPage, TestPage>(`/api/tests?${params}`);
      setTests(page.items.map(item => ({ ...item, title: capitalizeFirstLetter(item.title) })));
    } catch (requestError) {
      toast.error(errorMessage(requestError, 'Unable to load published tests.'));
    } finally {
      setLoading(false);
    }
  }, [open, source, testSearch]);

  useEffect(() => { const timeout = window.setTimeout(() => void loadTests(), 200); return () => window.clearTimeout(timeout); }, [loadTests]);
  useEffect(() => { if (!open) { setSelectedTest(null); setTitle(''); setAvailableAt(''); setDueAt(''); setMaxAttempts(1); setScorePolicy('FIRST'); setAllStudents(true); setStudentIds([]); } }, [open]);

  const selectTest = (test: LibraryTest) => { setSelectedTest(test); setTitle(test.title); };
  const toggleStudent = (studentId: number) => setStudentIds(current => current.includes(studentId) ? current.filter(id => id !== studentId) : [...current, studentId]);

  const submit = async () => {
    if (students.length === 0) return toast.error('Add at least one student before publishing an activity');
    if (!selectedTest) return toast.error('Select a published test');
    if (!allStudents && studentIds.length === 0) return toast.error('Select at least one student');
    if (availableAt && dueAt && new Date(availableAt) >= new Date(dueAt)) return toast.error('Deadline must be after availability');
    setSaving(true);
    try {
      await axiosClient.post('/api/test-deliveries', {
        classIds: [classId], testIds: [selectedTest.id], title: title.trim() || selectedTest.title,
        availableAt: availableAt ? new Date(availableAt).toISOString() : null,
        dueAt: dueAt ? new Date(dueAt).toISOString() : null,
        maxAttempts, scorePolicy,
        ...(!allStudents ? { studentIds } : {}),
      });
      toast.success('Test activity published');
      await onCreated();
    } catch (requestError) {
      toast.error(errorMessage(requestError, 'Unable to publish this activity.'));
    } finally {
      setSaving(false);
    }
  };

  return <Modal open={open} onClose={() => !saving && onClose()} closeOnBackdrop={!saving} presentation="content-dialog" title="Add test activity" subtitle="Choose a published test, then configure how students will complete it." className="max-w-3xl!" footer={<><Button variant="outline" disabled={saving} onClick={onClose}>Cancel</Button><Button disabled={saving || students.length === 0 || !selectedTest || (!allStudents && studentIds.length === 0)} onClick={() => void submit()}>{saving ? <><LoaderCircle size={15} className="animate-spin" />Publishing…</> : 'Publish activity'}</Button></>}>
    <div className="max-h-[68vh] space-y-5 overflow-y-auto pr-1">{students.length === 0 && <p className="rounded-control border border-ui-border bg-muted p-3 text-caption text-muted-foreground">Add at least one student to this class before publishing an activity.</p>}<div className="overflow-x-auto"><Tabs items={[{ value: 'MY' as const, label: 'My Tests' }, { value: 'SYSTEM' as const, label: 'System Tests' }]} value={source} onValueChange={value => { setSource(value); setSelectedTest(null); }} ariaLabel="Test source" /></div><label className="relative block"><Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" /><Input value={testSearch} onChange={event => setTestSearch(event.target.value)} placeholder="Search published tests…" className="w-full pl-9" /></label><div className="max-h-56 space-y-2 overflow-y-auto rounded-card border border-ui-border p-2">{loading ? <p className="py-10 text-center text-sm text-muted-foreground">Loading tests…</p> : tests.length === 0 ? <p className="py-10 text-center text-sm text-muted-foreground">No published tests found.</p> : tests.map(test => { const selected = selectedTest?.id === test.id; return <Button key={test.id} variant="ghost" className={`h-auto w-full justify-start gap-3 p-3 text-left ${selected ? 'bg-accent text-foreground' : ''}`} onClick={() => selectTest(test)}><span className="flex size-9 shrink-0 items-center justify-center rounded-control border border-ui-border bg-muted"><BookOpenCheck size={17} /></span><span className="min-w-0 flex-1"><span className="block truncate text-body font-medium">{test.title}</span><span className="mt-1 block text-caption font-normal text-muted-foreground">{test.subject === 'MATH' ? 'Math' : 'Reading & Writing'} · {test.mode === 'EXAM' ? 'Exam' : 'Practice'} · {test.questionCount} questions</span></span>{selected && <Check size={17} />}</Button>; })}</div>
      {selectedTest && <><div className="grid gap-4 border-t border-ui-border pt-5 sm:grid-cols-2"><Field label="Activity title" className="sm:col-span-2"><Input className="w-full" value={title} onChange={event => setTitle(event.target.value)} /></Field><Field label="Available from"><DateTimePicker value={availableAt} onChange={setAvailableAt} placeholder="Available now" ariaLabel="Available from" /></Field><Field label="Deadline"><DateTimePicker value={dueAt} minDate={availableAt || undefined} onChange={setDueAt} placeholder="No deadline" ariaLabel="Activity deadline" /></Field><Field label="Attempts"><Input className="w-full" type="number" min={1} max={10} value={maxAttempts} onChange={event => setMaxAttempts(Math.min(10, Math.max(1, Number(event.target.value))))} /></Field><Field label="Score policy"><Select className="w-full" value={scorePolicy} onChange={event => setScorePolicy(event.target.value as typeof scorePolicy)}><option value="FIRST">First attempt</option><option value="BEST">Best attempt</option><option value="LATEST">Latest attempt</option></Select></Field></div><div className="border-t border-ui-border pt-5"><div className="flex items-center justify-between gap-3"><div><h3 className="text-body font-medium">Students</h3><p className="mt-1 text-caption text-muted-foreground">Assign to the whole class or selected students.</p></div><label className="flex items-center gap-2 text-body"><Checkbox checked={allStudents} onCheckedChange={checked => { setAllStudents(Boolean(checked)); setStudentIds([]); }} />All students</label></div>{!allStudents && <div className="mt-3 grid gap-2 sm:grid-cols-2">{students.map(student => <label key={student.id} className="flex items-center gap-3 rounded-control border border-ui-border p-3 hover:bg-muted/30"><Checkbox checked={studentIds.includes(student.id)} onCheckedChange={() => toggleStudent(student.id)} /><span className="min-w-0"><span className="block truncate text-body font-medium">{student.name || student.email}</span><span className="block truncate text-caption text-muted-foreground">{student.email}</span></span></label>)}</div>}</div></>}
    </div>
  </Modal>;
}

function Field({ label, className = '', children }: { label: string; className?: string; children: React.ReactNode }) { return <label className={className}><span className="mb-2 block text-caption font-medium text-foreground">{label}</span>{children}</label>; }
function ActivitySkeleton() { return <TableShell className="animate-pulse shadow-none">{[1, 2, 3, 4].map(item => <div key={item} className="flex h-24 items-center gap-4 border-b border-ui-border px-4 last:border-0"><span className="size-10 rounded-control bg-muted" /><span className="h-4 w-64 rounded-sm bg-muted" /><span className="ml-auto h-8 w-32 rounded-control bg-muted" /></div>)}</TableShell>; }
const errorMessage = (error: unknown, fallback: string) => (error as { response?: { data?: { error?: string } } })?.response?.data?.error || fallback;
