import { useCallback, useEffect, useMemo, useState } from 'react';
import { BookCopy, ChevronDown, Search, X } from 'lucide-react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Badge, PageHeader, Tabs } from '@/components/ui/AppUI';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { DataPagination, DataSurface } from '@/components/ui/data-surface';
import { DateTimePicker } from '@/components/ui/DateTimePicker';
import { Input } from '@/components/ui/input';
import { LoadingSpinner } from '@/components/ui/loading';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { QuestionDifficultyBadge, QuestionPreviewModal } from '@/features/question-bank/QuestionPreviewModal';
import { questionIdLabel } from '@/features/question-bank/question-bank.utils';
import type { BankQuestion, BankQuestionDifficulty, BankQuestionPage, BankSubject } from '@/features/question-bank/question-bank.types';
import type { TaxonomyDomain } from '@/features/test-creation/create-test.types';
import { useDashboardBack } from '@/features/navigation/DashboardBackContext';
import axiosClient from '@/lib/axios';
import { cn } from '@/lib/utils';

type LessonPhase = 'BEFORE_CLASS' | 'DURING_CLASS' | 'AFTER_CLASS';
interface ActivityStudent { id: number; name: string; email: string }
interface QuizWorkspace {
  canManage: boolean;
  lesson: { id: string; title: string; week: { class: { id: string; name: string } } };
  monitor: null | { students: ActivityStudent[] };
}
interface FilterOption { value: string; label: string }

const PHASES: LessonPhase[] = ['BEFORE_CLASS', 'DURING_CLASS', 'AFTER_CLASS'];
const DIFFICULTY_OPTIONS: FilterOption[] = [
  { value: 'EASY', label: 'Easy' },
  { value: 'MEDIUM', label: 'Medium' },
  { value: 'HARD', label: 'Hard' },
];
const errorMessage = (error: unknown, fallback: string) => (error as { response?: { data?: { error?: string } } })?.response?.data?.error || fallback;
const isoOrNull = (value: string) => value ? new Date(value).toISOString() : null;

