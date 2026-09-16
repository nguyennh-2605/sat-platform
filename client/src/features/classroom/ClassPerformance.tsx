import { useCallback, useEffect, useState } from 'react';
import { Activity, AlertTriangle, ArrowRight, BarChart3, BookOpenCheck, CheckCircle2, ClipboardCheck, RefreshCw, Target, Users } from 'lucide-react';
import toast from 'react-hot-toast';
import { Badge, EmptyState, Modal, Tabs } from '@/components/ui/AppUI';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { DataSurface } from '@/components/ui/data-surface';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import axiosClient from '@/lib/axios';
import { AssignmentComposer, AssignTestsComposer, type ActivityStudent, type LearningFollowUpDraft } from './activity-composer/ActivityComposers';

type PerformanceSection = 'OVERVIEW' | 'STUDENTS' | 'SKILLS' | 'ASSESSMENTS' | 'FOLLOW_UPS';
type FollowUpStatus = 'OPEN' | 'ASSIGNED' | 'IN_PROGRESS' | 'READY_TO_EVALUATE' | 'RESOLVED' | 'NEEDS_FOLLOW_UP' | 'DISMISSED';

interface TaxonomyRow {
  code: string;
  name: string;
  subject: 'RW' | 'MATH';
  correct: number;
  answerCount: number;
  studentCount: number;
  accuracy: number | null;
  sufficient: boolean;
  affectedStudents: Array<{ id: number; name: string; accuracy: number; answerCount: number }>;
  targetBaseline: { correct: number; answerCount: number; studentCount: number; accuracy: number | null };
}

interface StudentRow {
  id: number;
  name: string;
  email: string;
  assigned: number;
  completed: number;
  completionRate: number | null;
  overdue: number;
  attendance: { sessions: number; absences: number; late: number };
  accuracy: number | null;
  answerCount: number;
  trend: number | null;
  weakSkills: Array<{ code: string; name: string; correct: number; answerCount: number; accuracy: number }>;
}

interface FollowUpRow {
  id: string;
  sourceType: LearningFollowUpDraft['sourceType'];
  actionType: 'TEST' | 'HOMEWORK' | 'CHECK_IN';
  status: FollowUpStatus;
  subject: 'RW' | 'MATH' | null;
  domainCode: string | null;
  domainName: string | null;
  skillCode: string | null;
  skillName: string | null;
  reason: string | null;
  baseline: { accuracy: number | null; correct: number | null; answerCount: number | null; studentCount: number | null; classificationCoverage: number | null };
  outcome: { accuracy: number | null; correct: number; answerCount: number; sufficient: boolean; delta: number | null };
  targets: Array<{ id: number; name: string; email: string }>;
  progress: { assigned: number; completed: number };
  activities: Array<{ id: string; type: 'TEST' | 'HOMEWORK'; title: string; dueAt: string | null; deliveryId: string | null; assignmentId: string | null }>;
  resolutionNote: string | null;
  createdAt: string;
  resolvedAt: string | null;
}

interface PerformanceResponse {
  rangeDays: number;
  class: { id: string; name: string; studentCount: number };
  summary: { assigned: number; completed: number; completionRate: number | null; assessedStudents: number; averageAccuracy: number | null; needsAttention: number; classificationCoverage: number | null; totalAnswers: number; attendance: { sessions: number; present: number; records: number; rate: number | null } };
  students: StudentRow[];
  domains: TaxonomyRow[];
  skills: TaxonomyRow[];
  assessments: Array<{ id: string; title: string; subject: 'RW' | 'MATH'; mode: 'PRACTICE' | 'EXAM'; dueAt: string | null; createdAt: string; assigned: number; completed: number; completionRate: number; averageAccuracy: number | null }>;
  followUps: FollowUpRow[];
}

interface PendingFollowUp {
  draft: LearningFollowUpDraft;
  title: string;
  description: string;
}

const SECTION_TABS = [
  { value: 'OVERVIEW' as const, label: 'Overview' },
  { value: 'STUDENTS' as const, label: 'Students' },
  { value: 'SKILLS' as const, label: 'Skills' },
  { value: 'ASSESSMENTS' as const, label: 'Assessments' },
  { value: 'FOLLOW_UPS' as const, label: 'Follow-ups' },
];
const EMPTY_STUDENT_IDS: number[] = [];

