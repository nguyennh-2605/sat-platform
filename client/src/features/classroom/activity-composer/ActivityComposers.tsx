import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { BookOpenCheck, Check, LoaderCircle, Search } from 'lucide-react';
import toast from 'react-hot-toast';
import { Badge, Button, Input, Modal, Select, Tabs } from '@/components/ui/AppUI';
import { Checkbox } from '@/components/ui/checkbox';
import { DateTimePicker } from '@/components/ui/DateTimePicker';
import { Textarea } from '@/components/ui/textarea';
import axiosClient from '@/lib/axios';
import { capitalizeFirstLetter } from '@/utils/text';

export interface ActivityStudent { id: number; name: string | null; email: string }
export interface ComposerTest { id: number; title: string; duration: number; subject: 'RW' | 'MATH'; mode: 'PRACTICE' | 'EXAM'; questionCount: number }
interface ClassOption { id: string; name: string; _count?: { students: number } }
interface OutlineWeek { id: string; title: string; order: number; lessons: Array<{ id: string; title: string; order: number }> }
interface TestPage { items: ComposerTest[] }
interface OutlineResponse { success: boolean; data: OutlineWeek[] }
interface ClassDetail { id: string; students: ActivityStudent[] }
type TestSource = 'MY' | 'SYSTEM';
const EMPTY_TESTS: ComposerTest[] = [];

interface BaseComposerProps {
  open: boolean;
  onClose: () => void;
  classId: string;
  students: ActivityStudent[];
  initialLessonId?: string;
  onCreated: () => Promise<void> | void;
}

export function AssignmentComposer({ open, onClose, classId, students, initialLessonId, onCreated }: BaseComposerProps) {
  const [title, setTitle] = useState('');
  const [instructions, setInstructions] = useState('');
  const [availableAt, setAvailableAt] = useState('');
  const [dueAt, setDueAt] = useState('');
  const [fileUrls, setFileUrls] = useState('');
  const [links, setLinks] = useState('');
  const [lessonId, setLessonId] = useState(initialLessonId || '');
  const [outline, setOutline] = useState<OutlineWeek[]>([]);
  const [allStudents, setAllStudents] = useState(true);
  const [studentIds, setStudentIds] = useState<number[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLessonId(initialLessonId || '');
    void loadOutline(classId, setOutline);
  }, [classId, initialLessonId, open]);
  useEffect(() => {
    if (open) return;
    setTitle(''); setInstructions(''); setAvailableAt(''); setDueAt(''); setFileUrls(''); setLinks('');
    setAllStudents(true); setStudentIds([]); setOutline([]);
  }, [open]);

  const submit = async () => {
    if (!title.trim()) return toast.error('Enter an assignment title');
    if (!students.length) return toast.error('Add at least one student before publishing an assignment');
    if (!allStudents && !studentIds.length) return toast.error('Select at least one student');
    if (!validDates(availableAt, dueAt)) return toast.error('Due date must be after availability');
    setSaving(true);
    try {
      await axiosClient.post('/api/class-activities/assignments', {
        classId, lessonId: lessonId || null, title: title.trim(), instructions: instructions.trim() || null,
        availableAt: isoOrNull(availableAt), dueAt: isoOrNull(dueAt),
        fileUrls: urlLines(fileUrls), links: urlLines(links), ...(!allStudents ? { studentIds } : {}),
      });
      toast.success('Assignment published');
      await onCreated();
      onClose();
    } catch (error) {
      toast.error(errorMessage(error, 'Unable to publish this assignment.'));
    } finally { setSaving(false); }
  };

  return <Modal open={open} onClose={() => !saving && onClose()} closeOnBackdrop={!saving} presentation="content-dialog" title="Add assignment" subtitle={initialLessonId ? 'Create student work for this session.' : 'Create student work with instructions and submissions.'} className="max-w-3xl!" footer={<><Button variant="outline" disabled={saving} onClick={onClose}>Cancel</Button><Button disabled={saving || !title.trim() || !students.length || (!allStudents && !studentIds.length)} onClick={() => void submit()}>{saving ? <><LoaderCircle size={15} className="animate-spin" />Publishing…</> : 'Publish assignment'}</Button></>}>
    <div className="max-h-[70vh] space-y-5 overflow-y-auto pr-1">
      {!students.length && <Notice>Add at least one student to this class before publishing an assignment.</Notice>}
      <section className="space-y-4"><SectionTitle title="Assignment" description="Instructions and resources students need to complete." /><Field label="Title"><Input autoFocus className="w-full" value={title} onChange={event => setTitle(event.target.value)} placeholder="e.g. Complete practice set 3" /></Field><Field label="Instructions"><Textarea value={instructions} onChange={event => setInstructions(event.target.value)} rows={4} placeholder="What should students complete or submit?" /></Field><div className="grid gap-4 sm:grid-cols-2"><Field label="File URLs"><Textarea value={fileUrls} onChange={event => setFileUrls(event.target.value)} rows={3} placeholder="One URL per line" /></Field><Field label="Reference links"><Textarea value={links} onChange={event => setLinks(event.target.value)} rows={3} placeholder="One URL per line" /></Field></div><div className="rounded-control border border-ui-border bg-muted/30 px-3 py-2.5"><p className="text-body font-medium text-foreground">Submission required</p><p className="mt-0.5 text-caption text-muted-foreground">Students submit a written response or share a work link.</p></div></section>
      <DeliveryFields availableAt={availableAt} onAvailableAt={setAvailableAt} dueAt={dueAt} onDueAt={setDueAt} outline={outline} lessonId={lessonId} onLessonId={setLessonId} students={students} allStudents={allStudents} onAllStudents={setAllStudents} studentIds={studentIds} onStudentIds={setStudentIds} />
    </div>
  </Modal>;
}

