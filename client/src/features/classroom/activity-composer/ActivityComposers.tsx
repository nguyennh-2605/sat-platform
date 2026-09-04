import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { BookOpenCheck, Check, LoaderCircle, Search } from 'lucide-react';
import toast from 'react-hot-toast';
import { Modal, Tabs } from '@/components/ui/AppUI';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { DateTimePicker } from '@/components/ui/DateTimePicker';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import axiosClient from '@/lib/axios';
import { cn } from '@/lib/utils';
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
const NO_SESSION = 'NO_SESSION';

interface BaseComposerProps {
  open: boolean;
  onClose: () => void;
  classId: string;
  students: ActivityStudent[];
  initialLessonId?: string;
  onCreated: () => Promise<void> | void;
  assignment?: {
    id: string;
    title: string;
    content: string | null;
    fileUrls: string[];
    links: string[];
    deadline: string | null;
    maxPoints: number | null;
    activity?: { availableAt: string | null; lesson: { id: string } | null } | null;
  };
}

export function AssignmentComposer({ open, onClose, classId, students, initialLessonId, onCreated, assignment }: BaseComposerProps) {
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
  const [gradingMode, setGradingMode] = useState<'FEEDBACK' | 'POINTS'>('FEEDBACK');
  const [maxPoints, setMaxPoints] = useState(10);
  const [saving, setSaving] = useState(false);
  const editing = Boolean(assignment);

  useEffect(() => {
    if (!open) return;
    setTitle(assignment?.title || '');
    setInstructions(assignment?.content || '');
    setAvailableAt(toLocalDateTime(assignment?.activity?.availableAt));
    setDueAt(toLocalDateTime(assignment?.deadline));
    setFileUrls((assignment?.fileUrls || []).join('\n'));
    setLinks((assignment?.links || []).join('\n'));
    setLessonId(assignment?.activity?.lesson?.id || initialLessonId || '');
    setGradingMode(assignment?.maxPoints ? 'POINTS' : 'FEEDBACK');
    setMaxPoints(assignment?.maxPoints || 10);
    void loadOutline(classId, setOutline);
  }, [assignment, classId, initialLessonId, open]);

  useEffect(() => {
    if (open) return;
    setTitle('');
    setInstructions('');
    setAvailableAt('');
    setDueAt('');
    setFileUrls('');
    setLinks('');
    setGradingMode('FEEDBACK');
    setMaxPoints(10);
    setAllStudents(true);
    setStudentIds([]);
    setOutline([]);
  }, [open]);

  const submit = async () => {
    if (!title.trim()) return toast.error('Enter an assignment title');
    if (!editing && !students.length) return toast.error('Add at least one student before publishing an assignment');
    if (!editing && !allStudents && !studentIds.length) return toast.error('Select at least one student');
    if (!validDates(availableAt, dueAt)) return toast.error('Due date must be after availability');
    if (gradingMode === 'POINTS' && (!Number.isFinite(maxPoints) || maxPoints <= 0 || maxPoints > 10000)) return toast.error('Maximum points must be between 0 and 10,000');
    setSaving(true);
    try {
      const payload = {
        classId,
        lessonId: lessonId || null,
        title: title.trim(),
        instructions: instructions.trim() || null,
        availableAt: isoOrNull(availableAt),
        dueAt: isoOrNull(dueAt),
        fileUrls: urlLines(fileUrls),
        links: urlLines(links),
        maxPoints: gradingMode === 'POINTS' ? maxPoints : null,
        ...(!allStudents ? { studentIds } : {}),
      };
      if (assignment) await axiosClient.put(`/api/assignments/${assignment.id}`, { title: payload.title, content: payload.instructions, deadline: payload.dueAt, fileUrls: payload.fileUrls, links: payload.links, maxPoints: payload.maxPoints });
      else await axiosClient.post('/api/class-activities/assignments', payload);
      toast.success(assignment ? 'Assignment updated' : 'Assignment published');
      await onCreated();
      onClose();
    } catch (error) {
      toast.error(errorMessage(error, 'Unable to publish this assignment.'));
    } finally {
      setSaving(false);
    }
  };

  return <Modal
    open={open}
    onClose={() => !saving && onClose()}
    closeOnBackdrop={!saving}
    presentation="content-dialog"
    title={editing ? 'Edit assignment' : 'Add assignment'}
    subtitle={editing ? 'Update the assignment details and grading.' : initialLessonId ? 'Create student work for this session.' : 'Create student work with instructions and submissions.'}
    className="max-w-3xl!"
    footer={<>
      <Button variant="outline" disabled={saving} onClick={onClose}>Cancel</Button>
      <Button disabled={saving || !title.trim() || (!editing && (!students.length || (!allStudents && !studentIds.length)))} onClick={() => void submit()}>
        {saving ? <><LoaderCircle className="animate-spin" />Saving…</> : editing ? 'Save changes' : 'Publish assignment'}
      </Button>
    </>}
  >
    <div className="max-h-[70vh] space-y-4 overflow-y-auto px-1">
      {!students.length && <Notice>Add at least one student to this class before publishing an assignment.</Notice>}
      <Field label="Title" htmlFor="assignment-title">
        <Input id="assignment-title" autoFocus value={title} onChange={event => setTitle(event.target.value)} placeholder="e.g. Complete practice set 3" />
      </Field>
      <Field label="Instructions" htmlFor="assignment-instructions">
        <Textarea id="assignment-instructions" value={instructions} onChange={event => setInstructions(event.target.value)} rows={4} placeholder="What should students complete or submit?" />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="File URLs" htmlFor="assignment-file-urls">
          <Textarea id="assignment-file-urls" value={fileUrls} onChange={event => setFileUrls(event.target.value)} rows={3} placeholder="One URL per line" />
        </Field>
        <Field label="Reference links" htmlFor="assignment-reference-links">
          <Textarea id="assignment-reference-links" value={links} onChange={event => setLinks(event.target.value)} rows={3} placeholder="One URL per line" />
        </Field>
      </div>
      <Field label="Grading">
        <div className="space-y-3"><Tabs className="grid w-full grid-cols-2 sm:w-80" items={[{ value: 'FEEDBACK' as const, label: 'Feedback only' }, { value: 'POINTS' as const, label: 'Points' }]} value={gradingMode} onValueChange={setGradingMode} ariaLabel="Assignment grading" tabClassName="w-full" />{gradingMode === 'POINTS' && <div className="flex max-w-xs items-center gap-2"><Input type="number" min={1} max={10000} step="any" value={maxPoints} onChange={event => setMaxPoints(Number(event.target.value))} aria-label="Maximum points" /><span className="shrink-0 text-caption text-muted-foreground">maximum points</span></div>}</div>
      </Field>
      {editing ? <Field label="Due date"><DateTimePicker value={dueAt} onChange={setDueAt} placeholder="No deadline" ariaLabel="Due date" /></Field> : <DeliveryFields
        idPrefix="assignment"
        availableAt={availableAt}
        onAvailableAt={setAvailableAt}
        dueAt={dueAt}
        onDueAt={setDueAt}
        outline={outline}
        lessonId={lessonId}
        onLessonId={setLessonId}
        students={students}
        allStudents={allStudents}
        onAllStudents={setAllStudents}
        studentIds={studentIds}
        onStudentIds={setStudentIds}
      />}
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
    } catch (error) {
      toast.error(errorMessage(error, 'Unable to load published tests.'));
    } finally {
      setLoading(false);
    }
  }, [initialTests, open, search, source]);

  useEffect(() => {
    const timeout = window.setTimeout(() => void loadTests(), 200);
    return () => window.clearTimeout(timeout);
  }, [loadTests]);

  useEffect(() => {
    if (!open || classId) return;
    axiosClient.get<ClassOption[], ClassOption[]>('/api/tests/classes')
      .then(setClasses)
      .catch(error => toast.error(errorMessage(error, 'Unable to load classes.')));
  }, [classId, open]);

  useEffect(() => {
    if (!open) return;
    setSource(initialSource);
    setSelectedClassId(classId || '');
    setStudents(fixedStudents || []);
    setLessonId(initialLessonId || '');
    setSelectedIds(initialTests.map(test => test.id));
  }, [classId, fixedStudents, initialLessonId, initialSource, initialTests, open]);

  useEffect(() => {
    if (!open || !selectedClassId) {
      setOutline([]);
      return;
    }
    void loadOutline(selectedClassId, setOutline);
    if (!classId) {
      axiosClient.get<ClassDetail, ClassDetail>(`/api/classes/${selectedClassId}`)
        .then(result => setStudents(result.students || []))
        .catch(error => toast.error(errorMessage(error, 'Unable to load class members.')));
    }
  }, [classId, open, selectedClassId]);

  useEffect(() => {
    if (open) return;
    setSearch('');
    setAvailableAt('');
    setDueAt('');
    setMaxAttempts(1);
    setScorePolicy('FIRST');
    setAllStudents(true);
    setStudentIds([]);
    setOutline([]);
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
        classIds: [selectedClassId],
        testIds: selectedIds,
        lessonId: lessonId || null,
        availableAt: isoOrNull(availableAt),
        dueAt: isoOrNull(dueAt),
        maxAttempts,
        scorePolicy,
        ...(!allStudents ? { studentIds } : {}),
      });
      toast.success(`${selectedIds.length} test${selectedIds.length === 1 ? '' : 's'} assigned`);
      await onCreated();
      onClose();
    } catch (error) {
      toast.error(errorMessage(error, 'Unable to assign the selected tests.'));
    } finally {
      setSaving(false);
    }
  };

  return <Modal
    open={open}
    onClose={() => !saving && onClose()}
    closeOnBackdrop={!saving}
    presentation="content-dialog"
    title="Assign tests"
    subtitle="Each selected test becomes an independent activity."
    className="max-w-4xl!"
    footer={<>
      <Button variant="outline" disabled={saving} onClick={onClose}>Cancel</Button>
      <Button disabled={saving || !selectedClassId || !selectedIds.length || !students.length || (!allStudents && !studentIds.length)} onClick={() => void submit()}>
        {saving ? <><LoaderCircle className="animate-spin" />Assigning…</> : `Assign ${selectedIds.length || ''} test${selectedIds.length === 1 ? '' : 's'}`}
      </Button>
    </>}
  >
    <div className="max-h-[72vh] space-y-4 overflow-y-auto px-1">
      {!classId && <Field label="Class" htmlFor="test-class">
        <Select value={selectedClassId || undefined} onValueChange={value => {
          setSelectedClassId(value);
          setStudentIds([]);
          setAllStudents(true);
          setLessonId('');
        }}>
          <SelectTrigger id="test-class" className="w-full"><SelectValue placeholder="Select a class" /></SelectTrigger>
          <SelectContent position="popper">
            {classes.map(item => <SelectItem key={item.id} value={item.id}>{item.name}{item._count ? ` · ${item._count.students} students` : ''}</SelectItem>)}
          </SelectContent>
        </Select>
      </Field>}

      <div className="flex min-w-0 items-center justify-between gap-3">
        <div className="min-w-0 overflow-x-auto">
          <Tabs items={[{ value: 'MY' as const, label: 'My Tests' }, { value: 'SYSTEM' as const, label: 'System Tests' }]} value={source} onValueChange={setSource} ariaLabel="Test source" />
        </div>
        <Badge variant="outline" className="shrink-0 text-muted-foreground">{selectedIds.length} selected</Badge>
      </div>

      <label className="relative block" htmlFor="test-search">
        <span className="sr-only">Search published tests</span>
        <Search className="pointer-events-none absolute left-2.5 top-1/2 z-10 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input id="test-search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Search published tests…" className="pl-8" />
      </label>

      <div className="max-h-64 overflow-y-auto rounded-card border border-ui-border p-1">
        {loading
          ? <p className="py-10 text-center text-body text-muted-foreground">Loading tests…</p>
          : tests.length === 0
            ? <p className="py-10 text-center text-body text-muted-foreground">No published tests found.</p>
            : <div>{tests.map(test => {
              const selected = selectedIds.includes(test.id);
              return <label key={test.id} className={cn('flex cursor-pointer items-center gap-3 rounded-control px-2.5 py-2 transition-colors hover:bg-muted/50', selected && 'bg-accent')}>
                <Checkbox checked={selected} onCheckedChange={() => toggleTest(test.id)} />
                <BookOpenCheck className="size-4 shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-body font-medium text-foreground">{test.title}</span>
                  <span className="block truncate text-caption text-muted-foreground">{test.subject === 'MATH' ? 'Math' : 'Reading & Writing'} · {test.mode === 'EXAM' ? 'Exam' : 'Practice'} · {test.questionCount} questions</span>
                </span>
                {selected && <Check className="size-4 shrink-0 text-primary" />}
              </label>;
            })}</div>}
      </div>

      {selectedTests.length > 1 && <p className="text-caption text-muted-foreground">The settings below apply to all {selectedTests.length} tests. Each test remains an independent activity.</p>}

      {selectedClassId && <>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Attempts" htmlFor="test-attempts">
            <Input id="test-attempts" type="number" min={1} max={10} value={maxAttempts} onChange={event => setMaxAttempts(Math.min(10, Math.max(1, Number(event.target.value))))} />
          </Field>
          <Field label="Score policy" htmlFor="test-score-policy">
            <Select value={scorePolicy} onValueChange={value => setScorePolicy(value as typeof scorePolicy)}>
              <SelectTrigger id="test-score-policy" className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="FIRST">First attempt</SelectItem>
                <SelectItem value="BEST">Best attempt</SelectItem>
                <SelectItem value="LATEST">Latest attempt</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        </div>
        <DeliveryFields
          idPrefix="test"
          availableAt={availableAt}
          onAvailableAt={setAvailableAt}
          dueAt={dueAt}
          onDueAt={setDueAt}
          outline={outline}
          lessonId={lessonId}
          onLessonId={setLessonId}
          students={students}
          allStudents={allStudents}
          onAllStudents={setAllStudents}
          studentIds={studentIds}
          onStudentIds={setStudentIds}
        />
      </>}
    </div>
  </Modal>;
}

