import { useMemo } from 'react';
import { Line, LineChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import { ArrowUpRight, ChartNoAxesCombined } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart';
import type { StudentOverviewResponse } from './student-overview.types';

const chartConfig = {
  rw: { label: 'Reading & Writing', color: 'var(--chart-3)' },
  math: { label: 'Math', color: 'var(--chart-2)' },
} satisfies ChartConfig;

const displayAccuracy = (value: number | null) => value === null ? '—' : `${value}%`;

export function StudentProgress({ progress }: { progress: StudentOverviewResponse['progress'] }) {
  const chartData = useMemo(() => progress.trend.map((item, index) => ({
    index: index + 1,
    date: item.date,
    title: item.title,
    rw: item.subject === 'RW' ? item.accuracy : null,
    math: item.subject === 'MATH' ? item.accuracy : null,
  })), [progress.trend]);

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>Progress</CardTitle>
        <CardDescription>Accuracy across completed tests in the last {progress.windowDays} days.</CardDescription>
        <CardAction><Button asChild variant="outline" size="sm"><Link to="/dashboard/results-analytics">Full analytics<ArrowUpRight /></Link></Button></CardAction>
      </CardHeader>
      <CardContent>
        <div className="mb-5 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-4">
          <ProgressMetric label="Overall accuracy" value={displayAccuracy(progress.overallAccuracy)} />
          <ProgressMetric label="Tests completed" value={String(progress.completedTests)} />
          <ProgressMetric label="R&W accuracy" value={displayAccuracy(progress.rwAccuracy)} />
          <ProgressMetric label="Math accuracy" value={displayAccuracy(progress.mathAccuracy)} />
        </div>
        {chartData.length > 0 ? (
          <ChartContainer config={chartConfig} className="h-52 w-full" role="img" aria-label="Recent Reading and Writing and Math accuracy trend">
            <LineChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="index" axisLine={false} tickLine={false} tickMargin={10} tickFormatter={value => `Test ${value}`} />
              <YAxis domain={[0, 100]} axisLine={false} tickLine={false} tickFormatter={value => `${value}%`} width={42} />
              <ChartTooltip cursor={false} content={<ChartTooltipContent labelFormatter={value => `Test ${value}`} />} />
              <Line connectNulls dataKey="rw" type="linear" stroke="var(--color-rw)" strokeWidth={2.5} dot={chartData.length <= 4 ? { r: 3 } : false} activeDot={{ r: 4 }} />
              <Line connectNulls dataKey="math" type="linear" stroke="var(--color-math)" strokeWidth={2.5} dot={chartData.length <= 4 ? { r: 3 } : false} activeDot={{ r: 4 }} />
            </LineChart>
          </ChartContainer>
        ) : (
          <div className="flex h-52 flex-col items-center justify-center text-center">
            <ChartNoAxesCombined className="size-9 text-muted-foreground" aria-hidden="true" />
            <p className="mt-3 font-medium text-foreground">Your progress chart starts here</p>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">Complete a practice test to see your accuracy trend.</p>
          </div>
        )}
        <div className="mt-4 flex items-center justify-between border-t border-border pt-3 text-sm">
          <span className="text-muted-foreground">Questions answered</span>
          <span className="font-medium tabular-nums text-foreground">{progress.questionsAnswered.toLocaleString('en-US')}</span>
        </div>
      </CardContent>
    </Card>
  );
}

function ProgressMetric({ label, value }: { label: string; value: string }) {
  return <div className="bg-card px-3 py-3"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 text-lg font-semibold tabular-nums text-foreground">{value}</p></div>;
}
