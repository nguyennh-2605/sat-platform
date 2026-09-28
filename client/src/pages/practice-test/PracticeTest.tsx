import { forwardRef, useCallback, useEffect, useMemo, useRef, useState, type ComponentProps } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { VirtuosoGrid, type GridStateSnapshot } from 'react-virtuoso';
import { ArrowUpDown, BookOpen, BookOpenCheck, CalendarDays, Check, CheckCircle2, ChevronRight, Clock3, Grid2X2, GraduationCap, List, LoaderCircle, Play, RefreshCw, SlidersHorizontal, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuSeparator, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { capitalizeFirstLetter } from '../../utils/text';
import { Badge, Button, Card, EmptyState, Modal, PageHeader } from '../../components/ui/AppUI';
import { DataSurface, DataToolbar, DataToolbarActions, DataToolbarSearch } from '@/components/ui/data-surface';
import { cachedGet } from '../../lib/queryCache';
import { SAT_TEST_MONTHS, satTestMonthLabel, type SatTestMonthFilter } from '@/lib/satTestMonths';
import { useDebounce } from '../../hooks/useDebounce';
import TeacherTestLibrary from './TeacherTestLibrary';
import AdminTestManagement from './AdminTestManagement';
import { practiceCenterCache } from './practiceCenterCache';

interface ClassInfo {
  id: string;
  name: string;
  _count?: { students: number };
}

interface DeliverySummary {
  id: string;
  title: string;
  classId: string;
  availableAt: string | null;
  dueAt: string | null;
  maxAttempts: number;
  scorePolicy: 'FIRST' | 'BEST' | 'LATEST';
  class: { name: string };
  attemptsUsed: number;
  canStart: boolean;
  latestSubmission: { id: number; status: 'DOING' | 'COMPLETED'; attemptNo: number } | null;
}

interface TestItem {
  id: number;
  title: string;
  description?: string;
  duration: number;
  subject: 'RW' | 'MATH';
  category: string;
  testDate?: string | null;
  mode: 'PRACTICE' | 'EXAM';
  isDoing?: boolean;
  questionCount: number;
  progress: number;
  attemptStatus: 'NOT_STARTED' | 'DOING' | 'COMPLETED';
  lastAttempt?: string | null;
  lastScore?: number | null;
  author?: { id: number; name?: string; role: 'ADMIN' | 'TEACHER' | 'STUDENT' } | null;
  classTests?: Array<{ classId: string; class?: { name: string } }>;
  deliveries?: DeliverySummary[];
}

type UserRole = 'ADMIN' | 'TEACHER' | 'STUDENT';
type SubjectFilter = 'ALL' | TestItem['subject'];
type ModeFilter = 'ALL' | TestItem['mode'];
type SortOrder = 'NEWEST' | 'OLDEST';
type ViewMode = 'GRID' | 'LIST';

interface TestPage { items: TestItem[]; total: number; nextCursor: string | null }

interface PracticeCacheEntry {
  items: TestItem[];
  total: number;
  nextCursor: string | null;
  snapshots: Partial<Record<ViewMode, GridStateSnapshot>>;
}

const usableGridSnapshot = (snapshot?: GridStateSnapshot) => Boolean(snapshot && snapshot.item.height > 0 && snapshot.item.width > 0 && snapshot.viewport.height > 0 && snapshot.viewport.width > 0);
const VirtualGridList = forwardRef<HTMLDivElement, ComponentProps<'div'>>(({ className, ...props }, ref) => <div ref={ref} {...props} className={`grid grid-cols-1 gap-4 pb-4 md:grid-cols-2 xl:grid-cols-3 ${className || ''}`} />);
const VirtualList = forwardRef<HTMLDivElement, ComponentProps<'div'>>(({ className, ...props }, ref) => <div ref={ref} {...props} className={`divide-y divide-ui-border/60 ${className || ''}`} />);
const VirtualGridItem = forwardRef<HTMLDivElement, ComponentProps<'div'>>((props, ref) => <div ref={ref} {...props} className="min-w-0" />);
const VirtualListItem = forwardRef<HTMLDivElement, ComponentProps<'div'>>((props, ref) => <div ref={ref} {...props} />);
const PracticeListHeader = () => <div className="grid min-w-[900px] grid-cols-[minmax(210px,1.45fr)_140px_minmax(190px,1fr)_90px_110px_120px_120px] gap-4 border-b border-ui-border bg-muted/30 px-4 py-2 text-xs font-medium text-muted-foreground"><span>Test</span><span>Type</span><span>Progress</span><span>Questions</span><span>Duration</span><span>Last attempt</span><span className="text-right">Actions</span></div>;

const subjectLabel: Record<TestItem['subject'], string> = { RW: 'Reading & Writing', MATH: 'Math' };
const modeLabel: Record<TestItem['mode'], string> = { PRACTICE: 'Practice', EXAM: 'Exam' };
const normalizeSubjectFilter = (value: string | null): SubjectFilter => value === 'RW' || value === 'MATH' ? value : 'ALL';
const normalizeModeFilter = (value: string | null): ModeFilter => value === 'PRACTICE' || value === 'EXAM' ? value : 'ALL';

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
const isDeliveryExhausted = (delivery: DeliverySummary | undefined) => Boolean(
  delivery && !delivery.canStart && delivery.latestSubmission?.status === 'COMPLETED'
);

const PracticeTest = () => {
  const role = (localStorage.getItem('userRole') || 'STUDENT') as UserRole;
  if (role === 'ADMIN') return <AdminTestManagement />;
  if (role === 'TEACHER') return <TeacherTestLibrary />;
  return <PracticeCenter />;
};

function PracticeCenter() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const subject = normalizeSubjectFilter(searchParams.get('subject'));
  const mode = normalizeModeFilter(searchParams.get('mode'));
  const month = (SAT_TEST_MONTHS.some(item => item.value === searchParams.get('month')) ? searchParams.get('month') : 'ALL') as SatTestMonthFilter;
  const classFilter = searchParams.get('classId') || 'ALL';
  const sortOrder: SortOrder = searchParams.get('sort') === 'OLDEST' ? 'OLDEST' : 'NEWEST';
  const [search, setSearch] = useState(searchParams.get('q') || '');
  const [classes, setClasses] = useState<ClassInfo[]>([]);
  const [tests, setTests] = useState<TestItem[]>([]);
  const [total, setTotal] = useState(0);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>(() => localStorage.getItem('practiceCenterView') === 'LIST' ? 'LIST' : 'GRID');
  const [startClassTest, setStartClassTest] = useState<TestItem | null>(null);
  const [scrollParent, setScrollParent] = useState<HTMLDivElement | null>(null);
  const debouncedSearch = useDebounce(search, 250);
  const requestId = useRef(0);

  const activeFilterCount = Number(subject !== 'ALL') + Number(mode !== 'ALL') + Number(month !== 'ALL') + Number(classFilter !== 'ALL');
  const queryKey = useMemo(() => JSON.stringify({ q: debouncedSearch.trim(), subject, mode, month, classFilter, sortOrder }), [classFilter, debouncedSearch, mode, month, sortOrder, subject]);
  const restoreSnapshot = useMemo(() => {
    const snapshot = practiceCenterCache.get<PracticeCacheEntry>(queryKey)?.snapshots[viewMode];
    return usableGridSnapshot(snapshot) ? snapshot : undefined;
  }, [queryKey, viewMode]);

  const buildParams = useCallback((cursor?: string | null) => {
    const params = new URLSearchParams({ limit: '30', sort: sortOrder });
    if (debouncedSearch.trim()) params.set('search', debouncedSearch.trim());
    if (subject !== 'ALL') params.set('subject', subject);
    if (mode !== 'ALL') params.set('mode', mode);
    if (month !== 'ALL') params.set('month', month);
    if (classFilter !== 'ALL') params.set('classId', classFilter);
    if (cursor) params.set('cursor', cursor);
    return params;
  }, [classFilter, debouncedSearch, mode, month, sortOrder, subject]);

  const loadFirstPage = useCallback(async (force = false) => {
    const currentRequest = ++requestId.current;
    setLoading(true);
    setLoadError(null);
    try {
      const data = await cachedGet<TestPage>(`/api/tests?${buildParams()}`, { ttlMs: 30_000, force });
      if (currentRequest !== requestId.current) return;
      const items = data.items.map(test => ({ ...test, title: capitalizeFirstLetter(test.title) }));
      setTests(items);
      setTotal(data.total);
      setNextCursor(data.nextCursor);
      practiceCenterCache.set<PracticeCacheEntry>(queryKey, { items, total: data.total, nextCursor: data.nextCursor, snapshots: practiceCenterCache.get<PracticeCacheEntry>(queryKey)?.snapshots || {} });
    } catch (error) {
      if (currentRequest !== requestId.current) return;
      console.error(error);
      setLoadError('Practice Center could not be loaded. Check your connection and try again.');
      toast.error('Unable to load Practice Center');
    } finally {
      if (currentRequest === requestId.current) setLoading(false);
    }
  }, [buildParams, queryKey]);

  const loadMore = useCallback(async () => {
    if (!nextCursor || loading || loadingMore) return;
    setLoadingMore(true);
    try {
      const data = await cachedGet<TestPage>(`/api/tests?${buildParams(nextCursor)}`, { ttlMs: 30_000 });
      const newItems = data.items.map(test => ({ ...test, title: capitalizeFirstLetter(test.title) }));
      setTests(current => {
        const known = new Set(current.map(test => test.id));
        const combined = [...current, ...newItems.filter(test => !known.has(test.id))];
        practiceCenterCache.set<PracticeCacheEntry>(queryKey, { items: combined, total, nextCursor: data.nextCursor, snapshots: practiceCenterCache.get<PracticeCacheEntry>(queryKey)?.snapshots || {} });
        return combined;
      });
      setNextCursor(data.nextCursor);
    } catch (error) {
      console.error(error);
      toast.error('Unable to load more tests');
    } finally {
      setLoadingMore(false);
    }
  }, [buildParams, loading, loadingMore, nextCursor, queryKey, total]);

  useEffect(() => {
    const cached = practiceCenterCache.get<PracticeCacheEntry>(queryKey);
    if (cached) {
      setTests(cached.items);
      setTotal(cached.total);
      setNextCursor(cached.nextCursor);
      setLoadError(null);
      setLoading(false);
      return;
    }
    setTests([]);
    setTotal(0);
    setNextCursor(null);
    void loadFirstPage();
  }, [loadFirstPage, queryKey]);

  useEffect(() => {
    void cachedGet<ClassInfo[]>('/api/tests/classes', { ttlMs: 5 * 60_000 }).then(data => setClasses(data.map(classroom => ({ ...classroom, name: capitalizeFirstLetter(classroom.name) }))));
  }, []);

  useEffect(() => {
    const urlSearch = searchParams.get('q') || '';
    if (urlSearch !== search && urlSearch !== debouncedSearch) setSearch(urlSearch);
  }, [debouncedSearch, search, searchParams]);

  useEffect(() => {
    const next = new URLSearchParams(searchParams);
    if (debouncedSearch.trim()) next.set('q', debouncedSearch.trim()); else next.delete('q');
    if (next.toString() !== searchParams.toString()) setSearchParams(next, { replace: true });
  }, [debouncedSearch, searchParams, setSearchParams]);

  const updateUrlFilter = (key: string, value: string) => {
    const next = new URLSearchParams(searchParams);
    if (value === 'ALL' || (key === 'sort' && value === 'NEWEST')) next.delete(key);
    else next.set(key, value);
    setSearchParams(next, { replace: true });
  };

  const openTest = useCallback((test: TestItem, context?: { classId?: string; deliveryId?: string }) => {
    localStorage.setItem('current_exam_info', JSON.stringify({ id: test.id, title: test.title, description: test.description, duration: test.duration }));
    const params = new URLSearchParams();
    if (context?.deliveryId) params.set('deliveryId', context.deliveryId);
    else if (context?.classId) params.set('classId', context.classId);
    navigate(`/test/${test.id}${params.toString() ? `?${params}` : ''}`);
  }, [navigate]);

  const openDelivery = useCallback((test: TestItem, delivery: DeliverySummary) => {
    if (isDeliveryExhausted(delivery) && delivery.latestSubmission) {
      navigate(`/dashboard/score-report/${delivery.latestSubmission.id}`);
      return;
    }
    openTest(test, { deliveryId: delivery.id });
  }, [navigate, openTest]);

  const handleStart = useCallback((test: TestItem) => {
    const deliveries = test.deliveries || [];
    if (deliveries.length > 1) {
      setStartClassTest(test);
      return;
    }
    if (deliveries.length === 1) {
      openDelivery(test, deliveries[0]);
      return;
    }
    const assignedClassIds = [...new Set((test.classTests || []).map(item => item.classId))];
    if (assignedClassIds.length > 1) {
      setStartClassTest(test);
      return;
    }
    openTest(test, assignedClassIds[0] ? { classId: assignedClassIds[0] } : undefined);
  }, [openDelivery, openTest]);

  const resetFilters = () => {
    const next = new URLSearchParams(searchParams);
    next.delete('subject');
    next.delete('mode');
    next.delete('month');
    next.delete('classId');
    setSearchParams(next, { replace: true });
  };

  const changeViewMode = (nextView: ViewMode) => {
    setViewMode(nextView);
    localStorage.setItem('practiceCenterView', nextView);
  };

  const saveSnapshot = useCallback((snapshot: GridStateSnapshot) => {
    if (!usableGridSnapshot(snapshot)) return;
    const cached = practiceCenterCache.get<PracticeCacheEntry>(queryKey) || { items: tests, total, nextCursor, snapshots: {} };
    cached.snapshots[viewMode] = snapshot;
    practiceCenterCache.set<PracticeCacheEntry>(queryKey, cached);
  }, [nextCursor, queryKey, tests, total, viewMode]);

  return (
    <div ref={setScrollParent} className="h-full overflow-y-auto bg-background">
      <main className="mx-auto flex w-full max-w-screen-2xl flex-col gap-4 p-4 md:p-6">
        <section className="flex flex-col gap-4">
          <PageHeader title={<span className="font-medium">Practice Center</span>} description="Find assigned and public SAT tests, then continue where you left off." />
          {(!loading || total > 0 || classes.length > 0) && <div className="flex flex-wrap items-center gap-2"><Badge className="gap-1.5 rounded-sm px-2 py-1"><BookOpenCheck size={13} aria-hidden="true" />{total} tests</Badge></div>}
        </section>

        <DataSurface aria-label="Practice Center controls">
        <PracticeToolbar search={search} onSearchChange={setSearch} subject={subject} onSubjectChange={value => updateUrlFilter('subject', value)} mode={mode} onModeChange={value => updateUrlFilter('mode', value)} month={month} onMonthChange={value => updateUrlFilter('month', value)} classFilter={classFilter} onClassChange={value => updateUrlFilter('classId', value)} classes={classes} sortOrder={sortOrder} onSortChange={value => updateUrlFilter('sort', value)} activeFilterCount={activeFilterCount} onResetFilters={resetFilters} viewMode={viewMode} onViewModeChange={changeViewMode} loading={loading || loadingMore} onRefresh={() => void loadFirstPage(true)} />
        </DataSurface>

        {loadError && tests.length === 0 && !loading ? (
          <EmptyState icon={<RefreshCw size={20} />} title="Unable to load tests" description={loadError} action={<Button variant="outline" onClick={() => void loadFirstPage(true)}><RefreshCw size={15} />Try again</Button>} className="min-h-80" />
        ) : loading ? (
          <PracticeSkeleton viewMode={viewMode} />
        ) : tests.length === 0 ? (
          <EmptyState icon={<BookOpenCheck size={22} />} title="No matching tests" description="Your teacher has not assigned a test to your class yet. Public admin tests appear here automatically." action={activeFilterCount > 0 || search ? <Button variant="outline" onClick={() => { setSearch(''); resetFilters(); }}><X size={15} />Clear filters</Button> : undefined} className="min-h-80" />
        ) : <VirtuosoGrid
          key={`${queryKey}:${viewMode}`}
          data={tests}
          customScrollParent={scrollParent || undefined}
          computeItemKey={(_, test) => test.id}
          components={{
            List: viewMode === 'GRID' ? VirtualGridList : VirtualList,
            Item: viewMode === 'GRID' ? VirtualGridItem : VirtualListItem,
            Header: viewMode === 'LIST' ? PracticeListHeader : undefined,
            Footer: () => loadingMore ? <div className="flex items-center justify-center gap-2 p-4 text-sm text-muted-foreground"><LoaderCircle className="size-4 animate-spin" />Loading next results…</div> : !nextCursor ? <p className="p-4 text-center text-xs text-muted-foreground">All {total} tests loaded</p> : null,
          }}
          itemContent={(_, test) => viewMode === 'GRID' ? <TestCard test={test} onStart={() => handleStart(test)} /> : <TestListRow test={test} onStart={() => handleStart(test)} />}
          endReached={() => void loadMore()}
          increaseViewportBy={900}
          overscan={400}
          restoreStateFrom={restoreSnapshot}
          stateChanged={saveSnapshot}
        />}
      </main>

      <Modal open={Boolean(startClassTest)} onClose={() => setStartClassTest(null)} closeOnBackdrop presentation="content-dialog" title="Choose a class" subtitle={startClassTest?.title} className="max-w-md!">{startClassTest && <div className="space-y-2">{(startClassTest.deliveries || []).length > 0 ? startClassTest.deliveries?.map(delivery => <Button key={delivery.id} variant="outline" onClick={() => openDelivery(startClassTest, delivery)} className="h-auto w-full justify-between p-4 text-left"><span><span className="block">{capitalizeFirstLetter(delivery.class.name)}</span><span className="mt-1 block text-xs font-normal text-muted-foreground">{isDeliveryExhausted(delivery) ? 'Attempt limit reached · View score' : delivery.dueAt ? `Due ${new Date(delivery.dueAt).toLocaleString()}` : 'No deadline'}</span></span><ChevronRight size={17} /></Button>) : [...new Set((startClassTest.classTests || []).map(item => item.classId))].map(classId => <Button key={classId} variant="outline" onClick={() => openTest(startClassTest, { classId })} className="h-auto w-full justify-between p-4 text-left">{classes.find(item => item.id === classId)?.name || 'Class'}<ChevronRight size={17} /></Button>)}</div>}</Modal>
    </div>
  );
}

