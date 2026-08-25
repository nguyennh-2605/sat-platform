import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ArrowRight, BarChart3, CheckCircle2, Clock3, Eye, FileText, Target, Trophy, Users } from 'lucide-react';
import axiosClient from '../../lib/axios';
import { BackButton, Badge, Button, Card, EmptyState, Modal, Select, TableShell } from '../../components/ui/AppUI';
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
  if (selectedDeliveryId) return <PerformanceDashboard report={report} loading={loading} onBack={closeReport} />;
  return <div className="space-y-5 animate-fade-in-up">
    <div><h2 className="text-lg font-semibold text-[#1A1A1A]">Test Performance</h2><p className="mt-1 text-xs text-[#6B7280]">Select an assigned test to review submissions and question-level performance.</p></div>
    {loading ? <EmptyState title="Loading assigned tests…" compact /> : deliveries.length === 0 ? <EmptyState title="No assigned tests" description="Tests assigned to this class will appear here." /> : <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{deliveries.map(delivery => <Card key={delivery.id} className="group cursor-pointer p-5 transition hover:border-[#A9CFC1] hover:shadow-md" onClick={() => openReport(delivery.id)}>
      <div className="flex items-start justify-between gap-4"><div className="flex min-w-0 gap-3"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#E8F5EF] text-[#1B7A5A]"><FileText size={19} /></div><div className="min-w-0"><h3 className="truncate text-sm font-semibold text-[#1A1A1A]">{capitalizeFirstLetter(delivery.title)}</h3><p className="mt-1 text-xs text-[#6B7280]">{delivery.lesson ? `${delivery.lesson.week.title} · ${delivery.lesson.title}` : 'Direct assignment'}</p></div></div><ArrowRight size={17} className="mt-1 shrink-0 text-[#9CA3AF] transition group-hover:translate-x-0.5 group-hover:text-[#1B7A5A]" /></div>
      <div className="mt-5 grid grid-cols-3 border-t border-[#D6E3DE] pt-4 text-center"><Metric value={`${delivery.stats.completed}/${delivery.stats.assigned}`} label="Submitted" /><Metric value={delivery.stats.averageScore === null ? '—' : `${delivery.stats.averageScore}%`} label="Average" bordered /><Metric value={String(delivery.stats.inProgress)} label="In progress" /></div>
      <div className="mt-4 flex items-center justify-between text-[11px] text-[#6B7280]"><Badge tone={delivery.test.mode === 'EXAM' ? 'green' : 'gold'}>{delivery.test.mode === 'EXAM' ? 'Test' : 'Practice'}</Badge><span>{delivery.dueAt ? `Due ${new Date(delivery.dueAt).toLocaleDateString()}` : 'No deadline'}</span></div>
    </Card>)}</div>}
  </div>;
}

