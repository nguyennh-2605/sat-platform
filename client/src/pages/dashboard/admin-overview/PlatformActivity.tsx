import { useMemo, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import { BarChart3, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart';
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import type { ActivityMetric, AdminActivityResponse } from './admin-overview.types';

const metricDetails: Record<ActivityMetric, { label: string; description: string; color: string }> = {
  attempts: { label: 'Test Attempts', description: 'Test sessions started during the selected period.', color: 'var(--chart-3)' },
  completions: { label: 'Completed Tests', description: 'Completed test submissions during the selected period.', color: 'var(--chart-4)' },
  studentsTakingTests: { label: 'Students Taking Tests', description: 'Distinct students who started a test in each interval.', color: 'var(--chart-2)' },
};

export function PlatformActivity({ data, loading, error, onRetry }: {
  data: AdminActivityResponse | null;
  loading: boolean;
  error: boolean;
  onRetry: () => void;
}) {
  const [metric, setMetric] = useState<ActivityMetric>('attempts');
  const details = metricDetails[metric];
  const chartConfig = useMemo<ChartConfig>(() => ({ [metric]: { label: details.label, color: details.color } }), [details, metric]);
  const total = data?.series.reduce((sum, item) => sum + item[metric], 0) || 0;

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>Platform Activity</CardTitle>
        <CardDescription>{details.description}</CardDescription>
        <CardAction>
          <Select value={metric} onValueChange={value => setMetric(value as ActivityMetric)}>
            <SelectTrigger size="sm" className="min-w-44" aria-label="Activity metric"><SelectValue /></SelectTrigger>
            <SelectContent align="end">
              <SelectGroup>
                <SelectItem value="attempts">Test Attempts</SelectItem>
                <SelectItem value="completions">Completed Tests</SelectItem>
                <SelectItem value="studentsTakingTests">Students Taking Tests</SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
        </CardAction>
      </CardHeader>
      <CardContent>
        {loading ? <Skeleton className="h-72 w-full" />
          : error ? <div className="flex h-72 flex-col items-center justify-center gap-3 text-center"><BarChart3 className="size-9 text-muted-foreground" /><div><p className="font-medium">Activity could not be loaded</p><p className="mt-1 text-sm text-muted-foreground">The rest of the overview is still available.</p></div><Button variant="outline" size="sm" onClick={onRetry}><RefreshCw />Retry chart</Button></div>
            : !data || data.series.length === 0 ? <div className="flex h-72 flex-col items-center justify-center text-center"><BarChart3 className="mb-3 size-9 text-muted-foreground" /><p className="font-medium">No activity in this period</p><p className="mt-1 text-sm text-muted-foreground">Activity will appear after students start tests.</p></div>
              : <>
                <ChartContainer id="admin-platform-activity" config={chartConfig} className="h-72 w-full" role="img" aria-label={`${details.label} chart. Total ${total.toLocaleString('en-US')} in the selected period.`}>
                  <BarChart data={data.series} margin={{ top: 8, right: 4, bottom: 0, left: -20 }} barSize={data.range.granularity === 'WEEK' ? 38 : 20}>
                    <defs>
                      <pattern id="admin-activity-pattern" width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                        <rect width="6" height="6" fill={details.color} fillOpacity="0.14" />
                        <line x1="0" y1="0" x2="0" y2="6" stroke={details.color} strokeWidth="1.25" strokeOpacity="0.45" />
                      </pattern>
                    </defs>
                    <CartesianGrid vertical={false} />
                    <XAxis
                      dataKey="bucket"
                      axisLine={false}
                      tickLine={false}
                      tickMargin={10}
                      minTickGap={28}
                      tickFormatter={value => format(parseISO(String(value)), data.range.granularity === 'WEEK' ? 'MMM d' : 'MMM d')}
                    />
                    <YAxis axisLine={false} tickLine={false} allowDecimals={false} />
                    <ChartTooltip cursor={{ fill: 'var(--muted)', opacity: 0.55 }} content={<ChartTooltipContent labelFormatter={value => format(parseISO(String(value)), 'MMM d, yyyy')} />} />
                    <Bar dataKey={metric} fill="url(#admin-activity-pattern)" stroke={details.color} strokeOpacity={0.55} strokeWidth={0.75} radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ChartContainer>
                <div className="mt-3 flex items-center justify-between border-t border-ui-border pt-3 text-sm">
                  <span className="text-muted-foreground">
                    {metric === 'studentsTakingTests'
                      ? 'Sum across chart intervals'
                      : 'Total for selected period'}
                  </span>
                  <span className="font-medium tabular-nums text-foreground">{total.toLocaleString('en-US')}</span>
                </div>
              </>}
      </CardContent>
    </Card>
  );
}
