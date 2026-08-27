import { formatDistanceToNowStrict, parseISO } from 'date-fns';
import { ArrowRight, FileCheck2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { StudentOverviewResponse } from './student-overview.types';

export function StudentRecentResults({ items, onOpenResult }: {
  items: StudentOverviewResponse['recentResults'];
  onOpenResult: (submissionId: number) => void;
}) {
  return <Card size="sm">
    <CardHeader><CardTitle>Recent Results</CardTitle><CardDescription>Your latest completed tests.</CardDescription><CardAction><Button asChild variant="ghost" size="xs"><Link to="/dashboard/results-analytics">View all<ArrowRight /></Link></Button></CardAction></CardHeader>
    <CardContent className="px-0">
      {items.length === 0 ? <div className="flex min-h-28 flex-col items-center justify-center px-4 text-center"><FileCheck2 className="size-7 text-muted-foreground" /><p className="mt-2 text-sm font-medium">No results yet</p><p className="mt-1 text-xs text-muted-foreground">Complete a test to see it here.</p></div> : <div>{items.slice(0, 3).map(item => <Button key={item.submissionId} variant="ghost" onClick={() => onOpenResult(item.submissionId)} className="h-auto w-full justify-start gap-3 rounded-none border-t px-3 py-3 text-left font-normal whitespace-normal first:border-t-0 active:translate-y-0"><span className="grid size-8 shrink-0 place-items-center rounded-lg bg-muted"><FileCheck2 className="size-3.5 text-muted-foreground" /></span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium text-foreground">{item.title}</span><span className="mt-0.5 block text-xs text-muted-foreground">{item.accuracy}% · {item.correctCount}/{item.totalQuestions} correct</span></span><span className="shrink-0 text-[10px] text-muted-foreground">{formatDistanceToNowStrict(parseISO(item.completedAt), { addSuffix: true })}</span></Button>)}</div>}
    </CardContent>
  </Card>;
}
