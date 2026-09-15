import { useEffect, useMemo, useState } from 'react';
import { CalendarDays, Clock3, Flame, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/AppUI';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import axiosClient from '@/lib/axios';
import { cn } from '@/lib/utils';
import { FOCUS_SESSION_CHANGED_EVENT } from '@/features/focus-timer/focus-timer.types';
import type { AnalyticsRange, StudyActivityType, StudyTimeSummaryResponse } from './analytics.types';

const activityLabels: Record<StudyActivityType, string> = {
  PRACTICE: 'SAT practice',
  VOCABULARY: 'Vocabulary',
  ERROR_LOG: 'Error Log',
  HOMEWORK: 'Homework',
  OTHER: 'Other study',
};

const dateOrdinal = (date: string) => {
  const [year, month, day] = date.split('-').map(Number);
  return Math.floor(Date.UTC(year, month - 1, day) / 86_400_000);
};

const dateFromOrdinal = (ordinal: number) => new Date(ordinal * 86_400_000).toISOString().slice(0, 10);

const formatTrackedTime = (milliseconds: number | null) => {
  if (milliseconds === null) return '—';
  const totalMinutes = Math.round(milliseconds / 60_000);
  if (totalMinutes < 60) return `${totalMinutes}m`;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return minutes ? `${hours}h ${minutes}m` : `${hours}h`;
};

const readableDate = (date: string) => new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${date}T00:00:00Z`));

function StudyCalendar({ data }: { data: StudyTimeSummaryResponse }) {
  const byDate = useMemo(() => new Map(data.daily.map(day => [day.date, day])), [data.daily]);
  const cells = useMemo(() => {
    const from = dateOrdinal(data.chartWindow.from);
    const to = dateOrdinal(data.chartWindow.to);
    const mondayOffset = (new Date(from * 86_400_000).getUTCDay() + 6) % 7;
    return [
      ...Array.from({ length: mondayOffset }, (_, index) => ({ key: `empty-${index}`, empty: true as const })),
      ...Array.from({ length: Math.max(0, to - from + 1) }, (_, index) => {
        const date = dateFromOrdinal(from + index);
        return { key: date, empty: false as const, date, item: byDate.get(date) };
      }),
    ];
  }, [byDate, data.chartWindow.from, data.chartWindow.to]);
  const maxMs = Math.max(0, ...data.daily.map(day => day.trackedMs));

  return <div>
    <div className="overflow-x-auto pb-2">
      <div
        className="grid w-max grid-flow-col gap-1"
        style={{ gridTemplateRows: 'repeat(7, minmax(0, 1fr))' }}
        role="img"
        aria-label={`Tracked focus time calendar from ${readableDate(data.chartWindow.from)} to ${readableDate(data.chartWindow.to)}, with ${data.summary.activeDays} active days and ${formatTrackedTime(data.summary.trackedMs)} tracked`}
      >
        {cells.map(cell => cell.empty ? <span key={cell.key} className="size-3.5" aria-hidden="true" /> : (() => {
          const trackedMs = cell.item?.trackedMs || 0;
          const ratio = maxMs ? trackedMs / maxMs : 0;
          return <span
            key={cell.key}
            title={`${readableDate(cell.date)}: ${formatTrackedTime(trackedMs)} across ${cell.item?.sessionCount || 0} session${cell.item?.sessionCount === 1 ? '' : 's'}`}
            className={cn(
              'size-3.5 rounded-sm ring-1 ring-inset ring-border',
              ratio === 0 ? 'bg-muted' : ratio <= 0.25 ? 'bg-primary/20' : ratio <= 0.5 ? 'bg-primary/40' : ratio <= 0.75 ? 'bg-primary/65' : 'bg-primary/90',
            )}
          />;
        })())}
      </div>
    </div>
    <div className="mt-2 flex items-center justify-between gap-3 text-xs text-muted-foreground">
      <span>{data.chartWindow.truncated ? 'Calendar shows the latest 365 days.' : 'Each square is one local calendar day.'}</span>
      <span className="flex shrink-0 items-center gap-1" aria-label="Calendar intensity from less to more focus time">Less<span className="size-3 rounded-sm bg-muted ring-1 ring-border" /><span className="size-3 rounded-sm bg-primary/40" /><span className="size-3 rounded-sm bg-primary/90" />More</span>
    </div>
  </div>;
}

function Metric({ icon: Icon, label, value, detail }: { icon: typeof Clock3; label: string; value: string; detail: string }) {
  return <div className="rounded-lg border border-border p-3">
    <div className="flex items-center gap-2 text-xs text-muted-foreground"><Icon className="size-3.5" aria-hidden="true" />{label}</div>
    <p className="mt-2 text-xl font-semibold tabular-nums text-foreground">{value}</p>
    <p className="mt-0.5 text-xs text-muted-foreground">{detail}</p>
  </div>;
}

export function StudyConsistency({ range }: { range: AnalyticsRange }) {
  const timeZone = useMemo(() => Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC', []);
  const [reload, setReload] = useState(0);
  const requestUrl = useMemo(() => `/api/study-sessions/summary?${new URLSearchParams({ range, timeZone })}`, [range, timeZone]);
  const requestKey = `${requestUrl}:${reload}`;
  const [result, setResult] = useState<{ key: string; data: StudyTimeSummaryResponse | null; error: boolean }>({ key: '', data: null, error: false });
  const pending = result.key !== requestKey;
  const data = pending ? null : result.data;
  const error = !pending && result.error;

  useEffect(() => {
    const controller = new AbortController();
    axiosClient.get<StudyTimeSummaryResponse, StudyTimeSummaryResponse>(requestUrl, { signal: controller.signal })
      .then(response => setResult({ key: requestKey, data: response, error: false }))
      .catch(requestError => {
        if ((requestError as { code?: string }).code !== 'ERR_CANCELED') setResult({ key: requestKey, data: null, error: true });
      });
    return () => controller.abort();
  }, [requestKey, requestUrl]);

  useEffect(() => {
    const refreshAfterSessionChange = () => setReload(value => value + 1);
    window.addEventListener(FOCUS_SESSION_CHANGED_EVENT, refreshAfterSessionChange);
    return () => window.removeEventListener(FOCUS_SESSION_CHANGED_EVENT, refreshAfterSessionChange);
  }, []);

  return <section id="consistency" aria-labelledby="consistency-title" className="scroll-mt-32 space-y-3">
    <div><h2 id="consistency-title" className="text-lg font-semibold text-foreground">Study consistency</h2><p className="mt-1 text-sm text-muted-foreground">Tracked focus time from completed Focus Clock sessions. Subject filters do not change this section.</p></div>
    {pending ? <Card><CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"><Skeleton className="h-24" /><Skeleton className="h-24" /><Skeleton className="h-24" /><Skeleton className="h-24" /></CardContent></Card>
      : error ? <Card><CardContent><EmptyState surface={false} compact icon={<RefreshCw />} title="Study consistency could not be loaded" description="Your performance analytics is still available. Try loading tracked focus time again." action={<Button variant="outline" size="sm" onClick={() => setReload(value => value + 1)}><RefreshCw />Try again</Button>} /></CardContent></Card>
        : !data || data.summary.sessionCount === 0 ? <Card><CardContent><EmptyState surface={false} compact icon={<Clock3 />} title="No tracked focus time yet" description="Start the Focus Clock in the dashboard header, then finish the session to add it here." /></CardContent></Card>
          : <div className="grid gap-4">
            <Card><CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Metric icon={Clock3} label="Tracked time" value={formatTrackedTime(data.summary.trackedMs)} detail={`${data.summary.sessionCount} completed session${data.summary.sessionCount === 1 ? '' : 's'}`} />
              <Metric icon={CalendarDays} label="Active days" value={String(data.summary.activeDays)} detail={`Longest streak: ${data.summary.longestStreak} day${data.summary.longestStreak === 1 ? '' : 's'}`} />
              <Metric icon={Flame} label="Current streak" value={`${data.summary.currentStreak} day${data.summary.currentStreak === 1 ? '' : 's'}`} detail="Current within this period" />
              <Metric icon={Clock3} label="Average session" value={formatTrackedTime(data.summary.averageSessionMs)} detail="Completed Focus Clock sessions" />
            </CardContent></Card>
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(18rem,1fr)]">
              <Card><CardHeader><CardTitle>Focus calendar</CardTitle><CardDescription>Daily tracked time in {data.timeZone.replaceAll('_', ' ')}.</CardDescription></CardHeader><CardContent><StudyCalendar data={data} /></CardContent></Card>
              <Card><CardHeader><CardTitle>Time by activity</CardTitle><CardDescription>Based on the activity selected when each timer started.</CardDescription></CardHeader><CardContent className="space-y-4">
                {data.activities.map(activity => <div key={activity.activityType}>
                  <div className="mb-1.5 flex items-center justify-between gap-3 text-sm"><span className="font-medium">{activityLabels[activity.activityType]}</span><span className="tabular-nums text-muted-foreground">{formatTrackedTime(activity.trackedMs)} · {activity.percentage}%</span></div>
                  <Progress value={activity.percentage} aria-label={`${activityLabels[activity.activityType]}: ${activity.percentage}% of tracked focus time`} />
                </div>)}
              </CardContent></Card>
            </div>
          </div>}
  </section>;
}
