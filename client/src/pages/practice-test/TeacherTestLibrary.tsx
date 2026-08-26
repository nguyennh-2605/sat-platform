import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { Archive, ArrowUpDown, BookOpen, Check, ChevronLeft, ChevronRight, Clock3, Copy, FilePenLine, Grid2X2, History, List, LoaderCircle, MoreHorizontal, Pencil, Play, Plus, RefreshCw, RotateCcw, Search, Trash2, UserRound, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Card, CardAction, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge, Button, EmptyState, Input, Modal, PageHeader, Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableShell, Tabs } from '@/components/ui/AppUI';
import axiosClient from '@/lib/axios';
import { cachedGet, invalidateQueryCache } from '@/lib/queryCache';
import { useDebounce } from '@/hooks/useDebounce';
import { capitalizeFirstLetter } from '@/utils/text';

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
  questionCount: number;
  updatedAt: string;
  author?: { id: number; name?: string | null; role: string } | null;
}

interface PaginationMeta { page: number; pageSize: number; total: number; totalPages: number }
interface LibraryPage { items: LibraryTest[]; pagination: PaginationMeta; sourceCounts?: { my: number; system: number } }

const subjectLabel = { RW: 'Reading & Writing', MATH: 'Math' } as const;
const modeLabel = { PRACTICE: 'Practice', EXAM: 'Exam' } as const;
const statusLabel = { ALL: 'All statuses', DRAFT: 'Draft', PUBLISHED: 'Published', ARCHIVED: 'Archived' } as const;