function PerformanceDashboard({ report, loading, onBack }: { report: PerformanceReport | null; loading: boolean; onBack: () => void }) {
  const [selectedStudent, setSelectedStudent] = useState<StudentRow | null>(null);
  if (loading || !report) return <div className="space-y-5"><PageHeading title="Test Performance" subtitle="Loading report…" onBack={onBack} /><EmptyState title="Loading performance data…" compact /></div>;
  const kpis = [
    { label: 'AVERAGE SCORE', value: correctScore(report.kpis.averageCorrect, report.delivery.test.questionCount), detail: `Median ${score(report.kpis.medianScore)}`, icon: Target },
    { label: 'HIGHEST SCORE', value: correctScore(report.kpis.highestCorrect, report.delivery.test.questionCount), detail: 'Top result', icon: Trophy },
    { label: 'LOWEST SCORE', value: correctScore(report.kpis.lowestCorrect, report.delivery.test.questionCount), detail: 'Needs support', icon: BarChart3 },
    { label: 'PARTICIPANTS', value: `${report.kpis.participants}/${report.kpis.assigned}`, detail: 'Submitted', icon: Users },
    { label: 'COMPLETION RATE', value: `${report.kpis.completionRate}%`, detail: 'Of assigned students', icon: CheckCircle2 },
    { label: 'AVERAGE TIME', value: report.delivery.test.mode === 'EXAM' ? formatDuration(report.kpis.averageTimeMs) : 'N/A', detail: report.delivery.test.mode === 'EXAM' ? 'Active test duration' : 'Test mode only', icon: Clock3 },
  ];
  return <div className="space-y-6">
    <PageHeading title={capitalizeFirstLetter(report.delivery.title)} subtitle={`${capitalizeFirstLetter(report.delivery.test.title)} · ${report.delivery.test.mode === 'EXAM' ? 'Test mode' : 'Practice mode'} · ${report.delivery.test.questionCount} questions`} onBack={onBack} />
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">{kpis.map(({ label, value, detail, icon: Icon }) => <Card key={label} className="min-h-[116px] p-4"><div className="flex items-start justify-between"><span className="text-[10px] font-semibold tracking-[0.08em] text-[#6B7280]">{label}</span><Icon size={15} className="text-[#1B7A5A]" /></div><p className="mt-4 text-2xl font-semibold text-[#1A1A1A]">{value}</p><p className="mt-1 text-[11px] text-[#6B7280]">{detail}</p></Card>)}</div>
    <div className="grid items-start gap-6 xl:grid-cols-12"><div className="space-y-6 xl:col-span-8"><QuestionBreakdown questions={report.questions} showTiming={report.delivery.test.mode === 'EXAM'} /><StudentRankings students={report.students} totalQuestions={report.delivery.test.questionCount} showTiming={report.delivery.test.mode === 'EXAM'} onView={setSelectedStudent} /></div><div className="space-y-6 xl:col-span-4"><HardestQuestions questions={report.hardestQuestions} /><ScoreDistribution items={report.scoreDistribution} /></div></div>
    {selectedStudent && <StudentDetailModal deliveryId={report.delivery.id} student={selectedStudent} onClose={() => setSelectedStudent(null)} />}
  </div>;
}

function QuestionBreakdown({ questions, showTiming }: { questions: QuestionRow[]; showTiming: boolean }) {
  return <Card className="overflow-hidden"><div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#D6E3DE] p-5"><div><h3 className="text-sm font-semibold">Question Performance Breakdown</h3><p className="mt-1 text-xs text-[#6B7280]">Accuracy across counted submissions</p></div><div className="flex gap-4 text-xs text-[#6B7280]"><Legend color="#1B7A5A" label="Correct" /><Legend color="#C53B3B" label="Incorrect" /></div></div><div className="max-h-[520px] space-y-5 overflow-y-auto p-5">{questions.map(question => <div key={question.id}><div className="mb-2 flex items-center gap-3"><span className="w-8 text-xs font-semibold text-[#4B5563]">Q{question.number}</span><div className="flex h-3 flex-1 overflow-hidden rounded-xs bg-[#F7DEDE]"><div className="bg-[#1B7A5A]" style={{ width: `${question.correctPercentage}%` }} /></div><span className="w-10 text-right text-xs font-semibold">{question.correctPercentage}%</span></div><div className="ml-11 flex flex-wrap items-center gap-2 text-[11px] text-[#6B7280]"><span>{question.correct} correct · {question.incorrect} incorrect</span>{question.domain && <Badge>{question.domain}</Badge>}{question.skill && <Badge tone="green">{question.skill}</Badge>}{showTiming && <span className="ml-auto">Avg. {formatDuration(question.averageTimeMs)}</span>}</div></div>)}{questions.length === 0 && <p className="py-10 text-center text-sm text-[#6B7280]">No question data yet.</p>}</div></Card>;
}
function StudentRankings({ students, totalQuestions, showTiming, onView }: { students: StudentRow[]; totalQuestions: number; showTiming: boolean; onView: (student: StudentRow) => void }) {
  const ordered = useMemo(() => [...students].sort((a, b) => (b.score ?? -1) - (a.score ?? -1)), [students]);
  return <TableShell><div className="flex items-center gap-2 border-b border-[#D6E3DE] p-5"><Users size={16} className="text-[#1B7A5A]" /><h3 className="text-sm font-semibold">Student Rankings</h3></div><div className="overflow-auto"><table className="w-full text-left text-xs"><thead className="bg-[#F2F8F5] text-[10px] tracking-wide text-[#4B5563]"><tr><th className="px-5 py-3">STUDENT</th><th className="px-4 py-3 text-center">STATUS</th><th className="px-4 py-3 text-center">SCORE</th>{showTiming && <th className="px-4 py-3 text-center">TIME</th>}<th className="px-5 py-3 text-right">ACTION</th></tr></thead><tbody className="divide-y divide-[#DDE7E3]">{ordered.map(student => <tr key={student.id} className="hover:bg-[#F8FBF9]"><td className="px-5 py-3"><div className="flex items-center gap-2"><span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#E8F5EF] text-[10px] font-semibold text-[#1B7A5A]">{initials(student.name)}</span><div><p className="font-medium text-[#1A1A1A]">{student.name}</p><p className="text-[10px] text-[#6B7280]">{student.email}</p></div></div></td><td className="px-4 py-3 text-center"><StatusBadge status={student.status} /></td><td className="px-4 py-3 text-center font-semibold text-[#1B7A5A]">{correctScore(student.rawScore, totalQuestions)}</td>{showTiming && <td className="px-4 py-3 text-center text-[#6B7280]">{formatDuration(student.completionTimeMs)}</td>}<td className="px-5 py-3 text-right"><Button variant="ghost" size="icon" onClick={() => onView(student)} aria-label={`View ${student.name}`}><Eye size={16} /></Button></td></tr>)}</tbody></table>{students.length === 0 && <p className="py-10 text-center text-sm text-[#6B7280]">No students are assigned.</p>}</div></TableShell>;
}
function HardestQuestions({ questions }: { questions: QuestionRow[] }) {
  return <Card className="p-5"><h3 className="text-sm font-semibold">Hardest Questions</h3><p className="mt-1 text-xs text-[#6B7280]">Lowest class accuracy</p><div className="mt-5 space-y-4">{questions.map(question => <div key={question.id} className="flex items-center gap-3 border-b border-[#DDE7E3] pb-4 last:border-0 last:pb-0"><span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#FDECEC] text-xs font-semibold text-[#B42318]">Q{question.number}</span><div className="min-w-0 flex-1"><p className="truncate text-xs font-medium">{question.skill || question.domain || question.sectionName}</p><div className="mt-2 h-1.5 overflow-hidden rounded-xs bg-[#F7DEDE]"><div className="h-full bg-[#C53B3B]" style={{ width: `${question.correctPercentage}%` }} /></div></div><span className="text-xs font-semibold text-[#B42318]">{question.correctPercentage}%</span></div>)}{questions.length === 0 && <p className="text-xs text-[#6B7280]">No completed submissions yet.</p>}</div></Card>;
}
function ScoreDistribution({ items }: { items: { label: string; count: number }[] }) {
  const max = Math.max(1, ...items.map(item => item.count));
  return <Card className="p-5"><h3 className="text-sm font-semibold">Score Distribution</h3><p className="mt-1 text-xs text-[#6B7280]">Counted submissions by score range</p><div className="mt-5 space-y-3">{items.map(item => <div key={item.label} className="grid grid-cols-[64px_1fr_24px] items-center gap-3 text-xs"><span className="text-[#6B7280]">{item.label}</span><div className="h-5 overflow-hidden rounded-xs bg-[#E8F5EF]"><div className="h-full bg-[#1B7A5A]" style={{ width: `${(item.count / max) * 100}%` }} /></div><span className="text-right font-semibold">{item.count}</span></div>)}</div></Card>;
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
          <p className="py-12 text-center text-sm text-[#6B7280]">Loading attempt details…</p>
        ) : detail.attempts.length === 0 ? (
          <p className="py-12 text-center text-sm text-[#6B7280]">This student has not started the test.</p>
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
              <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-[#4B5563]">
                <span><b className="text-[#1A1A1A]">{correctScore(attempt?.rawScore, attempt?.questions.length || 0)}</b> score</span>
                {detail.testMode === 'EXAM' && (
                  <span><b className="text-[#1A1A1A]">{formatDuration(attempt?.completionTimeMs)}</b> total time</span>
                )}
              </div>
            </div>

            <TableShell className="max-w-full shadow-none">
              <div className="max-w-full overflow-x-auto">
                <table className="w-full min-w-[860px] table-fixed text-left text-xs">
                  <thead className="sticky top-0 z-10 bg-[#F2F8F5] text-[10px] tracking-wide text-[#4B5563]">
                    <tr>
                      <th className="w-20 px-4 py-3">QUESTION</th>
                      <th className="w-60 px-4 py-3">DOMAIN / SKILL</th>
                      <th className="w-24 px-4 py-3 text-center">SELECTED</th>
                      <th className="w-24 px-4 py-3 text-center">CORRECT</th>
                      <th className="w-28 px-4 py-3 text-center">RESULT</th>
                      {detail.testMode === 'EXAM' && (
                        <>
                          <th className="w-28 px-4 py-3 text-center">ACTIVE TIME</th>
                          <th className="w-20 px-4 py-3 text-center">VISITS</th>
                        </>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#DDE7E3]">
                    {attempt?.questions.map(question => (
                      <tr key={question.id} className="align-top hover:bg-[#F8FBF9]">
                        <td className="px-4 py-3 font-medium">Q{question.number}</td>
                        <td className="px-4 py-3">
                          <p className="wrap-break-word font-medium text-[#1A1A1A]">{question.domain || 'Uncategorized'}</p>
                          <p className="mt-0.5 wrap-break-word text-[10px] leading-4 text-[#6B7280]">{question.skill || question.sectionName}</p>
                        </td>
                        <td className="break-all px-4 py-3 text-center">{question.selectedChoice || '—'}</td>
                        <td className="break-all px-4 py-3 text-center font-semibold">{question.correctAnswer}</td>
                        <td className="px-4 py-3 text-center">
                          <Badge tone={question.isCorrect ? 'success' : 'danger'}>{question.isCorrect ? 'Correct' : 'Incorrect'}</Badge>
                        </td>
                        {detail.testMode === 'EXAM' && (
                          <>
                            <td className="whitespace-nowrap px-4 py-3 text-center">{formatDuration(question.activeDurationMs)}</td>
                            <td className="px-4 py-3 text-center">{question.visitCount || 0}</td>
                          </>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </TableShell>
          </>
        )}
      </div>
    </Modal>
  );
}
function PageHeading({ title, subtitle, onBack }: { title: string; subtitle: string; onBack: () => void }) { return <div className="flex items-center gap-3"><BackButton onClick={onBack} /><div><h2 className="text-lg font-semibold">{title}</h2><p className="mt-0.5 text-xs text-[#6B7280]">{subtitle}</p></div></div>; }
function Metric({ value, label, bordered = false }: { value: string; label: string; bordered?: boolean }) { return <div className={bordered ? 'border-x border-[#D6E3DE]' : ''}><p className="text-base font-semibold text-[#1A1A1A]">{value}</p><p className="mt-0.5 text-[10px] text-[#6B7280]">{label}</p></div>; }
function Legend({ color, label }: { color: string; label: string }) { return <span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-xs" style={{ backgroundColor: color }} />{label}</span>; }
function score(value: number | null | undefined) { return Number.isFinite(value) ? `${value}%` : '—'; }
function correctScore(value: number | null | undefined, totalQuestions: number) { return Number.isFinite(value) && totalQuestions > 0 ? `${value}/${totalQuestions}` : '—'; }
function StatusBadge({ status }: { status: StudentRow['status'] }) { const tone = status === 'COMPLETED' ? 'success' : status === 'MISSING' ? 'danger' : status === 'IN_PROGRESS' ? 'warning' : 'neutral'; return <Badge tone={tone}>{status.replace('_', ' ').toLowerCase()}</Badge>; }
