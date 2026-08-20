import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { format } from 'date-fns';
import { ArrowRight, BookmarkCheck, Calendar, CheckCircle2, PenTool } from 'lucide-react';
import toast from 'react-hot-toast';
import axiosClient from '../../lib/axios';
import { AppHeader, Badge, Button, Card, TableShell } from '../../components/ui/AppUI';
import { ui } from '../../components/ui/styles';

interface AnalyticsSummary {
  overallAccuracy: number;
  correctAnswers: number;
  questionsAttempted: number;
  completedTests: number;
}

interface ScoreHistoryPoint {
  date: string;
  testName: string;
  rw: number | null;
  math: number | null;
}

interface HeatmapPoint {
  date: string;
  count: number;
}

interface SectionPerformanceItem {
  code: string;
  name: string;
  subject: 'RW' | 'MATH';
  sortOrder: number;
  correct: number;
  accuracy: number | null;
  attempted: number;
  skills: Array<{ code: string; name: string; correct: number; attempted: number; accuracy: number | null }>;
}

interface ClassificationCoverage {
  classified: number;
  total: number;
  percentage: number | null;
  uncategorizedAttempted: number;
}

interface HistoryItem {
  id: number;
  createdAt: string;
  status: 'DOING' | 'COMPLETED';
  subject: 'RW' | 'MATH';
  test: { title: string };
  correctCount: number;
  totalQuestions: number;
  accuracy: number;
}

interface AnalyticsResponse {
  summary?: AnalyticsSummary;
  scoreHistory?: ScoreHistoryPoint[];
  heatmapData?: HeatmapPoint[];
  sectionPerformance?: SectionPerformanceItem[];
  classificationCoverage?: ClassificationCoverage;
  historyData?: HistoryItem[];
}

const emptySummary: AnalyticsSummary = {
  overallAccuracy: 0,
  correctAnswers: 0,
  questionsAttempted: 0,
  completedTests: 0,
};

const heatmapColors = ['#EAF2EE', '#C2DDD4', '#6BBFA0', '#3AAD82', '#1B7A5A'];

const getHeatmapLevel = (count: number) => {
  if (count <= 0) return 0;
  if (count === 1) return 1;
  if (count === 2) return 2;
  if (count === 3) return 3;
  return 4;
};