export default function TeacherTestLibrary() {
  const navigate = useNavigate();
  const isAdmin = localStorage.getItem('userRole') === 'ADMIN';
  const [source, setSource] = useState<LibrarySource>('MY');
  const [tests, setTests] = useState<LibraryTest[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta>({ page: 1, pageSize: 24, total: 0, totalPages: 1 });
  const [sourceCounts, setSourceCounts] = useState({ my: 0, system: 0 });
  const [search, setSearch] = useState('');
  const [subject, setSubject] = useState<SubjectFilter>('ALL');
  const [mode, setMode] = useState<ModeFilter>('ALL');
  const [status, setStatus] = useState<StatusFilter>('ALL');
  const [sort, setSort] = useState<SortOrder>('NEWEST');
  const [view, setView] = useState<ViewMode>(() => localStorage.getItem('teacherTestLibraryView') === 'LIST' ? 'LIST' : 'GRID');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [workingId, setWorkingId] = useState<number | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<LibraryTest | null>(null);
  const debouncedSearch = useDebounce(search, 250);

  const loadTests = useCallback(async (force = false) => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ source, page: String(page), pageSize: '24', sort });
      if (debouncedSearch.trim()) params.set('search', debouncedSearch.trim());
      if (subject !== 'ALL') params.set('subject', subject);
      if (mode !== 'ALL') params.set('mode', mode);
      if (source === 'MY' && status !== 'ALL') params.set('status', status);
      const data = await cachedGet<LibraryPage>(`/api/tests?${params}`, { ttlMs: 20_000, force });
      setTests(data.items.map(item => ({ ...item, title: capitalizeFirstLetter(item.title) })));
      setPagination(data.pagination);
      if (data.sourceCounts) setSourceCounts(data.sourceCounts);
      else if (isAdmin) setSourceCounts(current => ({ ...current, my: data.pagination.total }));
    } catch (loadError) {
      console.error(loadError);
      setError('Your test library could not be loaded. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, isAdmin, mode, page, sort, source, status, subject]);

  useEffect(() => { void loadTests(); }, [loadTests]);

  const changeSource = (next: LibrarySource) => {
    setSource(next);
    setStatus('ALL');
    setPage(1);
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
    setSubject('ALL');
    setMode('ALL');
    setStatus('ALL');
    setPage(1);
  };

  const hasFilters = Boolean(search || subject !== 'ALL' || mode !== 'ALL' || (source === 'MY' && status !== 'ALL'));
  const resultSummary = useMemo(() => {
    if (!pagination.total) return 'No tests';
    return `${(pagination.page - 1) * pagination.pageSize + 1}–${Math.min(pagination.page * pagination.pageSize, pagination.total)} of ${pagination.total}`;
  }, [pagination]);

  return <div className="h-full overflow-y-auto bg-background">
    <main className="mx-auto flex w-full max-w-screen-2xl flex-col gap-4 p-4 md:p-6">
      <PageHeader title={<span className="font-medium">{isAdmin ? 'System Test Library' : 'Test Library'}</span>} description={isAdmin ? 'Create and manage published platform tests.' : 'Create and manage your SAT test library.'} />
      {!isAdmin && <div className="overflow-x-auto"><Tabs items={[
        { value: 'MY' as const, label: `My Tests (${sourceCounts.my})` },
        { value: 'SYSTEM' as const, label: `System Tests (${sourceCounts.system})` },
      ]} value={source} onValueChange={changeSource} ariaLabel="Test library source" /></div>}
      <LibraryToolbar source={source} search={search} onSearch={value => { setSearch(value); setPage(1); }} subject={subject} onSubject={value => { setSubject(value); setPage(1); }} mode={mode} onMode={value => { setMode(value); setPage(1); }} status={status} onStatus={value => { setStatus(value); setPage(1); }} sort={sort} onSort={value => { setSort(value); setPage(1); }} view={view} onView={changeView} loading={loading} onRefresh={() => void refresh()} onCreate={() => navigate('/dashboard/practice-test/create')} />

      {error && !loading && tests.length === 0 ? <EmptyState icon={<RefreshCw size={22} />} title="Unable to load tests" description={error} action={<Button variant="outline" onClick={() => void refresh()}><RefreshCw size={17} />Try again</Button>} />
        : loading ? <LibrarySkeleton view={view} />
          : tests.length === 0 ? <EmptyState icon={<BookOpen size={22} />} title={source === 'SYSTEM' ? 'No system tests found' : status === 'ARCHIVED' ? 'No archived tests' : 'No tests found'} description={hasFilters ? 'Adjust or clear the current filters.' : source === 'MY' ? 'Create your first test to begin building your library.' : 'Published platform tests will appear here.'} action={hasFilters ? <Button variant="outline" onClick={resetFilters}><X size={16} />Clear filters</Button> : source === 'MY' ? <Button onClick={() => navigate('/dashboard/practice-test/create')}><Plus size={16} />Create test</Button> : undefined} />
            : view === 'GRID' ? <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">{tests.map(test => <LibraryCard key={test.id} test={test} source={source} working={workingId === test.id} actions={actions} />)}</div>
              : <LibraryTable tests={tests} source={source} workingId={workingId} actions={actions} />}

      {!loading && pagination.total > 0 && <div className="flex flex-col items-center justify-between gap-3 border-t border-ui-border pt-4 sm:flex-row"><p className="text-caption text-muted-foreground">Showing {resultSummary} tests</p><div className="flex items-center gap-2"><Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(current => Math.max(1, current - 1))}><ChevronLeft size={16} />Previous</Button><span className="min-w-20 text-center text-caption font-medium text-subtle">Page {pagination.page} of {pagination.totalPages}</span><Button variant="outline" size="sm" disabled={page >= pagination.totalPages} onClick={() => setPage(current => current + 1)}>Next<ChevronRight size={16} /></Button></div></div>}
    </main>

    <Modal open={Boolean(deleteTarget)} onClose={() => workingId === null && setDeleteTarget(null)} closeOnBackdrop={workingId === null} presentation="content-dialog" title="Delete test?" subtitle={deleteTarget?.title} className="max-w-md!" footer={<><Button variant="outline" disabled={workingId !== null} onClick={() => setDeleteTarget(null)}>Cancel</Button><Button variant="destructive" disabled={workingId !== null} onClick={() => void remove()}>{workingId !== null ? 'Deleting…' : 'Delete permanently'}</Button></>}><p className="text-sm leading-6 text-muted-foreground">Only tests that have never been assigned or attempted can be permanently deleted. Tests with classroom history must be archived instead.</p></Modal>
  </div>;
}

interface ToolbarProps {
  source: LibrarySource; search: string; onSearch: (value: string) => void;
  subject: SubjectFilter; onSubject: (value: SubjectFilter) => void;
  mode: ModeFilter; onMode: (value: ModeFilter) => void;
  status: StatusFilter; onStatus: (value: StatusFilter) => void;
  sort: SortOrder; onSort: (value: SortOrder) => void;
  view: ViewMode; onView: (value: ViewMode) => void;
  loading: boolean; onRefresh: () => void; onCreate: () => void;
}