interface AssignTestsComposerProps {
  open: boolean;
  onClose: () => void;
  classId?: string;
  students?: ActivityStudent[];
  initialLessonId?: string;
  initialTests?: ComposerTest[];
  initialSource?: TestSource;
  onCreated: () => Promise<void> | void;
}

export function AssignTestsComposer({ open, onClose, classId, students: fixedStudents, initialLessonId, initialTests = EMPTY_TESTS, initialSource = 'MY', onCreated }: AssignTestsComposerProps) {
  const [source, setSource] = useState<TestSource>(initialSource);
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [selectedClassId, setSelectedClassId] = useState(classId || '');
  const [students, setStudents] = useState<ActivityStudent[]>(fixedStudents || []);
  const [tests, setTests] = useState<ComposerTest[]>(initialTests);
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<number[]>(initialTests.map(test => test.id));
  const [availableAt, setAvailableAt] = useState('');
  const [dueAt, setDueAt] = useState('');
  const [lessonId, setLessonId] = useState(initialLessonId || '');
  const [outline, setOutline] = useState<OutlineWeek[]>([]);
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
      if (search.trim()) params.set('search', search.trim());
      const page = await axiosClient.get<TestPage, TestPage>(`/api/tests?${params}`);
      const combined = [...initialTests, ...page.items].map(item => ({ ...item, title: capitalizeFirstLetter(item.title) }));
      setTests([...new Map(combined.map(item => [item.id, item])).values()]);
    } catch (error) { toast.error(errorMessage(error, 'Unable to load published tests.')); }
    finally { setLoading(false); }
  }, [initialTests, open, search, source]);

  useEffect(() => { const timeout = window.setTimeout(() => void loadTests(), 200); return () => window.clearTimeout(timeout); }, [loadTests]);
  useEffect(() => {
    if (!open || classId) return;
    axiosClient.get<ClassOption[], ClassOption[]>('/api/tests/classes').then(setClasses).catch(error => toast.error(errorMessage(error, 'Unable to load classes.')));
  }, [classId, open]);
  useEffect(() => {
    if (!open) return;
    setSource(initialSource); setSelectedClassId(classId || ''); setStudents(fixedStudents || []); setLessonId(initialLessonId || ''); setSelectedIds(initialTests.map(test => test.id));
  }, [classId, fixedStudents, initialLessonId, initialSource, initialTests, open]);
  useEffect(() => {
    if (!open || !selectedClassId) { setOutline([]); return; }
    void loadOutline(selectedClassId, setOutline);
    if (!classId) axiosClient.get<ClassDetail, ClassDetail>(`/api/classes/${selectedClassId}`).then(result => setStudents(result.students || [])).catch(error => toast.error(errorMessage(error, 'Unable to load class members.')));
  }, [classId, open, selectedClassId]);
  useEffect(() => {
    if (open) return;
    setSearch(''); setAvailableAt(''); setDueAt(''); setMaxAttempts(1); setScorePolicy('FIRST'); setAllStudents(true); setStudentIds([]); setOutline([]);
  }, [open]);

  const selectedTests = useMemo(() => tests.filter(test => selectedIds.includes(test.id)), [selectedIds, tests]);
  const toggleTest = (testId: number) => setSelectedIds(current => current.includes(testId) ? current.filter(id => id !== testId) : [...current, testId]);
  const submit = async () => {
    if (!selectedClassId) return toast.error('Select a class');
    if (!selectedIds.length) return toast.error('Select at least one published test');
    if (!students.length) return toast.error('Add at least one student before assigning tests');
    if (!allStudents && !studentIds.length) return toast.error('Select at least one student');
    if (!validDates(availableAt, dueAt)) return toast.error('Due date must be after availability');
    setSaving(true);
    try {
      await axiosClient.post('/api/test-deliveries', {
        classIds: [selectedClassId], testIds: selectedIds, lessonId: lessonId || null,
        availableAt: isoOrNull(availableAt), dueAt: isoOrNull(dueAt), maxAttempts, scorePolicy,
        ...(!allStudents ? { studentIds } : {}),
      });
      toast.success(`${selectedIds.length} test${selectedIds.length === 1 ? '' : 's'} assigned`);
      await onCreated();
      onClose();
    } catch (error) { toast.error(errorMessage(error, 'Unable to assign the selected tests.')); }
    finally { setSaving(false); }
  };

  return <Modal open={open} onClose={() => !saving && onClose()} closeOnBackdrop={!saving} presentation="content-dialog" title="Assign tests" subtitle="Each selected test becomes an independent activity." className="max-w-4xl!" footer={<><Button variant="outline" disabled={saving} onClick={onClose}>Cancel</Button><Button disabled={saving || !selectedClassId || !selectedIds.length || !students.length || (!allStudents && !studentIds.length)} onClick={() => void submit()}>{saving ? <><LoaderCircle size={15} className="animate-spin" />Assigning…</> : `Assign ${selectedIds.length || ''} test${selectedIds.length === 1 ? '' : 's'}`}</Button></>}>
    <div className="max-h-[72vh] space-y-5 overflow-y-auto pr-1">
      {!classId && <Field label="Class"><Select className="w-full" value={selectedClassId} onChange={event => { setSelectedClassId(event.target.value); setStudentIds([]); setAllStudents(true); setLessonId(''); }}><option value="">Select a class</option>{classes.map(item => <option key={item.id} value={item.id}>{item.name}{item._count ? ` · ${item._count.students} students` : ''}</option>)}</Select></Field>}
      <section className="space-y-3"><div className="flex flex-wrap items-center justify-between gap-3"><SectionTitle title="Choose tests" description="Bulk assignment creates one activity per test." /><Badge tone="neutral">{selectedIds.length} selected</Badge></div><div className="overflow-x-auto"><Tabs items={[{ value: 'MY' as const, label: 'My Tests' }, { value: 'SYSTEM' as const, label: 'System Tests' }]} value={source} onValueChange={setSource} ariaLabel="Test source" /></div><label className="relative block"><Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" /><Input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search published tests…" className="w-full pl-9" /></label><div className="max-h-64 overflow-y-auto rounded-card border border-ui-border p-2">{loading ? <p className="py-10 text-center text-body text-muted-foreground">Loading tests…</p> : tests.length === 0 ? <p className="py-10 text-center text-body text-muted-foreground">No published tests found.</p> : <div className="space-y-1">{tests.map(test => <label key={test.id} className={`flex cursor-pointer items-center gap-3 rounded-control p-3 transition-colors hover:bg-muted/50 ${selectedIds.includes(test.id) ? 'bg-accent' : ''}`}><Checkbox checked={selectedIds.includes(test.id)} onCheckedChange={() => toggleTest(test.id)} /><span className="flex size-9 shrink-0 items-center justify-center rounded-control border border-ui-border bg-surface"><BookOpenCheck size={17} /></span><span className="min-w-0 flex-1"><span className="block truncate text-body font-medium text-foreground">{test.title}</span><span className="mt-0.5 block text-caption text-muted-foreground">{test.subject === 'MATH' ? 'Math' : 'Reading & Writing'} · {test.mode === 'EXAM' ? 'Exam' : 'Practice'} · {test.questionCount} questions</span></span>{selectedIds.includes(test.id) && <Check size={16} className="text-primary" />}</label>)}</div>}</div>{selectedTests.length > 1 && <p className="text-caption text-muted-foreground">Delivery settings below apply to all {selectedTests.length} tests. Titles remain independent.</p>}</section>
      {selectedClassId && <><div className="grid gap-4 border-t border-ui-border pt-5 sm:grid-cols-2"><Field label="Attempts"><Input className="w-full" type="number" min={1} max={10} value={maxAttempts} onChange={event => setMaxAttempts(Math.min(10, Math.max(1, Number(event.target.value))))} /></Field><Field label="Score policy"><Select className="w-full" value={scorePolicy} onChange={event => setScorePolicy(event.target.value as typeof scorePolicy)}><option value="FIRST">First attempt</option><option value="BEST">Best attempt</option><option value="LATEST">Latest attempt</option></Select></Field></div><DeliveryFields availableAt={availableAt} onAvailableAt={setAvailableAt} dueAt={dueAt} onDueAt={setDueAt} outline={outline} lessonId={lessonId} onLessonId={setLessonId} students={students} allStudents={allStudents} onAllStudents={setAllStudents} studentIds={studentIds} onStudentIds={setStudentIds} /></>}
    </div>
  </Modal>;
}