const ResultAnalytics = () => {
  const navigate = useNavigate();
  const userName = localStorage.getItem('userName') || 'Student';
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<AnalyticsSummary>(emptySummary);
  const [scoreHistory, setScoreHistory] = useState<ScoreHistoryPoint[]>([]);
  const [heatmapData, setHeatmapData] = useState<HeatmapPoint[]>([]);
  const [sectionPerformance, setSectionPerformance] = useState<SectionPerformanceItem[]>([]);
  const [classificationCoverage, setClassificationCoverage] = useState<ClassificationCoverage | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);

  useEffect(() => {
    const fetchAnalytics = async () => {
      setLoading(true);
      try {
        const response = await axiosClient.get<AnalyticsResponse, AnalyticsResponse>('/api/results-analytics?days=84');
        setSummary(response.summary || emptySummary);
        setScoreHistory(Array.isArray(response.scoreHistory) ? response.scoreHistory : []);
        setHeatmapData(Array.isArray(response.heatmapData) ? response.heatmapData : []);
        setSectionPerformance(Array.isArray(response.sectionPerformance) ? response.sectionPerformance : []);
        setClassificationCoverage(response.classificationCoverage || null);
        setHistory(Array.isArray(response.historyData) ? response.historyData : []);
      } catch (error) {
        console.error('Failed to load analytics:', error);
        toast.error('Unable to load analytics');
      } finally {
        setLoading(false);
      }
    };

    fetchAnalytics();
  }, []);

  const rwSections = useMemo(
    () => sectionPerformance.filter(section => section.subject === 'RW').sort((first, second) => first.sortOrder - second.sortOrder),
    [sectionPerformance],
  );
  const mathSections = useMemo(
    () => sectionPerformance.filter(section => section.subject === 'MATH').sort((first, second) => first.sortOrder - second.sortOrder),
    [sectionPerformance],
  );

  return (
    <div className={ui.page}>
      <AppHeader title="Analytics" subtitle={`${userName} · SAT Learning Platform`} />

      <main className="min-h-0 flex-1 overflow-y-auto">
        <div className={ui.content}>
          <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
            <MetricCard label="Overall Accuracy" value={`${summary.overallAccuracy}%`} icon={<CheckCircle2 size={22} />} iconClassName="bg-[#E8F5EF] text-[#1B7A5A]" valueClassName="text-[#1B7A5A]" loading={loading} />
            <MetricCard label="Correct Answers" value={summary.correctAnswers.toLocaleString('en-US')} suffix="answers" icon={<BookmarkCheck size={22} />} iconClassName="bg-[#FEF9E7] text-[#E8C040]" valueClassName="text-[#92640A]" loading={loading} />
            <MetricCard label="Questions Attempted" value={summary.questionsAttempted.toLocaleString('en-US')} suffix={`${summary.completedTests} completed tests`} icon={<PenTool size={22} />} iconClassName="bg-slate-100 text-slate-600" valueClassName="text-slate-800" loading={loading} />
          </div>

          <Card className="mb-6 p-5">
            <div className="mb-4 flex items-center justify-between gap-4">
              <div>
                <h2 className="font-semibold text-slate-800">Score Progress</h2>
                <p className="text-xs text-[#6B7280]">Accuracy percentage across your latest 7 completed tests</p>
              </div>
              <div className="flex items-center gap-4 text-xs font-medium text-slate-600">
                <Legend color="#1B7A5A" label="RW" />
                <Legend color="#E8C040" label="Math" />
              </div>
            </div>

            <div className="h-[220px] w-full">
              {loading ? (
                <div className="h-full w-full animate-pulse rounded-lg bg-[#F2F8F5]" />
              ) : scoreHistory.length === 0 ? (
                <EmptyState label="Complete a test to see your score progress." />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={scoreHistory} margin={{ top: 4, right: 12, bottom: 0, left: -10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E2EDE9" />
                    <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#64748B' }} axisLine={{ stroke: '#CBD5E1' }} tickLine={false} />
                    <YAxis domain={[0, 100]} tickFormatter={value => `${value}%`} tick={{ fontSize: 11, fill: '#64748B' }} axisLine={{ stroke: '#CBD5E1' }} tickLine={false} />
                    <Tooltip content={<ScoreTooltip />} />
                    <Line connectNulls type="monotone" dataKey="rw" name="RW" stroke="#1B7A5A" strokeWidth={2.5} dot={{ r: 4, fill: '#1B7A5A', strokeWidth: 0 }} activeDot={{ r: 6 }} />
                    <Line connectNulls type="monotone" dataKey="math" name="Math" stroke="#E8C040" strokeWidth={2.5} dot={{ r: 4, fill: '#E8C040', strokeWidth: 0 }} activeDot={{ r: 6 }} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          </Card>

          <Card className="mb-6 p-5">
            <div className="mb-4 flex flex-col justify-between gap-4 md:flex-row md:items-center">
              <div>
                <h2 className="flex items-center gap-2 font-semibold text-slate-800"><Calendar size={18} className="text-[#1B7A5A]" /> Activity Heatmap</h2>
                <p className="mt-0.5 text-xs text-[#6B7280]">Your study activity over the last 12 weeks</p>
              </div>
              <div className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
                <span>Less</span>
                <div className="flex gap-1">{heatmapColors.map(color => <span key={color} className="h-3 w-3 rounded-[2px]" style={{ backgroundColor: color }} />)}</div>
                <span>More</span>
              </div>
            </div>

            {loading ? (
              <div className="h-16 animate-pulse rounded-lg bg-[#F2F8F5]" />
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {heatmapData.map(point => (
                  <div key={point.date} className="h-4 w-4 cursor-default rounded-[3px] transition-transform hover:scale-110" style={{ backgroundColor: heatmapColors[getHeatmapLevel(point.count)] }} title={`${point.date}: ${point.count} ${point.count === 1 ? 'activity' : 'activities'}`} />
                ))}
              </div>
            )}
          </Card>

          <Card className="mb-6 p-6">
            <div className="mb-5 flex flex-wrap items-start justify-between gap-3"><div><h2 className="font-semibold text-slate-800">Section Performance Breakdown</h2><p className="mt-1 text-xs text-[#6B7280]">Accuracy by official SAT content domain during the selected period.</p></div>{!loading && classificationCoverage && classificationCoverage.uncategorizedAttempted > 0 && <Badge tone="warning">{classificationCoverage.uncategorizedAttempted} uncategorized question{classificationCoverage.uncategorizedAttempted === 1 ? '' : 's'}</Badge>}</div>
            <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
              <SectionGroup title="Reading & Writing" tone="green" items={rwSections} color="#1B7A5A" />
              <SectionGroup title="Math" tone="gold" items={mathSections} color="#E8C040" />
            </div>
          </Card>

          <TableShell className="mb-8">
            <div className="border-b border-[#E2EDE9] p-5">
              <h2 className="font-semibold text-slate-800">Recent Activity</h2>
              <p className="text-xs text-[#6B7280]">Detailed history of your latest attempts</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[680px] text-left text-sm">
                <thead className="border-b border-[#E2EDE9] bg-slate-50 text-xs font-semibold uppercase text-slate-500">
                  <tr><th className="px-5 py-3">Test Name</th><th className="px-5 py-3">Status</th><th className="px-5 py-3">Date</th><th className="px-5 py-3 text-right">Action</th></tr>
                </thead>
                <tbody className="divide-y divide-[#E2EDE9]">
                  {loading ? (
                    [1, 2, 3].map(row => <tr key={row}><td colSpan={4} className="px-5 py-4"><div className="h-8 animate-pulse rounded bg-[#F2F8F5]" /></td></tr>)
                  ) : history.length === 0 ? (
                    <tr><td colSpan={4} className="px-5 py-12 text-center text-sm text-[#6B7280]">No recent activity yet.</td></tr>
                  ) : history.map(item => (
                    <tr key={item.id} className="transition-colors hover:bg-slate-50/50">
                      <td className="px-5 py-4 font-medium text-slate-800">{item.test.title}</td>
                      <td className="px-5 py-4"><Badge tone={item.status === 'COMPLETED' ? 'success' : 'warning'}>{item.status === 'COMPLETED' ? 'Completed' : 'Incomplete'}</Badge></td>
                      <td className="px-5 py-4 text-xs font-medium text-slate-600">{format(new Date(item.createdAt), 'MMM d, yyyy')}</td>
                      <td className="px-5 py-4 text-right"><Button variant="outline" size="sm" disabled={item.status !== 'COMPLETED'} onClick={() => navigate('/dashboard/score-report', { state: { resultId: item.id } })}>View Details <ArrowRight size={12} /></Button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </TableShell>
        </div>
      </main>
    </div>
  );
};

function MetricCard({ label, value, suffix, icon, iconClassName, valueClassName, loading }: { label: string; value: string; suffix?: string; icon: ReactNode; iconClassName: string; valueClassName: string; loading: boolean }) {
  return (
    <Card className="flex items-center gap-4 p-5">
      <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${iconClassName}`}>{icon}</div>
      <div className="min-w-0">
        <p className="mb-0.5 text-xs font-medium text-[#6B7280]">{label}</p>
        {loading ? <div className="mt-1 h-8 w-24 animate-pulse rounded bg-[#EAF2EE]" /> : <div className="flex items-baseline gap-1.5"><span className={`font-mono text-3xl font-extrabold ${valueClassName}`}>{value}</span>{suffix && <span className="truncate text-xs text-[#6B7280]">{suffix}</span>}</div>}
      </div>
    </Card>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return <span className="flex items-center gap-1.5"><span className="inline-block h-0.5 w-3 rounded-full" style={{ background: color }} />{label}</span>;
}

function EmptyState({ label }: { label: string }) {
  return <div className="flex h-full items-center justify-center text-sm text-[#6B7280]">{label}</div>;
}

function ScoreTooltip({ active, payload }: { active?: boolean; payload?: Array<{ name: string; value: number; payload: ScoreHistoryPoint; color: string }> }) {
  if (!active || !payload?.length) return null;
  const available = payload.filter(item => item.value !== null && item.value !== undefined);
  if (available.length === 0) return null;
  return <div className="min-w-[150px] rounded-lg border border-[#C2DDD4] bg-white p-3 text-xs shadow-xl"><p className="mb-2 border-b border-[#E2EDE9] pb-2 font-semibold text-slate-700">{available[0].payload.testName}</p>{available.map(item => <p key={item.name} className="flex justify-between gap-5"><span>{item.name}</span><strong style={{ color: item.color }}>{item.value}%</strong></p>)}</div>;
}

function SectionGroup({ title, tone, items, color }: { title: string; tone: 'green' | 'gold'; items: SectionPerformanceItem[]; color: string }) {
  return <div><Badge tone={tone} className="mb-4 rounded-md px-3 py-1.5">{title}</Badge>{items.length === 0 ? <p className="text-sm text-[#6B7280]">No performance data yet.</p> : <div className="flex flex-col gap-4">{items.map(item => <SectionBar key={item.name} name={item.name} percentage={item.accuracy} color={color} />)}</div>}</div>;
}

function SectionBar({ name, percentage, color }: { name: string; percentage: number | null; color: string }) {
  const hasData = percentage !== null;
  return <div className="flex items-center gap-4"><p className="w-40 shrink-0 truncate text-sm font-semibold text-slate-700" title={name}>{name}</p><div className="h-2.5 flex-1 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full transition-all duration-500" style={{ width: hasData ? `${percentage}%` : '0%', background: color }} /></div><span className="w-14 shrink-0 text-right font-mono text-xs font-semibold" style={{ color: hasData ? color : '#6B7280' }}>{hasData ? `${percentage}%` : 'No data'}</span></div>;
}

export default ResultAnalytics;
