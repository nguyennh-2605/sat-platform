import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ArrowRight, BarChart3, CheckCircle2, Clock3, Eye, FileText, Target, Trophy, Users } from 'lucide-react';
import axiosClient from '../../lib/axios';
import { Badge, Button, Card, EmptyState, Modal, Select } from '../../components/ui/AppUI';
import { DataSurface } from '@/components/ui/data-surface';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useDashboardBack } from '../navigation/DashboardBackContext';
import { capitalizeFirstLetter } from '../../utils/text';

interface DeliveryListItem {
  id: string; title: string; createdAt: string; dueAt: string | null; maxAttempts: number; scorePolicy: 'FIRST' | 'BEST' | 'LATEST';
  test: { id: number; title: string; mode: 'EXAM' | 'PRACTICE'; questionCount: number };
  lesson?: { title: string; week: { title: string } } | null;
  stats: { assigned: number; completed: number; inProgress: number; missing: number; averageScore: number | null };
}
interface StudentRow { id: number; name: string; email: string; status: 'COMPLETED' | 'IN_PROGRESS' | 'MISSING' | 'ASSIGNED'; score: number | null; rawScore: number | null; attempts: number; submittedAt: string | null; completionTimeMs: number | null }
interface QuestionRow { id: number; number: number; sectionName: string; questionText: string; domain: string | null; skill: string | null; correct: number; incorrect: number; correctPercentage: number; averageTimeMs: number | null }
interface PerformanceReport {
  delivery: DeliveryListItem & { test: DeliveryListItem['test'] & { duration: number; subject: string } };
  kpis: { averageScore: number | null; averageCorrect: number | null; medianScore: number | null; highestScore: number | null; highestCorrect: number | null; lowestScore: number | null; lowestCorrect: number | null; participants: number; assigned: number; completionRate: number; averageTimeMs: number | null };
  students: StudentRow[]; questions: QuestionRow[]; hardestQuestions: QuestionRow[]; scoreDistribution: { label: string; count: number }[];
}
interface StudentDetail {
  student: { id: number; name: string; email: string }; testMode: 'EXAM' | 'PRACTICE';
  attempts: Array<{ id: number; attemptNo: number; status: string; score: number | null; rawScore: number | null; submittedAt: string | null; completionTimeMs: number | null; questions: Array<QuestionRow & { selectedChoice: string | null; correctAnswer: string; isCorrect: boolean; activeDurationMs: number | null; visitCount: number | null }> }>;
}

