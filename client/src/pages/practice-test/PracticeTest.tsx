import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowUpDown, BookOpen, BookOpenCheck, Check, CheckCircle2, ChevronLeft, ChevronRight, Clock3, Grid2X2, GraduationCap, List, LoaderCircle, MoreHorizontal, Pencil, Play, Plus, RefreshCw, Search, SlidersHorizontal, Trash2, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { Checkbox } from '@/components/ui/checkbox';
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuSeparator, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import axiosClient from '../../lib/axios';
import { capitalizeFirstLetter } from '../../utils/text';
import { SatCountdown } from '../../features/sat-countdown/SatCountdown';
import { DateTimePicker } from '../../components/ui/DateTimePicker';
import { Badge, Button, Card, EmptyState, Input, Modal, PageHeader, Select, Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableShell } from '../../components/ui/AppUI';
import { cachedGet, invalidateQueryCache } from '../../lib/queryCache';
import { useDebounce } from '../../hooks/useDebounce';

interface ClassInfo {
  id: string;
  name: string;
  _count?: { students: number };
}

interface TestItem {
  id: number;
  title: string;
  description?: string;
  duration: number;
  subject: 'RW' | 'MATH';
  category: string;
  mode: 'PRACTICE' | 'EXAM';
  isDoing?: boolean;
  questionCount: number;
  progress: number;
  attemptStatus: 'NOT_STARTED' | 'DOING' | 'COMPLETED';
  lastAttempt?: string | null;
  lastScore?: number | null;
  author?: { id: number; name?: string; role: 'ADMIN' | 'TEACHER' | 'STUDENT' } | null;
  classTests?: Array<{ classId: string; class?: { name: string } }>;
  deliveries?: Array<{ id: string; title: string; classId: string; availableAt: string | null; dueAt: string | null; maxAttempts: number; scorePolicy: 'FIRST' | 'BEST' | 'LATEST'; class: { name: string } }>;
}

type UserRole = 'ADMIN' | 'TEACHER' | 'STUDENT';
type SubjectFilter = 'ALL' | TestItem['subject'];
type ModeFilter = 'ALL' | TestItem['mode'];
type SortOrder = 'NEWEST' | 'OLDEST';
type ViewMode = 'GRID' | 'LIST';

interface PaginationMeta { page: number; pageSize: number; total: number; totalPages: number }
interface TestPage { items: TestItem[]; pagination: PaginationMeta }

const subjectLabel: Record<TestItem['subject'], string> = { RW: 'Reading & Writing', MATH: 'Math' };
const modeLabel: Record<TestItem['mode'], string> = { PRACTICE: 'Practice', EXAM: 'Exam' };

