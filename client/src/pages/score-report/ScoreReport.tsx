import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { CalendarDays, CheckCircle2, ChevronLeft, ChevronRight, Clock3, Eye, LockKeyhole, MinusCircle, XCircle } from 'lucide-react';
import { LoadingState } from '@/components/ui/loading';

import { PageHeader } from '@/components/ui/AppUI';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { DataPagination, DataSurface, DataToolbar, DataToolbarActions } from '@/components/ui/data-surface';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { appToast } from '@/components/ui/toast';
import { useDashboardBack } from '../../features/navigation/DashboardBackContext';
import axiosClient from '../../lib/axios';
import { invalidateQueryCache } from '../../lib/queryCache';
import { capitalizeFirstLetter } from '../../utils/text';
import { QuestionReviewDialog } from './QuestionReviewDialog';
import type { DomainPerformance, ModulePerformance, QuestionResult, ScoreReportData } from './score-report.types';

interface ScoreReportProps {
  initialData?: ScoreReportData;
  onBackToHome?: () => void;
}

type ReviewFilter = 'ALL' | 'CORRECT' | 'INCORRECT' | 'OMITTED';
type ReportLoadState = {
  key: string | null;
  data: ScoreReportData | null;
  error: boolean;
};
const PAGE_SIZE = 7;