function DeliveryFields({ availableAt, onAvailableAt, dueAt, onDueAt, outline, lessonId, onLessonId, students, allStudents, onAllStudents, studentIds, onStudentIds }: { availableAt: string; onAvailableAt: (value: string) => void; dueAt: string; onDueAt: (value: string) => void; outline: OutlineWeek[]; lessonId: string; onLessonId: (value: string) => void; students: ActivityStudent[]; allStudents: boolean; onAllStudents: (value: boolean) => void; studentIds: number[]; onStudentIds: (value: number[]) => void }) {
  const toggleStudent = (studentId: number) => onStudentIds(studentIds.includes(studentId) ? studentIds.filter(id => id !== studentId) : [...studentIds, studentId]);
  return <section className="space-y-4 border-t border-ui-border pt-5"><SectionTitle title="Delivery" description="Control timing, audience, and curriculum placement." /><div className="grid gap-4 sm:grid-cols-2"><Field label="Available from"><DateTimePicker value={availableAt} onChange={onAvailableAt} placeholder="Available now" ariaLabel="Available from" /></Field><Field label="Due date"><DateTimePicker value={dueAt} minDate={availableAt || undefined} onChange={onDueAt} placeholder="No deadline" ariaLabel="Due date" /></Field></div><Field label="Curriculum placement"><Select className="w-full" value={lessonId} onChange={event => onLessonId(event.target.value)}><option value="">No session</option>{outline.map((week, weekIndex) => <optgroup key={week.id} label={`Week ${String(weekIndex + 1).padStart(2, '0')} · ${week.title}`}>{week.lessons.map((lesson, lessonIndex) => <option key={lesson.id} value={lesson.id}>Session {String(lessonIndex + 1).padStart(2, '0')} · {lesson.title}</option>)}</optgroup>)}</Select></Field><div><div className="flex items-center justify-between gap-3"><div><p className="text-body font-medium text-foreground">Students</p><p className="mt-0.5 text-caption text-muted-foreground">Assign to the whole class or selected students.</p></div><label className="flex items-center gap-2 text-body"><Checkbox checked={allStudents} onCheckedChange={checked => { onAllStudents(Boolean(checked)); onStudentIds([]); }} />All students</label></div>{!allStudents && <div className="mt-3 grid gap-2 sm:grid-cols-2">{students.map(student => <label key={student.id} className="flex items-center gap-3 rounded-control border border-ui-border p-3 hover:bg-muted/30"><Checkbox checked={studentIds.includes(student.id)} onCheckedChange={() => toggleStudent(student.id)} /><span className="min-w-0"><span className="block truncate text-body font-medium">{student.name || student.email}</span><span className="block truncate text-caption text-muted-foreground">{student.email}</span></span></label>)}</div>}</div></section>;
}