const formatLastAttempt = (value?: string | null) => {
  if (!value) return 'Never';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Never';
  const elapsed = Math.max(0, Date.now() - date.getTime());
  const minutes = Math.floor(elapsed / 60_000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

const clampProgress = (value: number | null | undefined) => Math.min(100, Math.max(0, value ?? 0));

const PracticeTest = () => {
  const navigate = useNavigate();
  const role = (localStorage.getItem('userRole') || 'STUDENT') as UserRole;
  const canManage = role === 'TEACHER' || role === 'ADMIN';

  const [tests, setTests] = useState<TestItem[]>([]);
  const [classes, setClasses] = useState<ClassInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [subject, setSubject] = useState<SubjectFilter>('ALL');
  const [mode, setMode] = useState<ModeFilter>('ALL');
  const [sortOrder, setSortOrder] = useState<SortOrder>('NEWEST');
  const [classFilter, setClassFilter] = useState('ALL');
  const [viewMode, setViewMode] = useState<ViewMode>(() => localStorage.getItem('practiceCenterView') === 'LIST' ? 'LIST' : 'GRID');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState<PaginationMeta>({ page: 1, pageSize: 24, total: 0, totalPages: 1 });
  const [selectedTestIds, setSelectedTestIds] = useState<number[]>([]);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedClassIds, setSelectedClassIds] = useState<string[]>([]);
  const [assignmentOpen, setAssignmentOpen] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [startClassTest, setStartClassTest] = useState<TestItem | null>(null);
  const [availableAt, setAvailableAt] = useState('');
  const [dueAt, setDueAt] = useState('');
  const [maxAttempts, setMaxAttempts] = useState(1);
  const [scorePolicy, setScorePolicy] = useState<'FIRST' | 'BEST' | 'LATEST'>('FIRST');
  const [deleteTarget, setDeleteTarget] = useState<TestItem | null>(null);
  const [deleting, setDeleting] = useState(false);
  const debouncedSearch = useDebounce(search, 250);

  const activeFilterCount = Number(subject !== 'ALL') + Number(mode !== 'ALL') + Number(classFilter !== 'ALL');
  const headerDescription = role === 'STUDENT'
    ? 'Find assigned and public SAT tests, then continue where you left off.'
    : 'Manage your SAT test library and assign tests to classes.';

  const loadData = useCallback(async (force = false) => {
    setLoading(true);
    setLoadError(null);
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: '24', sort: sortOrder });
      if (debouncedSearch.trim()) params.set('search', debouncedSearch.trim());
      if (subject !== 'ALL') params.set('subject', subject);
      if (mode !== 'ALL') params.set('mode', mode);
      if (classFilter !== 'ALL') params.set('classId', classFilter);
      const [testData, classData] = await Promise.all([
        cachedGet<TestPage>(`/api/tests?${params}`, { ttlMs: 30_000, force }),
        cachedGet<ClassInfo[]>('/api/tests/classes', { ttlMs: 5 * 60_000, force }),
      ]);
      setTests(testData.items.map(test => ({ ...test, title: capitalizeFirstLetter(test.title) })));
      setPagination(testData.pagination);
      setClasses(classData.map(classroom => ({ ...classroom, name: capitalizeFirstLetter(classroom.name) })));
    } catch (error) {
      console.error(error);
      setLoadError('Practice Center could not be loaded. Check your connection and try again.');
      toast.error('Unable to load Practice Center');
    } finally {
      setLoading(false);
    }
  }, [classFilter, debouncedSearch, mode, page, sortOrder, subject]);

  useEffect(() => { void loadData(); }, [loadData]);

  const openTest = useCallback((test: TestItem, context?: { classId?: string; deliveryId?: string }) => {
    localStorage.setItem('current_exam_info', JSON.stringify({ id: test.id, title: test.title, description: test.description, duration: test.duration }));
    const params = new URLSearchParams();
    if (context?.deliveryId) params.set('deliveryId', context.deliveryId);
    else if (context?.classId) params.set('classId', context.classId);
    navigate(`/test/${test.id}${params.toString() ? `?${params}` : ''}`);
  }, [navigate]);

  const handleStart = useCallback((test: TestItem) => {
    const deliveries = test.deliveries || [];
    if (role === 'STUDENT' && deliveries.length > 1) {
      setStartClassTest(test);
      return;
    }
    if (role === 'STUDENT' && deliveries.length === 1) {
      openTest(test, { deliveryId: deliveries[0].id });
      return;
    }
    const assignedClassIds = [...new Set((test.classTests || []).map(item => item.classId))];
    if (role === 'STUDENT' && assignedClassIds.length > 1) {
      setStartClassTest(test);
      return;
    }
    openTest(test, role === 'STUDENT' && assignedClassIds[0] ? { classId: assignedClassIds[0] } : undefined);
  }, [openTest, role]);

  const toggleTest = (testId: number) => setSelectedTestIds(current => current.includes(testId) ? current.filter(id => id !== testId) : [...current, testId]);
  const toggleClass = (classId: string) => setSelectedClassIds(current => current.includes(classId) ? current.filter(id => id !== classId) : [...current, classId]);

  const resetFilters = () => {
    setSubject('ALL');
    setMode('ALL');
    setClassFilter('ALL');
    setPage(1);
  };

  const changeViewMode = (nextView: ViewMode) => {
    setViewMode(nextView);
    localStorage.setItem('practiceCenterView', nextView);
  };

  const leaveSelectionMode = () => {
    setSelectionMode(false);
    setSelectedTestIds([]);
  };

  const assignTests = async () => {
    if (selectedTestIds.length === 0 || selectedClassIds.length === 0) {
      toast.error('Select at least one test and one class');
      return;
    }
    setAssigning(true);
    try {
      await axiosClient.post('/api/tests/assign', { testIds: selectedTestIds, classIds: selectedClassIds, availableAt: availableAt ? new Date(availableAt).toISOString() : null, dueAt: dueAt ? new Date(dueAt).toISOString() : null, maxAttempts, scorePolicy });
      toast.success(`Assigned ${selectedTestIds.length} test(s) to ${selectedClassIds.length} class(es)`);
      setAssignmentOpen(false);
      leaveSelectionMode();
      setSelectedClassIds([]);
      setAvailableAt('');
      setDueAt('');
      setMaxAttempts(1);
      setScorePolicy('FIRST');
      invalidateQueryCache('/api/tests');
      await loadData(true);
    } catch (error: unknown) {
      const requestError = error as { response?: { data?: { error?: string } } };
      toast.error(requestError.response?.data?.error || 'Unable to assign tests');
    } finally {
      setAssigning(false);
    }
  };

  const deleteTest = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await axiosClient.delete(`/api/tests/${deleteTarget.id}`);
      setDeleteTarget(null);
      toast.success('Exam deleted');
      invalidateQueryCache('/api/tests');
      if (tests.length === 1 && page > 1) setPage(current => current - 1);
      else await loadData(true);
    } catch (error: unknown) {
      const requestError = error as { response?: { data?: { error?: string } } };
      toast.error(requestError.response?.data?.error || 'Unable to delete this exam');
    } finally {
      setDeleting(false);
    }
  };

  const resultSummary = useMemo(() => {
    if (pagination.total === 0) return 'No tests';
    const first = (pagination.page - 1) * pagination.pageSize + 1;
    const last = Math.min(pagination.page * pagination.pageSize, pagination.total);
    return `${first}–${last} of ${pagination.total}`;
  }, [pagination]);

  return (
    <div className="h-full overflow-y-auto bg-background">
      <main className="mx-auto flex w-full max-w-screen-2xl flex-col gap-4 p-4 md:p-6">
        <section className="flex flex-col gap-4">
          <PageHeader title={<span className="font-medium">Practice Center</span>} description={headerDescription} actions={<SatCountdown />} />
          {(!loading || pagination.total > 0 || classes.length > 0) && <div className="flex flex-wrap items-center gap-2">
            <Badge className="gap-1.5 rounded-sm px-2 py-1"><BookOpenCheck size={13} aria-hidden="true" />{pagination.total} tests</Badge>
            {canManage && <Badge className="gap-1.5 rounded-sm px-2 py-1"><GraduationCap size={13} aria-hidden="true" />{classes.length} classes</Badge>}
            {selectionMode && <Badge tone="green" className="rounded-sm px-2 py-1">{selectedTestIds.length} selected</Badge>}
          </div>}
          <PracticeToolbar search={search} onSearchChange={value => { setSearch(value); setPage(1); }} subject={subject} onSubjectChange={value => { setSubject(value); setPage(1); }} mode={mode} onModeChange={value => { setMode(value); setPage(1); }} classFilter={classFilter} onClassChange={value => { setClassFilter(value); setPage(1); }} classes={classes} sortOrder={sortOrder} onSortChange={value => { setSortOrder(value); setPage(1); }} activeFilterCount={activeFilterCount} onResetFilters={resetFilters} viewMode={viewMode} onViewModeChange={changeViewMode} loading={loading} onRefresh={() => void loadData(true)} canManage={canManage} selectionMode={selectionMode} selectedCount={selectedTestIds.length} onEnterSelection={() => setSelectionMode(true)} onLeaveSelection={leaveSelectionMode} onAssign={() => setAssignmentOpen(true)} onCreate={() => navigate('/dashboard/practice-test/create')} />
        </section>

        {loadError && tests.length === 0 && !loading ? (
          <EmptyState icon={<RefreshCw size={20} />} title="Unable to load tests" description={loadError} action={<Button variant="outline" onClick={() => void loadData(true)}><RefreshCw size={15} />Try again</Button>} className="min-h-80" />
        ) : loading ? (
          <PracticeSkeleton viewMode={viewMode} />
        ) : tests.length === 0 ? (
          <EmptyState icon={<BookOpenCheck size={22} />} title="No matching tests" description={canManage ? 'Create your first exam or adjust the current filters.' : 'Your teacher has not assigned a test to your class yet. Public admin tests appear here automatically.'} action={activeFilterCount > 0 || search ? <Button variant="outline" onClick={() => { setSearch(''); resetFilters(); }}><X size={15} />Clear filters</Button> : canManage ? <Button onClick={() => navigate('/dashboard/practice-test/create')}><Plus size={15} />Create exam</Button> : undefined} className="min-h-80" />
        ) : viewMode === 'GRID' ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">{tests.map(test => <TestCard key={test.id} test={test} canManage={canManage} selectionMode={selectionMode} selected={selectedTestIds.includes(test.id)} onToggle={() => toggleTest(test.id)} onStart={() => handleStart(test)} onEdit={() => navigate(`/dashboard/practice-test/create?edit=${test.id}`)} onDelete={() => setDeleteTarget(test)} />)}</div>
        ) : (
          <TestList tests={tests} canManage={canManage} selectionMode={selectionMode} selectedTestIds={selectedTestIds} onToggle={toggleTest} onStart={handleStart} onEdit={test => navigate(`/dashboard/practice-test/create?edit=${test.id}`)} onDelete={setDeleteTarget} />
        )}

        {!loading && pagination.total > 0 && <div className="flex flex-col items-center justify-between gap-3 border-t border-ui-border pt-4 sm:flex-row"><p className="text-caption text-muted-foreground">Showing {resultSummary} tests</p><div className="flex items-center gap-2"><Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(current => Math.max(1, current - 1))}><ChevronLeft size={15} />Previous</Button><span className="min-w-20 text-center text-caption font-medium text-subtle">Page {pagination.page} of {pagination.totalPages}</span><Button variant="outline" size="sm" disabled={page >= pagination.totalPages} onClick={() => setPage(current => current + 1)}>Next<ChevronRight size={15} /></Button></div></div>}
      </main>

      <Modal open={assignmentOpen} onClose={() => setAssignmentOpen(false)} closeOnBackdrop presentation="content-dialog" title="Assign tests to classes" subtitle={`${selectedTestIds.length} test(s) selected`} className="max-w-lg!" footer={<><Button variant="outline" onClick={() => setAssignmentOpen(false)}>Cancel</Button><Button disabled={assigning || selectedClassIds.length === 0} onClick={assignTests}>{assigning ? 'Assigning…' : `Assign to ${selectedClassIds.length} class(es)`}</Button></>}>
        <div className="max-h-[520px] space-y-5 overflow-y-auto pr-1"><div className="grid grid-cols-1 gap-4 sm:grid-cols-2"><Field label="Available from"><DateTimePicker value={availableAt} onChange={setAvailableAt} placeholder="Choose availability" ariaLabel="Available from" /></Field><Field label="Deadline"><DateTimePicker value={dueAt} minDate={availableAt || undefined} onChange={setDueAt} placeholder="Choose deadline" ariaLabel="Assignment deadline" /></Field><Field label="Attempts"><Input type="number" min={1} max={10} value={maxAttempts} onChange={event => setMaxAttempts(Math.min(10, Math.max(1, Number(event.target.value))))} className="w-full" /></Field><Field label="Score policy"><Select value={scorePolicy} onChange={event => setScorePolicy(event.target.value as typeof scorePolicy)} className="w-full"><option value="FIRST">First attempt</option><option value="BEST">Best attempt</option><option value="LATEST">Latest attempt</option></Select></Field></div><div className="border-t border-ui-border pt-5"><p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Classes</p><div className="space-y-2">{classes.length === 0 ? <p className="rounded-control bg-muted p-5 text-center text-sm text-muted-foreground">You do not have any classes yet.</p> : classes.map(item => { const checked = selectedClassIds.includes(item.id); return <label key={item.id} className={`flex cursor-pointer items-center gap-3 rounded-control border p-3 transition-colors ${checked ? 'border-primary bg-primary-soft' : 'border-ui-border hover:bg-muted/50'}`}><Checkbox checked={checked} onCheckedChange={() => toggleClass(item.id)} /><span className="flex size-9 items-center justify-center rounded-control bg-muted text-muted-foreground"><GraduationCap size={17} /></span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium text-foreground">{item.name}</span><span className="block text-xs text-muted-foreground">{item._count?.students || 0} student(s)</span></span></label>; })}</div></div></div>
      </Modal>

      <Modal open={Boolean(startClassTest)} onClose={() => setStartClassTest(null)} closeOnBackdrop presentation="content-dialog" title="Choose a class" subtitle={startClassTest?.title} className="max-w-md!">{startClassTest && <div className="space-y-2">{(startClassTest.deliveries || []).length > 0 ? startClassTest.deliveries?.map(delivery => <Button key={delivery.id} variant="outline" onClick={() => openTest(startClassTest, { deliveryId: delivery.id })} className="h-auto w-full justify-between p-4 text-left"><span><span className="block">{capitalizeFirstLetter(delivery.class.name)}</span><span className="mt-1 block text-xs font-normal text-muted-foreground">{delivery.dueAt ? `Due ${new Date(delivery.dueAt).toLocaleString()}` : 'No deadline'}</span></span><ChevronRight size={17} /></Button>) : [...new Set((startClassTest.classTests || []).map(item => item.classId))].map(classId => <Button key={classId} variant="outline" onClick={() => openTest(startClassTest, { classId })} className="h-auto w-full justify-between p-4 text-left">{classes.find(item => item.id === classId)?.name || 'Class'}<ChevronRight size={17} /></Button>)}</div>}</Modal>

      <Modal open={Boolean(deleteTarget)} onClose={() => !deleting && setDeleteTarget(null)} closeOnBackdrop={!deleting} presentation="content-dialog" title="Delete exam?" subtitle={deleteTarget?.title} className="max-w-md!" footer={<><Button variant="outline" disabled={deleting} onClick={() => setDeleteTarget(null)}>Cancel</Button><Button variant="destructive" disabled={deleting} onClick={deleteTest}>{deleting ? 'Deleting…' : 'Delete exam'}</Button></>}><p className="text-sm leading-6 text-muted-foreground">This permanently deletes the exam, its assignments, and any student attempt data associated with it. This action cannot be undone.</p></Modal>
    </div>
  );
};

interface PracticeToolbarProps {
  search: string; onSearchChange: (value: string) => void;
  subject: SubjectFilter; onSubjectChange: (value: SubjectFilter) => void;
  mode: ModeFilter; onModeChange: (value: ModeFilter) => void;
  classFilter: string; onClassChange: (value: string) => void; classes: ClassInfo[];
  sortOrder: SortOrder; onSortChange: (value: SortOrder) => void;
  activeFilterCount: number; onResetFilters: () => void;
  viewMode: ViewMode; onViewModeChange: (value: ViewMode) => void;
  loading: boolean; onRefresh: () => void; canManage: boolean; selectionMode: boolean; selectedCount: number;
  onEnterSelection: () => void; onLeaveSelection: () => void; onAssign: () => void; onCreate: () => void;
}

function PracticeToolbar({ search, onSearchChange, subject, onSubjectChange, mode, onModeChange, classFilter, onClassChange, classes, sortOrder, onSortChange, activeFilterCount, onResetFilters, viewMode, onViewModeChange, loading, onRefresh, canManage, selectionMode, selectedCount, onEnterSelection, onLeaveSelection, onAssign, onCreate }: PracticeToolbarProps) {
  return <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:gap-2">
    <label className="relative w-full min-w-0 xl:flex-1"><Search size={16} className="pointer-events-none absolute left-2.5 top-1/2 z-10 -translate-y-1/2 text-muted-foreground" aria-hidden="true" /><Input controlSize="sm" value={search} onChange={event => onSearchChange(event.target.value)} placeholder="Search tests…" aria-label="Search tests" className="w-full pl-8" /></label>
    <div className="flex flex-wrap items-center gap-2 xl:flex-nowrap">
      <DropdownMenu><DropdownMenuTrigger asChild><Button variant="outline" size="sm" className={activeFilterCount > 0 ? 'bg-muted text-foreground' : undefined}><SlidersHorizontal size={15} />Filter{activeFilterCount > 0 && <Badge className="ml-1 min-w-5 justify-center px-1.5">{activeFilterCount}</Badge>}</Button></DropdownMenuTrigger><DropdownMenuContent align="end" className="w-52"><DropdownMenuLabel>Filter tests</DropdownMenuLabel><DropdownMenuSeparator /><DropdownMenuGroup><DropdownMenuSub><DropdownMenuSubTrigger><BookOpen />Subject</DropdownMenuSubTrigger><DropdownMenuSubContent sideOffset={8} className="w-48"><DropdownMenuLabel>Subject</DropdownMenuLabel><DropdownMenuSeparator /><DropdownMenuRadioGroup value={subject} onValueChange={value => onSubjectChange(value as SubjectFilter)}><DropdownMenuRadioItem value="ALL">All subjects</DropdownMenuRadioItem><DropdownMenuRadioItem value="RW">Reading & Writing</DropdownMenuRadioItem><DropdownMenuRadioItem value="MATH">Math</DropdownMenuRadioItem></DropdownMenuRadioGroup></DropdownMenuSubContent></DropdownMenuSub><DropdownMenuSub><DropdownMenuSubTrigger><BookOpenCheck />Test type</DropdownMenuSubTrigger><DropdownMenuSubContent sideOffset={8} className="w-44"><DropdownMenuLabel>Test type</DropdownMenuLabel><DropdownMenuSeparator /><DropdownMenuRadioGroup value={mode} onValueChange={value => onModeChange(value as ModeFilter)}><DropdownMenuRadioItem value="ALL">All types</DropdownMenuRadioItem><DropdownMenuRadioItem value="EXAM">Exam</DropdownMenuRadioItem><DropdownMenuRadioItem value="PRACTICE">Practice</DropdownMenuRadioItem></DropdownMenuRadioGroup></DropdownMenuSubContent></DropdownMenuSub>{classes.length > 0 && <DropdownMenuSub><DropdownMenuSubTrigger><GraduationCap />Class</DropdownMenuSubTrigger><DropdownMenuSubContent sideOffset={8} className="w-56"><DropdownMenuLabel>Class</DropdownMenuLabel><DropdownMenuSeparator /><DropdownMenuRadioGroup value={classFilter} onValueChange={onClassChange}><DropdownMenuRadioItem value="ALL">All classes</DropdownMenuRadioItem>{classes.map(item => <DropdownMenuRadioItem key={item.id} value={item.id}>{item.name}</DropdownMenuRadioItem>)}</DropdownMenuRadioGroup></DropdownMenuSubContent></DropdownMenuSub>}</DropdownMenuGroup><DropdownMenuSeparator /><DropdownMenuItem disabled={activeFilterCount === 0} onSelect={onResetFilters}><X />Reset filters</DropdownMenuItem></DropdownMenuContent></DropdownMenu>
      <DropdownMenu><DropdownMenuTrigger asChild><Button variant="outline" size="sm"><ArrowUpDown size={15} />{sortOrder === 'NEWEST' ? 'Newest' : 'Oldest'}</Button></DropdownMenuTrigger><DropdownMenuContent align="end" className="w-44"><DropdownMenuLabel>Sort by</DropdownMenuLabel><DropdownMenuSeparator /><DropdownMenuRadioGroup value={sortOrder} onValueChange={value => onSortChange(value as SortOrder)}><DropdownMenuRadioItem value="NEWEST">Newest first</DropdownMenuRadioItem><DropdownMenuRadioItem value="OLDEST">Oldest first</DropdownMenuRadioItem></DropdownMenuRadioGroup></DropdownMenuContent></DropdownMenu>
      <div className="flex h-8 items-center rounded-control border border-ui-border bg-surface p-0.5" role="group" aria-label="Display mode"><Button variant="ghost" size="sm" className={`h-7 px-2 shadow-none ${viewMode === 'GRID' ? 'bg-accent text-foreground' : ''}`} onClick={() => onViewModeChange('GRID')} aria-label="Card view" aria-pressed={viewMode === 'GRID'}>{viewMode === 'GRID' && <Check size={14} strokeWidth={2.5} aria-hidden="true" />}<Grid2X2 size={17} aria-hidden="true" /></Button><Button variant="ghost" size="sm" className={`h-7 px-2 shadow-none ${viewMode === 'LIST' ? 'bg-accent text-foreground' : ''}`} onClick={() => onViewModeChange('LIST')} aria-label="List view" aria-pressed={viewMode === 'LIST'}>{viewMode === 'LIST' && <Check size={14} strokeWidth={2.5} aria-hidden="true" />}<List size={18} aria-hidden="true" /></Button></div>
      <Button variant="outline" size="sm" className="w-8 px-0" onClick={onRefresh} disabled={loading} aria-label="Refresh tests"><RefreshCw size={17} className={loading ? 'animate-spin' : ''} aria-hidden="true" /></Button>
      {canManage && (selectionMode ? <><Button variant="outline" size="sm" onClick={onLeaveSelection}>Cancel</Button><Button size="sm" disabled={selectedCount === 0} onClick={onAssign}><GraduationCap size={15} />Assign{selectedCount > 0 ? ` (${selectedCount})` : ''}</Button></> : <><Button variant="outline" size="sm" onClick={onEnterSelection}><GraduationCap size={15} />Assign tests</Button><Button size="sm" onClick={onCreate}><Plus size={15} />Create exam</Button></>)}
    </div>
  </div>;
}

function TestItemActions({ test, onEdit, onDelete }: { test: TestItem; onEdit: () => void; onDelete: () => void }) {
  return <DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8" aria-label={`Actions for ${test.title}`}><MoreHorizontal size={16} /></Button></DropdownMenuTrigger><DropdownMenuContent align="end" className="w-44"><DropdownMenuLabel>Test actions</DropdownMenuLabel><DropdownMenuSeparator /><DropdownMenuItem onSelect={onEdit}><Pencil />Edit exam</DropdownMenuItem><DropdownMenuSeparator /><DropdownMenuItem variant="destructive" onSelect={onDelete}><Trash2 />Delete exam</DropdownMenuItem></DropdownMenuContent></DropdownMenu>;
}

function TestStatus({ test }: { test: TestItem }) {
  if (test.attemptStatus === 'COMPLETED') return <Badge className="gap-1.5 px-1.5 text-muted-foreground"><CheckCircle2 size={13} className="fill-success text-white" />Completed</Badge>;
  if (test.attemptStatus === 'DOING' || test.isDoing) return <Badge className="gap-1.5 px-1.5 text-muted-foreground"><LoaderCircle size={13} />In progress</Badge>;
  return <Badge className="gap-1.5 px-1.5 text-muted-foreground"><Clock3 size={13} />Not started</Badge>;
}

function TestProgress({ test, compact = false }: { test: TestItem; compact?: boolean }) {
  const progress = clampProgress(test.progress);
  return <div className={compact ? 'min-w-44' : ''}><div className="mb-1.5 text-caption text-muted-foreground">{progress}% complete</div><div className="h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary transition-[width] duration-300" style={{ width: `${progress}%` }} /></div></div>;
}

function StartButton({ test, onStart, className }: { test: TestItem; onStart: () => void; className?: string }) {
  const inProgress = test.attemptStatus === 'DOING' || test.isDoing || (test.progress > 0 && test.progress < 100);
  const completed = test.attemptStatus === 'COMPLETED';
  return <Button size="sm" variant={inProgress ? 'primary' : 'outline'} className={className} onClick={onStart}><Play size={14} />{inProgress ? 'Continue' : completed ? 'Retake' : 'Start test'}</Button>;
}

interface TestCardProps { test: TestItem; canManage: boolean; selectionMode: boolean; selected: boolean; onToggle: () => void; onStart: () => void; onEdit: () => void; onDelete: () => void }

function TestCard({ test, canManage, selectionMode, selected, onToggle, onStart, onEdit, onDelete }: TestCardProps) {
  return <Card className={`flex min-h-64 flex-col overflow-hidden transition-colors hover:border-ui-border-strong ${selected ? 'border-primary ring-2 ring-primary/15' : ''}`}><div className="flex items-start justify-between gap-3 p-5 pb-4"><div className="flex min-w-0 flex-1 flex-col gap-3"><div className="flex flex-wrap items-center gap-1.5"><Badge tone={test.subject === 'MATH' ? 'gold' : 'green'}>{subjectLabel[test.subject]}</Badge><Badge>{modeLabel[test.mode]}</Badge></div><div className="min-w-0"><h2 className="line-clamp-2 text-title font-semibold leading-5 text-foreground">{test.title}</h2>{test.description && <p className="mt-1 line-clamp-2 text-caption leading-5 text-muted-foreground">{test.description}</p>}</div></div>{canManage && (selectionMode ? <Checkbox checked={selected} onCheckedChange={onToggle} aria-label={selected ? `Deselect ${test.title}` : `Select ${test.title}`} /> : <TestItemActions test={test} onEdit={onEdit} onDelete={onDelete} />)}</div><div className="px-5"><TestProgress test={test} /></div><dl className="mt-4 grid grid-cols-2 gap-px border-y border-ui-border bg-ui-border text-caption sm:grid-cols-4"><Metric label="Questions" value={String(test.questionCount)} /><Metric label="Duration" value={`${Math.floor(test.duration)} min`} /><Metric label="Last attempt" value={formatLastAttempt(test.lastAttempt)} /><Metric label="Score" value={test.lastScore == null ? '—' : `${test.lastScore}%`} /></dl><div className="mt-auto flex items-center justify-between gap-3 p-4 pl-5"><TestStatus test={test} />{!selectionMode && <StartButton test={test} onStart={onStart} />}</div></Card>;
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="min-w-0 bg-muted/30 px-3 py-2.5 first:pl-5"><dt className="text-muted-foreground">{label}</dt><dd className="mt-0.5 truncate font-medium text-foreground" title={value}>{value}</dd></div>;
}

interface TestListProps { tests: TestItem[]; canManage: boolean; selectionMode: boolean; selectedTestIds: number[]; onToggle: (testId: number) => void; onStart: (test: TestItem) => void; onEdit: (test: TestItem) => void; onDelete: (test: TestItem) => void }

function TestList({ tests, canManage, selectionMode, selectedTestIds, onToggle, onStart, onEdit, onDelete }: TestListProps) {
  return <TableShell><div className="overflow-x-auto"><Table className="min-w-276 table-fixed"><colgroup><col className="w-82" /><col className="w-40" /><col className="w-52" /><col className="w-24" /><col className="w-28" /><col className="w-32" /><col className="w-36" /></colgroup><TableHeader className="bg-muted/50"><TableRow><TableHead>Test</TableHead><TableHead>Type</TableHead><TableHead>Progress</TableHead><TableHead>Questions</TableHead><TableHead>Duration</TableHead><TableHead>Last attempt</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader><TableBody>{tests.map(test => { const selected = selectedTestIds.includes(test.id); return <TableRow key={test.id} className={selected ? 'bg-primary-soft/50' : undefined}><TableCell><div className="min-w-0"><p className="truncate font-medium text-foreground" title={test.title}>{test.title}</p><p className="mt-1 truncate text-caption text-muted-foreground">{test.description || 'No description'}</p></div></TableCell><TableCell><div className="flex flex-wrap gap-1"><Badge tone={test.subject === 'MATH' ? 'gold' : 'green'}>{test.subject === 'RW' ? 'R&W' : 'Math'}</Badge><Badge>{modeLabel[test.mode]}</Badge></div></TableCell><TableCell><div className="space-y-2"><div className="flex items-center justify-between gap-2"><TestStatus test={test} />{test.lastScore != null && <span className="text-caption font-medium text-foreground">{test.lastScore}%</span>}</div><TestProgress test={test} compact /></div></TableCell><TableCell className="text-muted-foreground"><span className="inline-flex items-center gap-1.5"><BookOpen size={14} />{test.questionCount}</span></TableCell><TableCell className="text-muted-foreground"><span className="inline-flex items-center gap-1.5"><Clock3 size={14} />{Math.floor(test.duration)} min</span></TableCell><TableCell className="text-muted-foreground">{formatLastAttempt(test.lastAttempt)}</TableCell><TableCell><div className="flex items-center justify-end gap-1">{selectionMode && canManage ? <Checkbox checked={selected} onCheckedChange={() => onToggle(test.id)} aria-label={selected ? `Deselect ${test.title}` : `Select ${test.title}`} /> : <><StartButton test={test} onStart={() => onStart(test)} />{canManage && <TestItemActions test={test} onEdit={() => onEdit(test)} onDelete={() => onDelete(test)} />}</>}</div></TableCell></TableRow>; })}</TableBody></Table></div></TableShell>;
}

function PracticeSkeleton({ viewMode }: { viewMode: ViewMode }) {
  if (viewMode === 'LIST') return <TableShell className="animate-pulse"><div className="h-12 border-b border-ui-border bg-muted" />{[1, 2, 3, 4, 5].map(item => <div key={item} className="flex h-20 items-center gap-6 border-b border-ui-border px-5 last:border-0"><span className="h-4 w-64 rounded-sm bg-muted" /><span className="h-6 w-24 rounded-full bg-muted" /><span className="h-2 flex-1 rounded-full bg-muted" /><span className="h-8 w-24 rounded-control bg-muted" /></div>)}</TableShell>;
  return <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">{[1, 2, 3, 4, 5, 6].map(item => <Card key={item} className="h-72 animate-pulse p-5"><div className="mb-6 flex gap-2"><span className="h-5 w-24 rounded-full bg-muted" /><span className="h-5 w-16 rounded-full bg-muted" /></div><div className="h-5 w-3/4 rounded-sm bg-muted" /><div className="mt-3 h-4 w-full rounded-sm bg-muted" /><div className="mt-8 h-2 w-full rounded-full bg-muted" /></Card>)}</div>;
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="space-y-1.5 text-xs font-medium text-subtle"><span className="block">{label}</span>{children}</label>;
}

export default PracticeTest;
