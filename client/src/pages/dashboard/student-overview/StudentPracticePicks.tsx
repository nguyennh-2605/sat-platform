import { ArrowRight, BookOpen, Clock3, Play } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import type { StudentPracticePick } from './student-overview.types';

export function StudentPracticePicks({ items, onOpen }: { items: StudentPracticePick[]; onOpen: (item: StudentPracticePick) => void }) {
  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>Practice Picks</CardTitle>
        <CardDescription>Published SAT practice ready for your next session.</CardDescription>
        <CardAction><Button asChild variant="ghost" size="sm"><Link to="/dashboard/practice-test">View all<ArrowRight /></Link></Button></CardAction>
      </CardHeader>
      <CardContent className="px-0">
        {items.length === 0 ? (
          <div className="flex min-h-64 flex-col items-center justify-center px-6 text-center">
            <BookOpen className="size-9 text-muted-foreground" aria-hidden="true" />
            <p className="mt-3 font-medium text-foreground">No practice tests available</p>
            <p className="mt-1 text-sm text-muted-foreground">Published System Tests will appear here automatically.</p>
          </div>
        ) : items.map((item, index) => (
          <div key={item.id} className="border-t border-border px-4 py-4 first:border-t-0">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="mb-2 flex flex-wrap gap-1.5">
                  <Badge variant="outline">{item.subject === 'MATH' ? 'Math' : 'R&W'}</Badge>
                  <Badge variant="outline" className="text-muted-foreground">{item.mode === 'EXAM' ? 'Exam' : 'Practice'}</Badge>
                  {index === 0 && item.attemptStatus === 'NOT_STARTED' && <Badge variant="secondary">Suggested</Badge>}
                </div>
                <h3 className="line-clamp-2 font-semibold text-foreground">{item.title}</h3>
                <p className="mt-1 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1"><BookOpen className="size-3.5" />{item.questionCount} questions</span>
                  <span className="inline-flex items-center gap-1"><Clock3 className="size-3.5" />{item.duration} min</span>
                </p>
              </div>
              <Button variant={item.attemptStatus === 'DOING' ? 'default' : 'outline'} size="icon-sm" onClick={() => onOpen(item)} aria-label={`${item.attemptStatus === 'DOING' ? 'Continue' : 'Start'} ${item.title}`}>
                <Play />
              </Button>
            </div>
            {item.attemptStatus === 'DOING' && <div className="mt-3"><div className="mb-1.5 flex justify-between text-xs text-muted-foreground"><span>In progress</span><span>{item.progress}%</span></div><Progress value={item.progress} /></div>}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