interface PracticeToolbarProps {
  search: string; onSearchChange: (value: string) => void;
  subject: SubjectFilter; onSubjectChange: (value: SubjectFilter) => void;
  mode: ModeFilter; onModeChange: (value: ModeFilter) => void;
  month: SatTestMonthFilter; onMonthChange: (value: SatTestMonthFilter) => void;
  classFilter: string; onClassChange: (value: string) => void; classes: ClassInfo[];
  sortOrder: SortOrder; onSortChange: (value: SortOrder) => void;
  activeFilterCount: number; onResetFilters: () => void;
  viewMode: ViewMode; onViewModeChange: (value: ViewMode) => void;
  loading: boolean; onRefresh: () => void;
}

function PracticeToolbar({ search, onSearchChange, subject, onSubjectChange, mode, onModeChange, month, onMonthChange, classFilter, onClassChange, classes, sortOrder, onSortChange, activeFilterCount, onResetFilters, viewMode, onViewModeChange, loading, onRefresh }: PracticeToolbarProps) {
  return <DataToolbar className="border-b-0">
    <DataToolbarSearch value={search} onChange={event => onSearchChange(event.target.value)} placeholder="Search tests…" label="Search tests" />
    <DataToolbarActions>
      <DropdownMenu><DropdownMenuTrigger asChild><Button variant="outline" size="sm" className={activeFilterCount > 0 ? 'bg-muted text-foreground' : undefined}><SlidersHorizontal size={15} />Filter{activeFilterCount > 0 && <Badge className="ml-1 min-w-5 justify-center px-1.5">{activeFilterCount}</Badge>}</Button></DropdownMenuTrigger><DropdownMenuContent align="end" className="w-52"><DropdownMenuLabel>Filter tests</DropdownMenuLabel><DropdownMenuSeparator /><DropdownMenuGroup><DropdownMenuSub><DropdownMenuSubTrigger><BookOpen />Subject</DropdownMenuSubTrigger><DropdownMenuSubContent sideOffset={8} className="w-48"><DropdownMenuLabel>Subject</DropdownMenuLabel><DropdownMenuSeparator /><DropdownMenuRadioGroup value={subject} onValueChange={value => onSubjectChange(value as SubjectFilter)}><DropdownMenuRadioItem value="ALL">All subjects</DropdownMenuRadioItem><DropdownMenuRadioItem value="RW">Reading & Writing</DropdownMenuRadioItem><DropdownMenuRadioItem value="MATH">Math</DropdownMenuRadioItem></DropdownMenuRadioGroup></DropdownMenuSubContent></DropdownMenuSub><DropdownMenuSub><DropdownMenuSubTrigger><BookOpenCheck />Test type</DropdownMenuSubTrigger><DropdownMenuSubContent sideOffset={8} className="w-44"><DropdownMenuLabel>Test type</DropdownMenuLabel><DropdownMenuSeparator /><DropdownMenuRadioGroup value={mode} onValueChange={value => onModeChange(value as ModeFilter)}><DropdownMenuRadioItem value="ALL">All types</DropdownMenuRadioItem><DropdownMenuRadioItem value="EXAM">Exam</DropdownMenuRadioItem><DropdownMenuRadioItem value="PRACTICE">Practice</DropdownMenuRadioItem></DropdownMenuRadioGroup></DropdownMenuSubContent></DropdownMenuSub><DropdownMenuSub><DropdownMenuSubTrigger><CalendarDays />Official month</DropdownMenuSubTrigger><DropdownMenuSubContent sideOffset={8} className="w-44"><DropdownMenuLabel>SAT test month</DropdownMenuLabel><DropdownMenuSeparator /><DropdownMenuRadioGroup value={month} onValueChange={value => onMonthChange(value as SatTestMonthFilter)}><DropdownMenuRadioItem value="ALL">All months</DropdownMenuRadioItem>{SAT_TEST_MONTHS.map(item => <DropdownMenuRadioItem key={item.value} value={item.value}>{item.label}</DropdownMenuRadioItem>)}</DropdownMenuRadioGroup></DropdownMenuSubContent></DropdownMenuSub>{classes.length > 0 && <DropdownMenuSub><DropdownMenuSubTrigger><GraduationCap />Class</DropdownMenuSubTrigger><DropdownMenuSubContent sideOffset={8} className="w-56"><DropdownMenuLabel>Class</DropdownMenuLabel><DropdownMenuSeparator /><DropdownMenuRadioGroup value={classFilter} onValueChange={onClassChange}><DropdownMenuRadioItem value="ALL">All classes</DropdownMenuRadioItem>{classes.map(item => <DropdownMenuRadioItem key={item.id} value={item.id}>{item.name}</DropdownMenuRadioItem>)}</DropdownMenuRadioGroup></DropdownMenuSubContent></DropdownMenuSub>}</DropdownMenuGroup><DropdownMenuSeparator /><DropdownMenuItem disabled={activeFilterCount === 0} onSelect={onResetFilters}><X />Reset filters</DropdownMenuItem></DropdownMenuContent></DropdownMenu>
      <DropdownMenu><DropdownMenuTrigger asChild><Button variant="outline" size="sm"><ArrowUpDown size={15} />{sortOrder === 'NEWEST' ? 'Newest' : 'Oldest'}</Button></DropdownMenuTrigger><DropdownMenuContent align="end" className="w-44"><DropdownMenuLabel>Sort by</DropdownMenuLabel><DropdownMenuSeparator /><DropdownMenuRadioGroup value={sortOrder} onValueChange={value => onSortChange(value as SortOrder)}><DropdownMenuRadioItem value="NEWEST">Newest first</DropdownMenuRadioItem><DropdownMenuRadioItem value="OLDEST">Oldest first</DropdownMenuRadioItem></DropdownMenuRadioGroup></DropdownMenuContent></DropdownMenu>
      <div className="flex h-8 items-center rounded-control border border-ui-border bg-surface p-0.5" role="group" aria-label="Display mode"><Button variant="ghost" size="sm" className={`h-7 px-2 shadow-none ${viewMode === 'GRID' ? 'bg-accent text-foreground' : ''}`} onClick={() => onViewModeChange('GRID')} aria-label="Card view" aria-pressed={viewMode === 'GRID'}>{viewMode === 'GRID' && <Check size={14} strokeWidth={2.5} aria-hidden="true" />}<Grid2X2 size={17} aria-hidden="true" /></Button><Button variant="ghost" size="sm" className={`h-7 px-2 shadow-none ${viewMode === 'LIST' ? 'bg-accent text-foreground' : ''}`} onClick={() => onViewModeChange('LIST')} aria-label="List view" aria-pressed={viewMode === 'LIST'}>{viewMode === 'LIST' && <Check size={14} strokeWidth={2.5} aria-hidden="true" />}<List size={18} aria-hidden="true" /></Button></div>
      <Button variant="outline" size="sm" className="w-9 px-0" onClick={onRefresh} disabled={loading} aria-label="Refresh tests"><RefreshCw size={20} strokeWidth={2.25} className={loading ? 'animate-spin' : ''} aria-hidden="true" /></Button>
    </DataToolbarActions>
  </DataToolbar>;
}

