import { useMemo, useState } from 'react';
import { addDays, format, parseISO } from 'date-fns';
import { CalendarDays, ListChecks } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { StudyEventContent, StudyEventCompletionLine } from './StudyEventContent';
import { StudyPlannerEventDialog } from './StudyPlannerEventDialog';
import { compareStudyEvents, studyDay, studyEventTime, studyEventTitle, studyToday } from './task-planning';
import { useStudyPlannerEvents } from './useStudyPlannerEvents';
import type { StudentTaskItem, StudentTasksResponse } from './student-overview.types';

type TaskView = 'TODAY' | 'TOMORROW' | 'WEEK' | 'COMPLETED' | 'DATE';

function filteredEvents(items: StudentTaskItem[], view: TaskView, selectedDate?: Date) {
  const today = studyToday();
  const tomorrow = studyDay(addDays(parseISO(today), 1));
  const weekEnd = studyDay(addDays(parseISO(today), 6));
  return items.filter(task => {
    if (!task.plannedDate) return false;
    if (view === 'COMPLETED') return task.completed;
    if (view === 'DATE') return Boolean(selectedDate && task.plannedDate === studyDay(selectedDate));
    if (view === 'TOMORROW') return task.plannedDate === tomorrow;
    if (view === 'WEEK') return task.plannedDate >= today && task.plannedDate <= weekEnd;
    return task.plannedDate === today;
  }).sort(compareStudyEvents);
}

export function StudentTasksSection({ data, selectedDate, showTodayRequest = 0, onClearDate, onOpen, onReload }: {
  data: StudentTasksResponse;
  selectedDate?: Date;
  showTodayRequest?: number;
  onClearDate: () => void;
  onOpen: (item: StudentTaskItem) => void;
  onReload: () => Promise<void>;
}) {
  const [filter, setFilter] = useState<{ view: TaskView; todayRequest: number }>({ view: 'TODAY', todayRequest: showTodayRequest });
  const view = selectedDate ? 'DATE' : filter.todayRequest === showTodayRequest ? filter.view : 'TODAY';
  const visible = useMemo(() => filteredEvents(data.items, view, selectedDate), [data.items, selectedDate, view]);
  const { selection, setSelection, working, close, saveEvent, complete, remove, openTask } = useStudyPlannerEvents({ onReload, onOpen });
  const plannerDay = view === 'DATE' && selectedDate ? studyDay(selectedDate) : studyDay(addDays(parseISO(studyToday()), view === 'TOMORROW' ? 1 : 0));
  const plannerParams = new URLSearchParams(view === 'COMPLETED' ? { completed: 'true' } : { date: plannerDay });
  plannerParams.set('view', view === 'WEEK' ? 'week' : 'day');
  const changeView = (next: TaskView) => { setFilter({ view: next, todayRequest: showTodayRequest }); if (next !== 'DATE') onClearDate(); };
  const showEvent = (task: StudentTaskItem) => setSelection({ task, date: task.plannedDate!, startMinutes: task.plannedStartMinutes ?? null, endMinutes: task.plannedEndMinutes ?? null });

  return <>
    <Card>
      <CardHeader className="@container border-b">
        <CardTitle className="col-span-2 @[440px]:col-span-1">Tasks</CardTitle><CardDescription className="col-span-2 @[440px]:col-span-1">Your planned study events.</CardDescription>
        <CardAction className="col-span-2 col-start-1 row-start-3 row-span-1 flex flex-wrap items-center gap-2 justify-self-start @[440px]:col-span-1 @[440px]:col-start-2 @[440px]:row-start-1 @[440px]:row-span-2 @[440px]:justify-self-end"><Select value={view} onValueChange={value => changeView(value as TaskView)}><SelectTrigger size="sm" aria-label="Task view"><SelectValue /></SelectTrigger><SelectContent align="end"><SelectItem value="TODAY">Today</SelectItem><SelectItem value="TOMORROW">Tomorrow</SelectItem><SelectItem value="WEEK">This week</SelectItem><SelectItem value="COMPLETED">Completed</SelectItem>{selectedDate && <SelectItem value="DATE">{format(selectedDate, 'MMM d')}</SelectItem>}</SelectContent></Select><Button asChild size="sm"><Link to={`/dashboard/study-planner?${plannerParams}`}><CalendarDays />Open planner</Link></Button></CardAction>
      </CardHeader>
      <CardContent className="px-0">
        {visible.length === 0 ? <div className="flex min-h-48 flex-col items-center justify-center px-6 text-center"><ListChecks className="size-9 text-muted-foreground" /><p className="mt-3 font-medium">Nothing here yet</p><p className="mt-1 text-sm text-muted-foreground">{view === 'COMPLETED' ? 'Completed events will collect here.' : 'Open planner to add an event for this day.'}</p></div> :
          <div role="list" aria-label="Planned study events" className="divide-y px-4">{visible.map(task => <div role="listitem" key={task.key} data-overview-event={task.key} className={cn('relative flex items-center gap-2', task.completed && 'opacity-65')}>
            <StudyEventCompletionLine completed={task.completed} />
            <Checkbox className="size-6 rounded-full border-ui-border-strong after:inset-0" checked={task.completed} disabled={working || !task.canComplete} aria-label={task.canComplete ? `${task.completed ? 'Reopen' : 'Complete'} ${studyEventTitle(task.title)}` : `${studyEventTitle(task.title)} completion is updated from coursework`} onCheckedChange={() => void complete(task)} />
            <Button variant="calendar" disabled={working} aria-label={`Event: ${studyEventTitle(task.title)}`} title={`${studyEventTitle(task.title)} · ${studyEventTime(task)}${task.completed ? ' · Completed' : ''}`} className="relative flex h-auto min-h-12 min-w-0 flex-1 items-center justify-between gap-2 overflow-hidden px-0 py-3 text-sm text-foreground hover:bg-muted hover:text-foreground" onClick={() => showEvent(task)}><StudyEventContent task={task} inline showCompletion={false} /></Button>
          </div>)}</div>}
      </CardContent>
    </Card>
    {selection && <StudyPlannerEventDialog key={`${selection.task?.key}:${selection.date}:${selection.startMinutes}`} selection={selection} tasks={data.items} busy={working} onClose={close} onSave={saveEvent} onComplete={complete} onDelete={remove} onOpen={openTask} />}
  </>;
}