const formatDuration = (milliseconds: number | null | undefined) => {
  if (!Number.isFinite(milliseconds) || !milliseconds) return '—';
  const totalSeconds = Math.round(milliseconds / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return minutes ? `${minutes}m ${seconds}s` : `${seconds}s`;
};
const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(-2).map(part => part[0]).join('').toUpperCase();

export default function StudentAnalytics({ classId, initialDeliveryId }: { classId?: string; initialDeliveryId?: string | null }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [deliveries, setDeliveries] = useState<DeliveryListItem[]>([]);
  const [selectedDeliveryId, setSelectedDeliveryId] = useState<string | null>(initialDeliveryId || null);
  const [report, setReport] = useState<PerformanceReport | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!classId) return;
    axiosClient.get(`/api/test-deliveries/class/${classId}`)
      .then(data => setDeliveries(Array.isArray(data) ? data : []))
      .catch(error => console.error('Unable to load assigned tests:', error))
      .finally(() => setLoading(false));
  }, [classId]);
  useEffect(() => {
    if (!selectedDeliveryId) return;
    axiosClient.get(`/api/test-deliveries/${selectedDeliveryId}/performance`)
      .then(data => setReport(data))
      .catch(error => console.error('Unable to load test performance:', error))
      .finally(() => setLoading(false));
  }, [selectedDeliveryId]);

  const openReport = (deliveryId: string) => {
    setReport(null);
    setLoading(true);
    setSelectedDeliveryId(deliveryId);
    const next = new URLSearchParams(searchParams);
    next.set('tab', 'performance');
    next.set('deliveryId', deliveryId);
    setSearchParams(next, { replace: true });
  };
  const closeReport = () => {
    setSelectedDeliveryId(null);
    setReport(null);
    const next = new URLSearchParams(searchParams);
    next.delete('deliveryId');
    setSearchParams(next, { replace: true });
  };
  useDashboardBack(closeReport, Boolean(selectedDeliveryId), 10);
  if (selectedDeliveryId) return <PerformanceDashboard report={report} loading={loading} />;
  return <div className="space-y-5 animate-fade-in-up">
    <div><h2 className="text-lg font-semibold text-foreground">Test Performance</h2><p className="mt-1 text-xs text-muted-foreground">Select an assigned test to review submissions and question-level performance.</p></div>
    {loading ? <EmptyState title="Loading assigned tests…" compact /> : deliveries.length === 0 ? <EmptyState title="No assigned tests" description="Tests assigned to this class will appear here." /> : <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{deliveries.map(delivery => <Card key={delivery.id} interactive role="button" tabIndex={0} className="group cursor-pointer p-5" onClick={() => openReport(delivery.id)} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); openReport(delivery.id); } }}>
      <div className="flex items-start justify-between gap-4"><div className="flex min-w-0 gap-3"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary"><FileText size={19} /></div><div className="min-w-0"><h3 className="truncate text-sm font-semibold text-foreground">{capitalizeFirstLetter(delivery.title)}</h3><p className="mt-1 text-xs text-muted-foreground">{delivery.lesson ? `${delivery.lesson.week.title} · ${delivery.lesson.title}` : 'Direct assignment'}</p></div></div><ArrowRight size={17} className="mt-1 shrink-0 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-primary" /></div>
      <div className="mt-5 grid grid-cols-3 border-t border-ui-border pt-4 text-center"><Metric value={`${delivery.stats.completed}/${delivery.stats.assigned}`} label="Submitted" /><Metric value={delivery.stats.averageScore === null ? '—' : `${delivery.stats.averageScore}%`} label="Average" bordered /><Metric value={String(delivery.stats.inProgress)} label="In progress" /></div>
      <div className="mt-4 flex items-center justify-between text-[11px] text-muted-foreground"><Badge tone={delivery.test.mode === 'EXAM' ? 'green' : 'gold'}>{delivery.test.mode === 'EXAM' ? 'Test' : 'Practice'}</Badge><span>{delivery.dueAt ? `Due ${new Date(delivery.dueAt).toLocaleDateString()}` : 'No deadline'}</span></div>
    </Card>)}</div>}
  </div>;
}

