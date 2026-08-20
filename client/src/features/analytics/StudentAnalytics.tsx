import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { ArrowLeft, ArrowRight, ClipboardList, FileText, Users } from 'lucide-react';
import axiosClient from '../../lib/axios';
import { Badge, Button, Card, TableShell } from '../../components/ui/AppUI';

interface ExamItem { id: number; title: string; date: string; mode: 'EXAM'; subject: string; duration: number }
interface AssignmentScoreItem { id: string; title: string; createdAt: string; tests: ExamItem[] }
interface StudentStat { key: string; count: number; students: string[] }
interface QuestionReport { id: number; correctChoice: string; stats: StudentStat[] }
interface LeaderboardItem { id: number; name: string; score: number; time: string }
interface ReportResponse { leaderboard: LeaderboardItem[]; questions: QuestionReport[] }

const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(-2).map(part => part[0]).join('').toUpperCase();

export default function StudentAnalytics({ classId }: { classId?: string }) {
  const [assignments, setAssignments] = useState<AssignmentScoreItem[]>([]);
  const [selectedAssignment, setSelectedAssignment] = useState<AssignmentScoreItem | null>(null);
  const [selectedTest, setSelectedTest] = useState<ExamItem | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!classId) return;
    axiosClient.get<{ data: AssignmentScoreItem[] }, { data: AssignmentScoreItem[] }>(`/api/classes/${classId}/score-report`)
      .then(response => setAssignments(Array.isArray(response.data) ? response.data : []))
      .catch(error => console.error('Failed to load class score reports:', error))
      .finally(() => setLoading(false));
  }, [classId]);

  if (selectedAssignment && selectedTest) {
    return <TestPerformance assignment={selectedAssignment} test={selectedTest} onBack={() => setSelectedTest(null)} />;
  }

  if (selectedAssignment) {
    return (
      <div className="space-y-5">
        <SectionHeading title={selectedAssignment.title} subtitle="Select a test to view its performance" onBack={() => setSelectedAssignment(null)} />
        <div className="grid gap-4 md:grid-cols-2">
          {selectedAssignment.tests.map(test => (
            <PickerCard key={test.id} icon={<ClipboardList size={19} />} title={test.title} meta={`${test.subject} · ${test.duration} min · ${test.date}`} onClick={() => setSelectedTest(test)} />
          ))}
        </div>
        {selectedAssignment.tests.length === 0 && <EmptyState text="No exam tests are attached to this assignment." />}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div><h2 className="text-lg font-semibold">Test Performance</h2><p className="mt-1 text-xs text-[#6B7280]">Review assignment results and student performance</p></div>
      {loading ? <EmptyState text="Loading score reports…" /> : assignments.length === 0 ? <EmptyState text="No score reports are available yet." /> : (
        <div className="grid gap-4 md:grid-cols-2">
          {assignments.map(assignment => <PickerCard key={assignment.id} icon={<FileText size={19} />} title={assignment.title} meta={`${assignment.tests.length} exam ${assignment.tests.length === 1 ? 'test' : 'tests'}`} onClick={() => setSelectedAssignment(assignment)} />)}
        </div>
      )}
    </div>
  );
}

function PickerCard({ icon, title, meta, onClick }: { icon: ReactNode; title: string; meta: string; onClick: () => void }) {
  return (
    <Card className="group cursor-pointer p-5 transition hover:border-[#A9CFC1] hover:shadow-md" onClick={onClick}>
      <div className="flex items-center gap-4"><div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#E8F5EF] text-[#1B7A5A]">{icon}</div><div className="min-w-0 flex-1"><h3 className="truncate text-sm font-semibold">{title}</h3><p className="mt-1 text-xs text-[#6B7280]">{meta}</p></div><ArrowRight size={17} className="text-[#9CA3AF] transition group-hover:translate-x-0.5 group-hover:text-[#1B7A5A]" /></div>
    </Card>
  );
}

function SectionHeading({ title, subtitle, onBack }: { title: string; subtitle: string; onBack: () => void }) {
  return <div className="flex items-center gap-3"><Button variant="ghost" size="icon" onClick={onBack} aria-label="Go back"><ArrowLeft size={18} /></Button><div><h2 className="text-lg font-semibold">{title}</h2><p className="text-xs text-[#6B7280]">{subtitle}</p></div></div>;
}

function EmptyState({ text }: { text: string }) {
  return <Card className="flex min-h-40 items-center justify-center p-8 text-sm text-[#6B7280]">{text}</Card>;
}