const errorMessage = (error: unknown, fallback: string) => (error as { response?: { data?: { error?: string } } })?.response?.data?.error || fallback;

export default function ClassPerformance({ classId, students, onOpenAssessment }: { classId: string; students: ActivityStudent[]; onOpenAssessment: (deliveryId: string) => void }) {
  const [data, setData] = useState<PerformanceResponse | null>(null);
  const [range, setRange] = useState('30');
  const [section, setSection] = useState<PerformanceSection>('OVERVIEW');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [pending, setPending] = useState<PendingFollowUp | null>(null);
  const [action, setAction] = useState<'TEST' | 'HOMEWORK' | null>(null);
  const [repeatingFollowUpId, setRepeatingFollowUpId] = useState<string | null>(null);
  const [review, setReview] = useState<{ item: FollowUpRow; status: 'RESOLVED' | 'NEEDS_FOLLOW_UP' | 'DISMISSED' } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setData(await axiosClient.get<PerformanceResponse, PerformanceResponse>(`/api/classes/${classId}/performance?range=${range}`));
    } catch (requestError) {
      setError(errorMessage(requestError, 'Class performance could not be loaded.'));
    } finally {
      setLoading(false);
    }
  }, [classId, range]);

  useEffect(() => { void load(); }, [load]);

  const beginSkillFollowUp = (item: TaxonomyRow) => {
    const studentIds = item.affectedStudents.map(student => student.id);
    setPending({
      title: item.name,
      description: `${item.accuracy ?? '—'}% accuracy across ${item.answerCount} classified answers from ${item.studentCount} students.`,
      draft: {
        sourceType: 'SKILL_SIGNAL', subject: item.subject, skillCode: item.code, skillName: item.name,
        reason: `Reinforce ${item.name} based on class performance evidence.`, baselineAccuracy: item.targetBaseline.accuracy,
        baselineCorrect: item.targetBaseline.correct, baselineAnswerCount: item.targetBaseline.answerCount, baselineStudentCount: item.targetBaseline.studentCount,
        classificationCoverage: data?.summary.classificationCoverage, studentIds: studentIds.length ? studentIds : students.map(student => student.id),
      },
    });
  };

  const beginStudentFollowUp = (item: StudentRow) => setPending({
    title: item.name,
    description: item.accuracy === null ? 'No assessed answers in this range.' : `${item.accuracy}% accuracy across ${item.answerCount} classified answers${item.overdue ? ` · ${item.overdue} overdue` : ''}.`,
    draft: {
      sourceType: 'STUDENT_CHECK_IN', sourceStudentId: item.id,
      reason: item.overdue ? `${item.name} has overdue classroom work.` : item.attendance.sessions >= 3 && item.attendance.absences >= 2 ? `${item.name} was absent from ${item.attendance.absences} recent sessions.` : `Review recent performance with ${item.name}.`,
      baselineAccuracy: item.accuracy, baselineAnswerCount: item.answerCount, baselineStudentCount: 1,
      classificationCoverage: data?.summary.classificationCoverage, studentIds: [item.id],
    },
  });

  const startAction = (nextAction: 'TEST' | 'HOMEWORK') => {
    setAction(nextAction);
  };

  const finishAction = async () => {
    if (repeatingFollowUpId) {
      try {
        await axiosClient.patch(`/api/classes/${classId}/follow-ups/${repeatingFollowUpId}`, { status: 'NEEDS_FOLLOW_UP', resolutionNote: 'A new follow-up cycle was assigned.' });
      } catch (error) {
        toast.error(errorMessage(error, 'The new activity was assigned, but the previous cycle could not be updated.'));
      }
    }
    setAction(null);
    setPending(null);
    setRepeatingFollowUpId(null);
    setSection('FOLLOW_UPS');
    await load();
  };
  const cancelAction = () => {
    setAction(null);
    setPending(null);
    setRepeatingFollowUpId(null);
  };

  const repeatFollowUp = (item: FollowUpRow) => {
    const baseline = item.outcome.sufficient ? item.outcome : item.baseline;
    setRepeatingFollowUpId(item.id);
    setPending({
      title: item.skillName || item.domainName || item.targets[0]?.name || 'Follow-up cycle',
      description: item.outcome.sufficient ? `${item.outcome.accuracy}% accuracy across ${item.outcome.answerCount} outcome answers.` : 'Comparable outcome evidence is not sufficient yet.',
      draft: {
        sourceType: item.skillCode ? 'SKILL_SIGNAL' : 'MANUAL', subject: item.subject,
        domainCode: item.domainCode, domainName: item.domainName, skillCode: item.skillCode, skillName: item.skillName,
        reason: `Continue the learning cycle from follow-up ${item.id}.`, baselineAccuracy: baseline.accuracy,
        baselineCorrect: baseline.correct, baselineAnswerCount: baseline.answerCount, baselineStudentCount: item.targets.length,
        studentIds: item.targets.map(target => target.id),
      },
    });
  };

  if (loading && !data) return <PerformanceSkeleton />;
  if (!data || error) return <EmptyState icon={<BarChart3 />} title="Unable to load performance" description={error || 'Try loading this class again.'} action={<Button variant="outline" onClick={() => void load()}><RefreshCw />Try again</Button>} />;

  const activeFollowUps = data.followUps.filter(item => !['RESOLVED', 'DISMISSED'].includes(item.status));
  const sufficientSkills = data.skills.filter(item => item.sufficient);
  const attentionStudents = data.students.filter(item => item.overdue > 0 || (item.answerCount >= 5 && (item.accuracy ?? 100) < 60) || (item.attendance.sessions >= 3 && item.attendance.absences >= 2));
  const followUpStudentIds = pending?.draft.studentIds || EMPTY_STUDENT_IDS;

  return <div className="space-y-5 py-2">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div><h2 className="text-base font-semibold text-foreground">Class performance</h2><p className="mt-1 text-sm text-muted-foreground">Turn classroom evidence into targeted follow-ups, then verify the result.</p></div>
      <div className="flex items-center gap-2">
        <Select value={range} onValueChange={setRange}><SelectTrigger className="w-32" aria-label="Performance range"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="7">Last 7 days</SelectItem><SelectItem value="30">Last 30 days</SelectItem><SelectItem value="90">Last 90 days</SelectItem></SelectContent></Select>
        <Button variant="outline" size="icon" onClick={() => void load()} aria-label="Refresh performance"><RefreshCw /></Button>
      </div>
    </div>

    <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
      <MetricCard label="Completion" value={percent(data.summary.completionRate)} detail={`${data.summary.completed}/${data.summary.assigned} assigned activities`} icon={CheckCircle2} />
      <MetricCard label="Average accuracy" value={percent(data.summary.averageAccuracy)} detail={`${data.summary.assessedStudents}/${data.class.studentCount} students assessed`} icon={Target} />
      <MetricCard label="Needs attention" value={String(data.summary.needsAttention)} detail="Overdue or low evidence-backed accuracy" icon={AlertTriangle} />
      <MetricCard label="Classification" value={percent(data.summary.classificationCoverage)} detail={`${data.summary.totalAnswers} answers in range`} icon={Activity} />
      <MetricCard label="Attendance" value={percent(data.summary.attendance.rate)} detail={`${data.summary.attendance.sessions} recorded sessions`} icon={Users} />
    </div>

    <div className="overflow-x-auto"><Tabs items={SECTION_TABS} value={section} onValueChange={setSection} ariaLabel="Performance sections" /></div>

    {section === 'OVERVIEW' && <div className="grid gap-5 xl:grid-cols-2">
      <SignalList title="Skills to reinforce" description="Only evidence meeting the minimum answer and student thresholds is shown." empty="No reliable weak-skill signals yet." items={sufficientSkills.slice(0, 5).map(item => ({ id: item.code, title: item.name, meta: `${item.subject === 'RW' ? 'Reading & Writing' : 'Math'} · ${item.answerCount} answers · ${item.studentCount} students`, value: percent(item.accuracy), onAction: () => beginSkillFollowUp(item) }))} />
      <SignalList title="Students to check in" description="Students with overdue work, low recent accuracy, or repeated absences." empty="No students currently need evidence-based attention." items={attentionStudents.slice(0, 5).map(item => ({ id: String(item.id), title: item.name, meta: item.overdue ? `${item.overdue} overdue · ${item.answerCount} classified answers` : item.attendance.sessions >= 3 && item.attendance.absences >= 2 ? `${item.attendance.absences} absences across ${item.attendance.sessions} recorded sessions` : `${item.answerCount} classified answers`, value: percent(item.accuracy), onAction: () => beginStudentFollowUp(item) }))} />
      <div className="xl:col-span-2"><FollowUpsTable items={activeFollowUps.slice(0, 6)} onOpenAssessment={onOpenAssessment} onReview={setReview} onRepeat={repeatFollowUp} compact /></div>
    </div>}
    {section === 'STUDENTS' && <StudentsTable items={data.students} onFollowUp={beginStudentFollowUp} />}
    {section === 'SKILLS' && <SkillsTable items={data.skills} onFollowUp={beginSkillFollowUp} />}
    {section === 'ASSESSMENTS' && <AssessmentsTable items={data.assessments} onOpen={onOpenAssessment} />}
    {section === 'FOLLOW_UPS' && <FollowUpsTable items={data.followUps} onOpenAssessment={onOpenAssessment} onReview={setReview} onRepeat={repeatFollowUp} />}

    <FollowUpActionDialog pending={action ? null : pending} onClose={() => setPending(null)} onSelect={startAction} />
    <AssignTestsComposer open={action === 'TEST'} onClose={cancelAction} classId={classId} students={students} initialStudentIds={followUpStudentIds} followUp={pending?.draft} onCreated={finishAction} />
    <AssignmentComposer open={action === 'HOMEWORK'} onClose={cancelAction} classId={classId} students={students} initialStudentIds={followUpStudentIds} followUp={pending?.draft} onCreated={finishAction} />
    <FollowUpReviewDialog classId={classId} review={review} onClose={() => setReview(null)} onSaved={async () => { setReview(null); await load(); }} />
  </div>;
}

