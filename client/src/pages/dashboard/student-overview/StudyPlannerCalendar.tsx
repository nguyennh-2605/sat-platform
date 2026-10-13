import { useRef, type KeyboardEvent } from 'react';
import { addDays, addMonths, endOfMonth, endOfWeek, format, isSameMonth, startOfMonth, startOfWeek } from 'date-fns';
import { useDraggable, useDroppable } from '@dnd-kit/core';
import { ChevronLeft, ChevronRight, Columns3, Grid3X3, List, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DateTimePicker } from '@/components/ui/DateTimePicker';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { layoutStudyEvents, parseStudyDay, studyDay, studyTime, studyToday, studyEventsForDay, studyEventTime, studyEventTitle, type StudyEventSelection } from './task-planning';
import { StudyEventContent } from './StudyEventContent';
import type { StudentTaskItem } from './student-overview.types';
import { calendarColors, eventColor } from './calendar-colors';

export type PlannerView = 'DAY' | 'WEEK' | 'MONTH';
const ROW_HEIGHT = 32;

// Independently adapted from the interaction and visual direction of robskinney's calendar.
export function StudyPlannerCalendar({ date, view, tasks, disabled, showCompleted, onShowCompleted, onDateChange, onViewChange, onTask, onCreate }: {
  date: Date; view: PlannerView; tasks: StudentTaskItem[]; disabled: boolean; showCompleted: boolean;
  onShowCompleted: (value: boolean) => void; onDateChange: (date: Date) => void; onViewChange: (view: PlannerView) => void;
  onTask: (task: StudentTaskItem) => void; onCreate: (selection: StudyEventSelection) => void;
}) {
  const start = view === 'MONTH' ? startOfWeek(startOfMonth(date), { weekStartsOn: 1 }) : view === 'WEEK' ? startOfWeek(date, { weekStartsOn: 1 }) : date;
  const end = view === 'MONTH' ? endOfWeek(endOfMonth(date), { weekStartsOn: 1 }) : view === 'WEEK' ? addDays(start, 6) : date;
  const days: Date[] = [];
  for (let day = start; day <= end; day = addDays(day, 1)) days.push(day);
  const move = (direction: number) => onDateChange(view === 'MONTH' ? addMonths(date, direction) : addDays(date, direction * (view === 'DAY' ? 1 : 7)));
  return <Tabs value={view} onValueChange={value => onViewChange(value as PlannerView)} className="min-w-0 gap-0" data-study-date={studyDay(date)}>
    <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-3 pb-5" aria-label="Calendar toolbar">
      <div role="group" aria-label="Calendar navigation" className="flex min-w-0 items-center gap-2">
        <Button variant="ghost" size="icon" disabled={disabled} aria-label="Previous calendar period" onClick={() => move(-1)}><ChevronLeft /></Button>
        <DateTimePicker mode="date" value={studyDay(date)} onChange={value => { const day = parseStudyDay(value); if (day) onDateChange(day); }} clearable={false} displayFormat={view === 'MONTH' ? 'MMMM yyyy' : 'MMM d, yyyy'} ariaLabel="Choose calendar date" disabled={disabled} />
        <Button variant="ghost" size="icon" disabled={disabled} aria-label="Next calendar period" onClick={() => move(1)}><ChevronRight /></Button>
        <Button variant="outline" disabled={disabled} onClick={() => onDateChange(parseStudyDay(studyToday())!)}>Today</Button>
      </div>
      <TabsList aria-label="Planner view"><TabsTrigger value="DAY"><List />Day</TabsTrigger><TabsTrigger value="WEEK"><Columns3 />Week</TabsTrigger><TabsTrigger value="MONTH"><Grid3X3 />Month</TabsTrigger></TabsList>
      <Button disabled={disabled} onClick={() => onCreate({ date: studyDay(date), startMinutes: 540, endMinutes: 600 })}><Plus />Add event</Button>
    </div>
    <TabsContent value={view} className="m-0 min-w-0 overflow-hidden rounded-card border bg-surface">
      {view === 'MONTH' ? <div className="overflow-x-auto" role="region" aria-label="Month calendar" tabIndex={0}>
        <div className="min-w-[700px]"><div className="grid grid-cols-7 border-b">{['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => <span key={day} data-calendar-weekday className="py-3 text-center text-sm font-semibold text-foreground">{day}</span>)}</div>
          <div className="grid grid-cols-7">{days.map(day => <MonthDay key={studyDay(day)} day={day} month={date} tasks={studyEventsForDay(tasks, studyDay(day))} disabled={disabled} onTask={onTask} onCreate={onCreate} onOpenDay={() => { onDateChange(day); onViewChange('DAY'); }} />)}</div>
        </div>
      </div> : <TimeGrid key={view} days={days} selectedDate={studyDay(date)} tasks={tasks} disabled={disabled} onTask={onTask} onCreate={onCreate} />}
    </TabsContent>
    <div className="flex flex-wrap items-center justify-between gap-3 pt-3 text-xs text-muted-foreground">
      <div aria-label="Event colors" className="flex flex-wrap gap-x-4 gap-y-2">{Object.values(calendarColors).map(color => <span key={color.label} className="inline-flex items-center gap-1.5"><span aria-hidden="true" className={cn('size-2 rounded-full', color.dot)} />{color.label}</span>)}</div>
      <label className="flex items-center gap-2"><Checkbox checked={showCompleted} onCheckedChange={value => onShowCompleted(value === true)} />Show completed</label>
    </div>
  </Tabs>;
}

function TimeGrid({ days, selectedDate, tasks, disabled, onTask, onCreate }: {
  days: Date[]; selectedDate: string; tasks: StudentTaskItem[]; disabled: boolean; onTask: (task: StudentTaskItem) => void; onCreate: (selection: StudyEventSelection) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const columns = { gridTemplateColumns: `4rem repeat(${days.length}, minmax(0, 1fr))` };
  const navigateSlot = (event: KeyboardEvent<HTMLButtonElement>, index: number, minute: number) => {
    const nextIndex = index + (event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0);
    const nextMinute = minute + (event.key === 'ArrowDown' ? 30 : event.key === 'ArrowUp' ? -30 : 0);
    if (!event.key.startsWith('Arrow')) return;
    event.preventDefault();
    if (days[nextIndex] && nextMinute >= 0 && nextMinute < 1440) scrollRef.current?.querySelector<HTMLElement>(`[data-calendar-slot="${studyDay(days[nextIndex])}:${nextMinute}"]`)?.focus();
  };
  return <section aria-label={days.length === 1 ? 'Day plan' : 'Week plan'}>
    <div ref={scrollRef} role="region" aria-label="Calendar time grid" tabIndex={0} className="overflow-x-auto" data-time-grid>
      <div className={cn(days.length > 1 ? 'min-w-[840px]' : 'min-w-0')}>
        <div className="sticky top-0 z-20 bg-surface">
          <div className="grid border-b" style={columns}><div className="sticky left-0 z-10 border-r bg-surface" />{days.map(day => <div key={studyDay(day)} className="flex flex-col items-center gap-1 border-r py-3 last:border-r-0"><span data-calendar-weekday className="text-sm font-semibold text-foreground">{format(day, 'EEE')}</span><span className={cn('flex size-7 items-center justify-center rounded-full text-sm font-medium', studyDay(day) === studyToday() && 'bg-calendar-personal text-background')}>{format(day, 'd')}</span></div>)}</div>
          <div className="grid border-b" style={columns}><span className="sticky left-0 z-10 flex items-center justify-end whitespace-nowrap border-r bg-surface px-2 text-sm font-medium text-subtle">All day</span>{days.map(day => {
            const key = studyDay(day);
            const allDay = studyEventsForDay(tasks, key).filter(task => task.plannedStartMinutes == null);
            return <div key={key} className="relative min-h-9 border-r last:border-r-0"><Button variant="calendar" className="absolute inset-0 h-full w-full p-0 hover:bg-muted/40" disabled={disabled} aria-label={`Add all-day event on ${format(day, 'MMMM d, yyyy')}`} onClick={() => onCreate({ date: key, startMinutes: null, endMinutes: null })} /><div className="relative space-y-px">{allDay.map(task => <CalendarEvent key={task.key} task={task} day={key} disabled={disabled} onTask={onTask} />)}</div></div>;
          })}</div>
        </div>
        <div className="grid" style={columns}>
          <div className="sticky left-0 z-10 border-r bg-surface">{Array.from({ length: 48 }, (_, index) => <div key={index} data-calendar-hour={index % 2 === 0 ? studyTime(index * 30) : undefined} className={cn('flex h-8 justify-end border-b px-2 pt-1 text-sm font-medium text-foreground', index % 2 === 1 ? 'border-ui-border-strong' : 'border-ui-border/40')}>{index % 2 === 0 ? studyTime(index * 30) : ''}</div>)}</div>
          {days.map((day, index) => {
            const key = studyDay(day);
            const timed = layoutStudyEvents(tasks.filter(task => task.plannedDate === key));
            return <div key={key} data-study-day={key} className={cn('relative border-r last:border-r-0', key === studyToday() && 'bg-calendar-personal-soft/15')}>
              {Array.from({ length: 48 }, (_, slot) => <TimeSlot key={slot} day={day} minute={slot * 30} disabled={disabled} tabIndex={key === selectedDate && slot === 18 ? 0 : -1} onKeyDown={event => navigateSlot(event, index, slot * 30)} onCreate={onCreate} />)}
              {timed.map(({ task, lane, lanes }) => <CalendarEvent key={task.key} task={task} day={key} timed disabled={disabled} onTask={onTask} style={{ position: 'absolute', top: task.plannedStartMinutes! / 30 * ROW_HEIGHT, height: (task.plannedEndMinutes! - task.plannedStartMinutes!) / 30 * ROW_HEIGHT, left: `${lane / lanes * 100}%`, width: `${100 / lanes}%` }} />)}
            </div>;
          })}
        </div>
      </div>
    </div>
  </section>;
}

function TimeSlot({ day, minute, disabled, tabIndex, onKeyDown, onCreate }: { day: Date; minute: number; disabled: boolean; tabIndex: number; onKeyDown: (event: KeyboardEvent<HTMLButtonElement>) => void; onCreate: (selection: StudyEventSelection) => void }) {
  const key = studyDay(day);
  const { setNodeRef, isOver } = useDroppable({ id: `slot:${key}:${minute}`, disabled });
  return <Button ref={setNodeRef} variant="calendar" disabled={disabled} tabIndex={tabIndex} onKeyDown={onKeyDown} data-calendar-slot={`${key}:${minute}`} aria-label={`Add event on ${format(day, 'MMMM d, yyyy')} at ${studyTime(minute)}`} className={cn('flex h-8 w-full border-b p-0 hover:bg-calendar-personal-soft/40 focus-visible:bg-calendar-personal-soft/40', minute % 60 === 30 ? 'border-ui-border-strong' : 'border-ui-border/40', isOver && 'bg-calendar-personal-soft')} onClick={() => onCreate({ date: key, startMinutes: minute, endMinutes: Math.min(minute + 60, 1440) })} />;
}

function MonthDay({ day, month, tasks, disabled, onTask, onCreate, onOpenDay }: { day: Date; month: Date; tasks: StudentTaskItem[]; disabled: boolean; onTask: (task: StudentTaskItem) => void; onCreate: (selection: StudyEventSelection) => void; onOpenDay: () => void }) {
  const key = studyDay(day);
  const { setNodeRef, isOver } = useDroppable({ id: `day:${key}`, disabled });
  return <div ref={setNodeRef} data-study-day={key} className={cn('relative min-h-28 min-w-0 border-b border-r nth-[7n]:border-r-0', !isSameMonth(day, month) && 'bg-muted/25 text-muted-foreground', key === studyToday() && 'bg-calendar-personal-soft/15', isOver && 'bg-calendar-personal-soft')}>
    <Button variant="calendar" className="absolute inset-0 h-full w-full p-0 hover:bg-muted/30" disabled={disabled} aria-label={`Add event on ${format(day, 'MMMM d, yyyy')}`} onClick={() => onCreate({ date: key, startMinutes: null, endMinutes: null })} />
    <div className="relative flex justify-end px-2 py-2 pointer-events-none"><Button variant="ghost" size="icon-sm" disabled={disabled} aria-label={`Open ${format(day, 'MMMM d, yyyy')}`} onClick={onOpenDay} className={cn('pointer-events-auto rounded-full text-xs', key === studyToday() && 'bg-calendar-personal text-background hover:bg-calendar-personal/90 hover:text-background')}>{format(day, 'd')}</Button></div>
    <div className="relative space-y-px pb-2">{tasks.slice(0, 3).map(task => <CalendarEvent key={task.key} task={task} day={key} disabled={disabled} onTask={onTask} />)}{tasks.length > 3 && <Button variant="ghost" size="xs" className="w-full justify-start px-2 text-muted-foreground" onClick={onOpenDay}>+{tasks.length - 3} more</Button>}</div>
  </div>;
}

function CalendarEvent({ task, day, disabled, timed = false, style, onTask }: { task: StudentTaskItem; day: string; disabled: boolean; timed?: boolean; style?: React.CSSProperties; onTask: (task: StudentTaskItem) => void }) {
  const { setNodeRef, listeners, isDragging } = useDraggable({ id: `${day}:${task.key}`, data: { taskKey: task.key }, disabled });
  const time = studyEventTime(task);
  const short = timed && task.plannedEndMinutes! - task.plannedStartMinutes! < 30;
  return <div ref={setNodeRef} style={style} {...listeners} className={cn('relative z-10 min-w-0', timed && 'overflow-hidden', isDragging && 'opacity-40')} data-event-key={task.key}>
    <Button variant="calendar" disabled={disabled} aria-label={`Event: ${studyEventTitle(task.title)}`} title={`${studyEventTitle(task.title)} · ${time}${task.completed ? ' · Completed' : ''}`} className={cn('relative flex h-full w-full flex-col items-start justify-start gap-0.5 overflow-hidden whitespace-normal px-2 py-1 text-xs text-foreground hover:text-foreground', calendarColors[eventColor(task)].surface, task.completed && 'opacity-65', short && 'py-0')} onClick={() => onTask(task)}>
      <StudyEventContent task={task} timed={timed} hideTime={short} />
    </Button>
  </div>;
}