function TestStatus({ test }: { test: TestItem }) {
  if (test.attemptStatus === 'COMPLETED') return <Badge className="gap-1.5 px-1.5 text-muted-foreground"><CheckCircle2 size={13} className="fill-success text-white" />Completed</Badge>;
  if (test.attemptStatus === 'DOING' || test.isDoing) return <Badge className="gap-1.5 px-1.5 text-muted-foreground"><LoaderCircle size={13} />In progress</Badge>;
  return <Badge className="gap-1.5 px-1.5 text-muted-foreground"><Clock3 size={13} />Not started</Badge>;
}

function TestProgress({ test, compact = false }: { test: TestItem; compact?: boolean }) {
  const progress = clampProgress(test.progress);
  return <div className={compact ? 'min-w-44' : ''}><div className="h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary transition-[width] duration-300" style={{ width: `${progress}%` }} /></div></div>;
}

function StartButton({ test, onStart, className }: { test: TestItem; onStart: () => void; className?: string }) {
  const inProgress = test.attemptStatus === 'DOING' || test.isDoing || (test.progress > 0 && test.progress < 100);
  const completed = test.attemptStatus === 'COMPLETED';
  const exhausted = test.deliveries?.length === 1 && isDeliveryExhausted(test.deliveries[0]);
  return <Button size="sm" variant={inProgress ? 'primary' : 'outline'} className={className} onClick={onStart}>{exhausted ? <CheckCircle2 size={14} /> : <Play size={14} />}{exhausted ? 'View score' : inProgress ? 'Continue' : completed ? 'Retake' : 'Start test'}</Button>;
}