function MetricCard({ label, value, detail, icon: Icon }: { label: string; value: string; detail: string; icon: typeof Activity }) {
  return <Card><CardHeader className="pb-0"><div className="flex items-center justify-between gap-3"><CardDescription>{label}</CardDescription><Icon className="size-4 text-primary" /></div><CardTitle className="mt-2 text-2xl tabular-nums">{value}</CardTitle></CardHeader><CardContent><p className="text-xs text-muted-foreground">{detail}</p></CardContent></Card>;
}

function SignalList({ title, description, empty, items }: { title: string; description: string; empty: string; items: Array<{ id: string; title: string; meta: string; value: string; onAction: () => void }> }) {
  return <Card><CardHeader><CardTitle>{title}</CardTitle><CardDescription>{description}</CardDescription></CardHeader><CardContent className="space-y-1">{items.length === 0 ? <p className="py-8 text-center text-sm text-muted-foreground">{empty}</p> : items.map(item => <div key={item.id} className="flex items-center gap-3 border-b border-ui-border py-3 last:border-0"><div className="min-w-0 flex-1"><p className="truncate font-medium text-foreground">{item.title}</p><p className="mt-1 truncate text-xs text-muted-foreground">{item.meta}</p></div><span className="text-sm font-semibold tabular-nums">{item.value}</span><Button variant="ghost" size="sm" onClick={item.onAction}>Follow up<ArrowRight /></Button></div>)}</CardContent></Card>;
}

