import { ArrowRight, BookOpen, Check } from 'lucide-react';
import { Link } from 'react-router-dom';
import { EmptyState } from '@/components/ui/AppUI';
import { Button } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import type { StudentPracticePick } from './student-overview.types';

export function StudentPracticePicks({ items, onOpen }: { items: StudentPracticePick[]; onOpen: (item: StudentPracticePick) => void }) {
  return (
    <Card className="h-full" role="region" aria-label="Practice Picks">
      <CardHeader>
        <CardTitle>Practice Picks</CardTitle>
        <CardDescription>Choose your next session.</CardDescription>
        <CardAction><Button asChild variant="ghost" size="sm"><Link to="/dashboard/practice-test">View all</Link></Button></CardAction>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <EmptyState surface={false} compact icon={<BookOpen />} title="No practice tests available" description="Published System Tests will appear here automatically." />
        ) : <div className="divide-y">{items.map(item => (
          <article key={item.id} className="min-w-0 py-4 first:pt-0 last:pb-0" data-practice-pick={item.id}>
            <h3 className="line-clamp-2 break-words text-base font-semibold leading-snug text-foreground" title={item.title}>{item.title}</h3>
            <p className="mt-1 text-xs text-subtle">{item.subject === 'MATH' ? 'Math' : 'Reading & Writing'}<span aria-hidden="true" className="mx-1.5">·</span>{item.mode === 'EXAM' ? 'Exam' : 'Practice'}</p>
            {item.attemptStatus === 'DOING' && <div className="mt-3 flex items-center gap-3"><Progress value={item.progress} aria-label={`${item.title} progress`} className="flex-1" /><span className="shrink-0 text-xs text-subtle tabular-nums">{item.progress}% complete</span></div>}
            {item.attemptStatus === 'COMPLETED' && <p className="mt-2 flex items-center gap-1.5 text-xs text-subtle"><Check className="size-3.5" aria-hidden="true" />Completed</p>}
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
              <p className="shrink-0 whitespace-nowrap text-xs text-subtle">{item.questionCount} questions<span aria-hidden="true" className="mx-1.5">·</span>{item.duration} min</p>
              <Button className="ml-auto" variant={item.attemptStatus === 'DOING' ? 'secondary' : 'ghost'} size="sm" onClick={() => onOpen(item)} aria-label={`${item.attemptStatus === 'DOING' ? 'Continue' : item.attemptStatus === 'COMPLETED' ? 'Try again' : 'Start'} ${item.title}`}>
                {item.attemptStatus === 'DOING' ? 'Continue' : item.attemptStatus === 'COMPLETED' ? 'Try again' : 'Start'}<ArrowRight aria-hidden="true" />
              </Button>
            </div>
          </article>
        ))}</div>}
      </CardContent>
    </Card>
  );
}