function TestPerformance({ assignment, test, onBack }: { assignment: AssignmentScoreItem; test: ExamItem; onBack: () => void }) {
  const [report, setReport] = useState<ReportResponse>({ leaderboard: [], questions: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axiosClient.get<ReportResponse, ReportResponse>(`/api/classes/${test.id}/report`, { params: { assignmentId: assignment.id } })
      .then(data => setReport({ leaderboard: Array.isArray(data.leaderboard) ? data.leaderboard : [], questions: Array.isArray(data.questions) ? data.questions : [] }))
      .catch(error => console.error('Failed to load test performance:', error))
      .finally(() => setLoading(false));
  }, [assignment.id, test.id]);

  const scores = report.leaderboard.map(student => Number(student.score)).filter(Number.isFinite);
  const average = scores.length ? Math.round(scores.reduce((sum, value) => sum + value, 0) / scores.length) : 0;
  const kpis = [
    ['AVERAGE SCORE', `${average}%`, ''],
    ['HIGHEST SCORE', `${scores.length ? Math.max(...scores) : 0}%`, ''],
    ['LOWEST SCORE', `${scores.length ? Math.min(...scores) : 0}%`, ''],
    ['PARTICIPANTS', String(report.leaderboard.length), 'Submitted'],
    ['QUESTIONS', String(report.questions.length), 'In this test'],
    ['TIME LIMIT', `${test.duration}m`, 'Per student'],
  ];

  return (
    <div className="space-y-6">
      <SectionHeading title={test.title} subtitle={`${assignment.title} · Test performance`} onBack={onBack} />
      {loading ? <EmptyState text="Loading performance data…" /> : <>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          {kpis.map(([label, value, sub], index) => (
            <Card key={label} className="flex min-h-[116px] flex-col justify-between p-4"><span className="text-[10px] font-semibold tracking-[0.08em] text-[#6B7280]">{label}</span><div><div className={`text-2xl font-semibold ${index === 2 && scores.length ? 'text-red-600' : ''}`}>{value}</div>{sub && <p className="mt-1 text-xs text-[#9CA3AF]">{sub}</p>}{index < 3 && <div className={`mt-2 h-1 w-12 rounded-full ${index === 2 && scores.length ? 'bg-red-600' : 'bg-[#1B7A5A]'}`} />}</div></Card>
          ))}
        </div>
        <div className="grid items-start gap-6 lg:grid-cols-12">
          <Card className="overflow-hidden lg:col-span-7">
            <div className="flex items-center justify-between border-b border-[#E2EDE9] p-5"><h3 className="text-sm font-semibold">Question Performance Breakdown</h3><div className="flex gap-4 text-xs text-[#6B7280]"><Legend color="#115E43" label="Correct" /><Legend color="#B31919" label="Incorrect" /></div></div>
            <div className="max-h-[430px] space-y-5 overflow-y-auto p-5">
              {report.questions.map((question, index) => {
                const total = question.stats.reduce((sum, item) => sum + item.count, 0);
                const correct = question.stats.find(item => item.key === question.correctChoice)?.count || 0;
                const percentage = total ? Math.round((correct / total) * 100) : 0;
                return <div key={question.id}><div className="mb-2 flex items-center gap-3 text-xs"><span className="w-7 font-semibold text-[#6B7280]">Q{index + 1}</span><div className="flex h-3 flex-1 overflow-hidden rounded-full bg-[#FEECEC]"><div className="bg-[#115E43]" style={{ width: `${percentage}%` }} /><div className="bg-[#B31919]" style={{ width: `${100 - percentage}%` }} /></div><span className="w-9 text-right font-semibold text-[#6B7280]">{percentage}%</span></div><div className="ml-10 flex flex-wrap gap-1.5">{question.stats.map(stat => <Badge key={stat.key} tone={stat.key === question.correctChoice ? 'success' : 'neutral'}>{stat.key}: {stat.count}</Badge>)}</div></div>;
              })}
              {report.questions.length === 0 && <p className="py-12 text-center text-sm text-[#6B7280]">No question data yet.</p>}
            </div>
          </Card>
          <TableShell className="lg:col-span-5">
            <div className="flex items-center gap-2 border-b border-[#E2EDE9] p-5"><Users size={16} className="text-[#1B7A5A]" /><h3 className="text-sm font-semibold">Student Rankings</h3></div>
            <div className="max-h-[430px] overflow-auto"><table className="w-full text-left text-xs"><thead className="sticky top-0 bg-[#F8FBF9] text-[10px] tracking-wide text-[#6B7280]"><tr><th className="px-5 py-3">STUDENT NAME</th><th className="px-5 py-3 text-center">SCORE</th><th className="px-5 py-3 text-right">TIME</th></tr></thead><tbody className="divide-y divide-[#E2EDE9]">{report.leaderboard.map(student => <tr key={student.id} className="hover:bg-[#F8FBF9]"><td className="px-5 py-3"><div className="flex items-center gap-2"><span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#E8F5EF] text-[10px] font-semibold text-[#1B7A5A]">{initials(student.name)}</span><span className="max-w-[150px] truncate font-medium">{student.name}</span></div></td><td className="px-5 py-3 text-center font-semibold text-[#1B7A5A]">{student.score}%</td><td className="px-5 py-3 text-right text-[#6B7280]">{student.time || '—'}</td></tr>)}</tbody></table>{report.leaderboard.length === 0 && <p className="py-12 text-center text-sm text-[#6B7280]">No submissions yet.</p>}</div>
          </TableShell>
        </div>
      </>}
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return <span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: color }} />{label}</span>;
}