function LibraryToolbar({ source, search, onSearch, subject, onSubject, mode, onMode, status, onStatus, sort, onSort, view, onView, loading, onRefresh, onCreate }: ToolbarProps) {
  return <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:gap-2">
    <label className="relative w-full min-w-0 xl:flex-1"><Search size={16} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" aria-hidden="true" /><Input controlSize="sm" value={search} onChange={event => onSearch(event.target.value)} placeholder="Search tests…" aria-label="Search tests" className="w-full pl-8" /></label>
    <div className="flex flex-wrap items-center gap-2 xl:flex-nowrap">
      <RadioFilter label={subject === 'ALL' ? 'Subject' : subjectLabel[subject]} value={subject} onChange={value => onSubject(value as SubjectFilter)} options={[['ALL', 'All subjects'], ['RW', 'Reading & Writing'], ['MATH', 'Math']]} />
      <RadioFilter label={mode === 'ALL' ? 'Type' : modeLabel[mode]} value={mode} onChange={value => onMode(value as ModeFilter)} options={[['ALL', 'All types'], ['PRACTICE', 'Practice'], ['EXAM', 'Exam']]} />
      {source === 'MY' && <RadioFilter label={status === 'ALL' ? 'Status' : statusLabel[status]} value={status} onChange={value => onStatus(value as StatusFilter)} options={[['ALL', 'Published & draft'], ['PUBLISHED', 'Published'], ['DRAFT', 'Draft'], ['ARCHIVED', 'Archived']]} />}
      <RadioFilter icon={<ArrowUpDown size={16} />} label={sort === 'NEWEST' ? 'Newest' : 'Oldest'} value={sort} onChange={value => onSort(value as SortOrder)} options={[['NEWEST', 'Recently updated'], ['OLDEST', 'Oldest updated']]} />
      <div className="flex h-8 items-center rounded-control border border-ui-border bg-surface p-0.5" role="group" aria-label="Display mode"><Button variant="ghost" size="sm" className={`h-7 px-2 shadow-none ${view === 'GRID' ? 'bg-accent text-foreground' : ''}`} onClick={() => onView('GRID')} aria-label="Card view" aria-pressed={view === 'GRID'}>{view === 'GRID' && <Check size={14} strokeWidth={2.5} aria-hidden="true" />}<Grid2X2 size={17} aria-hidden="true" /></Button><Button variant="ghost" size="sm" className={`h-7 px-2 shadow-none ${view === 'LIST' ? 'bg-accent text-foreground' : ''}`} onClick={() => onView('LIST')} aria-label="List view" aria-pressed={view === 'LIST'}>{view === 'LIST' && <Check size={14} strokeWidth={2.5} aria-hidden="true" />}<List size={18} aria-hidden="true" /></Button></div>
      <Button variant="outline" size="sm" className="w-9 px-0" onClick={onRefresh} disabled={loading} aria-label="Refresh tests"><RefreshCw size={20} strokeWidth={2.25} className={loading ? 'animate-spin' : ''} aria-hidden="true" /></Button>
      <Button size="sm" onClick={onCreate}><Plus size={16} />Create test</Button>
    </div>
  </div>;
}

function RadioFilter({ icon, label, value, onChange, options }: { icon?: ReactNode; label: string; value: string; onChange: (value: string) => void; options: Array<[string, string]> }) {
  return <DropdownMenu><DropdownMenuTrigger asChild><Button variant="outline" size="sm">{icon}{label}</Button></DropdownMenuTrigger><DropdownMenuContent align="end" className="w-48"><DropdownMenuLabel>{label}</DropdownMenuLabel><DropdownMenuSeparator /><DropdownMenuRadioGroup value={value} onValueChange={onChange}>{options.map(([optionValue, optionLabel]) => <DropdownMenuRadioItem key={optionValue} value={optionValue}>{optionLabel}</DropdownMenuRadioItem>)}</DropdownMenuRadioGroup></DropdownMenuContent></DropdownMenu>;
}

interface TestActions { preview: (test: LibraryTest) => void; edit: (test: LibraryTest) => void; duplicate: (test: LibraryTest) => void; archive: (test: LibraryTest) => void; restore: (test: LibraryTest) => void; delete: (test: LibraryTest) => void }