function StudentsTable({ items, onFollowUp }: { items: StudentRow[]; onFollowUp: (item: StudentRow) => void }) {
  return <DataSurface><Table><TableHeader><TableRow><TableHead>Student</TableHead><TableHead>Completion</TableHead><TableHead>Accuracy</TableHead><TableHead>Trend</TableHead><TableHead>Signals</TableHead><TableHead className="w-28"><span className="sr-only">Actions</span></TableHead></TableRow></TableHeader><TableBody>{items.length === 0 ? <EmptyTable colSpan={6} text="No students are enrolled in this class." /> : items.map(item => <TableRow key={item.id}><TableCell><p className="font-medium">{item.name}</p><p className="text-xs text-muted-foreground">{item.email}</p></TableCell><TableCell><p className="tabular-nums">{item.completed}/{item.assigned}</p><Progress className="mt-2 w-24" value={item.completionRate || 0} /></TableCell><TableCell>{percent(item.accuracy)}<p className="text-xs text-muted-foreground">{item.answerCount} answers</p></TableCell><TableCell>{item.trend === null ? '—' : <span className={item.trend < 0 ? 'text-danger' : 'text-primary'}>{item.trend > 0 ? '+' : ''}{item.trend} pts</span>}</TableCell><TableCell>{item.overdue ? <Badge tone="danger">{item.overdue} overdue</Badge> : item.attendance.sessions >= 3 && item.attendance.absences >= 2 ? <Badge tone="warning">{item.attendance.absences} absences</Badge> : item.weakSkills.length ? <Badge tone="warning">{item.weakSkills.length} weak skills</Badge> : <span className="text-muted-foreground">No signal</span>}</TableCell><TableCell><Button variant="outline" size="sm" onClick={() => onFollowUp(item)}>Follow up</Button></TableCell></TableRow>)}</TableBody></Table></DataSurface>;
}

