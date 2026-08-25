import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BookOpen, BookOpenCheck, ChevronLeft, ChevronRight, Clock3, GraduationCap, MoreHorizontal, Pencil, Play, Plus, Search, SlidersHorizontal, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { Checkbox } from '@/components/ui/checkbox';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import axiosClient from '../../lib/axios';
import { capitalizeFirstLetter } from '../../utils/text';
import { SatCountdown } from '../../features/sat-countdown/SatCountdown';
import { DateTimePicker } from '../../components/ui/DateTimePicker';
import { Badge, Button, Card, EmptyState, Input, Modal, PageHeader, Select } from '../../components/ui/AppUI';
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
interface PaginationMeta { page: number; pageSize: number; total: number; totalPages: number }
interface TestPage { items: TestItem[]; pagination: PaginationMeta }

const subjectLabel: Record<TestItem['subject'], string> = {
  RW: 'RW',
  MATH: 'Math',
};

const typeLabel: Record<TestItem['mode'], string> = {
  PRACTICE: 'Practice',
  EXAM: 'Test',
};

const formatLastAttempt = (value?: string | null) => {
  if (!value) return 'Never';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Never';
  const elapsed = Math.max(0, Date.now() - date.getTime());
  const minutes = Math.floor(elapsed / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} day${days === 1 ? '' : 's'} ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

const PracticeTest = () => {
  const navigate = useNavigate();
  const role = (localStorage.getItem('userRole') || 'STUDENT') as UserRole;
  const canManage = role === 'TEACHER' || role === 'ADMIN';

  const [tests, setTests] = useState<TestItem[]>([]);
  const [classes, setClasses] = useState<ClassInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [subject, setSubject] = useState<'ALL' | TestItem['subject']>('ALL');
  const [type, setType] = useState<'ALL' | TestItem['mode']>('ALL');
  const [sortOrder, setSortOrder] = useState<'NEWEST' | 'OLDEST'>('NEWEST');
  const [classFilter, setClassFilter] = useState('ALL');
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

  const loadData = useCallback(async (force = false) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: '24', sort: sortOrder });
      if (debouncedSearch.trim()) params.set('search', debouncedSearch.trim());
      if (subject !== 'ALL') params.set('subject', subject);
      if (type !== 'ALL') params.set('mode', type);
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
      toast.error('Unable to load Practice Center');
    } finally {
      setLoading(false);
    }
  }, [classFilter, debouncedSearch, page, sortOrder, subject, type]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const openTest = useCallback((test: TestItem, context?: { classId?: string; deliveryId?: string }) => {
    localStorage.setItem('current_exam_info', JSON.stringify({
      id: test.id,
      title: test.title,
      description: test.description,
      duration: test.duration,
    }));
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

  const toggleTest = (testId: number) => {
    setSelectedTestIds(current => current.includes(testId) ? current.filter(id => id !== testId) : [...current, testId]);
  };

  const toggleClass = (classId: string) => {
    setSelectedClassIds(current => current.includes(classId) ? current.filter(id => id !== classId) : [...current, classId]);
  };

  const assignTests = async () => {
    if (selectedTestIds.length === 0 || selectedClassIds.length === 0) {
      toast.error('Select at least one test and one class');
      return;
    }
    setAssigning(true);
    try {
      await axiosClient.post('/api/tests/assign', {
        testIds: selectedTestIds,
        classIds: selectedClassIds,
        availableAt: availableAt ? new Date(availableAt).toISOString() : null,
        dueAt: dueAt ? new Date(dueAt).toISOString() : null,
        maxAttempts,
        scorePolicy,
      });
      toast.success(`Assigned ${selectedTestIds.length} test(s) to ${selectedClassIds.length} class(es)`);
      setAssignmentOpen(false);
      setSelectionMode(false);
      setSelectedTestIds([]);
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

  return (
    <div className="h-full overflow-y-auto">
      <main className="mx-auto flex w-full max-w-screen-2xl flex-col gap-4 p-4 md:p-6">
        <PageHeader title="Practice Center" description="Browse and attempt SAT practice tests." actions={<SatCountdown />} />
          <Card className="mb-6 p-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <label className="relative min-w-0 max-w-md flex-1">
                <Search size={16} className="pointer-events-none absolute left-3 top-1/2 z-10 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                <Input value={search} onChange={event => { setSearch(event.target.value); setPage(1); }} placeholder="Search tests..." aria-label="Search tests" className="w-full pl-9" />
              </label>
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2">
                  <span className="whitespace-nowrap text-body font-medium text-foreground">Sort by:</span>
                  <Select value={sortOrder} onChange={event => { setSortOrder(event.target.value as 'NEWEST' | 'OLDEST'); setPage(1); }}>
                    <option value="NEWEST">Newest</option>
                    <option value="OLDEST">Oldest</option>
                  </Select>
                </div>
                {canManage && (
                  selectionMode ? (
                    <>
                      <Button variant="outline"
                        onClick={() => { setSelectionMode(false); setSelectedTestIds([]); }}
                      >
                        Cancel
                      </Button>
                      <Button disabled={selectedTestIds.length === 0} onClick={() => setAssignmentOpen(true)}>
                        <GraduationCap size={16} /> Assign selected{selectedTestIds.length > 0 ? ` (${selectedTestIds.length})` : ''}
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button variant="outline" onClick={() => setSelectionMode(true)}>
                        <GraduationCap size={16} /> Assign tests
                      </Button>
                      <Button onClick={() => navigate('/dashboard/practice-test/create')}>
                        <Plus size={16} /> Create Exam
                      </Button>
                    </>
                  )
                )}
              </div>
            </div>
            <div className="mt-4 flex flex-col gap-3 border-t border-ui-border pt-4 lg:flex-row lg:items-center">
              <div className="flex items-center gap-1.5 overflow-x-auto">
                <SlidersHorizontal size={15} className="mr-1 shrink-0 text-muted-foreground" aria-hidden="true" />
                <span className="mr-1 text-caption font-medium text-muted-foreground">Subject:</span>
                {(['ALL', 'RW', 'MATH'] as const).map(value => (
                  <Button key={value} size="sm" variant={subject === value ? 'primary' : 'outline'} onClick={() => { setSubject(value); setPage(1); }} aria-pressed={subject === value}>
                    {value === 'ALL' ? 'All' : subjectLabel[value]}
                  </Button>
                ))}
              </div>
              <div className="flex items-center gap-1.5 overflow-x-auto">
                <span className="mr-1 text-caption font-medium text-muted-foreground">Type:</span>
                {(['ALL', 'EXAM', 'PRACTICE'] as const).map(value => (
                  <Button key={value} size="sm" variant={type === value ? 'primary' : 'outline'} onClick={() => { setType(value); setPage(1); }} aria-pressed={type === value}>
                    {value === 'ALL' ? 'All' : typeLabel[value]}
                  </Button>
                ))}
              </div>
              {classes.length > 0 && (
                <Select value={classFilter} onChange={event => { setClassFilter(event.target.value); setPage(1); }} className="lg:ml-auto">
                  <option value="ALL">All classes</option>
                  {classes.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
                </Select>
              )}
            </div>
          </Card>

          {loading ? (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {[1, 2, 3, 4, 5, 6].map(item => <Card key={item} className="h-[280px] animate-pulse p-5"><div className="mb-8 h-8 w-20 rounded-full bg-muted" /><div className="mb-3 h-5 w-2/3 rounded-sm bg-muted" /><div className="h-4 w-full rounded-sm bg-muted" /></Card>)}
            </div>
          ) : tests.length === 0 ? (
            <EmptyState icon={<BookOpenCheck size={22} />} title="No matching tests" description={canManage ? 'Create your first exam or adjust the current filters.' : 'Your teacher has not assigned a test to your class yet. Admin tests appear here automatically.'} className="min-h-[360px]" />
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {tests.map(test => {
                const selected = selectedTestIds.includes(test.id);
                const hasPartialProgress = test.progress > 0 && test.progress < 100;
                return (
                  <article key={test.id} className={`group relative flex transform-gpu flex-col gap-3 rounded-card border bg-surface p-5 shadow-card transition-[transform,border-color,box-shadow] duration-200 ease-out hover:-translate-y-0.5 hover:border-primary/45 hover:shadow-elevated ${selected ? 'border-primary ring-2 ring-primary/15' : 'border-ui-border'}`}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex flex-wrap gap-1.5">
                        <Badge tone={test.subject === 'MATH' ? 'gold' : 'green'}>{subjectLabel[test.subject]}</Badge>
                        <Badge>{typeLabel[test.mode]}</Badge>
                      </div>
                      {canManage && (selectionMode ? (
                        <Checkbox checked={selected} onCheckedChange={() => toggleTest(test.id)} aria-label={selected ? 'Deselect test' : 'Select test'} />
                      ) : (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8" aria-label={`Actions for ${test.title}`}><MoreHorizontal size={16} /></Button></DropdownMenuTrigger>
                          <DropdownMenuContent align="end"><DropdownMenuItem onSelect={() => navigate(`/dashboard/practice-test/create?edit=${test.id}`)}><Pencil />Edit</DropdownMenuItem><DropdownMenuSeparator /><DropdownMenuItem variant="destructive" onSelect={() => setDeleteTarget(test)}><Trash2 />Delete</DropdownMenuItem></DropdownMenuContent>
                        </DropdownMenu>
                      ))}
                    </div>

                    <h3 className="line-clamp-2 text-body font-semibold leading-snug text-foreground">{test.title}</h3>

                    <div>
                      <div className="mb-1 flex justify-between text-caption text-muted-foreground">
                        <span>{test.attemptStatus === 'COMPLETED' ? 'Completed' : test.isDoing ? 'In progress' : 'Not started'}</span>
                        <span>{test.progress ?? 0}%</span>
                      </div>
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                        <div className="h-full rounded-full bg-primary transition-all duration-300" style={{ width: `${test.progress ?? 0}%` }} />
                      </div>
                    </div>

                    <div className="flex items-center gap-3 text-caption text-muted-foreground">
                      <span className="flex items-center gap-1"><BookOpen size={12} /> {test.questionCount ?? 0}Q</span>
                      <span className="flex items-center gap-1"><Clock3 size={12} /> {Math.floor(test.duration)}m</span>
                    </div>

                    <p className="text-caption text-muted-foreground/80">Last attempted {formatLastAttempt(test.lastAttempt)}</p>

                    <Button onClick={() => handleStart(test)} variant={hasPartialProgress ? 'outline' : 'accent'} className="mt-auto w-full">
                      {hasPartialProgress ? <><Play size={13} /> Continue</> : <><Play size={13} /> Start <ChevronRight size={13} /></>}
                    </Button>
                  </article>
                );
              })}
            </div>
          )}
          {!loading && pagination.total > 0 && (
            <div className="mt-6 flex flex-col items-center justify-between gap-3 border-t border-ui-border pt-4 sm:flex-row">
              <p className="text-caption text-muted-foreground">
                Showing {(pagination.page - 1) * pagination.pageSize + 1}–{Math.min(pagination.page * pagination.pageSize, pagination.total)} of {pagination.total} tests
              </p>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(current => Math.max(1, current - 1))}><ChevronLeft size={15} />Previous</Button>
                <span className="min-w-20 text-center text-caption font-medium text-subtle">Page {pagination.page} of {pagination.totalPages}</span>
                <Button variant="outline" size="sm" disabled={page >= pagination.totalPages} onClick={() => setPage(current => current + 1)}>Next<ChevronRight size={15} /></Button>
              </div>
            </div>
          )}
      </main>

      <Modal
        open={assignmentOpen}
        onClose={() => setAssignmentOpen(false)}
        closeOnBackdrop
        presentation="content-dialog"
        title="Assign tests to classes"
        subtitle={`${selectedTestIds.length} test(s) selected`}
        className="max-w-lg!"
        footer={<><Button variant="outline" onClick={() => setAssignmentOpen(false)}>Cancel</Button><Button disabled={assigning || selectedClassIds.length === 0} onClick={assignTests}>{assigning ? 'Assigning...' : `Assign to ${selectedClassIds.length} class(es)`}</Button></>}
      >
            <div className="max-h-[520px] space-y-5 overflow-y-auto">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <label className="space-y-1.5 text-xs font-medium text-subtle">Available from<DateTimePicker value={availableAt} onChange={setAvailableAt} placeholder="Choose availability" ariaLabel="Available from" /></label>
                <label className="space-y-1.5 text-xs font-medium text-subtle">Deadline<DateTimePicker value={dueAt} minDate={availableAt || undefined} onChange={setDueAt} placeholder="Choose deadline" ariaLabel="Assignment deadline" /></label>
                <label className="space-y-1.5 text-xs font-medium text-subtle">Attempts<Input type="number" min={1} max={10} value={maxAttempts} onChange={event => setMaxAttempts(Math.min(10, Math.max(1, Number(event.target.value))))} className="w-full" /></label>
                <label className="space-y-1.5 text-xs font-medium text-subtle">Score policy<Select value={scorePolicy} onChange={event => setScorePolicy(event.target.value as typeof scorePolicy)} className="w-full"><option value="FIRST">First attempt</option><option value="BEST">Best attempt</option><option value="LATEST">Latest attempt</option></Select></label>
              </div>
              <div className="border-t pt-5">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Classes</p>
              {classes.length === 0 ? <p className="rounded-lg bg-muted p-5 text-center text-sm text-muted-foreground">You do not have any classes yet.</p> : classes.map(item => {
                const checked = selectedClassIds.includes(item.id);
                return <label key={item.id} className={`flex cursor-pointer items-center gap-4 rounded-lg border p-4 transition-colors ${checked ? 'border-primary bg-accent' : 'hover:bg-muted/50'}`}><Checkbox checked={checked} onCheckedChange={() => toggleClass(item.id)} /><span className="flex size-9 items-center justify-center rounded-lg bg-muted text-muted-foreground"><GraduationCap size={18} /></span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium text-foreground">{item.name}</span><span className="mt-1 block text-xs text-muted-foreground">{item._count?.students || 0} student(s)</span></span></label>;
              })}</div>
            </div>
      </Modal>

      <Modal open={Boolean(startClassTest)} onClose={() => setStartClassTest(null)} closeOnBackdrop presentation="content-dialog" title="Choose a class" subtitle={startClassTest?.title} className="max-w-md!">
            {startClassTest && <div className="space-y-2">{(startClassTest.deliveries || []).length > 0
              ? startClassTest.deliveries?.map(delivery => <Button key={delivery.id} variant="outline" onClick={() => openTest(startClassTest, { deliveryId: delivery.id })} className="h-auto w-full justify-between p-4 text-left"><span><span className="block">{capitalizeFirstLetter(delivery.class.name)}</span><span className="mt-1 block text-xs font-normal text-muted-foreground">{delivery.dueAt ? `Due ${new Date(delivery.dueAt).toLocaleString()}` : 'No deadline'}</span></span><ChevronRight size={17} /></Button>)
              : [...new Set((startClassTest.classTests || []).map(item => item.classId))].map(classId => <Button key={classId} variant="outline" onClick={() => openTest(startClassTest, { classId })} className="h-auto w-full justify-between p-4 text-left">{classes.find(item => item.id === classId)?.name || 'Class'}<ChevronRight size={17} /></Button>)}</div>}
      </Modal>

      <Modal open={Boolean(deleteTarget)} onClose={() => !deleting && setDeleteTarget(null)} closeOnBackdrop={!deleting} title="Delete exam?" subtitle={deleteTarget?.title} className="max-w-md!">
        <div className="space-y-5">
          <p className="text-sm leading-6 text-muted-foreground">This permanently deletes the exam, its assignments, and any student attempt data associated with it. This action cannot be undone.</p>
          <div className="flex justify-end gap-2 border-t pt-4"><Button variant="outline" disabled={deleting} onClick={() => setDeleteTarget(null)}>Cancel</Button><Button variant="destructive" disabled={deleting} onClick={deleteTest}>{deleting ? 'Deleting…' : 'Delete exam'}</Button></div>
        </div>
      </Modal>
    </div>
  );
};

export default PracticeTest;
