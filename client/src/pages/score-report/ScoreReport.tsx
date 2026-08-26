import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Bookmark,
  Calendar,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Eye,
  Filter,
  List,
  Loader2,
  XCircle,
} from 'lucide-react';
import toast from 'react-hot-toast';
import type { ContentBlock } from '../../types/quiz';
import ReviewModal from '../../features/quiz/ReviewModal';
import axiosClient from '../../lib/axios';
import { invalidateQueryCache } from '../../lib/queryCache';
import { Badge, Button, Card, PageHeader, Select, TableShell } from '../../components/ui/AppUI';
import { useDashboardBack } from '../../features/navigation/DashboardBackContext';
import { SatCountdown } from '../../features/sat-countdown/SatCountdown';
import { capitalizeFirstLetter } from '../../utils/text';

export interface QuestionResult {
  id: number | string;
  questionNumber: number;
  module: string;
  correctAnswer: string;
  userAnswer?: string | null;
  isCorrect: boolean;
  blocks: ContentBlock[];
  questionText: string;
  choices: { id: string; text: string }[];
  activeDurationMs?: number | null;
}

interface ScoreReportData {
  examTitle: string;
  subject: string;
  date: string;
  startedAt?: string;
  completedAt?: string;
  duration: string;
  questions: QuestionResult[];
}

interface ScoreReportProps {
  initialData?: ScoreReportData;
  onBackToHome?: () => void;
}

type ReviewFilter = 'ALL' | 'CORRECT' | 'INCORRECT';

const PAGE_SIZE = 7;

const formatDate = (value?: string) => {
  if (!value) return '—';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(parsed);
};

const formatTime = (value?: string) => {
  if (!value) return '—';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '—';
  return new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' }).format(parsed);
};