function SkillsTable({ items, onFollowUp }: { items: TaxonomyRow[]; onFollowUp: (item: TaxonomyRow) => void }) {
  return <DataSurface><Table><TableHeader><TableRow><TableHead>Skill</TableHead><TableHead>Subject</TableHead><TableHead>Accuracy</TableHead><TableHead>Evidence</TableHead><TableHead>Affected</TableHead><TableHead className="w-28"><span className="sr-only">Actions</span></TableHead></TableRow></TableHeader><TableBody>{items.length === 0 ? <EmptyTable colSpan={6} text="No classified skill evidence is available yet." /> : items.map(item => <TableRow key={item.code}><TableCell><p className="font-medium">{item.name}</p><p className="text-xs text-muted-foreground">{item.code}</p></TableCell><TableCell>{item.subject === 'RW' ? 'Reading & Writing' : 'Math'}</TableCell><TableCell className="font-semibold tabular-nums">{percent(item.accuracy)}</TableCell><TableCell><p>{item.answerCount} answers</p><p className="text-xs text-muted-foreground">{item.studentCount} students</p></TableCell><TableCell>{item.affectedStudents.length || '—'}</TableCell><TableCell>{item.sufficient ? <Button variant="outline" size="sm" onClick={() => onFollowUp(item)}>Follow up</Button> : <Badge tone="neutral">More evidence needed</Badge>}</TableCell></TableRow>)}</TableBody></Table></DataSurface>;
}

function AssessmentsTable({ items, onOpen }: { items: PerformanceResponse['assessments']; onOpen: (id: string) => void }) {
  return <DataSurface><Table><TableHeader><TableRow><TableHead>Assessment</TableHead><TableHead>Subject</TableHead><TableHead>Completion</TableHead><TableHead>Accuracy</TableHead><TableHead>Assigned</TableHead><TableHead className="w-24"><span className="sr-only">Actions</span></TableHead></TableRow></TableHeader><TableBody>{items.length === 0 ? <EmptyTable colSpan={6} text="No tests were assigned in this range." /> : items.map(item => <TableRow key={item.id}><TableCell><p className="font-medium">{item.title}</p><p className="text-xs text-muted-foreground">{item.mode === 'EXAM' ? 'Test mode' : 'Practice mode'}</p></TableCell><TableCell>{item.subject === 'RW' ? 'Reading & Writing' : 'Math'}</TableCell><TableCell>{item.completed}/{item.assigned}<Progress className="mt-2 w-24" value={item.completionRate} /></TableCell><TableCell>{percent(item.averageAccuracy)}</TableCell><TableCell>{dateLabel(item.createdAt)}</TableCell><TableCell><Button variant="ghost" size="sm" onClick={() => onOpen(item.id)}>Results<ArrowRight /></Button></TableCell></TableRow>)}</TableBody></Table></DataSurface>;
}

