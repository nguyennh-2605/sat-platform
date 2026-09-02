import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import {
  Archive,
  ArrowUpDown,
  BookOpen,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Copy,
  FilePenLine,
  Grid2X2,
  History,
  List,
  LoaderCircle,
  MoreHorizontal,
  Pencil,
  Play,
  Plus,
  RefreshCw,
  RotateCcw,
  SlidersHorizontal,
  Trash2,
  UserRound,
  X,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { DataPagination, DataSurface, DataToolbar, DataToolbarActions, DataToolbarGroup, DataToolbarSearch } from '@/components/ui/data-surface';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { EmptyState, Modal, PageHeader } from '@/components/ui/AppUI';
import { useDebounce } from '@/hooks/useDebounce';
import axiosClient from '@/lib/axios';
import { cachedGet, invalidateQueryCache } from '@/lib/queryCache';
import { cn } from '@/lib/utils';
import { capitalizeFirstLetter } from '@/utils/text';

type AdminSource = 'SYSTEM' | 'TEACHER';
type TestStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
type SubjectFilter = 'ALL' | 'RW' | 'MATH';
type ModeFilter = 'ALL' | 'PRACTICE' | 'EXAM';
type StatusFilter = 'ALL' | TestStatus;
type SortOrder = 'NEWEST' | 'OLDEST';
type ViewMode = 'GRID' | 'LIST';
type IntegrityFilter = 'ALL' | 'NO_SECTIONS' | 'NO_QUESTIONS' | 'EMPTY_SECTION';

interface TestCapabilities {
  canEdit: boolean;
  canArchive: boolean;
  canRestore: boolean;
  canDelete: boolean;
  canDuplicate: boolean;
  canCopyToSystem: boolean;
}

interface AdminTest {
  id: number;
  title: string;
  description?: string | null;
  duration: number;
  subject: 'RW' | 'MATH';
  mode: 'PRACTICE' | 'EXAM';
  status: TestStatus;
  scope: 'SYSTEM' | 'PERSONAL';
  questionCount: number;
  updatedAt: string;
  author?: { id: number; name?: string | null; role: string } | null;
  usage: { attempts: number; deliveries: number; legacyClassLinks: number };
  capabilities: TestCapabilities;
}

interface PaginationMeta { page: number; pageSize: number; total: number; totalPages: number }
interface AdminTestPage {
  items: AdminTest[];
  pagination: PaginationMeta;
  sourceCounts?: { system: number; teacher: number };
}

interface TestActions {
  preview: (test: AdminTest) => void;
  edit: (test: AdminTest) => void;
  duplicate: (test: AdminTest) => void;
  copyToSystem: (test: AdminTest) => void;
  setStatus: (test: AdminTest, status: TestStatus) => void;
  delete: (test: AdminTest) => void;
}

const subjectLabel = { RW: 'Reading & Writing', MATH: 'Math' } as const;
const modeLabel = { PRACTICE: 'Practice', EXAM: 'Exam' } as const;
const statusLabel = { ALL: 'All statuses', DRAFT: 'Draft', PUBLISHED: 'Published', ARCHIVED: 'Archived' } as const;
const integrityLabel = { ALL: 'All integrity states', NO_SECTIONS: 'No sections', NO_QUESTIONS: 'No questions', EMPTY_SECTION: 'Empty section' } as const;

const enumParam = <T extends string>(value: string | null, allowed: readonly T[], fallback: T): T => allowed.includes(value as T) ? value as T : fallback;

export default function AdminTestManagement() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const source = enumParam(searchParams.get('source')?.toUpperCase() || null, ['SYSTEM', 'TEACHER'] as const, 'SYSTEM');
  const search = searchParams.get('search') || '';
  const subject = enumParam(searchParams.get('subject')?.toUpperCase() || null, ['ALL', 'RW', 'MATH'] as const, 'ALL');
  const mode = enumParam(searchParams.get('mode')?.toUpperCase() || null, ['ALL', 'PRACTICE', 'EXAM'] as const, 'ALL');
  const status = enumParam(searchParams.get('status')?.toUpperCase() || null, ['ALL', 'DRAFT', 'PUBLISHED', 'ARCHIVED'] as const, 'ALL');
  const integrity = source === 'SYSTEM'
    ? enumParam(searchParams.get('integrity')?.toUpperCase() || null, ['ALL', 'NO_SECTIONS', 'NO_QUESTIONS', 'EMPTY_SECTION'] as const, 'ALL')
    : 'ALL';
  const sort = enumParam(searchParams.get('sort')?.toUpperCase() || null, ['NEWEST', 'OLDEST'] as const, 'NEWEST');
  const page = Math.max(1, Number.parseInt(searchParams.get('page') || '1', 10) || 1);
  const [tests, setTests] = useState<AdminTest[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta>({ page: 1, pageSize: 24, total: 0, totalPages: 1 });
  const [sourceCounts, setSourceCounts] = useState({ system: 0, teacher: 0 });
  const [view, setView] = useState<ViewMode>(() => localStorage.getItem('adminTestManagementView') === 'GRID' ? 'GRID' : 'LIST');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [workingId, setWorkingId] = useState<number | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AdminTest | null>(null);
  const debouncedSearch = useDebounce(search, 250);

  const updateQuery = useCallback((updates: Record<string, string | null>, resetPage = true) => {
    const next = new URLSearchParams(searchParams);
    for (const [key, value] of Object.entries(updates)) {
      if (!value || value === 'ALL' || value === 'NEWEST' || (key === 'page' && value === '1')) next.delete(key);
      else next.set(key, value);
    }
    if (resetPage && !('page' in updates)) next.delete('page');
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  const loadTests = useCallback(async (force = false) => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ source, page: String(page), pageSize: '24', sort });
      if (debouncedSearch.trim()) params.set('search', debouncedSearch.trim());
      if (subject !== 'ALL') params.set('subject', subject);
      if (mode !== 'ALL') params.set('mode', mode);
      if (status !== 'ALL') params.set('status', status);
      if (integrity !== 'ALL') params.set('integrity', integrity);
      const data = await cachedGet<AdminTestPage>(`/api/tests?${params}`, { ttlMs: 20_000, force });
      setTests(data.items.map(item => ({ ...item, title: capitalizeFirstLetter(item.title) })));
      setPagination(data.pagination);
      if (data.sourceCounts) setSourceCounts(data.sourceCounts);
    } catch (requestError) {
      console.error(requestError);
      setError('Test Management could not be loaded. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, integrity, mode, page, sort, source, status, subject]);

  useEffect(() => { void loadTests(); }, [loadTests]);

  const refresh = async () => {
    invalidateQueryCache('/api/tests');
    await loadTests(true);
  };

  const changeSource = (nextSource: string) => {
    updateQuery({ source: nextSource === 'SYSTEM' ? null : nextSource, status: null, integrity: null });
  };

  const changeView = (nextView: ViewMode) => {
    setView(nextView);
    localStorage.setItem('adminTestManagementView', nextView);
  };

  const updateStatus = async (test: AdminTest, nextStatus: TestStatus) => {
    setWorkingId(test.id);
    try {
      await axiosClient.patch(`/api/tests/${test.id}/status`, { status: nextStatus });
      toast.success(nextStatus === 'PUBLISHED' ? 'Test published' : nextStatus === 'DRAFT' ? 'Test moved to drafts' : 'Test archived');
      await refresh();
    } catch (requestError) {
      toast.error(errorMessage(requestError, 'Unable to update this test.'));
    } finally {
      setWorkingId(null);
    }
  };

  const duplicate = async (test: AdminTest) => {
    setWorkingId(test.id);
    try {
      const copy = await axiosClient.post<{ id: number }, { id: number }>(`/api/tests/${test.id}/duplicate`);
      invalidateQueryCache('/api/tests');
      toast.success('System draft created');
      navigate(`/dashboard/practice-test/create?edit=${copy.id}`);
    } catch (requestError) {
      toast.error(errorMessage(requestError, 'Unable to duplicate this test.'));
    } finally {
      setWorkingId(null);
    }
  };

  const copyToSystem = async (test: AdminTest) => {
    setWorkingId(test.id);
    try {
      const copy = await axiosClient.post<{ id: number }, { id: number }>(`/api/tests/${test.id}/copy-to-system`);
      invalidateQueryCache('/api/tests');
      toast.success('Teacher test copied to the System Library');
      navigate(`/dashboard/practice-test/create?edit=${copy.id}`);
    } catch (requestError) {
      toast.error(errorMessage(requestError, 'Unable to copy this test to the System Library.'));
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
      toast.success('System test permanently deleted');
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
    duplicate: test => void duplicate(test),
    copyToSystem: test => void copyToSystem(test),
    setStatus: (test, nextStatus) => void updateStatus(test, nextStatus),
    delete: setDeleteTarget,
  };

  const resetFilters = () => {
    updateQuery({ search: null, subject: null, mode: null, status: null, integrity: null });
  };

  const activeFilterCount = [subject !== 'ALL', mode !== 'ALL', status !== 'ALL', integrity !== 'ALL'].filter(Boolean).length;
  const resultSummary = useMemo(() => {
    if (!pagination.total) return 'No tests';
    return `${(pagination.page - 1) * pagination.pageSize + 1}–${Math.min(pagination.page * pagination.pageSize, pagination.total)} of ${pagination.total}`;
  }, [pagination]);

  return <div className="h-full overflow-y-auto bg-background">
    <main className="mx-auto flex w-full max-w-screen-2xl flex-col gap-4 p-4 md:p-6">
      <PageHeader
        title="Test Management"
        description="Manage system tests and oversee test content across the platform."
      />

      <Tabs value={source} onValueChange={changeSource}>
        <TabsList aria-label="Test management collections">
          <TabsTrigger value="SYSTEM">System Library ({sourceCounts.system})</TabsTrigger>
          <TabsTrigger value="TEACHER">Teacher Tests ({sourceCounts.teacher})</TabsTrigger>
        </TabsList>
      </Tabs>

      <DataSurface aria-label={source === 'SYSTEM' ? 'System Library' : 'Teacher Tests'}>
        <AdminToolbar
          source={source}
          search={search}
          onSearch={value => updateQuery({ search: value || null })}
          subject={subject}
          onSubject={value => updateQuery({ subject: value })}
          mode={mode}
          onMode={value => updateQuery({ mode: value })}
          status={status}
          onStatus={value => updateQuery({ status: value })}
          integrity={integrity}
          onIntegrity={value => updateQuery({ integrity: value })}
          sort={sort}
          onSort={value => updateQuery({ sort: value })}
          view={view}
          onView={changeView}
          activeFilterCount={activeFilterCount}
          onReset={resetFilters}
          loading={loading}
          onRefresh={() => void refresh()}
          onCreate={() => navigate('/dashboard/practice-test/create')}
        />

        {error && !loading && tests.length === 0
          ? <EmptyState surface={false} icon={<RefreshCw size={21} />} title="Unable to load tests" description={error} action={<Button variant="outline" onClick={() => void refresh()}><RefreshCw data-icon="inline-start" />Try again</Button>} />
          : loading
            ? <AdminTestSkeleton view={view} />
            : tests.length === 0
              ? <EmptyState
                  surface={false}
                  icon={<BookOpen size={21} />}
                  title={source === 'SYSTEM' ? 'No system tests found' : 'No teacher tests found'}
                  description={activeFilterCount || search ? 'Adjust or clear the current filters.' : source === 'SYSTEM' ? 'Create the first platform-owned test for the System Library.' : 'Teacher-created tests will appear here.'}
                  action={activeFilterCount || search ? <Button variant="outline" onClick={resetFilters}><X data-icon="inline-start" />Clear filters</Button> : source === 'SYSTEM' ? <Button onClick={() => navigate('/dashboard/practice-test/create')}><Plus data-icon="inline-start" />Create test</Button> : undefined}
                />
              : view === 'GRID'
                ? <div className="grid grid-cols-1 gap-4 p-4 md:grid-cols-2 xl:grid-cols-3">{tests.map(test => <AdminTestCard key={test.id} test={test} source={source} working={workingId === test.id} actions={actions} />)}</div>
                : <AdminTestTable tests={tests} source={source} workingId={workingId} actions={actions} />}

        {!loading && pagination.total > 0 && <DataPagination>
          <p className="text-sm text-muted-foreground">Showing {resultSummary} tests</p>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => updateQuery({ page: String(Math.max(1, page - 1)) }, false)}><ChevronLeft data-icon="inline-start" />Prev</Button>
            <span className="min-w-24 text-center text-sm font-medium text-muted-foreground">Page {pagination.page} of {pagination.totalPages}</span>
            <Button variant="outline" size="sm" disabled={page >= pagination.totalPages} onClick={() => updateQuery({ page: String(page + 1) }, false)}>Next<ChevronRight data-icon="inline-end" /></Button>
          </div>
        </DataPagination>}
      </DataSurface>
    </main>

    <Modal
      open={Boolean(deleteTarget)}
      onClose={() => workingId === null && setDeleteTarget(null)}
      closeOnBackdrop={workingId === null}
      presentation="content-dialog"
      title="Delete system test?"
      subtitle={deleteTarget?.title}
      className="max-w-md!"
      footer={<><Button variant="outline" disabled={workingId !== null} onClick={() => setDeleteTarget(null)}>Cancel</Button><Button variant="destructive" disabled={workingId !== null} onClick={() => void remove()}>{workingId !== null ? 'Deleting…' : 'Delete permanently'}</Button></>}
    >
      <p className="text-sm leading-6 text-muted-foreground">Only unused system tests can be permanently deleted. Tests with classroom or attempt history must be archived.</p>
    </Modal>
  </div>;
}

interface ToolbarProps {
  source: AdminSource;
  search: string;
  onSearch: (value: string) => void;
  subject: SubjectFilter;
  onSubject: (value: SubjectFilter) => void;
  mode: ModeFilter;
  onMode: (value: ModeFilter) => void;
  status: StatusFilter;
  onStatus: (value: StatusFilter) => void;
  integrity: IntegrityFilter;
  onIntegrity: (value: IntegrityFilter) => void;
  sort: SortOrder;
  onSort: (value: SortOrder) => void;
  view: ViewMode;
  onView: (value: ViewMode) => void;
  activeFilterCount: number;
  onReset: () => void;
  loading: boolean;
  onRefresh: () => void;
  onCreate: () => void;
}

function AdminToolbar({ source, search, onSearch, subject, onSubject, mode, onMode, status, onStatus, integrity, onIntegrity, sort, onSort, view, onView, activeFilterCount, onReset, loading, onRefresh, onCreate }: ToolbarProps) {
  return <DataToolbar>
    <DataToolbarGroup>
      <DataToolbarSearch value={search} onChange={event => onSearch(event.target.value)} placeholder={source === 'TEACHER' ? 'Search tests or teachers…' : 'Search system tests…'} label="Search tests" />
      <FilterMenu label="Subject" value={subject} onChange={value => onSubject(value as SubjectFilter)} options={[['ALL', 'All subjects'], ['RW', 'Reading & Writing'], ['MATH', 'Math']]} />
      <FilterMenu label="Type" value={mode} onChange={value => onMode(value as ModeFilter)} options={[['ALL', 'All types'], ['PRACTICE', 'Practice'], ['EXAM', 'Exam']]} />
      <FilterMenu label="Status" value={status} onChange={value => onStatus(value as StatusFilter)} options={[['ALL', 'Published & draft'], ['PUBLISHED', 'Published'], ['DRAFT', 'Draft'], ['ARCHIVED', 'Archived']]} />
      {source === 'SYSTEM' && <FilterMenu label={integrity === 'ALL' ? 'Integrity' : integrityLabel[integrity]} value={integrity} onChange={value => onIntegrity(value as IntegrityFilter)} options={[['ALL', 'All integrity states'], ['NO_SECTIONS', 'No sections'], ['NO_QUESTIONS', 'No questions'], ['EMPTY_SECTION', 'Empty section']]} />}
      {activeFilterCount > 0 && <Button variant="destructive" size="sm" onClick={onReset}><X data-icon="inline-start" />Reset</Button>}
    </DataToolbarGroup>
    <DataToolbarActions>
      <FilterMenu icon={<ArrowUpDown />} label={sort === 'NEWEST' ? 'Newest' : 'Oldest'} value={sort} onChange={value => onSort(value as SortOrder)} options={[['NEWEST', 'Recently updated'], ['OLDEST', 'Oldest updated']]} align="end" />
      <div className="flex h-8 items-center rounded-lg border border-ui-border bg-background p-0.5" role="group" aria-label="Display mode">
        <Button variant="ghost" size="sm" className={cn('h-7 px-2', view === 'GRID' && 'bg-muted text-foreground')} onClick={() => onView('GRID')} aria-label="Card view" aria-pressed={view === 'GRID'}>{view === 'GRID' && <Check className="size-3" aria-hidden="true" />}<Grid2X2 aria-hidden="true" /></Button>
        <Button variant="ghost" size="sm" className={cn('h-7 px-2', view === 'LIST' && 'bg-muted text-foreground')} onClick={() => onView('LIST')} aria-label="List view" aria-pressed={view === 'LIST'}>{view === 'LIST' && <Check className="size-3" aria-hidden="true" />}<List aria-hidden="true" /></Button>
      </div>
      <Button variant="outline" size="icon-sm" onClick={onRefresh} disabled={loading} aria-label="Refresh tests"><RefreshCw className={cn(loading && 'animate-spin')} aria-hidden="true" /></Button>
      {source === 'SYSTEM' && <Button size="sm" onClick={onCreate}><Plus data-icon="inline-start" />Create test</Button>}
    </DataToolbarActions>
  </DataToolbar>;
}

function FilterMenu({ icon, label, value, onChange, options, align = 'start' }: { icon?: ReactNode; label: string; value: string; onChange: (value: string) => void; options: Array<[string, string]>; align?: 'start' | 'end' }) {
  const active = value !== 'ALL' && value !== 'NEWEST';
  return <DropdownMenu>
    <DropdownMenuTrigger asChild><Button variant="outline" size="sm" className={cn('border-dashed', active && 'border-solid bg-muted text-foreground')}>{icon || <SlidersHorizontal data-icon="inline-start" />}{label}</Button></DropdownMenuTrigger>
    <DropdownMenuContent align={align} className="w-52">
      <DropdownMenuLabel>{label}</DropdownMenuLabel>
      <DropdownMenuSeparator />
      <DropdownMenuRadioGroup value={value} onValueChange={onChange}>{options.map(([optionValue, optionLabel]) => <DropdownMenuRadioItem key={optionValue} value={optionValue}>{optionLabel}</DropdownMenuRadioItem>)}</DropdownMenuRadioGroup>
    </DropdownMenuContent>
  </DropdownMenu>;
}

function AdminTestTable({ tests, source, workingId, actions }: { tests: AdminTest[]; source: AdminSource; workingId: number | null; actions: TestActions }) {
  return <Table className="min-w-240">
    <TableHeader><TableRow className="hover:bg-transparent"><TableHead className="h-11 px-4 text-muted-foreground">Test</TableHead>{source === 'TEACHER' && <TableHead className="h-11 px-4 text-muted-foreground">Teacher</TableHead>}<TableHead className="h-11 px-4 text-muted-foreground">Status</TableHead><TableHead className="h-11 px-4 text-muted-foreground">Subject</TableHead><TableHead className="h-11 px-4 text-muted-foreground">Type</TableHead><TableHead className="h-11 px-4 text-muted-foreground">Questions</TableHead><TableHead className="h-11 px-4 text-muted-foreground">Usage</TableHead><TableHead className="h-11 px-4 text-muted-foreground">Updated</TableHead><TableHead className="h-11 px-4 text-right text-muted-foreground">Actions</TableHead></TableRow></TableHeader>
    <TableBody>{tests.map(test => <TableRow key={test.id} className="border-ui-border/60 hover:bg-muted/20"><TableCell className="max-w-88 px-4 py-3"><Button variant="ghost" className="h-auto max-w-full justify-start p-0 text-left hover:bg-transparent" onClick={() => actions.preview(test)}><span className="truncate font-medium" title={test.title}>{test.title}</span></Button></TableCell>{source === 'TEACHER' && <TableCell className="px-4 py-3 text-muted-foreground"><span className="inline-flex max-w-48 items-center gap-2"><UserRound className="size-4 shrink-0" /><span className="truncate">{test.author?.name || 'Unknown teacher'}</span></span></TableCell>}<TableCell className="px-4 py-3"><StatusBadge status={test.status} /></TableCell><TableCell className="px-4 py-3 text-muted-foreground">{subjectLabel[test.subject]}</TableCell><TableCell className="px-4 py-3 text-muted-foreground">{modeLabel[test.mode]}</TableCell><TableCell className="px-4 py-3 text-muted-foreground">{test.questionCount}</TableCell><TableCell className="px-4 py-3 text-muted-foreground">{usageLabel(test)}</TableCell><TableCell className="px-4 py-3 text-muted-foreground">{relativeTime(test.updatedAt)}</TableCell><TableCell className="px-4 py-3 text-right"><TestActionMenu test={test} source={source} working={workingId === test.id} actions={actions} /></TableCell></TableRow>)}</TableBody>
  </Table>;
}

function AdminTestCard({ test, source, working, actions }: { test: AdminTest; source: AdminSource; working: boolean; actions: TestActions }) {
  const primary = source === 'TEACHER'
    ? <Button className="w-full" disabled={working} onClick={() => actions.copyToSystem(test)}>{working ? <LoaderCircle className="animate-spin" /> : <Copy />}Copy to System Library</Button>
    : test.capabilities.canEdit
      ? <Button className="w-full" disabled={working} onClick={() => actions.edit(test)}><Pencil />Edit test</Button>
      : <Button className="w-full" variant="outline" disabled={working} onClick={() => actions.preview(test)}><Play />Preview</Button>;
  return <Card className="flex h-full flex-col gap-0 py-0 shadow-none">
    <CardHeader className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 px-4 pb-0 pt-4"><div className="min-w-0"><CardTitle className="line-clamp-2 text-sm font-medium">{test.title}</CardTitle><p className="mt-1 text-xs text-muted-foreground">{subjectLabel[test.subject]} · {modeLabel[test.mode]}</p></div><TestActionMenu test={test} source={source} working={working} actions={actions} /></CardHeader>
    <CardContent className="px-4 py-4"><div className="mb-3 flex flex-wrap items-center gap-2"><StatusBadge status={test.status} />{source === 'TEACHER' && <Badge variant="outline" className="rounded-sm font-medium"><UserRound />{test.author?.name || 'Unknown teacher'}</Badge>}</div><ul className="space-y-2 text-sm text-muted-foreground"><li className="flex items-center gap-2"><BookOpen className="size-4" />{test.questionCount} questions</li><li className="flex items-center gap-2"><Clock3 className="size-4" />{test.duration} minutes</li><li className="flex items-center gap-2"><History className="size-4" />{usageLabel(test)}</li></ul></CardContent>
    <CardFooter className="mt-auto grid gap-2 border-t border-ui-border bg-muted/20 p-3">{primary}{!(source === 'SYSTEM' && !test.capabilities.canEdit) && <Button variant="outline" className="w-full" disabled={working} onClick={() => actions.preview(test)}><Play />Preview</Button>}</CardFooter>
  </Card>;
}

function TestActionMenu({ test, source, working, actions }: { test: AdminTest; source: AdminSource; working: boolean; actions: TestActions }) {
  return <DropdownMenu>
    <DropdownMenuTrigger asChild><Button variant="ghost" size="icon-sm" className="text-muted-foreground data-[state=open]:bg-muted" disabled={working} aria-label={`Actions for ${test.title}`}><MoreHorizontal /><span className="sr-only">Open menu</span></Button></DropdownMenuTrigger>
    <DropdownMenuContent align="end" className="w-48">
      <DropdownMenuItem onSelect={() => actions.preview(test)}><Play />Preview</DropdownMenuItem>
      {source === 'TEACHER'
        ? <DropdownMenuItem onSelect={() => actions.copyToSystem(test)}><Copy />Copy to System Library</DropdownMenuItem>
        : <>
            {test.capabilities.canEdit && <DropdownMenuItem onSelect={() => actions.edit(test)}><Pencil />Edit</DropdownMenuItem>}
            {test.capabilities.canDuplicate && <DropdownMenuItem onSelect={() => actions.duplicate(test)}><Copy />Duplicate</DropdownMenuItem>}
            <DropdownMenuSeparator />
            {test.status === 'DRAFT' && <DropdownMenuItem onSelect={() => actions.setStatus(test, 'PUBLISHED')}><Check />Publish</DropdownMenuItem>}
            {test.status === 'PUBLISHED' && <DropdownMenuItem onSelect={() => actions.setStatus(test, 'DRAFT')}><FilePenLine />Move to Draft</DropdownMenuItem>}
            {test.capabilities.canArchive && <DropdownMenuItem onSelect={() => actions.setStatus(test, 'ARCHIVED')}><Archive />Archive</DropdownMenuItem>}
            {test.capabilities.canRestore && <DropdownMenuItem onSelect={() => actions.setStatus(test, 'PUBLISHED')}><RotateCcw />Restore</DropdownMenuItem>}
            {test.capabilities.canDelete && <><DropdownMenuSeparator /><DropdownMenuItem variant="destructive" onSelect={() => actions.delete(test)}><Trash2 />Delete permanently</DropdownMenuItem></>}
          </>}
    </DropdownMenuContent>
  </DropdownMenu>;
}

function StatusBadge({ status }: { status: TestStatus }) {
  const Icon = status === 'PUBLISHED' ? Check : status === 'DRAFT' ? FilePenLine : Archive;
  return <Badge variant="outline" className={cn('gap-1.5 rounded-sm font-medium', status === 'PUBLISHED' && 'border-success/30 bg-success-soft text-success', status === 'DRAFT' && 'bg-muted text-muted-foreground', status === 'ARCHIVED' && 'border-warning/30 bg-warning-soft text-warning')}><Icon />{statusLabel[status]}</Badge>;
}

function AdminTestSkeleton({ view }: { view: ViewMode }) {
  if (view === 'GRID') return <div className="grid grid-cols-1 gap-4 p-4 md:grid-cols-2 xl:grid-cols-3">{[1, 2, 3, 4, 5, 6].map(item => <Card key={item} className="h-60 animate-pulse bg-muted/60 shadow-none" />)}</div>;
  return <div className="animate-pulse"><div className="h-11 border-b border-ui-border bg-muted/50" />{[1, 2, 3, 4, 5].map(item => <div key={item} className="flex h-14 items-center gap-6 border-b border-ui-border px-4 last:border-0"><span className="h-4 w-64 rounded-sm bg-muted" /><span className="h-5 w-20 rounded-sm bg-muted" /><span className="ml-auto h-7 w-7 rounded-lg bg-muted" /></div>)}</div>;
}

const usageLabel = (test: AdminTest) => {
  const deliveries = test.usage.deliveries + test.usage.legacyClassLinks;
  if (!deliveries && !test.usage.attempts) return 'Not used';
  return `${deliveries} ${deliveries === 1 ? 'delivery' : 'deliveries'} · ${test.usage.attempts} ${test.usage.attempts === 1 ? 'attempt' : 'attempts'}`;
};

const relativeTime = (value: string) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Recently' : formatDistanceToNow(date, { addSuffix: true });
};

const errorMessage = (error: unknown, fallback: string) => (error as { response?: { data?: { error?: string } } })?.response?.data?.error || fallback;
