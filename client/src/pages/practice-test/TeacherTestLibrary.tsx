import { forwardRef, useCallback, useEffect, useMemo, useRef, useState, type ComponentProps, type ReactNode } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { VirtuosoGrid, type GridStateSnapshot } from 'react-virtuoso';
import { Archive, ArrowUpDown, BookOpen, CalendarDays, Check, Copy, FilePenLine, Grid2X2, List, MoreHorizontal, Pencil, Play, Plus, RefreshCw, RotateCcw, SlidersHorizontal, Trash2, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Badge, Button, Card, EmptyState, Modal, PageHeader, Tabs } from '@/components/ui/AppUI';
import { DataSurface, DataToolbar, DataToolbarActions, DataToolbarGroup, DataToolbarSearch } from '@/components/ui/data-surface';
import axiosClient from '@/lib/axios';
import { cachedGet, invalidateQueryCache } from '@/lib/queryCache';
import { useDebounce } from '@/hooks/useDebounce';
import { capitalizeFirstLetter } from '@/utils/text';
import { SAT_TEST_MONTHS, satTestMonthLabel, type SatTestMonthFilter } from '@/lib/satTestMonths';
import { LoadingSpinner } from '@/components/ui/loading';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

type LibrarySource = 'MY' | 'SYSTEM';
type TestStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
type SubjectFilter = 'ALL' | 'RW' | 'MATH';
type ModeFilter = 'ALL' | 'PRACTICE' | 'EXAM';
type StatusFilter = 'ALL' | TestStatus;
type SortOrder = 'NEWEST' | 'OLDEST';
type ViewMode = 'GRID' | 'LIST';

interface LibraryTest {
  id: number;
  title: string;
  description?: string | null;
  duration: number;
  subject: 'RW' | 'MATH';
  mode: 'PRACTICE' | 'EXAM';
  status: TestStatus;
  category: string;
  testDate?: string | null;
  questionCount: number;
  updatedAt: string;
  author?: { id: number; name?: string | null; role: string } | null;
}

interface LibraryPage { items: LibraryTest[]; total: number; nextCursor: string | null; sourceCounts?: { my: number; system: number } }

interface LibraryCacheEntry { items: LibraryTest[]; total: number; nextCursor: string | null; sourceCounts: { my: number; system: number }; snapshots: Partial<Record<ViewMode, GridStateSnapshot>> }
const libraryCache = new Map<string, LibraryCacheEntry>();
const usableGridSnapshot = (snapshot?: GridStateSnapshot) => Boolean(snapshot && snapshot.item.height > 0 && snapshot.item.width > 0 && snapshot.viewport.height > 0 && snapshot.viewport.width > 0);
const LibraryGridList = forwardRef<HTMLDivElement, ComponentProps<'div'>>(({ className, ...props }, ref) => <div ref={ref} {...props} className={`grid grid-cols-1 gap-4 pb-4 md:grid-cols-2 xl:grid-cols-3 ${className || ''}`} />);
const LibraryList = forwardRef<HTMLDivElement, ComponentProps<'div'>>(({ className, ...props }, ref) => <div ref={ref} {...props} className={`divide-y divide-ui-border/60 ${className || ''}`} />);
const LibraryGridItem = forwardRef<HTMLDivElement, ComponentProps<'div'>>((props, ref) => <div ref={ref} {...props} className="min-w-0" />);
const LibraryListItem = forwardRef<HTMLDivElement, ComponentProps<'div'>>((props, ref) => <div ref={ref} {...props} />);
const LibraryListHeader = ({ source }: { source: LibrarySource }) => <div className="grid min-w-[900px] grid-cols-[minmax(210px,1.45fr)_140px_140px_90px_110px_120px_152px] gap-4 border-b border-ui-border bg-muted/30 px-4 py-2 text-xs font-medium text-muted-foreground"><span>Test</span><span>Type</span><span>{source === 'MY' ? 'Status' : 'Source'}</span><span>Questions</span><span>Duration</span><span>Updated</span><span className="text-right">Actions</span></div>;
const MyTestsListHeader = () => <LibraryListHeader source="MY" />;
const SystemTestsListHeader = () => <LibraryListHeader source="SYSTEM" />;