function Field({ label, children }: { label: string; children: ReactNode }) { return <label><span className="mb-2 block text-caption font-medium text-foreground">{label}</span>{children}</label>; }
function SectionTitle({ title, description }: { title: string; description: string }) { return <div><h3 className="text-body font-semibold text-foreground">{title}</h3><p className="mt-0.5 text-caption text-muted-foreground">{description}</p></div>; }
function Notice({ children }: { children: ReactNode }) { return <p className="rounded-control border border-ui-border bg-muted p-3 text-caption text-muted-foreground">{children}</p>; }
const isoOrNull = (value: string) => value ? new Date(value).toISOString() : null;
const validDates = (availableAt: string, dueAt: string) => !availableAt || !dueAt || new Date(availableAt) < new Date(dueAt);
const urlLines = (value: string) => value.split(/\r?\n/).map(item => item.trim()).filter(Boolean);
const errorMessage = (error: unknown, fallback: string) => (error as { response?: { data?: { error?: string } } })?.response?.data?.error || fallback;
async function loadOutline(classId: string, setOutline: (value: OutlineWeek[]) => void) {
  try { const result = await axiosClient.get<OutlineResponse, OutlineResponse>(`/api/progress/class/${classId}/outline`); setOutline(result.data || []); }
  catch (error) { toast.error(errorMessage(error, 'Unable to load curriculum placement.')); }
}