function LibraryCard({ test, source, working, actions }: { test: LibraryTest; source: LibrarySource; working: boolean; actions: TestActions }) {
  const system = source === 'SYSTEM';
  return <Card size="sm" className="flex h-full flex-col gap-0 py-0 shadow-card">
    <CardHeader className="gap-1 px-4 pb-0 pt-4">
      <CardTitle className="line-clamp-2 min-w-0 pr-2 text-title font-semibold text-foreground">{test.title}</CardTitle>
      <CardAction className="flex items-center gap-1.5 pl-2">
        <Badge className="font-medium text-muted-foreground">{subjectLabel[test.subject]}</Badge>
        <TestMenu test={test} source={source} working={working} actions={actions} />
      </CardAction>
      <p className="col-start-1 row-start-2 -mt-0.5 truncate text-caption text-muted-foreground">{modeLabel[test.mode]}</p>
    </CardHeader>
    <CardContent className="px-4 pb-4 pt-3">
      <ul className="space-y-2 text-body text-foreground">
        <li className="flex items-center gap-2"><BookOpen size={16} className="shrink-0 text-muted-foreground" aria-hidden="true" /><span>{test.questionCount} questions</span></li>
        <li className="flex items-center gap-2"><Clock3 size={16} className="shrink-0 text-muted-foreground" aria-hidden="true" /><span>{test.duration ? `${test.duration} minutes` : 'No time limit'}</span></li>
        <li className="flex min-w-0 items-center gap-2">{system ? <UserRound size={16} className="shrink-0 text-muted-foreground" aria-hidden="true" /> : <History size={16} className="shrink-0 text-muted-foreground" aria-hidden="true" />}<span className="truncate">{system ? `Provided by ${test.author?.name || 'SAT Platform'}` : `Updated ${relativeTime(test.updatedAt)}`}</span></li>
      </ul>
    </CardContent>
    <CardFooter className="mt-auto grid gap-2 bg-muted/40 p-3">
      <CardStackedActions test={test} source={source} working={working} actions={actions} />
    </CardFooter>
  </Card>;
}

function CardStackedActions({ test, source, working, actions }: { test: LibraryTest; source: LibrarySource; working: boolean; actions: TestActions }) {
  const primaryAction = source === 'SYSTEM'
    ? <Button size="sm" className="w-full" disabled={working} onClick={() => actions.duplicate(test)}>{working ? <LoaderCircle size={15} className="animate-spin" /> : <Copy size={15} />}Duplicate to My Tests</Button>
    : test.status === 'DRAFT'
      ? <Button size="sm" className="w-full" disabled={working} onClick={() => actions.edit(test)}><FilePenLine size={15} />Continue editing</Button>
      : test.status === 'ARCHIVED'
        ? <Button size="sm" className="w-full" disabled={working} onClick={() => actions.restore(test)}>{working ? <LoaderCircle size={15} className="animate-spin" /> : <RotateCcw size={15} />}Restore</Button>
        : <Button size="sm" className="w-full" disabled={working} onClick={() => actions.edit(test)}><Pencil size={15} />Edit test</Button>;

  return <>{primaryAction}<Button variant="outline" size="sm" className="w-full bg-surface" disabled={working} onClick={() => actions.preview(test)}><Play size={15} />Preview</Button></>;
}

function CardPrimaryActions({ test, source, working, actions }: { test: LibraryTest; source: LibrarySource; working: boolean; actions: TestActions }) {
  if (source === 'SYSTEM') return <><Button variant="outline" size="sm" disabled={working} onClick={() => actions.preview(test)}><Play size={15} />Preview</Button><Button size="sm" disabled={working} onClick={() => actions.duplicate(test)}>{working ? <LoaderCircle size={15} className="animate-spin" /> : <Copy size={15} />}Duplicate to My Tests</Button></>;
  if (test.status === 'DRAFT') return <Button size="sm" disabled={working} onClick={() => actions.edit(test)}><FilePenLine size={15} />Continue editing</Button>;
  if (test.status === 'ARCHIVED') return <Button variant="outline" size="sm" disabled={working} onClick={() => actions.restore(test)}>{working ? <LoaderCircle size={15} className="animate-spin" /> : <RotateCcw size={15} />}Restore</Button>;
  return <><Button variant="outline" size="sm" disabled={working} onClick={() => actions.preview(test)}><Play size={15} />Preview</Button><Button size="sm" disabled={working} onClick={() => actions.edit(test)}><Pencil size={15} />Edit</Button></>;
}