interface DeliveryFieldsProps {
  idPrefix: string;
  availableAt: string;
  onAvailableAt: (value: string) => void;
  dueAt: string;
  onDueAt: (value: string) => void;
  outline: OutlineWeek[];
  lessonId: string;
  onLessonId: (value: string) => void;
  students: ActivityStudent[];
  allStudents: boolean;
  onAllStudents: (value: boolean) => void;
  studentIds: number[];
  onStudentIds: (value: number[]) => void;
}

function DeliveryFields({ idPrefix, availableAt, onAvailableAt, dueAt, onDueAt, outline, lessonId, onLessonId, students, allStudents, onAllStudents, studentIds, onStudentIds }: DeliveryFieldsProps) {
  const toggleStudent = (studentId: number) => onStudentIds(studentIds.includes(studentId) ? studentIds.filter(id => id !== studentId) : [...studentIds, studentId]);

  return <>
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label="Available from"><DateTimePicker value={availableAt} onChange={onAvailableAt} placeholder="Available now" ariaLabel="Available from" /></Field>
      <Field label="Due date"><DateTimePicker value={dueAt} minDate={availableAt || undefined} onChange={onDueAt} placeholder="No deadline" ariaLabel="Due date" /></Field>
    </div>

    <Field label="Curriculum placement" htmlFor={`${idPrefix}-curriculum-placement`}>
      <Select value={lessonId || NO_SESSION} onValueChange={value => onLessonId(value === NO_SESSION ? '' : value)}>
        <SelectTrigger id={`${idPrefix}-curriculum-placement`} className="w-full"><SelectValue /></SelectTrigger>
        <SelectContent position="popper">
          <SelectItem value={NO_SESSION}>No session</SelectItem>
          {outline.map((week, weekIndex) => <SelectGroup key={week.id}>
            <SelectLabel>Week {String(weekIndex + 1).padStart(2, '0')} · {week.title}</SelectLabel>
            {week.lessons.map((lesson, lessonIndex) => <SelectItem key={lesson.id} value={lesson.id}>Session {String(lessonIndex + 1).padStart(2, '0')} · {lesson.title}</SelectItem>)}
          </SelectGroup>)}
        </SelectContent>
      </Select>
    </Field>

    <div>
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-body font-medium text-foreground">Students</p>
          <p className="text-caption text-muted-foreground">Assign to the whole class or selected students.</p>
        </div>
        <label className="flex shrink-0 items-center gap-2 text-body text-foreground">
          <Checkbox checked={allStudents} onCheckedChange={checked => {
            onAllStudents(Boolean(checked));
            onStudentIds([]);
          }} />
          All students
        </label>
      </div>
      {!allStudents && <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {students.map(student => <label key={student.id} className="flex items-center gap-3 rounded-control border border-ui-border px-3 py-2 hover:bg-muted/30">
          <Checkbox checked={studentIds.includes(student.id)} onCheckedChange={() => toggleStudent(student.id)} />
          <span className="min-w-0">
            <span className="block truncate text-body font-medium text-foreground">{student.name || student.email}</span>
            <span className="block truncate text-caption text-muted-foreground">{student.email}</span>
          </span>
        </label>)}
      </div>}
    </div>
  </>;
}

