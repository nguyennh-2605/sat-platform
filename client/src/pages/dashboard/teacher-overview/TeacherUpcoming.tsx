import { format } from 'date-fns';
import { ArrowRight, CalendarClock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { TeacherOverviewResponse } from './teacher-overview.types';

const eventLabel = (type: TeacherOverviewResponse['upcoming'][number]['eventType']) => type === 'AVAILABLE' ? 'Available' : type === 'DUE' ? 'Due' : 'Lesson';

export function TeacherUpcoming({ items }: { items: TeacherOverviewResponse['upcoming'] }) {
  const navigate = useNavigate();
  return <Card className="h-full">
    <CardHeader><CardTitle className="text-sm">Upcoming</CardTitle><CardAction><button type="button" onClick={() => navigate('/dashboard/classes')} className="flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">View classes <ArrowRight className="size-4" aria-hidden="true" /></button></CardAction></CardHeader>
    <CardContent className="flex flex-col gap-4">
      {items.length === 0 ? <div className="flex min-h-56 flex-col items-center justify-center text-center"><CalendarClock className="size-9 text-muted-foreground" /><p className="mt-3 font-medium">No upcoming dates</p><p className="mt-1 text-sm text-muted-foreground">Scheduled lessons and activity dates will appear here.</p></div> : <div className="space-y-4">
        {items.map(item => {
          const eventDate = new Date(item.occursAt);
          return <button key={item.id} type="button" onClick={() => navigate(item.href)} className="flex w-full items-center justify-between gap-4 rounded-sm text-left outline-none transition-colors hover:bg-muted/30 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
            <span className="flex min-w-0 items-center gap-2"><span className="size-11 shrink-0 overflow-hidden rounded-sm border"><span className="grid h-1/3 place-items-center border-b bg-muted text-[10px] font-medium uppercase leading-none">{format(eventDate, 'MMM')}</span><span className="grid h-2/3 place-items-center text-lg leading-none">{format(eventDate, 'd')}</span></span><span className="flex min-w-0 flex-col gap-1"><span className="truncate text-sm font-medium leading-none text-foreground">{item.title}</span><span className="truncate text-xs leading-none text-muted-foreground">{format(eventDate, 'h:mm a')} • {item.className}</span></span></span>
            <Badge variant="outline" className="shrink-0 rounded-md px-2.5 py-1 text-[10px] font-medium">{eventLabel(item.eventType)}</Badge>
          </button>;
        })}
      </div>}
    </CardContent>
  </Card>;
}
