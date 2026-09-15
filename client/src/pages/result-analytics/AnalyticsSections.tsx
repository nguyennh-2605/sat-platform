import { useCallback, useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  BookOpenCheck,
  ChevronDown,
  ChevronRight,
  CircleDashed,
  Clock3,
  ListChecks,
  RefreshCw,
  Target,
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { CartesianGrid, Line, LineChart, Tooltip, XAxis, YAxis } from 'recharts';

import { EmptyState } from '@/components/ui/AppUI';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartContainer, type ChartConfig } from '@/components/ui/chart';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  DataPagination,
  DataStateRow,
  DataSurface,
  DataTableViewport,
  DataToolbar,
  DataToolbarActions,
  DataToolbarSearch,
} from '@/components/ui/data-surface';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useDebounce } from '@/hooks/useDebounce';
import axiosClient from '@/lib/axios';
import { cn } from '@/lib/utils';
import type {
  AccuracyTrendPoint,
  AnalyticsRange,
  AnalyticsResponse,
  AnalyticsSource,
  AnalyticsSubject,
  AttemptItem,
  AttemptsResponse,
  Confidence,
  DomainPerformanceItem,
  FocusArea,
  MistakeReviewData,
  PacingData,
  SkillPerformanceItem,
} from './analytics.types';

const chartConfig = {
  rw: { label: 'Reading & Writing', color: 'var(--chart-3)' },
  math: { label: 'Math', color: 'var(--chart-2)' },
} satisfies ChartConfig;

const accuracyText = (value: number | null) => value === null ? '—' : `${value}%`;

