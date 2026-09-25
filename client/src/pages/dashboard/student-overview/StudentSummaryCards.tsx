import { ArrowRight, CheckCircle2, Clock3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { NextSatCard, ScoreGoalCard } from './StudentProductivitySidebar';
import type { StudentOverviewResponse, StudentTasksResponse } from './student-overview.types';

export function StudentSummaryCards({ summary, preferences, onShowToday, onSatDateSaved, onScoreGoalSaved }: {
  summary: StudentTasksResponse['summary'];
  preferences: StudentOverviewResponse['preferences'];
  onShowToday: () => void;
  onSatDateSaved: (value: string) => void;
  onScoreGoalSaved: (value: Pick<StudentOverviewResponse['preferences'], 'currentScore' | 'targetScore'>) => void;
}) {
  return <section className="grid gap-4 md:grid-cols-3" aria-label="Study summary">
    <Card className="h-full shadow-xs">
      <CardHeader><CardTitle><div className="flex items-center gap-2 text-sm text-muted-foreground"><span className="grid size-7 place-items-center rounded-lg border bg-muted">{summary.todayRemaining === 0 ? <CheckCircle2 className="size-4" /> : <Clock3 className="size-4" />}</span>Today</div></CardTitle></CardHeader>
      <CardContent><div className="flex flex-col gap-2"><div className="truncate text-2xl leading-none tracking-tight text-foreground">{summary.todayRemaining === 0 ? 'All caught up' : summary.todayRemaining}</div><div className="flex min-w-0 items-center justify-between gap-2"><p className="truncate leading-none tabular-nums text-muted-foreground">{summary.todayRemaining === 0 ? 'No tasks remaining' : summary.todayRemaining === 1 ? 'task remaining' : 'tasks remaining'}</p><Button variant="ghost" size="icon-xs" onClick={onShowToday} aria-label="Show today’s tasks"><ArrowRight /></Button></div></div></CardContent>
    </Card>
    <NextSatCard value={preferences.satTestDate} onSaved={onSatDateSaved} />
    <ScoreGoalCard currentScore={preferences.currentScore} targetScore={preferences.targetScore} onSaved={onScoreGoalSaved} />
  </section>;
}