const formatQuestionDuration = (milliseconds?: number | null) => {
  if (milliseconds == null || !Number.isFinite(milliseconds)) return '—';
  const totalSeconds = Math.max(0, Math.round(milliseconds / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return minutes ? `${minutes}m ${seconds}s` : `${seconds}s`;
};

const subjectLabel = (subject: string) => subject === 'RW' ? 'Reading & Writing' : subject === 'MATH' ? 'Mathematics' : subject;

export default function ScoreReport({ initialData, onBackToHome }: ScoreReportProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const routeData = location.state?.reportData as ScoreReportData | undefined;
  const resolvedInitialData = initialData || routeData;
  const [data, setData] = useState<ScoreReportData | null>(resolvedInitialData || null);
  const [loading, setLoading] = useState(!resolvedInitialData);
  const [loadError, setLoadError] = useState(false);
  const [reviewingQuestion, setReviewingQuestion] = useState<QuestionResult | null>(null);
  const [loggedQuestions, setLoggedQuestions] = useState<Set<number | string>>(new Set());
  const [filter, setFilter] = useState<ReviewFilter>('ALL');
  const [page, setPage] = useState(1);
  const resultId = location.state?.resultId;

  useEffect(() => {
    if (resolvedInitialData) return;

    const fetchDetail = async () => {
      if (!resultId) {
        setLoadError(true);
        setLoading(false);
        return;
      }

      try {
        const response = await axiosClient.get<ScoreReportData, ScoreReportData>(`/api/results-analytics/submission/${resultId}`);
        setData(response);
      } catch (error) {
        console.error('Failed to load score report:', error);
        setLoadError(true);
        toast.error('Unable to load score report');
      } finally {
        setLoading(false);
      }
    };

    fetchDetail();
  }, [resolvedInitialData, resultId]);

  const handleBack = () => {
    const cleanupKeys = location.state?.cleanupKeys as string[] | undefined;
    cleanupKeys?.forEach(key => localStorage.removeItem(key));
    if (onBackToHome) onBackToHome();
    else navigate('/dashboard/results-analytics');
  };
  useDashboardBack(handleBack);

  const handleAddToErrorLog = async (question: QuestionResult) => {
    if (!data || loggedQuestions.has(question.id)) return;

    try {
      await axiosClient.post('/api/error-logs', {
        source: data.examTitle,
        userAnswer: question.userAnswer || 'Omitted',
        category: 'General',
        correctAnswer: question.correctAnswer,
        whyWrong: '',
        whyRight: '',
      });
      invalidateQueryCache('/api/error-logs');
      setLoggedQuestions(current => new Set(current).add(question.id));
      toast.success(`Question ${question.questionNumber} added to Error Log`);
    } catch (error) {
      console.error('Failed to add question to Error Log:', error);
      toast.error('Unable to add to Error Log');
    }
  };

  const filteredQuestions = useMemo(() => {
    if (!data) return [];
    if (filter === 'CORRECT') return data.questions.filter(question => question.isCorrect);
    if (filter === 'INCORRECT') return data.questions.filter(question => !question.isCorrect);
    return data.questions;
  }, [data, filter]);

  const totalPages = Math.max(1, Math.ceil(filteredQuestions.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageQuestions = filteredQuestions.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  if (loading) {
    return <PageFrame><div className="flex min-h-0 flex-1 items-center justify-center text-primary"><Loader2 className="animate-spin" size={28} /><span className="ml-3 text-sm font-medium">Loading score report…</span></div></PageFrame>;
  }

  if (loadError || !data) {
    return <PageFrame><div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-4 p-6 text-center"><XCircle size={40} className="text-destructive" /><div><h1 className="text-lg font-semibold">Score report unavailable</h1><p className="mt-1 text-sm text-muted-foreground">This result may no longer exist or you may not have access.</p></div></div></PageFrame>;
  }

  const totalQuestions = data.questions.length;
  const correctCount = data.questions.filter(question => question.isCorrect).length;
  const incorrectCount = totalQuestions - correctCount;
  const accuracy = totalQuestions ? Number(((correctCount / totalQuestions) * 100).toFixed(1)) : 0;
  const firstShown = filteredQuestions.length ? (currentPage - 1) * PAGE_SIZE + 1 : 0;
  const lastShown = Math.min(currentPage * PAGE_SIZE, filteredQuestions.length);
  const reviewingQuestionIndex = reviewingQuestion
    ? data.questions.findIndex(question => question.id === reviewingQuestion.id)
    : -1;

  return (
    <div className="h-full overflow-y-auto bg-background text-foreground">
      <main className="mx-auto flex w-full max-w-screen-2xl flex-col gap-4 p-4 md:p-6">
        <PageHeader title="Test Result Details" description="Review your performance and identify areas for improvement." actions={<SatCountdown />} />

        <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
          <Card className="flex flex-col p-6 lg:col-span-2">
            <div className="mb-6 flex flex-col items-start justify-between gap-3 sm:flex-row">
              <h2 className="text-xl font-semibold text-foreground">{capitalizeFirstLetter(data.examTitle)}</h2>
              <Badge tone="success" className="rounded-md px-3 py-1">Completed</Badge>
            </div>
            <div className="grid grid-cols-2 gap-6 md:grid-cols-4">
              <TestMeta label="Subject" value={subjectLabel(data.subject)} />
              <TestMeta label="Date" value={formatDate(data.completedAt || data.date)} icon={<Calendar size={14} />} />
              <TestMeta label="Time Started" value={formatTime(data.startedAt)} icon={<Clock size={14} />} />
              <TestMeta label="Time Spent" value={data.duration || '—'} icon={<Clock size={14} />} />
            </div>
          </Card>

          <Card className="relative flex min-h-[190px] flex-col items-center justify-center overflow-hidden border-primary! bg-primary! p-6 text-primary-foreground! lg:col-span-1">
            <CheckCircle2 size={120} className="absolute -right-8 -top-8 text-primary-foreground opacity-10" aria-hidden="true" />
            <p className="relative z-10 mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-primary-foreground/70">Accuracy</p>
            <div className="relative z-10 font-mono text-5xl font-bold text-white">{accuracy}%</div>
            <div className="relative z-10 mt-3 rounded-lg border border-white/15 bg-black/20 px-3 py-1 text-xs font-medium text-white">{correctCount} of {totalQuestions} correct</div>
          </Card>
        </div>

        <div className="mb-8 grid grid-cols-1 gap-6 md:grid-cols-3">
          <StatCard label="Total Questions" value={totalQuestions} icon={<List size={20} />} border="border-l-slate-400" iconClass="bg-slate-100 text-slate-500" />
          <StatCard label="Correct" value={correctCount} icon={<CheckCircle2 size={20} />} border="border-l-success" iconClass="bg-success-soft text-success" />
          <StatCard label="Incorrect" value={incorrectCount} icon={<XCircle size={20} />} border="border-l-red-500" iconClass="bg-red-50 text-red-500" />
        </div>

        <TableShell className="mb-8">
          <div className="flex flex-col justify-between gap-3 border-b px-6 py-5 sm:flex-row sm:items-center">
            <h3 className="text-lg font-semibold text-foreground">Question Review</h3>
            <div className="flex items-center gap-2">
              <Filter size={16} className="text-muted-foreground" aria-hidden="true" />
              <Select value={filter} onChange={event => { setFilter(event.target.value as ReviewFilter); setPage(1); }} aria-label="Filter questions">
                <option value="ALL">All questions</option>
                <option value="CORRECT">Correct only</option>
                <option value="INCORRECT">Incorrect only</option>
              </Select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-left text-sm">
              <thead className="border-b bg-muted/50 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <tr><th className="w-28 px-6 py-4">Question</th><th className="px-6 py-4 text-center">Status</th><th className="px-6 py-4 text-center">Correct Answer</th><th className="px-6 py-4 text-center">Your Answer</th><th className="px-6 py-4 text-center">Time Spent</th><th className="px-6 py-4 text-right">Action</th></tr>
              </thead>
              <tbody className="divide-y">
                {pageQuestions.map(question => {
                  const logged = loggedQuestions.has(question.id);
                  return (
                    <tr key={question.id} className="transition-colors hover:bg-muted/30">
                      <td className="px-6 py-4"><p className="font-semibold text-foreground">Q{question.questionNumber}</p><p className="mt-0.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">{question.module}</p></td>
                      <td className="px-6 py-4"><div className="flex justify-center">{question.isCorrect ? <CheckCircle2 size={20} className="text-success" aria-label="Correct" /> : <XCircle size={20} className="text-danger" aria-label="Incorrect" />}</div></td>
                      <td className="px-6 py-4 text-center font-semibold text-foreground">{question.correctAnswer}</td>
                      <td className={`px-6 py-4 text-center font-semibold ${question.isCorrect ? 'text-success' : 'text-danger'}`}>{question.userAnswer || 'Omitted'}</td>
                      <td className="whitespace-nowrap px-6 py-4 text-center font-medium text-foreground">{formatQuestionDuration(question.activeDurationMs)}</td>
                      <td className="px-6 py-4"><div className="flex items-center justify-end gap-2"><Button variant={logged ? 'accent' : 'ghost'} size="sm" disabled={logged} onClick={() => handleAddToErrorLog(question)} title={logged ? 'Added to Error Log' : 'Add to Error Log'}><Bookmark size={14} className={logged ? 'fill-current' : ''} />{logged ? 'Logged' : 'Log'}</Button><Button size="sm" onClick={() => setReviewingQuestion(question)}><Eye size={14} /> Review</Button></div></td>
                    </tr>
                  );
                })}
                {pageQuestions.length === 0 && <tr><td colSpan={6} className="px-6 py-12 text-center text-sm text-muted-foreground">No questions match this filter.</td></tr>}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col items-center justify-between gap-3 border-t px-6 py-4 text-sm text-muted-foreground sm:flex-row">
            <span className="font-medium">Showing {firstShown} to {lastShown} of {filteredQuestions.length} entries</span>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" disabled={currentPage === 1} onClick={() => setPage(value => Math.max(1, value - 1))} aria-label="Previous page"><ChevronLeft size={18} /></Button>
              <span className="flex h-8 min-w-8 items-center justify-center rounded-lg bg-primary px-2 text-xs font-semibold text-primary-foreground">{currentPage}</span>
              <span className="px-1 text-xs">of {totalPages}</span>
              <Button variant="ghost" size="icon" disabled={currentPage === totalPages} onClick={() => setPage(value => Math.min(totalPages, value + 1))} aria-label="Next page"><ChevronRight size={18} /></Button>
            </div>
          </div>
        </TableShell>
      </main>

      {reviewingQuestion && <ReviewModal
        key={reviewingQuestion.id}
        data={reviewingQuestion}
        onClose={() => setReviewingQuestion(null)}
        onPrevious={reviewingQuestionIndex > 0 ? () => setReviewingQuestion(data.questions[reviewingQuestionIndex - 1]) : undefined}
        onNext={reviewingQuestionIndex >= 0 && reviewingQuestionIndex < data.questions.length - 1 ? () => setReviewingQuestion(data.questions[reviewingQuestionIndex + 1]) : undefined}
        examTitle={capitalizeFirstLetter(data.examTitle)}
        examSubject={data.subject}
      />}
    </div>
  );
}

function PageFrame({ children }: { children: React.ReactNode }) {
  return <div className="flex h-full min-h-0 flex-col overflow-hidden bg-background text-foreground">{children}</div>;
}

function TestMeta({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return <div className="min-w-0"><p className="mb-1 text-xs font-medium text-muted-foreground">{label}</p><p className="flex items-center gap-1.5 truncate text-sm font-semibold text-foreground">{icon && <span className="text-muted-foreground">{icon}</span>}{value}</p></div>;
}

function StatCard({ label, value, icon, border, iconClass }: { label: string; value: number; icon: React.ReactNode; border: string; iconClass: string }) {
  return <Card className={`flex items-center gap-4 border-l-4 p-5 ${border}`}><div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full ${iconClass}`}>{icon}</div><div><p className="mb-0.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p><p className="text-2xl font-semibold text-foreground">{value}</p></div></Card>;
}