const durationText = (value: number | null) => {
  if (value === null) return '—';
  const totalSeconds = Math.round(value / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return minutes ? `${minutes}m ${String(seconds).padStart(2, '0')}s` : `${seconds}s`;
};

const errorLogHref = (category?: string, status = 'NEEDS_REVIEW') => {
  const params = new URLSearchParams({ status });
  if (category) params.set('category', category);
  return `/dashboard/error-log?${params.toString()}`;
};

export function FocusAreas({ items, onViewBreakdown }: { items: FocusArea[]; onViewBreakdown: (domainCode: string) => void }) {
  return <AnalyticsSection id="overview" title="Focus areas" description="The strongest evidence about where your next review will have the most impact.">
    {items.length === 0 ? <EmptyState surface={false} compact icon={<Target />} title="No reliable focus area yet" description="Complete at least 10 classified questions in a skill or domain before Analytics ranks it." /> : <div className="grid gap-4 lg:grid-cols-2">
      {items.map(item => <Card key={`${item.kind}-${item.code}`} size="sm">
        <CardHeader>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">{item.subject === 'RW' ? 'R&W' : 'Math'}</Badge>
            <Badge variant="secondary">{item.kind === 'SKILL' ? item.domainName : 'Domain'}</Badge>
          </div>
          <CardTitle className="mt-2 text-base">{item.name}</CardTitle>
          <CardDescription>{item.reasons.join(' · ')}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-px overflow-hidden rounded-lg border border-border bg-border">
            <CompactMetric label="Accuracy" value={`${item.accuracy}%`} />
            <CompactMetric label="Questions" value={String(item.attempted)} />
            <CompactMetric label="Need review" value={String(item.needsReview)} />
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {item.needsReview > 0 && <Button asChild size="sm"><Link to={errorLogHref(item.category)}>Review mistakes<ArrowRight /></Link></Button>}
            <Button variant="outline" size="sm" onClick={() => onViewBreakdown(item.domainCode)}>View breakdown<ArrowRight /></Button>
          </div>
        </CardContent>
      </Card>)}
    </div>}
  </AnalyticsSection>;
}

export function PerformanceSnapshot({ data }: { data: AnalyticsResponse['snapshot'] }) {
  const items = [
    ['Overall accuracy', accuracyText(data.overallAccuracy)],
    ['R&W accuracy', accuracyText(data.rwAccuracy)],
    ['Math accuracy', accuracyText(data.mathAccuracy)],
    ['Questions answered', data.questionsAnswered.toLocaleString('en-US')],
  ];
  return <Card>
    <CardHeader className="border-b">
      <CardTitle>Performance snapshot</CardTitle>
      <CardDescription>Results matching the selected time period and subject · {data.completedTests} completed test{data.completedTests === 1 ? '' : 's'}.</CardDescription>
    </CardHeader>
    <CardContent className="grid grid-cols-2 gap-px bg-border p-0 sm:grid-cols-4">
      {items.map(([label, value]) => <div key={label} className="bg-card px-4 py-5"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 text-2xl font-semibold tabular-nums text-foreground">{value}</p></div>)}
    </CardContent>
  </Card>;
}

export function AccuracyTrend({ data }: { data: AccuracyTrendPoint[] }) {
  const chartData = useMemo(() => data.map((item, index) => ({
    ...item,
    attempt: index + 1,
    rw: item.subject === 'RW' ? item.accuracy : null,
    math: item.subject === 'MATH' ? item.accuracy : null,
  })), [data]);
  return <AnalyticsSection id="trend" title="Accuracy trend" description="Accuracy from completed attempts, using real completion dates rather than an estimated SAT score.">
    <Card>
      <CardContent>
        {chartData.length === 0 ? <EmptyState surface={false} compact icon={<Target />} title="No completed attempts yet" description="Complete a test to start your accuracy trend." /> : <ChartContainer config={chartConfig} className="h-72 w-full" role="img" aria-label="Reading and Writing and Math accuracy across completed attempts">
          <LineChart data={chartData} margin={{ top: 12, right: 12, bottom: 8, left: -12 }}>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="attempt" axisLine={false} tickLine={false} tickMargin={10} tickFormatter={value => {
              const item = chartData[Number(value) - 1];
              return item ? format(new Date(item.date), 'MMM d') : String(value);
            }} />
            <YAxis domain={[0, 100]} axisLine={false} tickLine={false} tickFormatter={value => `${value}%`} width={44} />
            <Tooltip cursor={false} content={<AccuracyTooltip />} />
            <Line connectNulls dataKey="rw" type="linear" stroke="var(--color-rw)" strokeWidth={2.5} dot={{ r: 3 }} activeDot={{ r: 5 }} />
            <Line connectNulls dataKey="math" type="linear" stroke="var(--color-math)" strokeWidth={2.5} dot={{ r: 3 }} activeDot={{ r: 5 }} />
          </LineChart>
        </ChartContainer>}
        {chartData.length === 50 && <p className="mt-3 text-center text-xs text-muted-foreground">Showing the latest 50 attempts in this period.</p>}
      </CardContent>
    </Card>
  </AnalyticsSection>;
}

interface TooltipPayloadItem { payload: AccuracyTrendPoint & { attempt: number }; value?: number }
function AccuracyTooltip({ active, payload }: { active?: boolean; payload?: TooltipPayloadItem[] }) {
  const item = payload?.[0]?.payload;
  if (!active || !item) return null;
  return <div className="min-w-52 rounded-control border border-ui-border bg-background p-3 text-xs shadow-raised">
    <p className="font-medium text-foreground">{item.testName}</p>
    <p className="mt-1 text-muted-foreground">{format(new Date(item.date), 'MMM d, yyyy')} · {item.subject === 'RW' ? 'Reading & Writing' : 'Math'}</p>
    <p className="mt-2 font-medium tabular-nums text-foreground">{item.correctCount}/{item.totalQuestions} correct · {item.accuracy}%</p>
  </div>;
}

export function SkillPerformance({ domains, focusedDomain }: { domains: DomainPerformanceItem[]; focusedDomain: string | null }) {
  const [open, setOpen] = useState<Set<string>>(() => new Set(domains.filter(domain => domain.attempted > 0).map(domain => domain.code)));
  const grouped = useMemo(() => ({
    RW: domains.filter(domain => domain.subject === 'RW').sort((first, second) => first.sortOrder - second.sortOrder),
    MATH: domains.filter(domain => domain.subject === 'MATH').sort((first, second) => first.sortOrder - second.sortOrder),
  }), [domains]);
  return <AnalyticsSection id="skills" title="Skill performance" description="Expand each SAT content domain to separate reliable signals from small samples.">
    <div className="space-y-5">
      {(['RW', 'MATH'] as const).map(subject => grouped[subject].length > 0 && <div key={subject}>
        <h3 className="mb-2 text-sm font-medium text-foreground">{subject === 'RW' ? 'Reading & Writing' : 'Math'}</h3>
        <DataSurface>
          {grouped[subject].map(domain => <DomainRow key={domain.code} domain={domain} open={open.has(domain.code) || focusedDomain === domain.code} highlighted={focusedDomain === domain.code} onOpenChange={next => setOpen(previous => {
            const copy = new Set(previous);
            if (next) copy.add(domain.code); else copy.delete(domain.code);
            return copy;
          })} />)}
        </DataSurface>
      </div>)}
    </div>
  </AnalyticsSection>;
}

function DomainRow({ domain, open, highlighted, onOpenChange }: { domain: DomainPerformanceItem; open: boolean; highlighted: boolean; onOpenChange: (open: boolean) => void }) {
  return <Collapsible open={open} onOpenChange={onOpenChange}>
    <CollapsibleTrigger asChild>
      <button type="button" className={cn('flex w-full items-center gap-3 border-b border-ui-border px-4 py-3 text-left transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring', highlighted && 'bg-primary/5')}>
        {open ? <ChevronDown className="size-4 shrink-0 text-muted-foreground" /> : <ChevronRight className="size-4 shrink-0 text-muted-foreground" />}
        <div className="min-w-0 flex-1"><p className="font-medium text-foreground">{domain.name}</p><p className="mt-0.5 text-xs text-muted-foreground">{domain.attempted ? `${domain.correct}/${domain.attempted} correct` : 'No classified answers yet'}</p></div>
        <TrendValue value={domain.trendDelta} />
        <span className="w-14 text-right font-medium tabular-nums">{accuracyText(domain.accuracy)}</span>
      </button>
    </CollapsibleTrigger>
    <CollapsibleContent>
      <div className="divide-y divide-ui-border border-b border-ui-border bg-muted/10 pl-7">
        {domain.skills.map(skill => <SkillRow key={skill.code} skill={skill} />)}
      </div>
    </CollapsibleContent>
  </Collapsible>;
}

function SkillRow({ skill }: { skill: SkillPerformanceItem }) {
  return <div className="grid gap-3 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_auto_auto_auto] sm:items-center">
    <div className="min-w-0"><p className="text-sm font-medium text-foreground">{skill.name}</p><div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground"><ConfidenceBadge confidence={skill.confidence} /><span>{skill.attempted} questions</span>{skill.avgTimeMs !== null && <span>{durationText(skill.avgTimeMs)} avg</span>}</div></div>
    <TrendValue value={skill.trendDelta} />
    <span className="text-sm font-medium tabular-nums">{accuracyText(skill.accuracy)}</span>
    {skill.mistakes > 0 ? <Button asChild variant="ghost" size="sm" className="justify-start sm:justify-end"><Link to={errorLogHref(skill.name, skill.needsReview ? 'NEEDS_REVIEW' : 'ALL')}>{skill.needsReview ? `${skill.needsReview} need review` : `${skill.mistakes} reviewed`}<ArrowRight /></Link></Button> : <span className="text-xs text-muted-foreground sm:text-right">No saved mistakes</span>}
  </div>;
}

function ConfidenceBadge({ confidence }: { confidence: Confidence }) {
  const label = confidence === 'RANKABLE' ? 'Reliable' : confidence === 'EARLY_SIGNAL' ? 'Early signal' : 'Not enough data';
  return <Badge variant={confidence === 'RANKABLE' ? 'secondary' : 'outline'}>{label}</Badge>;
}

function TrendValue({ value }: { value: number | null }) {
  if (value === null) return <span className="text-xs text-muted-foreground">No trend</span>;
  if (value > 0) return <span className="inline-flex items-center gap-1 text-xs font-medium text-primary"><ArrowUpRight className="size-3.5" />{value} pts</span>;
  if (value < 0) return <span className="inline-flex items-center gap-1 text-xs font-medium text-destructive"><ArrowDownRight className="size-3.5" />{Math.abs(value)} pts</span>;
  return <span className="text-xs text-muted-foreground">Stable</span>;
}

export function MistakeReview({ data }: { data: MistakeReviewData }) {
  return <AnalyticsSection id="mistakes" title="Mistake review" description="Review progress from your Error Log without duplicating reflection work here.">
    <Card>
      <CardContent>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <CompactMetric label="Saved mistakes" value={String(data.saved)} bordered />
          <CompactMetric label="Need review" value={String(data.needsReview)} bordered />
          <CompactMetric label="Reviewed" value={String(data.reviewed)} bordered />
          <CompactMetric label="Review completion" value={data.completion === null ? '—' : `${data.completion}%`} bordered />
        </div>
        {data.saved > 0 && <Progress value={data.completion || 0} className="mt-4 h-1.5" aria-label={`${data.completion || 0}% of mistakes reviewed`} />}
        <div className="mt-5 border-t border-border pt-4">
          <div className="flex items-center justify-between gap-3"><div><h3 className="text-sm font-medium">Top mistake areas</h3><p className="mt-0.5 text-xs text-muted-foreground">Categories with the most saved errors in this view.</p></div><Button asChild variant={data.needsReview ? 'default' : 'outline'} size="sm"><Link to={errorLogHref(undefined, data.needsReview ? 'NEEDS_REVIEW' : 'ALL')}>{data.needsReview ? `Review ${data.needsReview} mistakes` : 'Open Error Log'}<ArrowRight /></Link></Button></div>
          {data.topAreas.length === 0 ? <p className="mt-5 text-sm text-muted-foreground">No matching Error Log entries in this period.</p> : <div className="mt-4 divide-y divide-border">{data.topAreas.map(area => <div key={`${area.category}-${area.name}`} className="flex items-center gap-3 py-2.5"><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{area.name}</p><p className="text-xs text-muted-foreground">{area.saved} saved · {area.reviewed} reviewed</p></div>{area.needsReview > 0 && <Button asChild variant="ghost" size="sm"><Link to={errorLogHref(area.category)}>{area.needsReview} need review<ArrowRight /></Link></Button>}</div>)}</div>}
        </div>
      </CardContent>
    </Card>
  </AnalyticsSection>;
}

export function PacingAnalytics({ data }: { data: PacingData }) {
  return <AnalyticsSection id="pacing" title="Pacing" description="Active time per question from attempts that recorded Question Timing.">
    {!data.available ? <Card><CardContent><EmptyState surface={false} compact icon={<Clock3 />} title="No pacing data yet" description="Pacing currently becomes available after a timed Exam attempt. Missing timings are never treated as zero." /></CardContent></Card> : <div className="space-y-4">
      <Card>
        <CardHeader className="border-b"><CardTitle>Pacing snapshot</CardTitle><CardDescription>Based on {data.timedQuestions} of {data.answeredQuestions} answered questions ({data.coverage}% coverage).</CardDescription></CardHeader>
        <CardContent className="grid grid-cols-2 gap-px bg-border p-0 sm:grid-cols-4">
          <CompactMetric label="Average / question" value={durationText(data.averageTimeMs)} />
          <CompactMetric label="Correct average" value={durationText(data.correctAverageMs)} />
          <CompactMetric label="Incorrect average" value={durationText(data.incorrectAverageMs)} />
          <CompactMetric label="Over 2 minutes" value={String(data.slowQuestions)} />
        </CardContent>
      </Card>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card><CardHeader><CardTitle>Answer patterns</CardTitle><CardDescription>Slow means more than two active minutes on a question.</CardDescription></CardHeader><CardContent className="grid grid-cols-2 gap-3">
          <Pattern label="Fast + correct" value={data.patterns.fastCorrect} />
          <Pattern label="Slow + correct" value={data.patterns.slowCorrect} />
          <Pattern label="Fast + wrong" value={data.patterns.fastWrong} />
          <Pattern label="Slow + wrong" value={data.patterns.slowWrong} emphasis />
        </CardContent></Card>
        <Card><CardHeader><CardTitle>Slowest skills</CardTitle><CardDescription>Skill timing is shown only where a question has both classification and timing.</CardDescription></CardHeader><CardContent>
          <div className="divide-y divide-border">{data.skills.length ? data.skills.map(skill => <div key={skill.code} className="flex items-center gap-3 py-2.5"><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{skill.name}</p><p className="text-xs text-muted-foreground">{skill.timedQuestions} timed · {accuracyText(skill.accuracy)} accuracy</p></div><span className="text-sm font-medium tabular-nums">{durationText(skill.avgTimeMs)}</span></div>) : <p className="text-sm text-muted-foreground">No classified timing data yet.</p>}</div>
        </CardContent></Card>
      </div>
    </div>}
  </AnalyticsSection>;
}

function Pattern({ label, value, emphasis = false }: { label: string; value: number; emphasis?: boolean }) {
  return <div className={cn('rounded-lg border border-border p-3', emphasis && value > 0 && 'border-destructive/30 bg-destructive/5')}><p className="text-xs text-muted-foreground">{label}</p><p className={cn('mt-1 text-2xl font-semibold tabular-nums', emphasis && value > 0 && 'text-destructive')}>{value}</p></div>;
}

export function Attempts({ range, subject }: { range: AnalyticsRange; subject: AnalyticsSubject }) {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 250);
  const [source, setSource] = useState<AnalyticsSource>('ALL');
  const [items, setItems] = useState<AttemptItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);

  const load = useCallback(async (cursor?: string | null, signal?: AbortSignal) => {
    if (cursor) setLoadingMore(true); else setLoading(true);
    setError('');
    try {
      const response = await axiosClient.get<AttemptsResponse>('/api/results-analytics/attempts', { params: { range, subject, source, search: debouncedSearch || undefined, cursor: cursor || undefined, limit: 20 }, signal });
      if (signal?.aborted) return;
      setItems(previous => cursor ? [...previous, ...response.items.filter(item => !previous.some(existing => existing.id === item.id))] : response.items);
      setNextCursor(response.nextCursor);
    } catch {
      if (!signal?.aborted) setError(cursor ? 'More attempts could not be loaded.' : 'Attempts could not be loaded.');
    } finally {
      if (!signal?.aborted) {
        setLoading(false);
        setLoadingMore(false);
      }
    }
  }, [debouncedSearch, range, source, subject]);

  useEffect(() => {
    const controller = new AbortController();
    setItems([]);
    setNextCursor(null);
    void load(null, controller.signal);
    return () => controller.abort();
  }, [load, reload]);

  return <AnalyticsSection id="attempts" title="Attempts" description="Completed tests only. In-progress work stays on Overview so you can continue it there.">
    <DataSurface>
      <DataToolbar>
        <DataToolbarSearch value={search} onChange={event => setSearch(event.target.value)} placeholder="Search test name" label="Search completed attempts" />
        <DataToolbarActions>
          <Select value={source} onValueChange={value => setSource(value as AnalyticsSource)}><SelectTrigger aria-label="Filter attempts by source"><SelectValue /></SelectTrigger><SelectContent position="popper" align="end"><SelectItem value="ALL">All sources</SelectItem><SelectItem value="CLASSROOM">Classroom</SelectItem><SelectItem value="SELF_STUDY">Self-study</SelectItem></SelectContent></Select>
        </DataToolbarActions>
      </DataToolbar>
      <DataTableViewport>
        <Table className="min-w-224">
          <TableHeader><TableRow><TableHead>Test</TableHead><TableHead>Subject</TableHead><TableHead>Accuracy</TableHead><TableHead>Correct</TableHead><TableHead>Time</TableHead><TableHead>Source</TableHead><TableHead>Date</TableHead><TableHead className="text-right">Action</TableHead></TableRow></TableHeader>
          <TableBody>
            {loading ? Array.from({ length: 5 }, (_, index) => <TableRow key={index}><TableCell colSpan={8}><Skeleton className="h-8 w-full" /></TableCell></TableRow>) : error && items.length === 0 ? <DataStateRow colSpan={8}><div role="alert"><p>{error}</p><Button variant="outline" size="sm" className="mt-3" onClick={() => setReload(value => value + 1)}><RefreshCw />Try again</Button></div></DataStateRow> : items.length === 0 ? <DataStateRow colSpan={8}><div className="flex flex-col items-center"><CircleDashed className="size-8 text-muted-foreground" /><p className="mt-3 font-medium">No matching attempts</p><p className="mt-1 text-sm text-muted-foreground">Complete a test or adjust the search and source filter.</p></div></DataStateRow> : items.map(item => <TableRow key={item.id}>
              <TableCell><div className="max-w-72"><p className="truncate font-medium text-foreground">{item.testName}</p><p className="mt-0.5 text-xs text-muted-foreground">{item.mode === 'EXAM' ? 'Timed exam' : 'Practice'}</p></div></TableCell>
              <TableCell><Badge variant="outline">{item.subject === 'RW' ? 'R&W' : 'Math'}</Badge></TableCell>
              <TableCell className="font-medium tabular-nums">{accuracyText(item.accuracy)}</TableCell>
              <TableCell className="tabular-nums text-muted-foreground">{item.correctCount}/{item.totalQuestions}</TableCell>
              <TableCell className="tabular-nums text-muted-foreground" title={item.durationSource === 'ACTIVE' ? 'Active question time' : 'Elapsed attempt time'}>{durationText(item.durationMs)}</TableCell>
              <TableCell>{item.source === 'CLASSROOM' ? 'Classroom' : 'Self-study'}</TableCell>
              <TableCell className="text-muted-foreground">{format(new Date(item.completedAt), 'MMM d, yyyy')}</TableCell>
              <TableCell className="text-right"><Button variant="outline" size="sm" onClick={() => navigate('/dashboard/score-report', { state: { resultId: item.id } })}>View details<ArrowRight /></Button></TableCell>
            </TableRow>)}
          </TableBody>
        </Table>
      </DataTableViewport>
      {(nextCursor || error && items.length > 0) && <DataPagination><p className="text-xs text-muted-foreground">{items.length} completed attempt{items.length === 1 ? '' : 's'} loaded</p>{error ? <div className="flex items-center gap-2"><span className="text-xs text-destructive">{error}</span><Button variant="outline" size="sm" onClick={() => void load(nextCursor)}><RefreshCw />Retry</Button></div> : <Button variant="outline" size="sm" disabled={loadingMore} onClick={() => void load(nextCursor)}>{loadingMore ? 'Loading…' : 'Load more'}</Button>}</DataPagination>}
    </DataSurface>
  </AnalyticsSection>;
}

function AnalyticsSection({ id, title, description, children }: { id: string; title: string; description: string; children: React.ReactNode }) {
  return <section id={id} aria-labelledby={`${id}-title`} className="scroll-mt-32 space-y-3">
    <div><h2 id={`${id}-title`} className="text-lg font-semibold text-foreground">{title}</h2><p className="mt-1 text-sm text-muted-foreground">{description}</p></div>
    {children}
  </section>;
}

function CompactMetric({ label, value, bordered = false }: { label: string; value: string; bordered?: boolean }) {
  return <div className={cn('bg-card px-3 py-3', bordered && 'rounded-lg border border-border')}><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 text-lg font-semibold tabular-nums text-foreground">{value}</p></div>;
}

export function AnalyticsLoading() {
  return <div className="space-y-6" aria-label="Loading analytics">
    <div className="grid gap-4 lg:grid-cols-2">{[1, 2].map(item => <Card key={item}><CardContent><Skeleton className="h-36 w-full" /></CardContent></Card>)}</div>
    <Card><CardContent><Skeleton className="h-24 w-full" /></CardContent></Card>
    <Card><CardContent><Skeleton className="h-72 w-full" /></CardContent></Card>
    <Card><CardContent><Skeleton className="h-80 w-full" /></CardContent></Card>
  </div>;
}

export function AnalyticsEmpty() {
  return <Card><CardContent><EmptyState surface={false} icon={<BookOpenCheck />} title="Your analytics starts here" description="Complete a test to unlock skill, mistake, pacing, and attempt insights." /></CardContent></Card>;
}

export function AnalyticsLoadError({ onRetry }: { onRetry: () => void }) {
  return <Card><CardContent><EmptyState surface={false} icon={<ListChecks />} title="Analytics could not be loaded" description="Check the server connection and try again." action={<Button variant="outline" onClick={onRetry}><RefreshCw />Try again</Button>} /></CardContent></Card>;
}