export default function ScoreReport({ initialData, onBackToHome }: ScoreReportProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const params = useParams<{ resultId?: string }>();
  const stateResultId = location.state?.resultId as number | string | undefined;
  const resultId = params.resultId || stateResultId || initialData?.submissionId;
  const requestKey = resultId === undefined ? null : String(resultId);
  const [reportState, setReportState] = useState<ReportLoadState>(() => ({
    key: initialData ? requestKey : null,
    data: initialData || null,
    error: false,
  }));
  const [reviewingQuestion, setReviewingQuestion] = useState<QuestionResult | null>(null);
  const [filter, setFilter] = useState<ReviewFilter>('ALL');
  const [domainFilter, setDomainFilter] = useState('ALL');
  const [page, setPage] = useState(1);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    invalidateQueryCache('/api/error-logs');
  }, [requestKey]);

  useEffect(() => {
    if (initialData) return;
    if (!requestKey) return;
    const controller = new AbortController();
    void axiosClient.get<ScoreReportData, ScoreReportData>(`/api/results-analytics/submission/${requestKey}`, { signal: controller.signal })
      .then(response => {
        if (!controller.signal.aborted) setReportState({ key: requestKey, data: response, error: false });
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setReportState({ key: requestKey, data: null, error: true });
          appToast.error('Unable to load score report.');
        }
      });
    return () => controller.abort();
  }, [initialData, reload, requestKey]);

  const data = initialData || (reportState.key === requestKey ? reportState.data : null);
  const loading = !initialData && Boolean(requestKey) && reportState.key !== requestKey;
  const loadError = !initialData && (!requestKey || (reportState.key === requestKey && reportState.error));

  const handleBack = () => {
    const cleanupKeys = location.state?.cleanupKeys as string[] | undefined;
    cleanupKeys?.forEach(key => localStorage.removeItem(key));
    if (onBackToHome) onBackToHome();
    else navigate('/dashboard/results-analytics');
  };
  useDashboardBack(handleBack);

  const retryLoad = () => {
    setReportState({ key: null, data: null, error: false });
    setReload(value => value + 1);
  };

  const filteredQuestions = useMemo(() => {
    if (!data) return [];
    return data.questions.filter(question => {
      const matchesOutcome = filter === 'ALL'
        || (filter === 'CORRECT' && question.isCorrect)
        || (filter === 'INCORRECT' && !question.isCorrect && !question.isOmitted)
        || (filter === 'OMITTED' && question.isOmitted);
      const questionDomain = question.domain?.code || 'UNCLASSIFIED';
      return matchesOutcome && (domainFilter === 'ALL' || questionDomain === domainFilter);
    });
  }, [data, domainFilter, filter]);

  const totalPages = Math.max(1, Math.ceil(filteredQuestions.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageQuestions = filteredQuestions.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const firstShown = filteredQuestions.length ? (currentPage - 1) * PAGE_SIZE + 1 : 0;
  const lastShown = Math.min(currentPage * PAGE_SIZE, filteredQuestions.length);
  const reviewingQuestionIndex = reviewingQuestion
    ? filteredQuestions.findIndex(question => question.id === reviewingQuestion.id)
    : -1;
  const reviewErrorLogId = reviewingQuestion?.errorLogId;

  if (loading) return <ReportFrame><LoadingState className="min-h-80" label="Loading score report…" /></ReportFrame>;
  if (loadError || !data) return <ReportFrame><div className="flex min-h-80 flex-col items-center justify-center gap-3 text-center"><XCircle className="size-9 text-danger" /><div><h1 className="text-heading font-semibold">Score report unavailable</h1><p className="mt-1 text-body text-muted-foreground">This result may no longer exist or you may not have access.</p></div><div className="flex flex-wrap justify-center gap-2">{requestKey && <Button onClick={retryLoad}>Try again</Button>}<Button variant="outline" onClick={handleBack}>Back to results</Button></div></div></ReportFrame>;

  const title = capitalizeFirstLetter(data.examTitle);
  const hasFilters = filter !== 'ALL' || domainFilter !== 'ALL';
  const filterableDomains = data.domains.filter(domain => domain.total > 0);

  return (
    <ReportFrame>
      <PageHeader title="Test Result Details" description="Review this attempt and identify what to improve next." />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(16rem,1fr)]">
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div><CardTitle>{title}</CardTitle><CardDescription className="mt-1">{subjectLabel(data.subject)} · {modeLabel(data.mode)} · Attempt {data.attemptNo}</CardDescription></div>
              <Badge variant="outline" className="border-success/30 bg-success-soft text-success">Completed</Badge>
            </div>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <MetaItem icon={<CalendarDays />} label="Completed" value={formatDate(data.completedAt || data.date)} />
            <MetaItem icon={<Clock3 />} label="Elapsed time" value={formatDuration(data.elapsedDurationMs)} />
            <MetaItem icon={<Clock3 />} label="Active time" value={formatDuration(data.pacing.activeDurationMs)} />
            <MetaItem icon={<Clock3 />} label="Average per timed question" value={formatDuration(data.pacing.averageActiveDurationMs)} />
          </CardContent>
        </Card>

        <Card className="justify-center bg-primary text-primary-foreground ring-primary">
          <CardContent className="flex flex-col items-center justify-center py-4 text-center">
            <p className="text-caption font-semibold uppercase tracking-wide text-primary-foreground/70">Accuracy</p>
            <p className="mt-2 text-5xl font-semibold tabular-nums">{formatPercentage(data.summary.accuracy)}</p>
            <p className="mt-2 text-body text-primary-foreground/80">{data.summary.correct} of {data.summary.total} correct</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <OutcomeCard label="Correct" value={data.summary.correct} icon={<CheckCircle2 />} tone="success" />
        <OutcomeCard label="Incorrect" value={data.summary.incorrect} icon={<XCircle />} tone="danger" />
        <OutcomeCard label="Omitted" value={data.summary.omitted} icon={<MinusCircle />} tone="warning" />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <PerformanceCard title="Performance by module" description="Accuracy and active time within each module.">{data.modules.map(module => <ModuleRow key={module.order} module={module} />)}</PerformanceCard>
        <PerformanceCard title="Pacing" description={`${data.pacing.timedQuestions} of ${data.pacing.totalQuestions} questions include active timing.`}>
          <MetricRow label="Active time" value={formatDuration(data.pacing.activeDurationMs)} />
          <MetricRow label="Average per timed question" value={formatDuration(data.pacing.averageActiveDurationMs)} />
          <MetricRow label="Timing coverage" value={formatPercentage(data.pacing.timingCoverage)} />
          <MetricRow label="Slowest question" value={data.pacing.slowestQuestion ? `Module ${data.pacing.slowestQuestion.moduleOrder}, Q${data.pacing.slowestQuestion.questionNumber} · ${formatDuration(data.pacing.slowestQuestion.activeDurationMs)}` : '—'} />
        </PerformanceCard>
      </div>

      <KnowledgeAndSkillsBreakdown
        subject={data.subject}
        domains={data.domains}
        totalQuestions={data.summary.total}
        classifiedQuestions={data.classificationCoverage.classified}
      />

      {data.solutionsLocked ? <Card className="border-warning/30 bg-warning-soft"><CardContent className="flex items-start gap-3 py-5"><LockKeyhole className="mt-0.5 size-5 shrink-0 text-warning" aria-hidden="true" /><div><h2 className="text-title font-semibold text-foreground">Question review is locked</h2><p className="mt-1 text-body text-muted-foreground">This assigned quiz is still open, so correct answers and explanations remain hidden{data.solutionAvailableAt ? ` until ${formatDate(data.solutionAvailableAt)}` : ' until the teacher closes it'}.</p></div></CardContent></Card> : <DataSurface>
        <DataToolbar>
          <div><h2 className="text-title font-semibold text-foreground">Question review</h2><p className="mt-0.5 text-caption text-muted-foreground">Inspect each answer and read the authored explanation when available.</p></div>
          <DataToolbarActions>
            <Select value={filter} onValueChange={value => { setFilter(value as ReviewFilter); setPage(1); }}><SelectTrigger size="sm" aria-label="Filter by result"><SelectValue /></SelectTrigger><SelectContent position="popper" align="end"><SelectItem value="ALL">All questions</SelectItem><SelectItem value="INCORRECT">Incorrect</SelectItem><SelectItem value="OMITTED">Omitted</SelectItem><SelectItem value="CORRECT">Correct</SelectItem></SelectContent></Select>
            <Select value={domainFilter} onValueChange={value => { setDomainFilter(value); setPage(1); }}><SelectTrigger size="sm" aria-label="Filter by domain"><SelectValue /></SelectTrigger><SelectContent position="popper" align="end"><SelectItem value="ALL">All domains</SelectItem>{filterableDomains.map(domain => <SelectItem key={domain.code} value={domain.code}>{domain.name}</SelectItem>)}</SelectContent></Select>
            {hasFilters && <Button variant="ghost" size="sm" onClick={() => { setFilter('ALL'); setDomainFilter('ALL'); setPage(1); }}>Clear filters</Button>}
          </DataToolbarActions>
        </DataToolbar>

        <Table className="min-w-[800px]">
          <TableHeader><TableRow><TableHead className="w-[42%]">Question</TableHead><TableHead>Status</TableHead><TableHead className="text-center">Correct answer</TableHead><TableHead className="text-center">Your answer</TableHead><TableHead className="text-center">Time</TableHead><TableHead className="w-24 text-right">Action</TableHead></TableRow></TableHeader>
          <TableBody>
            {pageQuestions.map(question => <QuestionRow key={question.id} question={question} onReview={() => setReviewingQuestion(question)} />)}
            {pageQuestions.length === 0 && <TableRow className="hover:bg-transparent"><TableCell colSpan={6} className="h-40 text-center"><p className="font-medium text-foreground">No matching questions</p><p className="mt-1 text-caption text-muted-foreground">Change or clear the current filters.</p>{hasFilters && <Button variant="outline" size="sm" className="mt-3" onClick={() => { setFilter('ALL'); setDomainFilter('ALL'); setPage(1); }}>Clear filters</Button>}</TableCell></TableRow>}
          </TableBody>
        </Table>

        <DataPagination className="text-caption text-muted-foreground"><span>Showing {firstShown}–{lastShown} of {filteredQuestions.length}</span><div className="flex items-center gap-1"><Button variant="ghost" size="icon-sm" disabled={currentPage === 1} onClick={() => setPage(value => Math.max(1, value - 1))} aria-label="Previous page"><ChevronLeft /></Button><span className="min-w-16 text-center tabular-nums">{currentPage} of {totalPages}</span><Button variant="ghost" size="icon-sm" disabled={currentPage === totalPages} onClick={() => setPage(value => Math.min(totalPages, value + 1))} aria-label="Next page"><ChevronRight /></Button></div></DataPagination>
      </DataSurface>}

      {!data.solutionsLocked && <QuestionReviewDialog
        key={reviewingQuestion?.id || 'closed'}
        data={reviewingQuestion}
        examTitle={title}
        examSubject={data.subject}
        onClose={() => setReviewingQuestion(null)}
        onPrevious={reviewingQuestionIndex > 0 ? () => setReviewingQuestion(filteredQuestions[reviewingQuestionIndex - 1]) : undefined}
        onNext={reviewingQuestionIndex >= 0 && reviewingQuestionIndex < filteredQuestions.length - 1 ? () => setReviewingQuestion(filteredQuestions[reviewingQuestionIndex + 1]) : undefined}
        onOpenErrorLog={reviewErrorLogId ? () => navigate(`/dashboard/error-log?entry=${encodeURIComponent(reviewErrorLogId)}`) : undefined}
      />}
    </ReportFrame>
  );
}

function ReportFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="h-full min-h-0 overflow-y-auto">
      <main className="mx-auto flex w-full max-w-screen-2xl flex-col gap-4 p-4 pb-10 text-foreground md:p-6 md:pb-12">
        {children}
      </main>
    </div>
  );
}

function MetaItem({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return <div className="flex min-w-0 gap-2.5"><span className="mt-0.5 text-muted-foreground [&>svg]:size-4">{icon}</span><div className="min-w-0"><p className="text-caption text-muted-foreground">{label}</p><p className="mt-0.5 truncate text-body font-medium tabular-nums text-foreground">{value}</p></div></div>;
}

function OutcomeCard({ label, value, icon, tone }: { label: string; value: number; icon: React.ReactNode; tone: 'success' | 'danger' | 'warning' }) {
  const toneClass = tone === 'success' ? 'bg-success-soft text-success' : tone === 'danger' ? 'bg-danger-soft text-danger' : 'bg-warning-soft text-warning';
  return <Card size="sm"><CardContent className="flex items-center gap-3"><span className={`flex size-9 items-center justify-center rounded-control [&>svg]:size-4 ${toneClass}`}>{icon}</span><div><p className="text-caption text-muted-foreground">{label}</p><p className="text-2xl font-semibold tabular-nums text-foreground">{value}</p></div></CardContent></Card>;
}

function PerformanceCard({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return <Card><CardHeader><CardTitle>{title}</CardTitle><CardDescription>{description}</CardDescription></CardHeader><CardContent className="divide-y divide-ui-border/60">{children}</CardContent></Card>;
}

function ModuleRow({ module }: { module: ModulePerformance }) {
  return <div className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-4 py-3 first:pt-0 last:pb-0"><div><p className="text-body font-medium text-foreground">{module.name || `Module ${module.order}`}</p><p className="text-caption text-muted-foreground">{module.correct} correct · {module.incorrect} incorrect · {module.omitted} omitted</p></div><span className="text-body font-medium tabular-nums">{formatPercentage(module.accuracy)}</span><span className="min-w-16 text-right text-caption tabular-nums text-muted-foreground">{formatDuration(module.activeDurationMs || null)}</span></div>;
}

function KnowledgeAndSkillsBreakdown({
  subject,
  domains,
  totalQuestions,
  classifiedQuestions,
}: {
  subject: ScoreReportData['subject'];
  domains: DomainPerformance[];
  totalQuestions: number;
  classifiedQuestions: number;
}) {
  const subjectLabel = subject === 'RW' ? 'Reading and Writing' : 'Math';
  const subjectPrefix = subject === 'RW' ? 'RW_' : 'MATH_';
  const subjectDomains = domains
    .filter(domain => domain.code.startsWith(subjectPrefix))
    .sort((first, second) => first.sortOrder - second.sortOrder);
  const unclassifiedQuestions = Math.max(0, totalQuestions - classifiedQuestions);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Knowledge and Skills</CardTitle>
        <CardDescription>View your performance across the {subjectDomains.length} {subjectLabel} content domains for this attempt.</CardDescription>
      </CardHeader>
      <CardContent>
        <h3 className="text-heading font-semibold text-foreground">{subjectLabel}</h3>
        <div className="mt-5 max-w-4xl space-y-6">
          {subjectDomains.map(domain => (
            <DomainBand key={domain.code} domain={domain} totalQuestions={totalQuestions} />
          ))}
        </div>
        {unclassifiedQuestions > 0 && (
          <p className="mt-5 border-t border-ui-border pt-4 text-caption text-muted-foreground">
            {unclassifiedQuestions} {unclassifiedQuestions === 1 ? 'question is' : 'questions are'} not classified yet and {unclassifiedQuestions === 1 ? 'is' : 'are'} excluded from this breakdown.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function DomainBand({ domain, totalQuestions }: { domain: DomainPerformance; totalQuestions: number }) {
  const segmentCount = 7;
  const filledSegments = domain.accuracy === null
    ? 0
    : Math.max(0, Math.min(segmentCount, Math.round((domain.accuracy / 100) * segmentCount)));
  const attemptShare = totalQuestions ? Math.round((domain.total / totalQuestions) * 100) : 0;
  const questionLabel = domain.total === 1 ? 'question' : 'questions';
  const detail = domain.total
    ? `${attemptShare}% of this attempt · ${domain.total} ${questionLabel} · ${domain.correct} correct`
    : 'Not measured in this attempt';

  return (
    <div aria-label={`${domain.name}: ${domain.total ? `${domain.correct} of ${domain.total} correct` : 'not measured'}`}>
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-1">
        <div>
          <p className="text-body font-semibold text-foreground">{domain.name}</p>
          <p className="mt-0.5 text-caption text-muted-foreground">{detail}</p>
        </div>
        <span className="text-body font-semibold tabular-nums text-foreground">{formatPercentage(domain.accuracy)}</span>
      </div>
      <div className="mt-2 grid grid-cols-7 gap-1.5" aria-hidden="true">
        {Array.from({ length: segmentCount }, (_, index) => (
          <span
            key={index}
            className={`h-3 rounded-[2px] border ${index < filledSegments ? 'border-foreground bg-foreground' : 'border-ui-border-strong bg-surface'}`}
          />
        ))}
      </div>
    </div>
  );
}

function MetricRow({ label, value }: { label: string; value: string }) {
  return <div className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0"><span className="text-body text-muted-foreground">{label}</span><span className="text-right text-body font-medium tabular-nums text-foreground">{value}</span></div>;
}

function QuestionRow({ question, onReview }: { question: QuestionResult; onReview: () => void }) {
  const status = question.isCorrect ? 'Correct' : question.isOmitted ? 'Omitted' : 'Incorrect';
  const classification = [question.domain?.name, question.skill?.name].filter(Boolean).join(' · ') || 'Unclassified';
  return <TableRow><TableCell><p className="text-body font-medium text-foreground">Q{question.questionNumber} · {question.module.name || `Module ${question.module.order}`}</p><p className="mt-0.5 truncate text-caption text-muted-foreground">{classification}</p></TableCell><TableCell><Badge variant="outline" className={question.isCorrect ? 'border-success/30 bg-success-soft text-success' : question.isOmitted ? 'border-warning/30 bg-warning-soft text-warning' : 'border-danger/30 bg-danger-soft text-danger'}>{status}</Badge></TableCell><TableCell className="text-center font-medium tabular-nums">{question.correctAnswer || '—'}</TableCell><TableCell className="text-center font-medium tabular-nums">{question.userAnswer || 'Omitted'}</TableCell><TableCell className="whitespace-nowrap text-center tabular-nums text-muted-foreground">{formatDuration(question.activeDurationMs)}</TableCell><TableCell className="text-right"><Button variant="ghost" size="icon-sm" onClick={onReview} aria-label={`Review question ${question.questionNumber}`}><Eye /></Button></TableCell></TableRow>;
}

function formatDate(value?: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(date);
}

function formatDuration(milliseconds?: number | null) {
  if (milliseconds === null || milliseconds === undefined || !Number.isFinite(milliseconds)) return '—';
  const totalSeconds = Math.max(0, Math.round(milliseconds / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours) return `${hours}h ${minutes}m`;
  return minutes ? `${minutes}m ${seconds}s` : `${seconds}s`;
}

function formatPercentage(value: number | null) {
  return value === null ? '—' : `${value}%`;
}

function subjectLabel(subject: ScoreReportData['subject']) {
  return subject === 'RW' ? 'Reading & Writing' : 'Mathematics';
}

function modeLabel(mode: ScoreReportData['mode']) {
  return mode === 'EXAM' ? 'Exam' : 'Practice';
}