export default function CreateLessonQuiz() {
  const { classId, lessonId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const backPath = classId && lessonId ? `/dashboard/class/${classId}/lesson/${lessonId}` : '/dashboard/classes';
  const requestedPhase = searchParams.get('phase') as LessonPhase | null;
  const lessonPhase: LessonPhase = requestedPhase && PHASES.includes(requestedPhase) ? requestedPhase : 'DURING_CLASS';
  useDashboardBack(() => navigate(backPath), Boolean(classId && lessonId));

  const role = localStorage.getItem('userRole') || 'TEACHER';
  const [workspace, setWorkspace] = useState<QuizWorkspace | null>(null);
  const [contextLoading, setContextLoading] = useState(true);
  const [contextError, setContextError] = useState('');
  const [title, setTitle] = useState('');
  const [subject, setSubject] = useState<BankSubject>('RW');
  const [source, setSource] = useState<'MINE' | 'SYSTEM'>('SYSTEM');
  const [search, setSearch] = useState('');
  const [domainCodes, setDomainCodes] = useState<string[]>([]);
  const [skillCodes, setSkillCodes] = useState<string[]>([]);
  const [difficulties, setDifficulties] = useState<BankQuestionDifficulty[]>([]);
  const [taxonomy, setTaxonomy] = useState<TaxonomyDomain[]>([]);
  const [page, setPage] = useState(1);
  const [questionPage, setQuestionPage] = useState<BankQuestionPage | null>(null);
  const [selectedById, setSelectedById] = useState<Record<string, BankQuestion>>({});
  const [viewingQuestion, setViewingQuestion] = useState<BankQuestion | null>(null);
  const [duration, setDuration] = useState(10);
  const [availableAt, setAvailableAt] = useState('');
  const [dueAt, setDueAt] = useState('');
  const [maxAttempts, setMaxAttempts] = useState(1);
  const [scorePolicy, setScorePolicy] = useState<'FIRST' | 'BEST' | 'LATEST'>('FIRST');
  const [allStudents, setAllStudents] = useState(true);
  const [studentIds, setStudentIds] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState('');

  const loadContext = useCallback(async () => {
    if (!lessonId || !classId) {
      setContextError('The lesson could not be identified.');
      setContextLoading(false);
      return;
    }
    setContextLoading(true);
    setContextError('');
    try {
      const response = await axiosClient.get<{ success: boolean; data: QuizWorkspace }>(`/api/progress/lessons/${lessonId}/workspace`);
      if (!response.data.canManage || response.data.lesson.week.class.id !== classId) {
        setContextError('You do not have access to create a quiz for this lesson.');
        return;
      }
      setWorkspace(response.data);
    } catch (error) {
      setContextError(errorMessage(error, 'Unable to load this lesson.'));
    } finally {
      setContextLoading(false);
    }
  }, [classId, lessonId]);

  const loadQuestions = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const params = new URLSearchParams({ source, subject, status: 'PUBLISHED', page: String(page), limit: '20' });
      if (search.trim()) params.set('search', search.trim());
      if (domainCodes.length) params.set('domainCodes', domainCodes.join(','));
      if (skillCodes.length) params.set('skillCodes', skillCodes.join(','));
      if (difficulties.length) params.set('difficulties', difficulties.join(','));
      setQuestionPage(await axiosClient.get<BankQuestionPage, BankQuestionPage>(`/api/question-bank?${params}`));
    } catch (error) {
      setLoadError(errorMessage(error, 'Unable to load questions from Question Bank.'));
    } finally {
      setLoading(false);
    }
  }, [difficulties, domainCodes, page, search, skillCodes, source, subject]);

  useEffect(() => { void loadContext(); }, [loadContext]);
  useEffect(() => {
    const timeout = window.setTimeout(() => void loadQuestions(), search.trim() ? 250 : 0);
    return () => window.clearTimeout(timeout);
  }, [loadQuestions, search]);
  useEffect(() => {
    void axiosClient.get<TaxonomyDomain[], TaxonomyDomain[]>(`/api/tests/taxonomy?subject=${subject}`).then(setTaxonomy).catch(() => setTaxonomy([]));
  }, [subject]);

  const students = useMemo(() => workspace?.monitor?.students || [], [workspace]);
  const selected = useMemo(() => Object.values(selectedById), [selectedById]);
  const availableSkills = useMemo(() => {
    const domains = domainCodes.length ? taxonomy.filter(domain => domainCodes.includes(domain.code)) : taxonomy;
    return [...new Map(domains.flatMap(domain => domain.skills).map(skill => [skill.code, skill])).values()];
  }, [domainCodes, taxonomy]);
  const toggleQuestion = (question: BankQuestion) => setSelectedById(current => {
    const next = { ...current };
    if (next[question.id]) delete next[question.id]; else next[question.id] = question;
    return next;
  });
  const changeSubject = (value: BankSubject) => {
    setSubject(value);
    setDomainCodes([]);
    setSkillCodes([]);
    setDifficulties([]);
    setPage(1);
    setSelectedById({});
    setViewingQuestion(null);
  };
  const toggleStudent = (studentId: number) => setStudentIds(current => current.includes(studentId) ? current.filter(id => id !== studentId) : [...current, studentId]);
  const updateDomains = (nextDomainCodes: string[]) => {
    setDomainCodes(nextDomainCodes);
    if (nextDomainCodes.length) {
      const allowedSkills = new Set(taxonomy.filter(domain => nextDomainCodes.includes(domain.code)).flatMap(domain => domain.skills.map(skill => skill.code)));
      setSkillCodes(current => current.filter(code => allowedSkills.has(code)));
    }
    setPage(1);
  };
  const activeFilterTags = [
    ...domainCodes.map(code => ({ key: `domain-${code}`, label: taxonomy.find(domain => domain.code === code)?.name || code, onRemove: () => updateDomains(domainCodes.filter(value => value !== code)) })),
    ...skillCodes.map(code => ({ key: `skill-${code}`, label: availableSkills.find(skill => skill.code === code)?.name || taxonomy.flatMap(domain => domain.skills).find(skill => skill.code === code)?.name || code, onRemove: () => { setSkillCodes(current => current.filter(value => value !== code)); setPage(1); } })),
    ...difficulties.map(value => ({ key: `difficulty-${value}`, label: DIFFICULTY_OPTIONS.find(option => option.value === value)?.label || value, onRemove: () => { setDifficulties(current => current.filter(item => item !== value)); setPage(1); } })),
  ];

  const submit = async () => {
    if (!classId || !lessonId) return;
    if (!title.trim()) return toast.error('Enter a quiz title');
    if (!selected.length) return toast.error('Select at least one question');
    if (!students.length) return toast.error('Add at least one student before publishing a quiz');
    if (!allStudents && !studentIds.length) return toast.error('Select at least one student');
    if (availableAt && dueAt && new Date(availableAt) >= new Date(dueAt)) return toast.error('Due date must be after availability');
    setSaving(true);
    try {
      await axiosClient.post('/api/question-bank/quizzes', {
        classId,
        lessonId,
        lessonPhase,
        title: title.trim(),
        subject,
        duration,
        questions: selected.map(question => ({ sourceBankQuestionId: question.id, sourceBankVersionId: question.versionId })),
        availableAt: isoOrNull(availableAt),
        dueAt: isoOrNull(dueAt),
        maxAttempts,
        scorePolicy,
        ...(!allStudents ? { studentIds } : {}),
      });
      toast.success('Quiz created and assigned');
      navigate(backPath);
    } catch (error) {
      toast.error(errorMessage(error, 'Unable to create this quiz.'));
    } finally {
      setSaving(false);
    }
  };

  if (contextLoading) return <PageShell><Skeleton className="h-24" /><div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(22rem,26rem)]"><Skeleton className="h-[36rem]" /><Skeleton className="h-[36rem]" /></div></PageShell>;
  if (contextError || !workspace) return <PageShell><PageHeader title="Create quiz" description="Build a quiz from published Question Bank questions." /><Card className="items-center p-8 text-center"><BookCopy className="size-8 text-muted-foreground" /><p className="font-medium text-foreground">Quiz creation is unavailable</p><p className="max-w-lg text-body text-muted-foreground">{contextError || 'This lesson could not be loaded.'}</p><Button variant="outline" onClick={() => navigate(backPath)}>Back to lesson</Button></Card></PageShell>;

  return <PageShell>
    <PageHeader
      title="Create quiz"
      description={`Select Question Bank questions and assign the quiz to ${workspace.lesson.title}.`}
      actions={<Button variant="outline" disabled={saving} onClick={() => navigate(backPath)}>Cancel</Button>}
    />

    <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(22rem,26rem)] xl:items-start">
      <DataSurface className="min-w-0">
        <div className="space-y-4 border-b border-ui-border p-4 sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div><h2 className="text-title font-semibold text-foreground">Question Bank</h2><p className="text-caption text-muted-foreground">One quiz can contain Reading & Writing or Math questions.</p></div>
            <Badge tone="neutral">{selected.length} selected</Badge>
          </div>
          <Tabs items={[{ value: 'RW' as const, label: 'Reading & Writing' }, { value: 'MATH' as const, label: 'Math' }]} value={subject} onValueChange={changeSubject} ariaLabel="Quiz subject" />
          <div className={cn('grid gap-2 sm:grid-cols-2', role !== 'ADMIN' ? 'lg:grid-cols-4' : 'lg:grid-cols-3')}>
            {role !== 'ADMIN' && <Select value={source} onValueChange={value => { setSource(value as typeof source); setPage(1); setSelectedById({}); }}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="SYSTEM">System questions</SelectItem><SelectItem value="MINE">My questions</SelectItem></SelectContent></Select>}
            <MultiSelectFilter label="Domains" options={taxonomy.map(domain => ({ value: domain.code, label: domain.name }))} values={domainCodes} onChange={updateDomains} />
            <MultiSelectFilter label="Skills" options={availableSkills.map(skill => ({ value: skill.code, label: skill.name }))} values={skillCodes} onChange={values => { setSkillCodes(values); setPage(1); }} />
            <MultiSelectFilter label="Difficulty" options={DIFFICULTY_OPTIONS} values={difficulties} onChange={values => { setDifficulties(values as BankQuestionDifficulty[]); setPage(1); }} />
          </div>
          {activeFilterTags.length > 0 && <div className="flex flex-wrap items-center gap-2" aria-label="Active question filters"><span className="text-caption font-medium text-muted-foreground">Filtered by</span>{activeFilterTags.map(tag => <span key={tag.key} className="inline-flex max-w-full items-center gap-1 rounded-full border border-ui-border bg-muted/40 py-1 pl-2.5 pr-1 text-caption font-medium text-foreground"><span className="max-w-64 truncate">{tag.label}</span><button type="button" className="flex size-5 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label={`Remove ${tag.label} filter`} onClick={tag.onRemove}><X className="size-3" /></button></span>)}</div>}
          <label className="relative block"><span className="sr-only">Search questions</span><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input value={search} onChange={event => { setSearch(event.target.value); setPage(1); }} placeholder="Search question content…" className="pl-9" /></label>
        </div>

        <div className="min-w-0 overflow-x-auto">
          <div className="min-w-[46rem]">
            <div className="grid grid-cols-[2.5rem_8.5rem_minmax(11rem,0.9fr)_minmax(14rem,1.2fr)_7rem] items-center gap-3 border-b border-ui-border bg-muted/20 px-4 py-2 text-caption font-medium text-muted-foreground" aria-hidden="true">
              <span /><span>Question ID</span><span>Domain</span><span>Skill</span><span>Difficulty</span>
            </div>
            {loading ? <div className="space-y-2 p-4">{Array.from({ length: 6 }, (_, index) => <Skeleton key={index} className="h-14 w-full" />)}</div>
              : loadError ? <div className="p-10 text-center"><p className="text-body text-danger">{loadError}</p><Button className="mt-3" variant="outline" size="sm" onClick={() => void loadQuestions()}>Try again</Button></div>
                : !questionPage?.items.length ? <div className="flex flex-col items-center px-5 py-14 text-center"><BookCopy className="size-7 text-muted-foreground" /><p className="mt-3 font-medium">No matching published questions</p><p className="mt-1 text-caption text-muted-foreground">Change the source or filters in Question Bank.</p></div>
                  : <div className="divide-y divide-ui-border">{questionPage.items.map(question => {
                    const checked = Boolean(selectedById[question.id]);
                    return <div key={question.id} className={cn('grid grid-cols-[2.5rem_8.5rem_minmax(11rem,0.9fr)_minmax(14rem,1.2fr)_7rem] items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/25', checked && 'bg-accent/60')}>
                      <Checkbox checked={checked} onCheckedChange={() => toggleQuestion(question)} aria-label={`${checked ? 'Remove' : 'Add'} question ${questionIdLabel(question.id)}`} />
                      <Button variant="link" size="sm" className="h-auto justify-start p-0 font-mono font-semibold" title={question.id} onClick={() => setViewingQuestion(question)}>{questionIdLabel(question.id)}</Button>
                      <span className="text-body text-foreground">{question.domain.name}</span>
                      <span className="text-body text-foreground">{question.skill.name}</span>
                      <QuestionDifficultyBadge difficulty={question.difficulty} />
                    </div>;
                  })}</div>}
          </div>
        </div>
        {questionPage && questionPage.pagination.totalPages > 1 && <DataPagination><span className="text-caption text-muted-foreground">Page {page} of {questionPage.pagination.totalPages} · {questionPage.pagination.total} questions</span><div className="flex gap-2"><Button variant="outline" size="sm" disabled={page <= 1 || loading} onClick={() => setPage(current => current - 1)}>Previous</Button><Button variant="outline" size="sm" disabled={page >= questionPage.pagination.totalPages || loading} onClick={() => setPage(current => current + 1)}>Next</Button></div></DataPagination>}
      </DataSurface>

      <Card className="gap-5 p-4 shadow-none xl:sticky xl:top-5 sm:p-5">
        <div><h2 className="text-title font-semibold text-foreground">Quiz settings</h2><p className="mt-1 text-caption text-muted-foreground">Choose availability, scoring, and students.</p></div>
        <Field label="Quiz title"><Input autoFocus value={title} onChange={event => setTitle(event.target.value)} placeholder="e.g. Linear equations check-in" maxLength={160} /></Field>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-2"><Field label="Duration (minutes)"><Input type="number" min={1} max={180} value={duration} onChange={event => setDuration(Math.min(180, Math.max(1, Number(event.target.value))))} /></Field><Field label="Attempts"><Input type="number" min={1} max={10} value={maxAttempts} onChange={event => setMaxAttempts(Math.min(10, Math.max(1, Number(event.target.value))))} /></Field></div>
        <Field label="Score policy"><Select value={scorePolicy} onValueChange={value => setScorePolicy(value as typeof scorePolicy)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="FIRST">First attempt</SelectItem><SelectItem value="BEST">Best attempt</SelectItem><SelectItem value="LATEST">Latest attempt</SelectItem></SelectContent></Select></Field>
        <Field label="Available from"><DateTimePicker value={availableAt} onChange={setAvailableAt} placeholder="Available now" ariaLabel="Quiz available from" /></Field>
        <Field label="Due date"><DateTimePicker value={dueAt} minDate={availableAt || undefined} onChange={setDueAt} placeholder="No deadline" ariaLabel="Quiz due date" /></Field>
        <div><div className="flex items-center justify-between gap-3"><div><p className="text-body font-medium text-foreground">Students</p><p className="text-caption text-muted-foreground">Assign the whole class or selected students.</p></div><label className="flex shrink-0 items-center gap-2 text-caption"><Checkbox checked={allStudents} onCheckedChange={checked => { setAllStudents(Boolean(checked)); setStudentIds([]); }} />All</label></div>{!allStudents && <div className="mt-3 max-h-56 space-y-2 overflow-y-auto">{students.map(student => <label key={student.id} className="flex items-center gap-2 rounded-control border border-ui-border bg-surface px-3 py-2"><Checkbox checked={studentIds.includes(student.id)} onCheckedChange={() => toggleStudent(student.id)} /><span className="min-w-0"><span className="block truncate text-caption font-medium">{student.name || student.email}</span><span className="block truncate text-caption text-muted-foreground">{student.email}</span></span></label>)}</div>}</div>
        <div className="border-t border-ui-border pt-4"><Button className="w-full" disabled={saving || !title.trim() || !selected.length || !students.length || (!allStudents && !studentIds.length)} onClick={() => void submit()}>{saving ? <><LoadingSpinner />Creating…</> : `Create quiz · ${selected.length} question${selected.length === 1 ? '' : 's'}`}</Button></div>
      </Card>
    </div>

    <QuestionPreviewModal question={viewingQuestion} questions={questionPage?.items || []} onQuestionChange={setViewingQuestion} onClose={() => setViewingQuestion(null)} />
  </PageShell>;
}

function PageShell({ children }: { children: React.ReactNode }) {
  return <div className="h-full min-w-0 overflow-y-auto overflow-x-hidden bg-background"><main className="mx-auto w-full max-w-screen-2xl space-y-5 p-4 pb-10 md:p-6 md:pb-10">{children}</main></div>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-2"><p className="text-caption font-medium text-foreground">{label}</p>{children}</div>;
}

function MultiSelectFilter({ label, options, values, onChange }: { label: string; options: FilterOption[]; values: string[]; onChange: (values: string[]) => void }) {
  const toggle = (value: string) => onChange(values.includes(value) ? values.filter(item => item !== value) : [...values, value]);
  return <Popover>
    <PopoverTrigger asChild>
      <Button type="button" variant="outline" className={cn('w-full min-w-0 justify-between px-3', values.length > 0 && 'bg-muted/50 text-foreground ring-1 ring-foreground/40')}>
        <span className="truncate">{label}</span>
        <span className="flex shrink-0 items-center gap-1.5">{values.length > 0 && <span className="flex min-w-5 items-center justify-center rounded-full bg-foreground px-1.5 text-[11px] font-semibold text-background">{values.length}</span>}<ChevronDown className="size-4 text-muted-foreground" /></span>
      </Button>
    </PopoverTrigger>
    <PopoverContent align="start" className="w-80 max-w-[calc(100vw-2rem)] overflow-hidden p-0">
      <div className="flex items-center justify-between gap-3 border-b border-ui-border px-3 py-2.5"><p className="text-body font-semibold text-foreground">{label}</p>{values.length > 0 && <Button type="button" variant="ghost" size="xs" onClick={() => onChange([])}>Clear</Button>}</div>
      <div className="max-h-72 overflow-y-auto p-1.5">
        {options.length === 0 ? <p className="px-3 py-5 text-center text-caption text-muted-foreground">No options available.</p> : options.map(option => {
          const checked = values.includes(option.value);
          return <label key={option.value} className="flex cursor-pointer items-start gap-2.5 rounded-control px-2.5 py-2 text-body text-foreground hover:bg-muted/60"><Checkbox checked={checked} onCheckedChange={() => toggle(option.value)} className="mt-0.5" /><span className="min-w-0 leading-5">{option.label}</span></label>;
        })}
      </div>
    </PopoverContent>
  </Popover>;
}