function PerformanceDashboard({ report, loading }: { report: PerformanceReport | null; loading: boolean }) {
  const [selectedStudent, setSelectedStudent] = useState<StudentRow | null>(null);
  if (loading || !report) return <div className="space-y-5"><PageHeading title="Test Performance" subtitle="Loading report…" /><EmptyState title="Loading performance data…" compact /></div>;
  const kpis = [
    { label: 'AVERAGE SCORE', value: correctScore(report.kpis.averageCorrect, report.delivery.test.questionCount), detail: `Median ${score(report.kpis.medianScore)}`, icon: Target },
    { label: 'HIGHEST SCORE', value: correctScore(report.kpis.highestCorrect, report.delivery.test.questionCount), detail: 'Top result', icon: Trophy },
    { label: 'LOWEST SCORE', value: correctScore(report.kpis.lowestCorrect, report.delivery.test.questionCount), detail: 'Needs support', icon: BarChart3 },
    { label: 'PARTICIPANTS', value: `${report.kpis.participants}/${report.kpis.assigned}`, detail: 'Submitted', icon: Users },
    { label: 'COMPLETION RATE', value: `${report.kpis.completionRate}%`, detail: 'Of assigned students', icon: CheckCircle2 },
    { label: 'AVERAGE TIME', value: report.delivery.test.mode === 'EXAM' ? formatDuration(report.kpis.averageTimeMs) : 'N/A', detail: report.delivery.test.mode === 'EXAM' ? 'Active test duration' : 'Test mode only', icon: Clock3 },
  ];
  return <div className="space-y-6">
    <PageHeading title={capitalizeFirstLetter(report.delivery.title)} subtitle={`${capitalizeFirstLetter(report.delivery.test.title)} · ${report.delivery.test.mode === 'EXAM' ? 'Test mode' : 'Practice mode'} · ${report.delivery.test.questionCount} questions`} />
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">{kpis.map(({ label, value, detail, icon: Icon }) => <Card key={label} className="min-h-[116px] p-4"><div className="flex items-start justify-between"><span className="text-[10px] font-semibold tracking-[0.08em] text-muted-foreground">{label}</span><Icon size={15} className="text-primary" /></div><p className="mt-4 text-2xl font-semibold text-foreground">{value}</p><p className="mt-1 text-[11px] text-muted-foreground">{detail}</p></Card>)}</div>
    <div className="grid items-start gap-6 xl:grid-cols-12"><div className="space-y-6 xl:col-span-8"><QuestionBreakdown questions={report.questions} showTiming={report.delivery.test.mode === 'EXAM'} /><StudentRankings students={report.students} totalQuestions={report.delivery.test.questionCount} showTiming={report.delivery.test.mode === 'EXAM'} onView={setSelectedStudent} /></div><div className="space-y-6 xl:col-span-4"><HardestQuestions questions={report.hardestQuestions} /><ScoreDistribution items={report.scoreDistribution} /></div></div>
    {selectedStudent && <StudentDetailModal deliveryId={report.delivery.id} student={selectedStudent} onClose={() => setSelectedStudent(null)} />}
  </div>;
}

