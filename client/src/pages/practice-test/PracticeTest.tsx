import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, BookOpen, BookOpenCheck, Check, ChevronRight, Clock3, GraduationCap, MoreHorizontal, Play, Plus, Search, SlidersHorizontal, X } from 'lucide-react';
import toast from 'react-hot-toast';
import axiosClient from '../../lib/axios';

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

const formatTestTitle = (title: string) => {
  const trimmedTitle = title.trim();
  if (!trimmedTitle) return title;
  return `${trimmedTitle.charAt(0).toLocaleUpperCase()}${trimmedTitle.slice(1)}`;
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

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [testData, classData] = await Promise.all([
        axiosClient.get<TestItem[], TestItem[]>('/api/tests'),
        axiosClient.get<ClassInfo[], ClassInfo[]>('/api/tests/classes'),
      ]);
      setTests(testData.map(test => ({ ...test, title: formatTestTitle(test.title) })));
      setClasses(classData);
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

  return (
    <div className="flex h-full min-h-0 flex-col bg-[#F2F8F5] text-[#1A1A1A]">
      <header className="sticky top-0 z-30 flex h-[60px] shrink-0 items-center justify-between border-b border-[#E2EDE9] bg-white px-6">
        <div>
          <h1 className="text-base font-semibold leading-tight">Practice Center</h1>
          <p className="mt-0.5 text-xs leading-tight text-[#6B7280]">Browse and attempt SAT practice tests</p>
        </div>
        <div className="flex items-center gap-5">
          <button className="relative text-[#6B7280] transition-colors hover:text-[#1A1A1A]" aria-label="Notifications">
            <Bell size={20} />
            <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-red-500 ring-2 ring-white" />
          </button>
          <div className="flex h-8 w-8 select-none items-center justify-center rounded-full bg-[#1B7A5A] text-xs font-semibold text-white ring-2 ring-transparent ring-offset-2 ring-offset-white transition-all hover:ring-[#1B7A5A]/30" title={userName}>
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
                  <select value={sortOrder} onChange={event => setSortOrder(event.target.value as 'NEWEST' | 'OLDEST')} className="app-input cursor-pointer">
                    <option value="NEWEST">Newest</option>
                    <option value="OLDEST">Oldest</option>
                  </select>
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
                <select value={classFilter} onChange={event => setClassFilter(event.target.value)} className="app-input lg:ml-auto">
                  <option value="ALL">All classes</option>
                  {classes.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
                </select>
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
                  <article key={test.id} className={`group relative flex flex-col gap-3 rounded-xl border bg-white p-5 transition-all duration-200 ${selected ? 'border-[#1B7A5A] ring-2 ring-[#1B7A5A]/15' : 'border-[#E2EDE9] hover:border-[#1B7A5A]/40 hover:shadow-md'}`}>
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
                        <button className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[#6B7280] transition-colors hover:bg-[#EAF2EE] hover:text-[#1A1A1A]" aria-label={`Actions for ${test.title}`}>
                          <MoreHorizontal size={16} />
                        </button>
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

      {assignmentOpen && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center bg-[#0A1F16]/50 p-4">
          <div className="app-modal w-full max-w-lg">
            <div className="flex items-start justify-between border-b border-[#E2EDE9] px-6 py-5"><div><h3 className="text-lg font-semibold">Assign tests to classes</h3><p className="mt-1 text-sm text-[#6B7280]">{selectedTestIds.length} test(s) selected</p></div><button className="app-icon-button" onClick={() => setAssignmentOpen(false)}><X size={18} /></button></div>
            <div className="max-h-[520px] space-y-5 overflow-y-auto p-6">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <label className="space-y-1.5 text-xs font-medium text-[#4B5563]">Available from<input type="datetime-local" value={availableAt} onChange={event => setAvailableAt(event.target.value)} className="h-9 w-full rounded-lg border border-[#C9D8D2] bg-white px-3 text-sm outline-none focus:border-[#1B7A5A] focus:ring-2 focus:ring-[#1B7A5A]/20" /></label>
                <label className="space-y-1.5 text-xs font-medium text-[#4B5563]">Deadline<input type="datetime-local" value={dueAt} min={availableAt || undefined} onChange={event => setDueAt(event.target.value)} className="h-9 w-full rounded-lg border border-[#C9D8D2] bg-white px-3 text-sm outline-none focus:border-[#1B7A5A] focus:ring-2 focus:ring-[#1B7A5A]/20" /></label>
                <label className="space-y-1.5 text-xs font-medium text-[#4B5563]">Attempts<input type="number" min={1} max={10} value={maxAttempts} onChange={event => setMaxAttempts(Math.min(10, Math.max(1, Number(event.target.value))))} className="h-9 w-full rounded-lg border border-[#C9D8D2] bg-white px-3 text-sm outline-none focus:border-[#1B7A5A]" /></label>
                <label className="space-y-1.5 text-xs font-medium text-[#4B5563]">Score policy<select value={scorePolicy} onChange={event => setScorePolicy(event.target.value as typeof scorePolicy)} className="h-9 w-full rounded-lg border border-[#C9D8D2] bg-white px-3 text-sm outline-none focus:border-[#1B7A5A]"><option value="FIRST">First attempt</option><option value="BEST">Best attempt</option><option value="LATEST">Latest attempt</option></select></label>
              </div>
              <div className="border-t border-[#D6E3DE] pt-5">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#6B7280]">Classes</p>
              {classes.length === 0 ? <p className="rounded-lg bg-[#EAF2EE] p-5 text-center text-sm text-[#6B7280]">You do not have any classes yet.</p> : classes.map(item => {
                const checked = selectedClassIds.includes(item.id);
                return <button key={item.id} onClick={() => toggleClass(item.id)} className={`flex w-full items-center gap-4 rounded-lg border p-4 text-left transition-colors ${checked ? 'border-[#1B7A5A] bg-[#E8F5EF]' : 'border-[#E2EDE9] hover:bg-[#F2F8F5]'}`}><span className={`flex h-9 w-9 items-center justify-center rounded-lg ${checked ? 'bg-[#1B7A5A] text-white' : 'bg-[#EAF2EE] text-[#6B7280]'}`}>{checked ? <Check size={18} strokeWidth={3} /> : <GraduationCap size={18} />}</span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium text-[#1A1A1A]">{item.name}</span><span className="mt-1 block text-xs text-[#6B7280]">{item._count?.students || 0} student(s)</span></span></button>;
              })}</div>
            </div>
            <div className="flex justify-end gap-3 border-t border-[#E2EDE9] bg-[#F2F8F5] px-6 py-4"><button className="app-button app-button-secondary" onClick={() => setAssignmentOpen(false)}>Cancel</button><button className="app-button app-button-primary" disabled={assigning || selectedClassIds.length === 0} onClick={assignTests}>{assigning ? 'Assigning...' : `Assign to ${selectedClassIds.length} class(es)`}</button></div>
          </div>
        </div>
      )}

      {startClassTest && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center bg-[#0A1F16]/50 p-4 backdrop-blur-sm">
          <div className="app-modal w-full max-w-md p-6">
            <div className="mb-5 flex items-start justify-between gap-4"><div><h3 className="font-semibold text-[#1A1A1A]">Choose a class</h3><p className="mt-1 line-clamp-1 text-sm text-[#6B7280]">{startClassTest.title}</p></div><button className="app-icon-button" onClick={() => setStartClassTest(null)}><X size={18} /></button></div>
            <div className="space-y-2">{(startClassTest.deliveries || []).length > 0
              ? startClassTest.deliveries?.map(delivery => <button key={delivery.id} onClick={() => openTest(startClassTest, { deliveryId: delivery.id })} className="flex w-full items-center justify-between rounded-lg border border-[#C9D8D2] p-4 text-left text-sm font-medium text-[#1A1A1A] hover:border-[#1B7A5A] hover:bg-[#E8F5EF]"><span><span className="block">{delivery.class.name}</span><span className="mt-1 block text-xs font-normal text-[#6B7280]">{delivery.dueAt ? `Due ${new Date(delivery.dueAt).toLocaleString()}` : 'No deadline'}</span></span><ChevronRight size={17} /></button>)
              : [...new Set((startClassTest.classTests || []).map(item => item.classId))].map(classId => <button key={classId} onClick={() => openTest(startClassTest, { classId })} className="flex w-full items-center justify-between rounded-lg border border-[#C9D8D2] p-4 text-left text-sm font-medium text-[#1A1A1A] hover:border-[#1B7A5A] hover:bg-[#E8F5EF]">{classes.find(item => item.id === classId)?.name || 'Class'}<ChevronRight size={17} /></button>)}</div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PracticeTest;
