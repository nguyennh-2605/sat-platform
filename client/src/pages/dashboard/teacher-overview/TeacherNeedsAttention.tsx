import { format } from 'date-fns';
import { ArrowRight, CheckCircle2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { TeacherActivityType, TeacherOverviewResponse } from './teacher-overview.types';

const labelFor = (type: TeacherActivityType) => type === 'TEST' ? 'Test' : type === 'VOCABULARY' ? 'Vocabulary' : type === 'HOMEWORK' ? 'Assignment' : 'Resource';

export function TeacherNeedsAttention({ items }: { items: TeacherOverviewResponse['needsAttention'] }) {
  const navigate = useNavigate();
  return <Card className="h-full">
    <CardHeader>
      <CardTitle className="text-sm">Needs Attention</CardTitle>
      <CardAction><button type="button" onClick={() => navigate('/dashboard/classes')} className="flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">View classes <ArrowRight className="size-4" aria-hidden="true" /></button></CardAction>
    </CardHeader>
    <CardContent className="flex flex-col gap-0">
      {items.length === 0 ? <div className="flex min-h-56 flex-col items-center justify-center px-6 text-center"><CheckCircle2 className="size-9 text-muted-foreground" /><p className="mt-3 font-medium">Everything is on track</p><p className="mt-1 text-sm text-muted-foreground">No classroom activities need immediate attention.</p></div> : <div className="divide-y">
        {items.map(item => {
          const overdue = item.reason === 'OVERDUE';
          return <button key={item.id} type="button" onClick={() => navigate(item.href)} className="grid w-full grid-cols-1 gap-3 bg-card py-3 text-left transition-colors hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:grid-cols-[10rem_1fr_auto] sm:items-center">
            <span className="flex gap-2">
              <span className={overdue ? 'w-1 shrink-0 rounded-md bg-destructive' : 'w-1 shrink-0 rounded-md bg-yellow-500 dark:bg-yellow-400'} aria-hidden="true" />
              <span className="text-nowrap text-xs"><span className="block font-medium text-foreground">{format(new Date(item.dueAt), 'h:mm a')}</span><span className="block text-muted-foreground">{format(new Date(item.dueAt), 'EEE, MMM d')}</span></span>
            </span>
            <span className="flex min-w-0 flex-col gap-1"><span className="truncate text-sm font-medium leading-none text-foreground">{item.title}</span><span className="truncate text-xs leading-none text-muted-foreground">{item.className} • {labelFor(item.type)} • {item.stats.completed}/{item.stats.assigned} completed</span></span>
            <Badge variant="secondary" className={overdue ? 'shrink-0 rounded-md border-destructive/50 bg-destructive/10 px-2.5 py-1 text-[10px] font-medium text-destructive dark:bg-destructive/20' : 'shrink-0 rounded-md border-yellow-600/50 bg-yellow-50 px-2.5 py-1 text-[10px] font-medium text-yellow-700 dark:border-yellow-800/50 dark:bg-yellow-500/10 dark:text-yellow-300'}>{item.reasonLabel}</Badge>
          </button>;
        })}
      </div>}
    </CardContent>
  </Card>;
}