interface TestCardProps { test: TestItem; onStart: () => void }

function TestCard({ test, onStart }: TestCardProps) {
  return <Card className="relative flex min-h-64 flex-col overflow-hidden transition-shadow duration-200 hover:shadow-raised">{test.category === 'REAL' && <Badge className="absolute right-3 top-3 z-10 border-primary/30 bg-primary text-primary-foreground shadow-sm">Official{satTestMonthLabel(test.testDate) ? ` · ${satTestMonthLabel(test.testDate)}` : ''}</Badge>}<div className="flex items-start justify-between gap-3 p-5 pb-4"><div className="flex min-w-0 flex-1 flex-col gap-3"><div className={`flex flex-wrap items-center gap-1.5 ${test.category === 'REAL' ? 'pr-28' : ''}`}><Badge tone={test.subject === 'MATH' ? 'gold' : 'green'}>{subjectLabel[test.subject]}</Badge><Badge>{modeLabel[test.mode]}</Badge></div><div className="min-w-0"><h2 className="line-clamp-2 text-title font-semibold leading-5 text-foreground">{test.title}</h2></div></div></div><div className="px-5"><TestProgress test={test} /></div><dl className="mt-4 grid grid-cols-2 gap-px border-y border-ui-border bg-ui-border text-caption sm:grid-cols-4"><Metric label="Questions" value={String(test.questionCount)} /><Metric label="Duration" value={`${Math.floor(test.duration)} min`} /><Metric label="Last attempt" value={formatLastAttempt(test.lastAttempt)} /><Metric label="Score" value={test.lastScore == null ? '—' : `${test.lastScore}%`} /></dl><div className="mt-auto flex items-center justify-between gap-3 p-4 pl-5"><TestStatus test={test} /><StartButton test={test} onStart={onStart} /></div></Card>;
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="min-w-0 bg-muted/30 px-3 py-2.5 first:pl-5"><dt className="text-muted-foreground">{label}</dt><dd className="mt-0.5 truncate font-medium text-foreground" title={value}>{value}</dd></div>;
}

