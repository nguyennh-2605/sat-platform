import { useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import { BarChart3, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart';
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import type { TeacherInsightsResponse } from './teacher-overview.types';

type SubjectFilter = 'ALL' | 'RW' | 'MATH';
const chartConfig = { accuracy: { label: 'Accuracy (%)', color: 'var(--chart-3)' } } satisfies ChartConfig;

interface TeacherLearningInsightsProps {
  data: TeacherInsightsResponse | null;
  loading: boolean;
  error: boolean;
  classes: Array<{ id: string; name: string }>;
  selectedClassId: string | null;
  onClassChange: (classId: string) => void;
  onRetry: () => void;
}

export function TeacherLearningInsights({ data, loading, error, classes, selectedClassId, onClassChange, onRetry }: TeacherLearningInsightsProps) {
  const [subject, setSubject] = useState<SubjectFilter>('ALL');
  const selectedClassName = classes.find(item => item.id === selectedClassId)?.name || 'this class';
  const items = useMemo(() => {
    if (!data) return [];
    const source = data.skills.length ? data.skills : data.domains;
    return source.filter(item => subject === 'ALL' || item.subject === subject).slice(0, 5);
  }, [data, subject]);
  return <Card className="h-full">
    <CardHeader>
      <CardTitle>Learning Insights</CardTitle>
      <CardDescription>Skills that may need reinforcement in {selectedClassName} over the last 30 days.</CardDescription>
      <CardAction className="flex flex-wrap justify-end gap-2 max-sm:col-start-1 max-sm:row-start-3 max-sm:justify-self-stretch">
        {classes.length > 1 && <Select value={selectedClassId || undefined} onValueChange={onClassChange}><SelectTrigger size="sm" className="w-44 max-sm:flex-1" aria-label="Insight class"><SelectValue placeholder="Select class" /></SelectTrigger><SelectContent align="end"><SelectGroup>{classes.map(item => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}</SelectGroup></SelectContent></Select>}
        <Select value={subject} onValueChange={value => setSubject(value as SubjectFilter)}><SelectTrigger size="sm" className="w-40 max-sm:flex-1" aria-label="Insight subject"><SelectValue /></SelectTrigger><SelectContent align="end"><SelectGroup><SelectItem value="ALL">All subjects</SelectItem><SelectItem value="RW">Reading & Writing</SelectItem><SelectItem value="MATH">Math</SelectItem></SelectGroup></SelectContent></Select>
      </CardAction>
    </CardHeader>
    <CardContent>
      {loading ? <Skeleton className="h-64 w-full" /> : error ? <div className="flex h-64 flex-col items-center justify-center text-center"><BarChart3 className="size-9 text-muted-foreground" /><p className="mt-3 font-medium">Insights could not be loaded</p><p className="mt-1 text-sm text-muted-foreground">Your classroom workflow is still available.</p><Button variant="outline" size="sm" className="mt-4" onClick={onRetry}><RefreshCw />Retry insights</Button></div> : !data?.sufficient || items.length === 0 ? <div className="flex h-64 flex-col items-center justify-center text-center"><BarChart3 className="size-9 text-muted-foreground" /><p className="mt-3 font-medium">Not enough data yet</p><p className="mt-1 max-w-md text-sm text-muted-foreground">Insights require enough classified answers from at least three students.</p>{data?.classificationCoverage.percentage !== null && <p className="mt-3 text-xs text-muted-foreground">Classification coverage: {data?.classificationCoverage.percentage}%</p>}</div> : <>
        <ChartContainer id="teacher-learning-insights" config={chartConfig} className="h-64 w-full" role="img" aria-label="Lowest classroom skill accuracy over the last 30 days">
          <BarChart data={items} layout="vertical" margin={{ top: 0, right: 28, bottom: 0, left: 12 }}>
            <CartesianGrid horizontal={false} />
            <XAxis type="number" domain={[0, 100]} axisLine={false} tickLine={false} tickFormatter={value => `${value}%`} />
            <YAxis type="category" dataKey="name" axisLine={false} tickLine={false} width={118} tickFormatter={value => String(value).length > 18 ? `${String(value).slice(0, 17)}…` : String(value)} />
            <ChartTooltip cursor={{ fill: 'var(--muted)', opacity: 0.45 }} content={<ChartTooltipContent />} />
            <Bar dataKey="accuracy" fill="var(--color-accuracy)" radius={[0, 8, 8, 0]} barSize={22} />
          </BarChart>
        </ChartContainer>
        <div className="mt-3 flex items-center justify-between border-t pt-3 text-xs text-muted-foreground"><span>{data.completedSubmissions} counted submissions</span><span>{data.classificationCoverage.percentage}% classified</span></div>
      </>}
    </CardContent>
  </Card>;
}