const subjectLabel = { RW: 'Reading & Writing', MATH: 'Math' } as const;
const modeLabel = { PRACTICE: 'Practice', EXAM: 'Exam' } as const;
const statusLabel = { ALL: 'All statuses', DRAFT: 'Draft', PUBLISHED: 'Published', ARCHIVED: 'Archived' } as const;

export default function TeacherTestLibrary() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const source: LibrarySource = searchParams.get('source') === 'SYSTEM' ? 'SYSTEM' : 'MY';
  const subject = (['RW', 'MATH'].includes(searchParams.get('subject') || '') ? searchParams.get('subject') : 'ALL') as SubjectFilter;
  const mode = (['PRACTICE', 'EXAM'].includes(searchParams.get('mode') || '') ? searchParams.get('mode') : 'ALL') as ModeFilter;
  const status = (['DRAFT', 'PUBLISHED', 'ARCHIVED'].includes(searchParams.get('status') || '') ? searchParams.get('status') : 'ALL') as StatusFilter;
  const month = (SAT_TEST_MONTHS.some(item => item.value === searchParams.get('month')) ? searchParams.get('month') : 'ALL') as SatTestMonthFilter;
  const sort: SortOrder = searchParams.get('sort') === 'OLDEST' ? 'OLDEST' : 'NEWEST';
  const [tests, setTests] = useState<LibraryTest[]>([]);
  const [total, setTotal] = useState(0);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [sourceCounts, setSourceCounts] = useState({ my: 0, system: 0 });
  const [search, setSearch] = useState(searchParams.get('q') || '');
  const [view, setView] = useState<ViewMode>(() => localStorage.getItem('teacherTestLibraryView') === 'LIST' ? 'LIST' : 'GRID');
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [workingId, setWorkingId] = useState<number | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<LibraryTest | null>(null);
  const [scrollParent, setScrollParent] = useState<HTMLDivElement | null>(null);
  const debouncedSearch = useDebounce(search, 250);
  const requestId = useRef(0);
  const queryKey = useMemo(() => JSON.stringify({ source, q: debouncedSearch.trim(), subject, mode, status: source === 'MY' ? status : 'ALL', month: source === 'SYSTEM' ? month : 'ALL', sort }), [debouncedSearch, mode, month, sort, source, status, subject]);
  const restoreSnapshot = useMemo(() => {
    const snapshot = libraryCache.get(queryKey)?.snapshots[view];
    return usableGridSnapshot(snapshot) ? snapshot : undefined;
  }, [queryKey, view]);

  const updateQuery = useCallback((key: string, value: string) => {
    const next = new URLSearchParams(searchParams);
    if (value === 'ALL' || (key === 'source' && value === 'MY') || (key === 'sort' && value === 'NEWEST')) next.delete(key); else next.set(key, value);
    if (key === 'source') { next.delete('status'); next.delete('month'); }
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  const buildParams = useCallback((cursor?: string | null) => {
    const params = new URLSearchParams({ source, limit: '30', sort });
    if (debouncedSearch.trim()) params.set('search', debouncedSearch.trim());
    if (subject !== 'ALL') params.set('subject', subject);
    if (mode !== 'ALL') params.set('mode', mode);
    if (source === 'MY' && status !== 'ALL') params.set('status', status);
    if (source === 'SYSTEM' && month !== 'ALL') params.set('month', month);
    if (cursor) params.set('cursor', cursor);
    return params;
  }, [debouncedSearch, mode, month, sort, source, status, subject]);

  const loadTests = useCallback(async (force = false) => {
    const currentRequest = ++requestId.current;
    setLoading(true);
    setError('');
    try {
      const data = await cachedGet<LibraryPage>(`/api/tests?${buildParams()}`, { ttlMs: 20_000, force });
      if (currentRequest !== requestId.current) return;
      const items = data.items.map(item => ({ ...item, title: capitalizeFirstLetter(item.title) }));
      const counts = data.sourceCounts || sourceCounts;
      setTests(items);
      setTotal(data.total);
      setNextCursor(data.nextCursor);
      setSourceCounts(counts);
      libraryCache.set(queryKey, { items, total: data.total, nextCursor: data.nextCursor, sourceCounts: counts, snapshots: libraryCache.get(queryKey)?.snapshots || {} });
    } catch (loadError) {
      if (currentRequest !== requestId.current) return;
      console.error(loadError);
      setError('Your test library could not be loaded. Check your connection and try again.');
    } finally {
      if (currentRequest === requestId.current) setLoading(false);
    }
  }, [buildParams, queryKey, sourceCounts]);

  const loadMore = useCallback(async () => {
    if (!nextCursor || loading || loadingMore) return;
    setLoadingMore(true);
    try {
      const data = await cachedGet<LibraryPage>(`/api/tests?${buildParams(nextCursor)}`, { ttlMs: 20_000 });
      const incoming = data.items.map(item => ({ ...item, title: capitalizeFirstLetter(item.title) }));
      setTests(current => {
        const known = new Set(current.map(test => test.id));
        const combined = [...current, ...incoming.filter(test => !known.has(test.id))];
        libraryCache.set(queryKey, { items: combined, total, nextCursor: data.nextCursor, sourceCounts, snapshots: libraryCache.get(queryKey)?.snapshots || {} });
        return combined;
      });
      setNextCursor(data.nextCursor);
    } catch (loadError) {
      console.error(loadError);
      toast.error('Unable to load more tests');
    } finally {
      setLoadingMore(false);
    }
  }, [buildParams, loading, loadingMore, nextCursor, queryKey, sourceCounts, total]);

  useEffect(() => {
    const cached = libraryCache.get(queryKey);
    if (cached) {
      setTests(cached.items); setTotal(cached.total); setNextCursor(cached.nextCursor); setSourceCounts(cached.sourceCounts); setError(''); setLoading(false);
    } else {
      setTests([]); setTotal(0); setNextCursor(null); void loadTests();
    }
  }, [loadTests, queryKey]);

  useEffect(() => {
    const urlSearch = searchParams.get('q') || '';
    if (urlSearch !== search && urlSearch !== debouncedSearch) setSearch(urlSearch);
  }, [debouncedSearch, search, searchParams]);

  useEffect(() => {
    const next = new URLSearchParams(searchParams);
    if (debouncedSearch.trim()) next.set('q', debouncedSearch.trim()); else next.delete('q');
    if (next.toString() !== searchParams.toString()) setSearchParams(next, { replace: true });
  }, [debouncedSearch, searchParams, setSearchParams]);

  const changeSource = (next: LibrarySource) => {
    updateQuery('source', next);
  };

  const changeView = (next: ViewMode) => {
    setView(next);
    localStorage.setItem('teacherTestLibraryView', next);
  };

  const refresh = async () => {
    invalidateQueryCache('/api/tests');
    await loadTests(true);
  };

  const updateStatus = async (test: LibraryTest, nextStatus: TestStatus) => {
    setWorkingId(test.id);
    try {
      await axiosClient.patch(`/api/tests/${test.id}/status`, { status: nextStatus });
      toast.success(nextStatus === 'ARCHIVED' ? 'Test archived' : nextStatus === 'PUBLISHED' ? 'Test published' : 'Test moved to drafts');
      await refresh();
    } catch (requestError) {
      toast.error(errorMessage(requestError, 'Unable to update this test.'));
    } finally {
      setWorkingId(null);
    }
  };

  const duplicate = async (test: LibraryTest) => {
    setWorkingId(test.id);
    try {
      const copy = await axiosClient.post<{ id: number }, { id: number }>(`/api/tests/${test.id}/duplicate`);
      invalidateQueryCache('/api/tests');
      toast.success('Draft copy created in My Tests');
      navigate(`/dashboard/practice-test/create?edit=${copy.id}`);
    } catch (requestError) {
      toast.error(errorMessage(requestError, 'Unable to duplicate this test.'));
    } finally {
      setWorkingId(null);
    }
  };

  const remove = async () => {
    if (!deleteTarget) return;
    setWorkingId(deleteTarget.id);
    try {
      await axiosClient.delete(`/api/tests/${deleteTarget.id}`);
      setDeleteTarget(null);
      toast.success('Test permanently deleted');
      await refresh();
    } catch (requestError) {
      toast.error(errorMessage(requestError, 'Unable to delete this test.'));
    } finally {
      setWorkingId(null);
    }
  };

  const actions: TestActions = {
    preview: test => navigate(`/dashboard/practice-test/${test.id}`),
    edit: test => navigate(`/dashboard/practice-test/create?edit=${test.id}`),
    duplicate,
    archive: test => void updateStatus(test, 'ARCHIVED'),
    restore: test => void updateStatus(test, 'PUBLISHED'),
    delete: setDeleteTarget,
  };

  const resetFilters = () => {
    setSearch('');
    const next = new URLSearchParams(searchParams);
    ['q', 'subject', 'mode', 'status', 'month'].forEach(key => next.delete(key));
    setSearchParams(next, { replace: true });
  };

  const hasStructuredFilters = subject !== 'ALL' || mode !== 'ALL' || (source === 'MY' && status !== 'ALL') || (source === 'SYSTEM' && month !== 'ALL');
  const hasFilters = Boolean(search || hasStructuredFilters);
  const saveSnapshot = useCallback((snapshot: GridStateSnapshot) => {
    if (!usableGridSnapshot(snapshot)) return;
    const cached = libraryCache.get(queryKey) || { items: tests, total, nextCursor, sourceCounts, snapshots: {} };
    cached.snapshots[view] = snapshot;
    libraryCache.set(queryKey, cached);
  }, [nextCursor, queryKey, sourceCounts, tests, total, view]);

  return <div ref={setScrollParent} className="h-full overflow-y-auto bg-background">
    <main className="mx-auto flex w-full max-w-screen-2xl flex-col gap-4 p-4 md:p-6">
      <PageHeader title={<span className="font-medium">Test Library</span>} description="Create and manage your SAT test library." />
      <div className="overflow-x-auto"><Tabs items={[
        { value: 'MY' as const, label: `My Tests (${sourceCounts.my})` },
        { value: 'SYSTEM' as const, label: `System Tests (${sourceCounts.system})` },
      ]} value={source} onValueChange={changeSource} ariaLabel="Test library source" /></div>
      <DataSurface aria-label={`${source === 'MY' ? 'My Tests' : 'System Tests'} controls`}>
        <LibraryToolbar source={source} search={search} onSearch={setSearch} subject={subject} onSubject={value => updateQuery('subject', value)} mode={mode} onMode={value => updateQuery('mode', value)} status={status} onStatus={value => updateQuery('status', value)} month={month} onMonth={value => updateQuery('month', value)} sort={sort} onSort={value => updateQuery('sort', value)} view={view} onView={changeView} hasActiveFilters={hasStructuredFilters} onReset={resetFilters} loading={loading || loadingMore} onRefresh={() => void refresh()} onCreate={() => navigate('/dashboard/practice-test/create')} />
      </DataSurface>

        {error && !loading && tests.length === 0 ? <EmptyState icon={<RefreshCw size={22} />} title="Unable to load tests" description={error} action={<Button variant="outline" onClick={() => void refresh()}><RefreshCw size={17} />Try again</Button>} className="min-h-80" />
          : loading ? <LibrarySkeleton view={view} />
            : tests.length === 0 ? <EmptyState icon={<BookOpen size={22} />} title={source === 'SYSTEM' ? 'No system tests found' : status === 'ARCHIVED' ? 'No archived tests' : 'No tests found'} description={hasFilters ? 'Adjust or clear the current filters.' : source === 'MY' ? 'Create your first test to begin building your library.' : 'Published platform tests will appear here.'} action={hasFilters ? <Button variant="outline" onClick={resetFilters}><X size={16} />Clear filters</Button> : source === 'MY' ? <Button onClick={() => navigate('/dashboard/practice-test/create')}><Plus size={16} />Create test</Button> : undefined} className="min-h-80" />
              : <VirtuosoGrid
                  key={`${queryKey}:${view}`}
                  data={tests}
                  customScrollParent={scrollParent || undefined}
                  computeItemKey={(_, test) => test.id}
                  components={{
                    List: view === 'GRID' ? LibraryGridList : LibraryList,
                    Item: view === 'GRID' ? LibraryGridItem : LibraryListItem,
                    Header: view === 'LIST' ? source === 'MY' ? MyTestsListHeader : SystemTestsListHeader : undefined,
                    Footer: () => loadingMore ? <div className="flex items-center justify-center gap-2 p-4 text-sm text-muted-foreground"><LoadingSpinner />Loading next results…</div> : !nextCursor ? <p className="p-4 text-center text-xs text-muted-foreground">All {total} tests loaded</p> : null,
                  }}
                  itemContent={(_, test) => view === 'GRID' ? <LibraryCard test={test} source={source} working={workingId === test.id} actions={actions} /> : <LibraryListRow test={test} source={source} working={workingId === test.id} actions={actions} />}
                  endReached={() => void loadMore()}
                  increaseViewportBy={900}
                  overscan={400}
                  restoreStateFrom={restoreSnapshot}
                  stateChanged={saveSnapshot}
                />}
    </main>

    <Modal open={Boolean(deleteTarget)} onClose={() => workingId === null && setDeleteTarget(null)} closeOnBackdrop={workingId === null} presentation="content-dialog" title="Delete test?" subtitle={deleteTarget?.title} className="max-w-md!" footer={<><Button variant="outline" disabled={workingId !== null} onClick={() => setDeleteTarget(null)}>Cancel</Button><Button variant="destructive" disabled={workingId !== null} onClick={() => void remove()}>{workingId !== null ? 'Deleting…' : 'Delete permanently'}</Button></>}><p className="text-sm leading-6 text-muted-foreground">Only tests that have never been assigned or attempted can be permanently deleted. Tests with classroom history must be archived instead.</p></Modal>
  </div>;
}

interface ToolbarProps {
  source: LibrarySource; search: string; onSearch: (value: string) => void;
  subject: SubjectFilter; onSubject: (value: SubjectFilter) => void;
  mode: ModeFilter; onMode: (value: ModeFilter) => void;
  status: StatusFilter; onStatus: (value: StatusFilter) => void;
  month: SatTestMonthFilter; onMonth: (value: SatTestMonthFilter) => void;
  sort: SortOrder; onSort: (value: SortOrder) => void;
  view: ViewMode; onView: (value: ViewMode) => void;
  hasActiveFilters: boolean; onReset: () => void;
  loading: boolean; onRefresh: () => void; onCreate: () => void;
}

function LibraryToolbar({ source, search, onSearch, subject, onSubject, mode, onMode, status, onStatus, month, onMonth, sort, onSort, view, onView, hasActiveFilters, onReset, loading, onRefresh, onCreate }: ToolbarProps) {
  return <DataToolbar className="border-b-0">
    <DataToolbarGroup>
      <DataToolbarSearch value={search} onChange={event => onSearch(event.target.value)} placeholder="Search tests…" label="Search tests" />
      <RadioFilter label={subject === 'ALL' ? 'Subject' : subjectLabel[subject]} value={subject} onChange={value => onSubject(value as SubjectFilter)} options={[['ALL', 'All subjects'], ['RW', 'Reading & Writing'], ['MATH', 'Math']]} />
      <RadioFilter label={mode === 'ALL' ? 'Type' : modeLabel[mode]} value={mode} onChange={value => onMode(value as ModeFilter)} options={[['ALL', 'All types'], ['PRACTICE', 'Practice'], ['EXAM', 'Exam']]} />
      {source === 'MY' && <RadioFilter label={status === 'ALL' ? 'Status' : statusLabel[status]} value={status} onChange={value => onStatus(value as StatusFilter)} options={[['ALL', 'Published & draft'], ['PUBLISHED', 'Published'], ['DRAFT', 'Draft'], ['ARCHIVED', 'Archived']]} />}
      {source === 'SYSTEM' && <RadioFilter icon={<CalendarDays size={16} />} label={month === 'ALL' ? 'Official month' : satTestMonthLabel(month) || 'Official month'} value={month} onChange={value => onMonth(value as SatTestMonthFilter)} options={[['ALL', 'All months'], ...SAT_TEST_MONTHS.map(item => [item.value, item.label] as [string, string])]} />}
      {hasActiveFilters && <Button variant="ghost" size="sm" onClick={onReset}><X size={16} />Reset</Button>}
    </DataToolbarGroup>
    <DataToolbarActions>
      <RadioFilter icon={<ArrowUpDown size={16} />} label={`Sort: ${sort === 'NEWEST' ? 'Newest' : 'Oldest'}`} value={sort} onChange={value => onSort(value as SortOrder)} options={[['NEWEST', 'Recently updated'], ['OLDEST', 'Oldest updated']]} align="end" />
      <div className="flex h-8 items-center rounded-control border border-ui-border bg-surface p-0.5" role="group" aria-label="Display mode"><Button variant="ghost" size="sm" className={`h-7 px-2 shadow-none ${view === 'GRID' ? 'bg-accent text-foreground' : ''}`} onClick={() => onView('GRID')} aria-label="Card view" aria-pressed={view === 'GRID'}>{view === 'GRID' && <Check size={14} strokeWidth={2.5} aria-hidden="true" />}<Grid2X2 size={17} aria-hidden="true" /></Button><Button variant="ghost" size="sm" className={`h-7 px-2 shadow-none ${view === 'LIST' ? 'bg-accent text-foreground' : ''}`} onClick={() => onView('LIST')} aria-label="List view" aria-pressed={view === 'LIST'}>{view === 'LIST' && <Check size={14} strokeWidth={2.5} aria-hidden="true" />}<List size={18} aria-hidden="true" /></Button></div>
      <Button variant="outline" size="sm" className="w-9 px-0" onClick={onRefresh} disabled={loading} aria-label="Refresh tests">{loading ? <LoadingSpinner /> : <RefreshCw size={20} strokeWidth={2.25} aria-hidden="true" />}</Button>
      <Button size="sm" onClick={onCreate}><Plus size={16} />Create test</Button>
    </DataToolbarActions>
  </DataToolbar>;
}

function RadioFilter({ icon, label, value, onChange, options, align = 'start' }: { icon?: ReactNode; label: string; value: string; onChange: (value: string) => void; options: Array<[string, string]>; align?: 'start' | 'end' }) {
  const active = value !== 'ALL' && value !== 'NEWEST';
  return <DropdownMenu><DropdownMenuTrigger asChild><Button variant="outline" size="sm" className={active ? 'bg-muted text-foreground' : undefined}>{icon || <SlidersHorizontal size={16} />}{label}</Button></DropdownMenuTrigger><DropdownMenuContent align={align} className="w-52"><DropdownMenuLabel>{label}</DropdownMenuLabel><DropdownMenuSeparator /><DropdownMenuRadioGroup value={value} onValueChange={onChange}>{options.map(([optionValue, optionLabel]) => <DropdownMenuRadioItem key={optionValue} value={optionValue}>{optionLabel}</DropdownMenuRadioItem>)}</DropdownMenuRadioGroup></DropdownMenuContent></DropdownMenu>;
}

interface TestActions { preview: (test: LibraryTest) => void; edit: (test: LibraryTest) => void; duplicate: (test: LibraryTest) => void; archive: (test: LibraryTest) => void; restore: (test: LibraryTest) => void; delete: (test: LibraryTest) => void }

function LibraryCard({ test, source, working, actions }: { test: LibraryTest; source: LibrarySource; working: boolean; actions: TestActions }) {
  return <Card className="relative flex min-h-64 flex-col overflow-hidden transition-shadow duration-200 hover:shadow-raised">
    {test.category === 'REAL' && <Badge className="absolute right-12 top-3 z-10 border-primary/30 bg-primary text-primary-foreground shadow-sm">Official{satTestMonthLabel(test.testDate) ? ` · ${satTestMonthLabel(test.testDate)}` : ''}</Badge>}
    <div className="absolute right-3 top-3 z-20"><TestMenu test={test} source={source} working={working} actions={actions} /></div>
    <div className="flex h-28 shrink-0 items-start justify-between gap-3 p-5 pb-4 pr-12">
      <div className="flex min-w-0 flex-1 flex-col gap-3">
        <div className={`flex flex-wrap items-center gap-1.5 ${test.category === 'REAL' ? 'pr-28' : ''}`}>
          <Badge tone={test.subject === 'MATH' ? 'gold' : 'green'}>{subjectLabel[test.subject]}</Badge>
          <Badge>{modeLabel[test.mode]}</Badge>
        </div>
        <Tooltip>
          <TooltipTrigger asChild><h2 className="line-clamp-2 cursor-default text-title font-semibold leading-5 text-foreground">{test.title}</h2></TooltipTrigger>
          <TooltipContent className="max-w-sm">{test.title}</TooltipContent>
        </Tooltip>
      </div>
    </div>
    <dl className="grid grid-cols-2 gap-px border-y border-ui-border bg-ui-border text-caption sm:grid-cols-4">
      <LibraryMetric label="Questions" value={String(test.questionCount)} />
      <LibraryMetric label="Duration" value={formatDuration(test.duration)} />
      <LibraryMetric label="Updated" value={formatUpdatedAt(test.updatedAt)} />
      <LibraryMetric label="Source" value={source === 'SYSTEM' ? test.author?.name || 'SAT Platform' : 'My library'} />
    </dl>
    <div className="mt-auto flex items-center justify-between gap-3 p-4 pl-5">
      {source === 'MY' ? <StatusBadge status={test.status} /> : <Badge className="text-muted-foreground">System test</Badge>}
      <PrimaryTestAction test={test} source={source} working={working} actions={actions} />
    </div>
  </Card>;
}

function LibraryMetric({ label, value }: { label: string; value: string }) {
  return <div className="min-w-0 bg-muted/30 px-3 py-2.5 first:pl-5"><dt className="text-muted-foreground">{label}</dt><dd className="mt-0.5 truncate font-medium text-foreground" title={value}>{value}</dd></div>;
}

function PrimaryTestAction({ test, source, working, actions }: { test: LibraryTest; source: LibrarySource; working: boolean; actions: TestActions }) {
  if (source === 'SYSTEM' || test.status === 'PUBLISHED') return <Button variant="outline" size="sm" disabled={working} onClick={() => actions.preview(test)}><Play size={15} />Open</Button>;
  if (test.status === 'DRAFT') return <Button size="sm" disabled={working} onClick={() => actions.edit(test)}><FilePenLine size={15} />Continue</Button>;
  return <Button variant="outline" size="sm" disabled={working} onClick={() => actions.restore(test)}>{working ? <LoadingSpinner /> : <RotateCcw size={15} />}Restore</Button>;
}

function TestMenu({ test, source, working, actions }: { test: LibraryTest; source: LibrarySource; working: boolean; actions: TestActions }) {
  return <DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="sm" className="h-8 w-8 px-0 shadow-none" disabled={working} aria-label={`Actions for ${test.title}`}><MoreHorizontal size={18} /></Button></DropdownMenuTrigger><DropdownMenuContent align="end" className="w-52"><DropdownMenuLabel>Test actions</DropdownMenuLabel><DropdownMenuSeparator />{source === 'SYSTEM' ? <DropdownMenuItem onSelect={() => actions.duplicate(test)}><Copy />Duplicate to My Tests</DropdownMenuItem> : <>{test.status === 'PUBLISHED' && <DropdownMenuItem onSelect={() => actions.edit(test)}><Pencil />Edit test</DropdownMenuItem>}{test.status === 'DRAFT' && <DropdownMenuItem onSelect={() => actions.edit(test)}><FilePenLine />Continue editing</DropdownMenuItem>}{test.status === 'ARCHIVED' && <DropdownMenuItem onSelect={() => actions.restore(test)}><RotateCcw />Restore</DropdownMenuItem>}{test.status !== 'PUBLISHED' && <DropdownMenuItem onSelect={() => actions.preview(test)}><Play />Preview</DropdownMenuItem>}<DropdownMenuItem onSelect={() => actions.duplicate(test)}><Copy />Duplicate</DropdownMenuItem>{test.status === 'PUBLISHED' && <DropdownMenuItem onSelect={() => actions.archive(test)}><Archive />Archive</DropdownMenuItem>}<DropdownMenuSeparator /><DropdownMenuItem variant="destructive" onSelect={() => actions.delete(test)}><Trash2 />Delete permanently</DropdownMenuItem></>}</DropdownMenuContent></DropdownMenu>;
}

function LibraryListRow({ test, source, working, actions }: { test: LibraryTest; source: LibrarySource; working: boolean; actions: TestActions }) {
  const openDefault = (test: LibraryTest) => source === 'MY' && test.status === 'DRAFT' ? actions.edit(test) : actions.preview(test);
  return <div className="grid min-w-[900px] grid-cols-[minmax(210px,1.45fr)_140px_140px_90px_110px_120px_152px] items-center gap-4 px-4 py-3 hover:bg-muted/20"><Button variant="ghost" className="h-auto min-w-0 justify-start gap-2 p-0 text-left text-foreground hover:bg-transparent hover:underline" onClick={() => openDefault(test)}><span className="truncate text-body font-medium" title={test.title}>{test.title}</span>{test.category === 'REAL' && <Badge className="shrink-0 bg-primary text-primary-foreground">Official{satTestMonthLabel(test.testDate) ? ` · ${satTestMonthLabel(test.testDate)}` : ''}</Badge>}</Button><div className="flex flex-wrap gap-1"><Badge tone={test.subject === 'MATH' ? 'gold' : 'green'}>{test.subject === 'RW' ? 'R&W' : 'Math'}</Badge><Badge>{modeLabel[test.mode]}</Badge></div><span>{source === 'MY' ? <StatusBadge status={test.status} /> : <span className="text-caption text-muted-foreground">SAT Platform</span>}</span><span className="text-caption tabular-nums text-muted-foreground">{test.questionCount}</span><span className="text-caption text-muted-foreground">{formatDuration(test.duration)}</span><span className="text-caption text-muted-foreground">{formatUpdatedAt(test.updatedAt)}</span><span className="flex items-center justify-end gap-1"><PrimaryTestAction test={test} source={source} working={working} actions={actions} /><TestMenu test={test} source={source} working={working} actions={actions} /></span></div>;
}

function StatusBadge({ status }: { status: TestStatus }) {
  return <Badge className="gap-1.5 px-1.5 text-muted-foreground">{status === 'PUBLISHED' ? <Check size={13} aria-hidden="true" /> : status === 'DRAFT' ? <FilePenLine size={13} aria-hidden="true" /> : <Archive size={13} aria-hidden="true" />}{statusLabel[status]}</Badge>;
}

function LibrarySkeleton({ view }: { view: ViewMode }) {
  if (view === 'LIST') return <div><Skeleton className="h-11 rounded-none border-b border-ui-border" />{[1, 2, 3, 4, 5].map(item => <div key={item} className="flex h-16 items-center gap-6 border-b border-ui-border/60 px-4 last:border-0"><Skeleton className="h-4 w-64" /><Skeleton className="h-6 w-24 rounded-full" /><Skeleton className="h-4 flex-1" /><Skeleton className="h-8 w-28" /></div>)}</div>;
  return <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">{[1, 2, 3, 4, 5, 6].map(item => <Card key={item} className="h-72 p-5"><div className="mb-6 flex gap-2"><Skeleton className="h-5 w-24 rounded-full" /><Skeleton className="h-5 w-16 rounded-full" /></div><Skeleton className="h-5 w-3/4" /><Skeleton className="mt-3 h-4 w-full" /><Skeleton className="mt-8 h-20 w-full" /></Card>)}</div>;
}

const formatDuration = (value: number) => value ? `${Math.floor(value)} min` : 'No limit';

const formatUpdatedAt = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Recently';
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

const errorMessage = (error: unknown, fallback: string) => (error as { response?: { data?: { error?: string } } })?.response?.data?.error || fallback;