function TestListRow({ test, onStart }: { test: TestItem; onStart: () => void }) {
  return <div className="grid min-w-[900px] grid-cols-[minmax(210px,1.45fr)_140px_minmax(190px,1fr)_90px_110px_120px_120px] items-center gap-4 px-4 py-3 hover:bg-muted/20"><div className="min-w-0"><div className="flex items-center gap-2"><p className="truncate font-medium text-foreground" title={test.title}>{test.title}</p>{test.category === 'REAL' && <Badge className="shrink-0 bg-primary text-primary-foreground">Official{satTestMonthLabel(test.testDate) ? ` · ${satTestMonthLabel(test.testDate)}` : ''}</Badge>}</div></div><div className="flex flex-wrap gap-1"><Badge tone={test.subject === 'MATH' ? 'gold' : 'green'}>{test.subject === 'RW' ? 'R&W' : 'Math'}</Badge><Badge>{modeLabel[test.mode]}</Badge></div><div className="space-y-2 pr-6"><div className="flex items-center justify-between gap-2"><TestStatus test={test} /><span className="text-caption font-medium tabular-nums text-foreground">{clampProgress(test.progress)}%</span></div><TestProgress test={test} compact /></div><span className="text-caption text-muted-foreground">{test.questionCount}</span><span className="text-caption text-muted-foreground">{Math.floor(test.duration)} min</span><span className="text-caption text-muted-foreground">{formatLastAttempt(test.lastAttempt)}</span><div className="flex justify-end"><StartButton test={test} onStart={onStart} /></div></div>;
}

function PracticeSkeleton({ viewMode }: { viewMode: ViewMode }) {
  if (viewMode === 'LIST') return <div className="animate-pulse"><div className="h-11 border-b border-ui-border bg-muted/20" />{[1, 2, 3, 4, 5].map(item => <div key={item} className="flex h-16 items-center gap-6 border-b border-ui-border/60 px-4 last:border-0"><span className="h-4 w-64 rounded-sm bg-muted" /><span className="h-6 w-24 rounded-full bg-muted" /><span className="h-2 flex-1 rounded-full bg-muted" /><span className="h-8 w-24 rounded-control bg-muted" /></div>)}</div>;
  return <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">{[1, 2, 3, 4, 5, 6].map(item => <Card key={item} className="h-72 animate-pulse p-5"><div className="mb-6 flex gap-2"><span className="h-5 w-24 rounded-full bg-muted" /><span className="h-5 w-16 rounded-full bg-muted" /></div><div className="h-5 w-3/4 rounded-sm bg-muted" /><div className="mt-3 h-4 w-full rounded-sm bg-muted" /><div className="mt-8 h-2 w-full rounded-full bg-muted" /></Card>)}</div>;
}

export default PracticeTest;
