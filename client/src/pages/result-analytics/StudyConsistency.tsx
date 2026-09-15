import { useEffect, useMemo, useState } from 'react';
import { CalendarDays, Clock3, Flame, RefreshCw } from 'lucide-react';
import { Label, Pie, PieChart, Tooltip } from 'recharts';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartContainer, type ChartConfig } from '@/components/ui/chart';
import { EmptyState } from '@/components/ui/AppUI';
import { Skeleton } from '@/components/ui/skeleton';
import { cachedGet } from '@/lib/queryCache';
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

const activityChartConfig = {
  PRACTICE: { label: activityLabels.PRACTICE, color: 'var(--chart-5)' },
  VOCABULARY: { label: activityLabels.VOCABULARY, color: 'var(--chart-4)' },
  ERROR_LOG: { label: activityLabels.ERROR_LOG, color: 'var(--chart-3)' },
  HOMEWORK: { label: activityLabels.HOMEWORK, color: 'var(--chart-2)' },
  OTHER: { label: activityLabels.OTHER, color: 'var(--chart-1)' },
} satisfies ChartConfig;

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

interface ActivityChartItem {
  activityType: StudyActivityType;
  label: string;
  trackedMs: number;
  sessionCount: number;
  percentage: number;
  fill: string;
}

interface ActivityTooltipPayload { payload: ActivityChartItem }

function ActivityTooltip({ active, payload }: { active?: boolean; payload?: ActivityTooltipPayload[] }) {
  const item = payload?.[0]?.payload;
  if (!active || !item) return null;
  return <div className="min-w-44 rounded-control border border-ui-border bg-background p-3 text-xs shadow-raised">
    <div className="flex items-center gap-2 font-medium text-foreground"><span className="size-2 rounded-sm" style={{ backgroundColor: item.fill }} aria-hidden="true" />{item.label}</div>
    <p className="mt-1.5 tabular-nums text-muted-foreground">{formatTrackedTime(item.trackedMs)} · {item.percentage}% · {item.sessionCount} session{item.sessionCount === 1 ? '' : 's'}</p>
  </div>;
}

function ActivityDistribution({ data }: { data: StudyTimeSummaryResponse }) {
  const chartData = data.activities.map(activity => ({
    ...activity,
    label: activityLabels[activity.activityType],
    fill: activityChartConfig[activity.activityType].color,
  }));
  const accessibleBreakdown = chartData.map(item => `${item.label} ${item.percentage}%`).join(', ');

  return <div className="grid items-center gap-5 sm:grid-cols-[minmax(0,0.9fr)_minmax(0,1fr)] lg:grid-cols-1 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1fr)]">
    <ChartContainer
      config={activityChartConfig}
      className="mx-auto aspect-square h-52 max-w-full"
      role="img"
      aria-label={`Tracked focus time by activity. ${accessibleBreakdown}.`}
    >
      <PieChart>
        <Tooltip cursor={false} content={<ActivityTooltip />} />
        <Pie
          cornerRadius={6}
          data={chartData}
          dataKey="trackedMs"
          innerRadius={58}
          nameKey="label"
          outerRadius={84}
          paddingAngle={2}
          stroke="var(--card)"
          strokeWidth={4}
        >
          <Label content={({ viewBox }) => {
            if (!(viewBox && 'cx' in viewBox && 'cy' in viewBox)) return null;
            return <text dominantBaseline="middle" textAnchor="middle" x={viewBox.cx} y={viewBox.cy}>
              <tspan className="fill-muted-foreground text-xs" x={viewBox.cx} y={(viewBox.cy ?? 0) - 8}>Total</tspan>
              <tspan className="fill-foreground text-lg font-medium tabular-nums" x={viewBox.cx} y={(viewBox.cy ?? 0) + 14}>{formatTrackedTime(data.summary.trackedMs)}</tspan>
            </text>;
          }} />
        </Pie>
      </PieChart>
    </ChartContainer>
    <div className="flex min-w-0 flex-col gap-3">
      {chartData.map(item => <div className="grid grid-cols-[1fr_auto] items-end gap-3" key={item.activityType}>
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-1.5">
            <span className="h-2 w-1 rounded-full" style={{ backgroundColor: item.fill }} aria-hidden="true" />
            <p className="truncate text-xs text-muted-foreground">{item.label}</p>
          </div>
          <p className="font-medium tabular-nums text-foreground">{formatTrackedTime(item.trackedMs)}</p>
        </div>
        <p className="font-medium tabular-nums text-foreground">{item.percentage}%</p>
      </div>)}
    </div>
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
    let active = true;
    void cachedGet<StudyTimeSummaryResponse>(requestUrl, { ttlMs: 60_000, force: reload > 0 })
      .then(response => { if (active) setResult({ key: requestKey, data: response, error: false }); })
      .catch(() => { if (active) setResult({ key: requestKey, data: null, error: true }); });
    return () => { active = false; };
  }, [reload, requestKey, requestUrl]);

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
              <Card><CardHeader><CardTitle>Time by activity</CardTitle><CardDescription>Based on the activity selected when each timer started.</CardDescription></CardHeader><CardContent><ActivityDistribution data={data} /></CardContent></Card>
            </div>
          </div>}
  </section>;
}
