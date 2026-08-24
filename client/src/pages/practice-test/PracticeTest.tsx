import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, BookOpen, BookOpenCheck, Check, ChevronRight, Clock3, GraduationCap, MoreHorizontal, Pencil, Play, Plus, Search, SlidersHorizontal, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import axiosClient from '../../lib/axios';
import { capitalizeFirstLetter } from '../../utils/text';
import { SatCountdown } from '../../features/sat-countdown/SatCountdown';
import { DateTimePicker } from '../../components/ui/DateTimePicker';
import { Button, Input, Modal, Select } from '../../components/ui/AppUI';

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
  const userName = localStorage.getItem('userName') || 'Student';
  const canManage = role === 'TEACHER' || role === 'ADMIN';
  const initials = userName.split(/\s+/).filter(Boolean).slice(-2).map(part => part[0]).join('').toUpperCase() || 'ST';

  const [tests, setTests] = useState<TestItem[]>([]);
  const [classes, setClasses] = useState<ClassInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [subject, setSubject] = useState<'ALL' | TestItem['subject']>('ALL');
  const [type, setType] = useState<'ALL' | TestItem['mode']>('ALL');
  const [sortOrder, setSortOrder] = useState<'NEWEST' | 'OLDEST'>('NEWEST');
  const [classFilter, setClassFilter] = useState('ALL');
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
  const [openActionTestId, setOpenActionTestId] = useState<number | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<TestItem | null>(null);
  const [deleting, setDeleting] = useState(false);
  const actionMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (openActionTestId === null) return;
    const closeMenu = (event: PointerEvent) => {
      if (!actionMenuRef.current?.contains(event.target as Node)) setOpenActionTestId(null);
    };
    document.addEventListener('pointerdown', closeMenu);
    return () => document.removeEventListener('pointerdown', closeMenu);
  }, [openActionTestId]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [testData, classData] = await Promise.all([
        axiosClient.get<TestItem[], TestItem[]>('/api/tests'),
        axiosClient.get<ClassInfo[], ClassInfo[]>('/api/tests/classes'),
      ]);
      setTests(testData.map(test => ({ ...test, title: capitalizeFirstLetter(test.title) })));
      setClasses(classData.map(classroom => ({ ...classroom, name: capitalizeFirstLetter(classroom.name) })));
    } catch (error) {
      console.error(error);
      toast.error('Unable to load Practice Center');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const filteredTests = useMemo(() => {
    const keyword = search.trim().toLocaleLowerCase();
    return tests.filter(test => {
      if (keyword && !`${test.title} ${test.description || ''}`.toLocaleLowerCase().includes(keyword)) return false;
      if (subject !== 'ALL' && test.subject !== subject) return false;
      if (type !== 'ALL' && test.mode !== type) return false;
      if (classFilter !== 'ALL' && !test.classTests?.some(item => item.classId === classFilter)) return false;
      return true;
    }).sort((first, second) => sortOrder === 'NEWEST' ? second.id - first.id : first.id - second.id);
  }, [classFilter, search, sortOrder, subject, tests, type]);

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
      await loadData();
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
      setTests(current => current.filter(test => test.id !== deleteTarget.id));
      setDeleteTarget(null);
      toast.success('Exam deleted');
    } catch (error: unknown) {
      const requestError = error as { response?: { data?: { error?: string } } };
      toast.error(requestError.response?.data?.error || 'Unable to delete this exam');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col bg-[#F2F8F5] text-[#1A1A1A]">
      <header className="sticky top-0 z-30 flex h-[60px] shrink-0 items-center justify-between border-b border-[#E2EDE9] bg-white px-6">
        <div>
          <h1 className="text-base font-semibold leading-tight">Practice Center</h1>
          <p className="mt-0.5 text-xs leading-tight text-[#6B7280]">Browse and attempt SAT practice tests</p>
        </div>
        <div className="flex items-center gap-5">
          <SatCountdown />
          <button className="relative shrink-0 text-[#6B7280] transition-colors hover:text-[#1A1A1A]" aria-label="Notifications">
            <Bell size={20} />
            <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-red-500 ring-2 ring-white" />
          </button>
          <div className="flex h-8 min-h-8 w-8 min-w-8 shrink-0 select-none items-center justify-center rounded-full bg-[#1B7A5A] text-xs font-semibold text-white ring-2 ring-transparent ring-offset-2 ring-offset-white transition-[box-shadow] hover:ring-[#1B7A5A]/30" title={userName}>
            {initials}
          </div>
        </div>
      </header>

      <main className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-[1200px] p-6 lg:p-8 lg:pt-6">
          <section className="mb-8 rounded-xl border border-[#E2EDE9] bg-white p-4 shadow-sm">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <label className="flex h-9 min-w-0 max-w-md flex-1 items-center gap-2.5 rounded-lg border border-[#E2EDE9] bg-[#F2F8F5] px-3 focus-within:border-[#1B7A5A] focus-within:bg-white focus-within:ring-2 focus-within:ring-[#1B7A5A]/20">
                <Search size={15} className="shrink-0 text-[#6B7280]" />
                <input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search tests..." className="h-full w-full bg-transparent text-sm outline-none placeholder:text-[#6B7280]" />
              </label>
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2">
                  <span className="whitespace-nowrap text-sm font-medium text-[#1A1A1A]">Sort by:</span>
                  <Select value={sortOrder} onChange={event => setSortOrder(event.target.value as 'NEWEST' | 'OLDEST')}>
                    <option value="NEWEST">Newest</option>
                    <option value="OLDEST">Oldest</option>
                  </Select>
                </div>
                {canManage && (
                  selectionMode ? (
                    <>
                      <button
                        onClick={() => { setSelectionMode(false); setSelectedTestIds([]); }}
                        className="app-button app-button-secondary"
                      >
                        Cancel
                      </button>
                      <button disabled={selectedTestIds.length === 0} onClick={() => setAssignmentOpen(true)} className="app-button app-button-primary">
                        <GraduationCap size={16} /> Assign selected{selectedTestIds.length > 0 ? ` (${selectedTestIds.length})` : ''}
                      </button>
                    </>
                  ) : (
                    <>
                      <button onClick={() => setSelectionMode(true)} className="app-button app-button-secondary">
                        <GraduationCap size={16} /> Assign tests
                      </button>
                      <button onClick={() => navigate('/dashboard/practice-test/create')} className="app-button app-button-primary">
                        <Plus size={16} /> Create Exam
                      </button>
                    </>
                  )
                )}
              </div>
            </div>
            <div className="mt-4 flex flex-col gap-3 border-t border-[#E2EDE9] pt-4 lg:flex-row lg:items-center">
              <div className="flex items-center gap-1.5 overflow-x-auto">
                <SlidersHorizontal size={15} className="mr-1 shrink-0 text-[#6B7280]" />
                <span className="mr-1 text-xs font-medium text-[#6B7280]">Subject:</span>
                {(['ALL', 'RW', 'MATH'] as const).map(value => (
                  <button key={value} onClick={() => setSubject(value)} className={`h-7 whitespace-nowrap rounded-full border px-3 text-xs font-medium transition-colors ${subject === value ? 'border-[#1B7A5A] bg-[#1B7A5A] text-white' : 'border-[#1B7A5A] bg-white text-[#1B7A5A] hover:bg-[#E8F5EF]'}`}>
                    {value === 'ALL' ? 'All' : subjectLabel[value]}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-1.5 overflow-x-auto">
                <span className="mr-1 text-xs font-medium text-[#6B7280]">Type:</span>
                {(['ALL', 'EXAM', 'PRACTICE'] as const).map(value => (
                  <button key={value} onClick={() => setType(value)} className={`h-7 whitespace-nowrap rounded-full border px-3 text-xs font-medium transition-colors ${type === value ? 'border-[#1B7A5A] bg-[#1B7A5A] text-white' : 'border-[#1B7A5A] bg-white text-[#1B7A5A] hover:bg-[#E8F5EF]'}`}>
                    {value === 'ALL' ? 'All' : typeLabel[value]}
                  </button>
                ))}
              </div>
              {classes.length > 0 && (
                <Select value={classFilter} onChange={event => setClassFilter(event.target.value)} className="lg:ml-auto">
                  <option value="ALL">All classes</option>
                  {classes.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
                </Select>
              )}
            </div>
          </section>

          {loading ? (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {[1, 2, 3, 4, 5, 6].map(item => <div key={item} className="h-[280px] animate-pulse rounded-xl border border-[#E2EDE9] bg-white p-5"><div className="mb-8 h-8 w-20 rounded-full bg-[#EAF2EE]" /><div className="mb-3 h-5 w-2/3 rounded bg-[#EAF2EE]" /><div className="h-4 w-full rounded bg-[#EAF2EE]" /></div>)}
            </div>
          ) : filteredTests.length === 0 ? (
            <div className="flex min-h-[360px] flex-col items-center justify-center rounded-xl border border-dashed border-[#C2DDD4] bg-white px-6 text-center">
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-[#E8F5EF] text-[#1B7A5A]"><BookOpenCheck size={26} /></div>
              <h3 className="font-semibold text-[#1A1A1A]">No matching tests</h3>
              <p className="mt-2 max-w-sm text-sm leading-6 text-[#6B7280]">{canManage ? 'Create your first exam or adjust the current filters.' : 'Your teacher has not assigned a test to your class yet. Admin tests appear here automatically.'}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {filteredTests.map(test => {
                const selected = selectedTestIds.includes(test.id);
                const hasPartialProgress = test.progress > 0 && test.progress < 100;
                return (
                  <article key={test.id} className={`group relative flex transform-gpu flex-col gap-3 rounded-xl border bg-white p-5 shadow-sm transition-[transform,border-color,box-shadow] duration-200 ease-out hover:-translate-y-0.5 hover:border-[#1B7A5A]/45 hover:shadow-[0_6px_16px_rgba(15,77,56,0.12)] ${selected ? 'border-[#1B7A5A] ring-2 ring-[#1B7A5A]/15' : 'border-[#E2EDE9]'}`}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex flex-wrap gap-1.5">
                        <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${test.subject === 'MATH' ? 'border-[#F0D070] bg-[#FEF9E7] text-[#92640A]' : 'border-[#C2DDD4] bg-[#E8F5EF] text-[#1B7A5A]'}`}>
                          {subjectLabel[test.subject]}
                        </span>
                        <span className="rounded-full border border-[#E5E7EB] bg-[#F9FAFB] px-2 py-0.5 text-[11px] text-[#6B7280]">
                          {typeLabel[test.mode]}
                        </span>
                      </div>
                      {canManage && (selectionMode ? (
                        <button onClick={() => toggleTest(test.id)} className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border transition-colors ${selected ? 'border-[#1B7A5A] bg-[#1B7A5A] text-white' : 'border-[#C2DDD4] bg-white text-transparent hover:border-[#1B7A5A]'}`} aria-label={selected ? 'Deselect test' : 'Select test'}>
                          <Check size={15} strokeWidth={3} />
                        </button>
                      ) : (
                        <div className="relative" ref={openActionTestId === test.id ? actionMenuRef : undefined}>
                          <button onClick={() => setOpenActionTestId(current => current === test.id ? null : test.id)} className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[#6B7280] transition-colors hover:bg-[#EAF2EE] hover:text-[#1A1A1A]" aria-label={`Actions for ${test.title}`} aria-haspopup="menu" aria-expanded={openActionTestId === test.id}>
                            <MoreHorizontal size={16} />
                          </button>
                          {openActionTestId === test.id && <div role="menu" className="absolute right-0 top-9 z-20 w-36 overflow-hidden rounded-lg border border-[#C9D8D2] bg-white py-1 shadow-lg">
                            <button role="menuitem" onClick={() => navigate(`/dashboard/practice-test/create?edit=${test.id}`)} className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-medium text-[#374151] hover:bg-[#EAF2EE]"><Pencil size={14} />Edit</button>
                            <button role="menuitem" onClick={() => { setOpenActionTestId(null); setDeleteTarget(test); }} className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-medium text-red-700 hover:bg-red-50"><Trash2 size={14} />Delete</button>
                          </div>}
                        </div>
                      ))}
                    </div>

                    <h3 className="line-clamp-2 text-sm font-medium leading-snug text-[#1A1A1A]">{test.title}</h3>

                    <div>
                      <div className="mb-1 flex justify-between text-xs text-[#6B7280]">
                        <span>{test.attemptStatus === 'COMPLETED' ? 'Completed' : test.isDoing ? 'In progress' : 'Not started'}</span>
                        <span>{test.progress ?? 0}%</span>
                      </div>
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#EAF2EE]">
                        <div className="h-full rounded-full bg-[#1B7A5A] transition-all duration-300" style={{ width: `${test.progress ?? 0}%` }} />
                      </div>
                    </div>

                    <div className="flex items-center gap-3 text-xs text-[#6B7280]">
                      <span className="flex items-center gap-1"><BookOpen size={12} /> {test.questionCount ?? 0}Q</span>
                      <span className="flex items-center gap-1"><Clock3 size={12} /> {Math.floor(test.duration)}m</span>
                    </div>

                    <p className="text-xs text-[#6B7280]/70">Last attempted {formatLastAttempt(test.lastAttempt)}</p>

                    <button onClick={() => handleStart(test)} className={`mt-auto flex h-9 w-full items-center justify-center gap-1.5 rounded-lg px-4 text-xs font-medium transition-all duration-150 group-hover:gap-2 ${hasPartialProgress ? 'border border-[#1B7A5A] bg-white text-[#1B7A5A] hover:bg-[#E8F5EF]' : 'bg-[#E8C040] text-[#1A1A1A] hover:bg-[#D9B138]'}`}>
                      {hasPartialProgress ? <><Play size={13} /> Continue</> : <><Play size={13} /> Start <ChevronRight size={13} /></>}
                    </button>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </main>

      <Modal
        open={assignmentOpen}
        onClose={() => setAssignmentOpen(false)}
        closeOnBackdrop
        presentation="content-dialog"
        title="Assign tests to classes"
        subtitle={`${selectedTestIds.length} test(s) selected`}
        className="!max-w-lg"
        footer={<><Button variant="outline" onClick={() => setAssignmentOpen(false)}>Cancel</Button><Button disabled={assigning || selectedClassIds.length === 0} onClick={assignTests}>{assigning ? 'Assigning...' : `Assign to ${selectedClassIds.length} class(es)`}</Button></>}
      >
            <div className="max-h-[520px] space-y-5 overflow-y-auto">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <label className="space-y-1.5 text-xs font-medium text-subtle">Available from<DateTimePicker value={availableAt} onChange={setAvailableAt} placeholder="Choose availability" ariaLabel="Available from" /></label>
                <label className="space-y-1.5 text-xs font-medium text-subtle">Deadline<DateTimePicker value={dueAt} minDate={availableAt || undefined} onChange={setDueAt} placeholder="Choose deadline" ariaLabel="Assignment deadline" /></label>
                <label className="space-y-1.5 text-xs font-medium text-subtle">Attempts<Input type="number" min={1} max={10} value={maxAttempts} onChange={event => setMaxAttempts(Math.min(10, Math.max(1, Number(event.target.value))))} className="w-full" /></label>
                <label className="space-y-1.5 text-xs font-medium text-subtle">Score policy<Select value={scorePolicy} onChange={event => setScorePolicy(event.target.value as typeof scorePolicy)} className="w-full"><option value="FIRST">First attempt</option><option value="BEST">Best attempt</option><option value="LATEST">Latest attempt</option></Select></label>
              </div>
              <div className="border-t border-[#D6E3DE] pt-5">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#6B7280]">Classes</p>
              {classes.length === 0 ? <p className="rounded-lg bg-[#EAF2EE] p-5 text-center text-sm text-[#6B7280]">You do not have any classes yet.</p> : classes.map(item => {
                const checked = selectedClassIds.includes(item.id);
                return <button key={item.id} onClick={() => toggleClass(item.id)} className={`flex w-full items-center gap-4 rounded-lg border p-4 text-left transition-colors ${checked ? 'border-[#1B7A5A] bg-[#E8F5EF]' : 'border-[#E2EDE9] hover:bg-[#F2F8F5]'}`}><span className={`flex h-9 w-9 items-center justify-center rounded-lg ${checked ? 'bg-[#1B7A5A] text-white' : 'bg-[#EAF2EE] text-[#6B7280]'}`}>{checked ? <Check size={18} strokeWidth={3} /> : <GraduationCap size={18} />}</span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium text-[#1A1A1A]">{item.name}</span><span className="mt-1 block text-xs text-[#6B7280]">{item._count?.students || 0} student(s)</span></span></button>;
              })}</div>
            </div>
      </Modal>

      <Modal open={Boolean(startClassTest)} onClose={() => setStartClassTest(null)} closeOnBackdrop presentation="content-dialog" title="Choose a class" subtitle={startClassTest?.title} className="!max-w-md">
            {startClassTest && <div className="space-y-2">{(startClassTest.deliveries || []).length > 0
              ? startClassTest.deliveries?.map(delivery => <button key={delivery.id} onClick={() => openTest(startClassTest, { deliveryId: delivery.id })} className="flex w-full items-center justify-between rounded-lg border border-[#C9D8D2] p-4 text-left text-sm font-medium text-[#1A1A1A] hover:border-[#1B7A5A] hover:bg-[#E8F5EF]"><span><span className="block">{capitalizeFirstLetter(delivery.class.name)}</span><span className="mt-1 block text-xs font-normal text-[#6B7280]">{delivery.dueAt ? `Due ${new Date(delivery.dueAt).toLocaleString()}` : 'No deadline'}</span></span><ChevronRight size={17} /></button>)
              : [...new Set((startClassTest.classTests || []).map(item => item.classId))].map(classId => <button key={classId} onClick={() => openTest(startClassTest, { classId })} className="flex w-full items-center justify-between rounded-lg border border-[#C9D8D2] p-4 text-left text-sm font-medium text-[#1A1A1A] hover:border-[#1B7A5A] hover:bg-[#E8F5EF]">{classes.find(item => item.id === classId)?.name || 'Class'}<ChevronRight size={17} /></button>)}</div>}
      </Modal>

      <Modal open={Boolean(deleteTarget)} onClose={() => !deleting && setDeleteTarget(null)} closeOnBackdrop={!deleting} title="Delete exam?" subtitle={deleteTarget?.title} className="!max-w-md">
        <div className="space-y-5">
          <p className="text-sm leading-6 text-[#4B5563]">This permanently deletes the exam, its assignments, and any student attempt data associated with it. This action cannot be undone.</p>
          <div className="flex justify-end gap-2 border-t border-[#E2EDE9] pt-4"><Button variant="outline" disabled={deleting} onClick={() => setDeleteTarget(null)}>Cancel</Button><Button variant="destructive" disabled={deleting} onClick={deleteTest}>{deleting ? 'Deleting…' : 'Delete exam'}</Button></div>
        </div>
      </Modal>
    </div>
  );
};

export default PracticeTest;