function QuestionBreakdown({ questions, showTiming }: { questions: QuestionRow[]; showTiming: boolean }) {
  return <Card className="overflow-hidden"><div className="flex flex-wrap items-center justify-between gap-3 border-b border-ui-border p-5"><div><h3 className="text-sm font-semibold">Question Performance Breakdown</h3><p className="mt-1 text-xs text-muted-foreground">Accuracy across counted submissions</p></div><div className="flex gap-4 text-xs text-muted-foreground"><Legend color="var(--primary)" label="Correct" /><Legend color="var(--danger)" label="Incorrect" /></div></div><div className="max-h-[520px] space-y-5 overflow-y-auto p-5">{questions.map(question => <div key={question.id}><div className="mb-2 flex items-center gap-3"><span className="w-8 text-xs font-semibold text-muted-foreground">Q{question.number}</span><div className="flex h-3 flex-1 overflow-hidden rounded-xs bg-danger-soft"><div className="bg-primary" style={{ width: `${question.correctPercentage}%` }} /></div><span className="w-10 text-right text-xs font-semibold">{question.correctPercentage}%</span></div><div className="ml-11 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground"><span>{question.correct} correct · {question.incorrect} incorrect</span>{question.domain && <Badge>{question.domain}</Badge>}{question.skill && <Badge tone="green">{question.skill}</Badge>}{showTiming && <span className="ml-auto">Avg. {formatDuration(question.averageTimeMs)}</span>}</div></div>)}{questions.length === 0 && <p className="py-10 text-center text-sm text-muted-foreground">No question data yet.</p>}</div></Card>;
}
function StudentRankings({ students, totalQuestions, showTiming, onView }: { students: StudentRow[]; totalQuestions: number; showTiming: boolean; onView: (student: StudentRow) => void }) {
  const ordered = useMemo(() => [...students].sort((a, b) => (b.score ?? -1) - (a.score ?? -1)), [students]);
  return <DataSurface><div className="flex items-center gap-2 border-b border-ui-border px-4 py-3"><Users size={16} className="text-primary" /><h3 className="text-sm font-medium">Student Rankings</h3></div><Table><TableHeader><TableRow><TableHead>Student</TableHead><TableHead className="text-center">Status</TableHead><TableHead className="text-center">Score</TableHead>{showTiming && <TableHead className="text-center">Time</TableHead>}<TableHead className="w-12 text-right"><span className="sr-only">Actions</span></TableHead></TableRow></TableHeader><TableBody>{ordered.length === 0 ? <TableRow className="hover:bg-transparent"><TableCell colSpan={showTiming ? 5 : 4} className="h-40 text-center text-muted-foreground">No students are assigned.</TableCell></TableRow> : ordered.map(student => <TableRow key={student.id}><TableCell><div className="flex items-center gap-2"><span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary-soft text-[10px] font-semibold text-primary">{initials(student.name)}</span><div className="min-w-0"><p className="truncate font-medium text-foreground">{student.name}</p><p className="truncate text-xs text-muted-foreground">{student.email}</p></div></div></TableCell><TableCell className="text-center"><StatusBadge status={student.status} /></TableCell><TableCell className="text-center font-semibold tabular-nums text-primary">{correctScore(student.rawScore, totalQuestions)}</TableCell>{showTiming && <TableCell className="text-center text-muted-foreground">{formatDuration(student.completionTimeMs)}</TableCell>}<TableCell className="text-right"><Button variant="ghost" size="icon" className="size-9 shadow-none" onClick={() => onView(student)} aria-label={`View ${student.name}`}><Eye size={16} /></Button></TableCell></TableRow>)}</TableBody></Table></DataSurface>;
}
function HardestQuestions({ questions }: { questions: QuestionRow[] }) {
  return <Card className="p-5"><h3 className="text-sm font-semibold">Hardest Questions</h3><p className="mt-1 text-xs text-muted-foreground">Lowest class accuracy</p><div className="mt-5 space-y-4">{questions.map(question => <div key={question.id} className="flex items-center gap-3 border-b border-ui-border pb-4 last:border-0 last:pb-0"><span className="flex h-9 w-9 items-center justify-center rounded-lg bg-danger-soft text-xs font-semibold text-danger">Q{question.number}</span><div className="min-w-0 flex-1"><p className="truncate text-xs font-medium">{question.skill || question.domain || question.sectionName}</p><div className="mt-2 h-1.5 overflow-hidden rounded-xs bg-danger-soft"><div className="h-full bg-danger" style={{ width: `${question.correctPercentage}%` }} /></div></div><span className="text-xs font-semibold text-danger">{question.correctPercentage}%</span></div>)}{questions.length === 0 && <p className="text-xs text-muted-foreground">No completed submissions yet.</p>}</div></Card>;
}
function ScoreDistribution({ items }: { items: { label: string; count: number }[] }) {
  const max = Math.max(1, ...items.map(item => item.count));
  return <Card className="p-5"><h3 className="text-sm font-semibold">Score Distribution</h3><p className="mt-1 text-xs text-muted-foreground">Counted submissions by score range</p><div className="mt-5 space-y-3">{items.map(item => <div key={item.label} className="grid grid-cols-[64px_1fr_24px] items-center gap-3 text-xs"><span className="text-muted-foreground">{item.label}</span><div className="h-5 overflow-hidden rounded-xs bg-primary-soft"><div className="h-full bg-primary" style={{ width: `${(item.count / max) * 100}%` }} /></div><span className="text-right font-semibold">{item.count}</span></div>)}</div></Card>;
}
function StudentDetailModal({ deliveryId, student, onClose }: { deliveryId: string; student: StudentRow; onClose: () => void }) {
  const [detail, setDetail] = useState<StudentDetail | null>(null);
  const [attemptIndex, setAttemptIndex] = useState(0);
  useEffect(() => { axiosClient.get(`/api/test-deliveries/${deliveryId}/students/${student.id}`).then(setDetail).catch(error => console.error('Unable to load student detail:', error)); }, [deliveryId, student.id]);
  const attempt = detail?.attempts[attemptIndex];
  return (
    <Modal
      open
      onClose={onClose}
      closeOnBackdrop
      title={student.name || 'Student performance'}
      subtitle={student.email}
      presentation="content-dialog"
      className="h-[calc(100%-2rem)] max-w-[1100px]!"
    >
      <div className="h-full min-h-0 min-w-0 overflow-y-auto pr-1">
        {!detail ? (
          <p className="py-12 text-center text-sm text-muted-foreground">Loading attempt details…</p>
        ) : detail.attempts.length === 0 ? (
          <p className="py-12 text-center text-sm text-muted-foreground">This student has not started the test.</p>
        ) : (
          <>
            <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <Select
                value={attemptIndex}
                onChange={event => setAttemptIndex(Number(event.target.value))}
                className="w-full sm:w-auto sm:min-w-48"
              >
                {detail.attempts.map((item, index) => (
                  <option key={item.id} value={index}>Attempt {item.attemptNo} · {item.status}</option>
                ))}
              </Select>
              <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-muted-foreground">
                <span><b className="text-foreground">{correctScore(attempt?.rawScore, attempt?.questions.length || 0)}</b> score</span>
                {detail.testMode === 'EXAM' && (
                  <span><b className="text-foreground">{formatDuration(attempt?.completionTimeMs)}</b> total time</span>
                )}
              </div>
            </div>

            <DataSurface className="max-w-full">
                <Table className="w-full min-w-[860px] table-fixed">
                  <TableHeader className="sticky top-0 z-10">
                    <TableRow>
                      <TableHead className="w-20">Question</TableHead>
                      <TableHead className="w-60">Domain / skill</TableHead>
                      <TableHead className="w-24 text-center">Selected</TableHead>
                      <TableHead className="w-24 text-center">Correct</TableHead>
                      <TableHead className="w-28 text-center">Result</TableHead>
                      {detail.testMode === 'EXAM' && (
                        <>
                          <TableHead className="w-28 text-center">Active time</TableHead>
                          <TableHead className="w-20 text-center">Visits</TableHead>
                        </>
                      )}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {attempt?.questions.map(question => (
                      <TableRow key={question.id} className="align-top">
                        <TableCell className="font-medium">Q{question.number}</TableCell>
                        <TableCell>
                          <p className="wrap-break-word font-medium text-foreground">{question.domain || 'Uncategorized'}</p>
                          <p className="mt-0.5 wrap-break-word text-xs text-muted-foreground">{question.skill || question.sectionName}</p>
                        </TableCell>
                        <TableCell className="break-all text-center">{question.selectedChoice || '—'}</TableCell>
                        <TableCell className="break-all text-center font-semibold">{question.correctAnswer}</TableCell>
                        <TableCell className="text-center">
                          <Badge tone={question.isCorrect ? 'success' : 'danger'}>{question.isCorrect ? 'Correct' : 'Incorrect'}</Badge>
                        </TableCell>
                        {detail.testMode === 'EXAM' && (
                          <>
                            <TableCell className="whitespace-nowrap text-center">{formatDuration(question.activeDurationMs)}</TableCell>
                            <TableCell className="text-center tabular-nums">{question.visitCount || 0}</TableCell>
                          </>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
            </DataSurface>
          </>
        )}
      </div>
    </Modal>
  );
}
function PageHeading({ title, subtitle }: { title: string; subtitle: string }) { return <div><h2 className="text-lg font-semibold">{title}</h2><p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p></div>; }
function Metric({ value, label, bordered = false }: { value: string; label: string; bordered?: boolean }) { return <div className={bordered ? 'border-x border-ui-border' : ''}><p className="text-base font-semibold text-foreground">{value}</p><p className="mt-0.5 text-[10px] text-muted-foreground">{label}</p></div>; }
function Legend({ color, label }: { color: string; label: string }) { return <span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-xs" style={{ backgroundColor: color }} />{label}</span>; }
function score(value: number | null | undefined) { return Number.isFinite(value) ? `${value}%` : '—'; }
function correctScore(value: number | null | undefined, totalQuestions: number) { return Number.isFinite(value) && totalQuestions > 0 ? `${value}/${totalQuestions}` : '—'; }
function StatusBadge({ status }: { status: StudentRow['status'] }) { const tone = status === 'COMPLETED' ? 'success' : status === 'MISSING' ? 'danger' : status === 'IN_PROGRESS' ? 'warning' : 'neutral'; return <Badge tone={tone}>{status.replace('_', ' ').toLowerCase()}</Badge>; }