function TestMenu({ test, source, working, actions }: { test: LibraryTest; source: LibrarySource; working: boolean; actions: TestActions }) {
  if (source === 'SYSTEM') return null;
  return <DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="sm" className="h-8 w-8 px-0" disabled={working} aria-label={`Actions for ${test.title}`}><MoreHorizontal size={18} /></Button></DropdownMenuTrigger><DropdownMenuContent align="end" className="w-48"><DropdownMenuLabel>Test actions</DropdownMenuLabel><DropdownMenuSeparator />{test.status !== 'PUBLISHED' && <DropdownMenuItem onSelect={() => actions.preview(test)}><Play />Preview</DropdownMenuItem>}<DropdownMenuItem onSelect={() => actions.duplicate(test)}><Copy />Duplicate</DropdownMenuItem>{test.status === 'PUBLISHED' && <DropdownMenuItem onSelect={() => actions.archive(test)}><Archive />Archive</DropdownMenuItem>}<DropdownMenuSeparator /><DropdownMenuItem variant="destructive" onSelect={() => actions.delete(test)}><Trash2 />Delete permanently</DropdownMenuItem></DropdownMenuContent></DropdownMenu>;
}

function LibraryTable({ tests, source, workingId, actions }: { tests: LibraryTest[]; source: LibrarySource; workingId: number | null; actions: TestActions }) {
  return <TableShell><div className="overflow-x-auto"><Table className="min-w-[900px]"><TableHeader><TableRow><TableHead>Test</TableHead><TableHead>Subject</TableHead><TableHead>Type</TableHead><TableHead>Questions</TableHead><TableHead>{source === 'MY' ? 'Status' : 'Source'}</TableHead><TableHead>Updated</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader><TableBody>{tests.map(test => <TableRow key={test.id}><TableCell><Button variant="ghost" size="sm" className="h-auto justify-start p-0 text-left font-medium text-foreground hover:bg-transparent hover:underline" onClick={() => actions.preview(test)}>{test.title}</Button></TableCell><TableCell className="text-muted-foreground">{subjectLabel[test.subject]}</TableCell><TableCell className="text-muted-foreground">{modeLabel[test.mode]}</TableCell><TableCell className="text-muted-foreground">{test.questionCount}</TableCell><TableCell>{source === 'MY' ? <StatusBadge status={test.status} /> : <span className="text-muted-foreground">SAT Platform</span>}</TableCell><TableCell className="text-muted-foreground">{relativeTime(test.updatedAt)}</TableCell><TableCell><div className="flex justify-end gap-2"><CardPrimaryActions test={test} source={source} working={workingId === test.id} actions={actions} /><TestMenu test={test} source={source} working={workingId === test.id} actions={actions} /></div></TableCell></TableRow>)}</TableBody></Table></div></TableShell>;
}

function StatusBadge({ status }: { status: TestStatus }) {
  return <Badge className="gap-1.5 px-1.5 text-muted-foreground">{status === 'PUBLISHED' ? <Check size={13} aria-hidden="true" /> : status === 'DRAFT' ? <FilePenLine size={13} aria-hidden="true" /> : <Archive size={13} aria-hidden="true" />}{statusLabel[status]}</Badge>;
}

function LibrarySkeleton({ view }: { view: ViewMode }) {
  if (view === 'LIST') return <TableShell className="animate-pulse"><div className="h-12 border-b border-ui-border bg-muted" />{[1, 2, 3, 4, 5].map(item => <div key={item} className="flex h-16 items-center gap-5 border-b border-ui-border px-5 last:border-0"><span className="h-4 w-64 rounded-sm bg-muted" /><span className="h-4 w-32 rounded-sm bg-muted" /><span className="ml-auto h-8 w-32 rounded-control bg-muted" /></div>)}</TableShell>;
  return <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">{[1, 2, 3, 4, 5, 6].map(item => <Card key={item} className="h-60 animate-pulse bg-muted" />)}</div>;
}

const relativeTime = (value: string) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'recently' : formatDistanceToNow(date, { addSuffix: true });
};

const errorMessage = (error: unknown, fallback: string) => (error as { response?: { data?: { error?: string } } })?.response?.data?.error || fallback;