function FollowUpsTable({ items, onOpenAssessment, onReview, onRepeat, compact = false }: { items: FollowUpRow[]; onOpenAssessment: (id: string) => void; onReview: (value: { item: FollowUpRow; status: 'RESOLVED' | 'NEEDS_FOLLOW_UP' | 'DISMISSED' }) => void; onRepeat: (item: FollowUpRow) => void; compact?: boolean }) {
  return <Card><CardHeader><CardTitle>Follow-ups</CardTitle><CardDescription>Actions created from classroom evidence and their latest outcomes.</CardDescription></CardHeader><CardContent>{items.length === 0 ? <div className="py-10 text-center"><ClipboardCheck className="mx-auto size-6 text-muted-foreground" /><p className="mt-3 text-sm font-medium">No follow-ups yet</p><p className="mt-1 text-xs text-muted-foreground">Create one from a skill or student signal.</p></div> : <div className="space-y-3">{items.slice(0, compact ? 6 : undefined).map(item => <div key={item.id} className="rounded-lg border border-ui-border p-4"><div className="flex flex-wrap items-start gap-3"><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="font-medium">{item.skillName || item.domainName || item.targets[0]?.name || 'Class follow-up'}</p><StatusBadge status={item.status} /></div><p className="mt-1 text-xs text-muted-foreground">{item.targets.length} {item.targets.length === 1 ? 'student' : 'students'} · {item.actionType === 'TEST' ? 'Targeted test' : item.actionType === 'HOMEWORK' ? 'Assignment' : 'Check-in'} · {dateLabel(item.createdAt)}</p></div><div className="text-right text-sm"><p className="font-medium tabular-nums">{item.progress.completed}/{item.progress.assigned} complete</p>{item.outcome.delta !== null ? <p className={item.outcome.delta >= 0 ? 'text-primary' : 'text-danger'}>{item.outcome.delta > 0 ? '+' : ''}{item.outcome.delta} pts vs baseline</p> : <p className="text-xs text-muted-foreground">{item.outcome.answerCount ? `${item.outcome.answerCount} outcome answers` : 'Awaiting comparable evidence'}</p>}</div></div><div className="mt-3 flex flex-wrap items-center gap-2">{item.activities.map(activity => activity.deliveryId ? <Button key={activity.id} variant="ghost" size="sm" onClick={() => onOpenAssessment(activity.deliveryId as string)}><BookOpenCheck />{activity.title}</Button> : <Badge key={activity.id} tone="neutral">{activity.title}</Badge>)}{item.status === 'READY_TO_EVALUATE' && <><Button className="ml-auto" size="sm" onClick={() => onReview({ item, status: 'RESOLVED' })}>Resolve</Button><Button variant="outline" size="sm" onClick={() => onRepeat(item)}>Continue cycle</Button></>}{item.status === 'NEEDS_FOLLOW_UP' && <Button className="ml-auto" variant="outline" size="sm" onClick={() => onRepeat(item)}>Assign next step</Button>}{!['RESOLVED', 'DISMISSED', 'NEEDS_FOLLOW_UP'].includes(item.status) && item.status !== 'READY_TO_EVALUATE' && <Button className="ml-auto" variant="ghost" size="sm" onClick={() => onReview({ item, status: 'DISMISSED' })}>Dismiss</Button>}</div></div>)}</div>}</CardContent></Card>;
}

function FollowUpActionDialog({ pending, onClose, onSelect }: { pending: PendingFollowUp | null; onClose: () => void; onSelect: (action: 'TEST' | 'HOMEWORK') => void }) {
  return <Modal open={Boolean(pending)} onClose={onClose} closeOnBackdrop presentation="content-dialog" title="Create a targeted follow-up" subtitle="The evidence below will be saved with the activity so you can evaluate the outcome later."><div className="space-y-4"><div className="rounded-lg border border-ui-border bg-muted/20 p-4"><p className="font-medium">{pending?.title}</p><p className="mt-1 text-sm text-muted-foreground">{pending?.description}</p><p className="mt-3 text-xs text-muted-foreground">Audience: {pending?.draft.studentIds.length || 0} students</p></div><div className="grid gap-3 sm:grid-cols-2"><button type="button" className="rounded-lg border border-ui-border p-4 text-left transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40" onClick={() => onSelect('TEST')}><BookOpenCheck className="size-5 text-primary" /><p className="mt-3 font-medium">Assign a test</p><p className="mt-1 text-xs text-muted-foreground">Best for measuring the same skill again.</p></button><button type="button" className="rounded-lg border border-ui-border p-4 text-left transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40" onClick={() => onSelect('HOMEWORK')}><ClipboardCheck className="size-5 text-primary" /><p className="mt-3 font-medium">Create an assignment</p><p className="mt-1 text-xs text-muted-foreground">Best for instruction, practice, or written work.</p></button></div></div></Modal>;
}