function Field({ label, htmlFor, children }: { label: string; htmlFor?: string; children: ReactNode }) {
  return <div className="space-y-2">
    <label htmlFor={htmlFor} className="block text-caption font-medium text-foreground">{label}</label>
    {children}
  </div>;
}

function Notice({ children }: { children: ReactNode }) {
  return <p className="rounded-control border border-ui-border bg-muted p-3 text-caption text-muted-foreground">{children}</p>;
}

const isoOrNull = (value: string) => value ? new Date(value).toISOString() : null;
const validDates = (availableAt: string, dueAt: string) => !availableAt || !dueAt || new Date(availableAt) < new Date(dueAt);
const urlLines = (value: string) => value.split(/\r?\n/).map(item => item.trim()).filter(Boolean);
const errorMessage = (error: unknown, fallback: string) => (error as { response?: { data?: { error?: string } } })?.response?.data?.error || fallback;
const toLocalDateTime = (value?: string | null) => {
  if (!value) return '';
  const date = new Date(value);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
};

async function loadOutline(classId: string, setOutline: (value: OutlineWeek[]) => void) {
  try {
    const result = await axiosClient.get<OutlineResponse, OutlineResponse>(`/api/progress/class/${classId}/outline`);
    setOutline(result.data || []);
  } catch (error) {
    toast.error(errorMessage(error, 'Unable to load curriculum placement.'));
  }
}
