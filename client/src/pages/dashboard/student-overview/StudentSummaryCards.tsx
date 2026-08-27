import { ArrowRight, Clock3, Focus, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { StudentFocus, StudentTasksResponse } from './student-overview.types';

export function StudentSummaryCards({ summary, focus, onOpenFocus }: {
  summary: StudentTasksResponse['summary'];
  focus: StudentFocus | null;
  onOpenFocus: (focus: StudentFocus) => void;
}) {
  const cards = [
    { title: 'Today', value: String(summary.todayRemaining), description: 'tasks remaining', icon: Clock3 },
    { title: 'This Week', value: `${summary.weekPercentage}%`, description: `${summary.weekCompleted} of ${summary.weekTotal} completed`, icon: TrendingUp },
    { title: 'Next Step', value: focus?.title || 'Choose practice', description: focus?.description || 'Build your study momentum', icon: Focus, focus },
  ];

  return <section className="grid gap-4 md:grid-cols-3" aria-label="Study summary">
    {cards.map(item => <Card key={item.title} className="shadow-xs">
      <CardHeader><CardTitle><div className="flex items-center gap-2 text-sm text-muted-foreground"><span className="grid size-7 place-items-center rounded-lg border bg-muted"><item.icon className="size-4" /></span>{item.title}</div></CardTitle></CardHeader>
      <CardContent><div className="flex flex-col gap-2"><div className="truncate text-2xl leading-none tracking-tight text-foreground" title={item.value}>{item.value}</div><div className="flex min-w-0 items-center justify-between gap-2"><p className="truncate leading-none tabular-nums text-muted-foreground">{item.description}</p>{item.focus ? <Button variant="ghost" size="icon-xs" onClick={() => { if (item.focus) onOpenFocus(item.focus); }} aria-label={`Open ${item.focus.title}`}><ArrowRight /></Button> : <ArrowRight className="size-4 shrink-0 text-muted-foreground" />}</div></div></CardContent>
    </Card>)}
  </section>;
}