function FollowUpReviewDialog({ classId, review, onClose, onSaved }: { classId: string; review: { item: FollowUpRow; status: 'RESOLVED' | 'NEEDS_FOLLOW_UP' | 'DISMISSED' } | null; onClose: () => void; onSaved: () => Promise<void> }) {
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  useEffect(() => { if (review) setNote(review.item.resolutionNote || ''); }, [review]);
  const save = async () => {
    if (!review) return;
    setSaving(true);
    try {
      await axiosClient.patch(`/api/classes/${classId}/follow-ups/${review.item.id}`, { status: review.status, resolutionNote: note.trim() || null });
      toast.success(review.status === 'RESOLVED' ? 'Follow-up resolved' : review.status === 'DISMISSED' ? 'Follow-up dismissed' : 'Follow-up marked for another cycle');
      await onSaved();
    } catch (error) {
      toast.error(errorMessage(error, 'Unable to update this follow-up.'));
    } finally { setSaving(false); }
  };
  return <Modal open={Boolean(review)} onClose={() => !saving && onClose()} closeOnBackdrop={!saving} presentation="content-dialog" title={review?.status === 'RESOLVED' ? 'Resolve follow-up' : review?.status === 'DISMISSED' ? 'Dismiss follow-up' : 'Continue the learning cycle'} subtitle="Record the teaching decision so this signal has a clear outcome." footer={<><Button variant="outline" disabled={saving} onClick={onClose}>Cancel</Button><Button disabled={saving} onClick={() => void save()}>{saving ? 'Saving…' : 'Save outcome'}</Button></>}><label className="block"><span className="mb-2 block text-sm font-medium">Outcome note <span className="font-normal text-muted-foreground">(optional)</span></span><Textarea value={note} onChange={event => setNote(event.target.value)} rows={4} maxLength={2000} placeholder="What changed, and what should happen next?" /></label></Modal>;
}

function StatusBadge({ status }: { status: FollowUpStatus }) {
  const content: Record<FollowUpStatus, { label: string; tone: 'neutral' | 'warning' | 'success' | 'danger' }> = {
    OPEN: { label: 'Open', tone: 'neutral' }, ASSIGNED: { label: 'Assigned', tone: 'neutral' }, IN_PROGRESS: { label: 'In progress', tone: 'warning' }, READY_TO_EVALUATE: { label: 'Ready to evaluate', tone: 'warning' }, RESOLVED: { label: 'Resolved', tone: 'success' }, NEEDS_FOLLOW_UP: { label: 'Needs another cycle', tone: 'danger' }, DISMISSED: { label: 'Dismissed', tone: 'neutral' },
  };
  return <Badge tone={content[status].tone}>{content[status].label}</Badge>;
}

function EmptyTable({ colSpan, text }: { colSpan: number; text: string }) { return <TableRow className="hover:bg-transparent"><TableCell colSpan={colSpan} className="h-44 text-center text-muted-foreground">{text}</TableCell></TableRow>; }
function percent(value: number | null) { return value === null ? '—' : `${value}%`; }
function dateLabel(value: string) { return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(value)); }
function PerformanceSkeleton() { return <div className="space-y-5 py-2"><div className="h-12 w-80 animate-pulse rounded bg-muted" /><div className="grid grid-cols-2 gap-3 lg:grid-cols-5">{Array.from({ length: 5 }, (_, index) => <div key={index} className="h-28 animate-pulse rounded-xl bg-muted" />)}</div><div className="h-80 animate-pulse rounded-xl bg-muted" /></div>; }
