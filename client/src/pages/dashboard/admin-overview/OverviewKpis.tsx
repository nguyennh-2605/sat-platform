import { Building2, GraduationCap, TrendingDown, TrendingUp, UserRound, UsersRound } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardAction, CardContent, CardDescription, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import type { AdminOverviewResponse, OverviewRange } from './admin-overview.types';

const rangeLabel = { '7d': '7 days', '30d': '30 days', '90d': '90 days' } as const;

function GrowthBadge({ value, percentage = false }: { value: number | null; percentage?: boolean }) {
  if (value === null) return <Badge variant="outline" className="rounded-sm font-normal text-muted-foreground">No comparison</Badge>;
  const positive = value >= 0;
  const Icon = positive ? TrendingUp : TrendingDown;
  return (
    <Badge
      variant="outline"
      className={positive
        ? 'rounded-sm border-success/30 bg-success-soft font-normal text-success'
        : 'rounded-sm border-danger/30 bg-danger-soft font-normal text-danger'}
    >
      <Icon />
      {positive ? '+' : ''}{value.toLocaleString('en-US')}{percentage ? '%' : ''}
    </Badge>
  );
}

export function OverviewKpis({ data, range, loading }: { data: AdminOverviewResponse | null; range: OverviewRange; loading: boolean }) {
  const cards = data ? [
    { label: 'Students', value: data.summary.students.total, context: 'created in selected period', growth: data.summary.students.createdInPeriod, icon: GraduationCap },
    { label: 'Teachers', value: data.summary.teachers.total, context: 'created in selected period', growth: data.summary.teachers.createdInPeriod, icon: UserRound },
    { label: 'Classrooms', value: data.summary.classrooms.total, context: 'created in selected period', growth: data.summary.classrooms.createdInPeriod, icon: Building2 },
    { label: 'Test Attempts', value: data.summary.testAttempts.current, context: `vs previous ${rangeLabel[range]}`, growth: data.summary.testAttempts.changePercent, percentage: true, icon: UsersRound },
  ] : [];

  return (
    <section aria-label="Platform summary" className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
      {loading || !data
        ? [1, 2, 3, 4].map(item => <Card key={item}><CardHeader><Skeleton className="h-4 w-24" /></CardHeader><CardContent className="space-y-3"><Skeleton className="h-8 w-32" /><Skeleton className="h-4 w-40" /></CardContent></Card>)
        : cards.map(({ label, value, context, growth, percentage, icon: Icon }) => (
          <Card key={label}>
            <CardHeader>
              <CardDescription>{label}</CardDescription>
              <CardAction><span className="flex size-7 items-center justify-center rounded-control border border-ui-border bg-muted text-muted-foreground"><Icon className="size-4" aria-hidden="true" /></span></CardAction>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-3xl leading-none tracking-tight tabular-nums text-foreground">{value.toLocaleString('en-US')}</span>
                <GrowthBadge value={growth} percentage={percentage} />
              </div>
              <p className="text-sm text-muted-foreground">{context}</p>
            </CardContent>
          </Card>
        ))}
    </section>
  );
}
