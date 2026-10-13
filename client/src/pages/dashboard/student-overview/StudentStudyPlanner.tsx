import { useCallback, useEffect, useMemo, useState } from 'react';
import { parseISO } from 'date-fns';
import { DndContext, DragOverlay, PointerSensor, pointerWithin, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { RefreshCw, Undo2 } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import axiosClient from '@/lib/axios';
import { cachedGet } from '@/lib/queryCache';
import { useDashboardBack } from '@/features/navigation/DashboardBackContext';
import { parseStudyDay, studyDay, studyToday, taskError, type StudyPlanInput } from './task-planning';
import { StudyPlannerCalendar, type PlannerView } from './StudyPlannerCalendar';
import { StudyPlannerEventDialog } from './StudyPlannerEventDialog';
import { useStudyPlannerEvents } from './useStudyPlannerEvents';
import type { StudentTaskItem, StudentTasksResponse } from './student-overview.types';

const emptyTasks: StudentTasksResponse = { items: [], calendar: [], summary: { todayRemaining: 0, weekCompleted: 0, weekTotal: 0, weekPercentage: 0 } };
const planFor = (task: StudentTaskItem): StudyPlanInput => ({ plannedDate: task.plannedDate || null, plannedStartMinutes: task.plannedStartMinutes ?? null, plannedEndMinutes: task.plannedEndMinutes ?? null });

export default function StudentStudyPlanner() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [data, setData] = useState<StudentTasksResponse>(emptyTasks);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [date, setDate] = useState(() => parseStudyDay(searchParams.get('date')) || parseISO(studyToday()));
  const [view, setView] = useState<PlannerView>(searchParams.get('view') === 'day' ? 'DAY' : searchParams.get('view') === 'week' ? 'WEEK' : 'MONTH');
  const [showCompleted, setShowCompleted] = useState(searchParams.get('completed') !== 'false');
  useEffect(() => {
    const day = studyDay(date);
    if (searchParams.get('date') === day && searchParams.get('view') === view.toLowerCase() && searchParams.get('completed') === String(showCompleted)) return;
    const next = new URLSearchParams(searchParams);
    next.set('date', day); next.set('view', view.toLowerCase()); next.set('completed', String(showCompleted));
    setSearchParams(next, { replace: true });
  }, [date, view, showCompleted, searchParams, setSearchParams]);
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [undo, setUndo] = useState<{ key: string; plan: StudyPlanInput; title: string } | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  useDashboardBack(() => navigate('/dashboard'), true, 6);
  const load = useCallback(async () => {
    try { setData(await cachedGet<StudentTasksResponse>('/api/student/tasks', { force: true })); setError(''); }
    catch (failure) { setError(taskError(failure, 'Your calendar could not be loaded. Please retry.')); }
    finally { setLoading(false); }
  }, []);
  const { selection, setSelection, working, inFlight, mutate, close, saveEvent, complete, remove, openTask } = useStudyPlannerEvents({
    onReload: load,
    onOpen: task => navigate(task.href),
    onChanged: draft => { setUndo(null); if (draft?.plannedDate) setDate(parseISO(draft.plannedDate)); },
  });
  useEffect(() => { void load(); }, [load]);
  const visibleTasks = useMemo(() => data.items.filter(task => showCompleted || !task.completed), [data.items, showCompleted]);
  const activeTask = data.items.find(task => task.key === activeKey);
  const schedule = async (task: StudentTaskItem, plan: StudyPlanInput, undoing = false) => {
    const previous = data;
    if (inFlight.current || JSON.stringify(planFor(task)) === JSON.stringify(plan)) return;
    setData(current => ({ ...current, items: current.items.map(item => item.key === task.key ? { ...item, ...plan } : item) }));
    const saved = await mutate(() => axiosClient.put('/api/student/tasks/schedule', { itemKey: task.key, ...plan }), () => {
      setUndo(undoing ? null : { key: task.key, plan: planFor(task), title: task.title });
    }, 'Unable to move event. Please retry.');
    if (!saved) setData(previous);
  };
  const dropped = (event: DragEndEvent) => {
    setActiveKey(null);
    const task = data.items.find(task => task.key === event.active.data.current?.taskKey);
    if (!task || !event.over) return;
    const [kind, day, minute] = String(event.over.id).split(':');
    if (kind === 'day') void schedule(task, { ...planFor(task), plannedDate: day });
    if (kind === 'slot') {
      const start = Number(minute);
      const duration = task.plannedStartMinutes != null && task.plannedEndMinutes != null ? task.plannedEndMinutes - task.plannedStartMinutes : 60;
      void schedule(task, { plannedDate: day, plannedStartMinutes: Math.min(start, 1440 - duration), plannedEndMinutes: Math.min(start + duration, 1440) });
    }
  };
  const editEvent = (task: StudentTaskItem) => setSelection({ task, date: task.plannedDate || studyDay(date), startMinutes: task.plannedStartMinutes ?? null, endMinutes: task.plannedEndMinutes ?? null });
  return <div className="h-full overflow-y-auto bg-background" data-study-planner-page><main className="mx-auto w-full max-w-screen-2xl p-4 md:p-6">
    <header className="mb-6 flex items-start justify-between gap-4"><div><h1 className="font-heading text-3xl font-semibold tracking-tight">Study planner</h1><p className="mt-1 text-sm text-muted-foreground">Select a time on your calendar to plan a study session.</p></div><Button variant="outline" size="icon-sm" disabled={working || loading} aria-label="Refresh planner" onClick={() => void load()}><RefreshCw /></Button></header>
    {error && <div role="alert" className="mb-4 flex flex-wrap items-center gap-3 rounded-control border p-4 text-sm"><p className="text-destructive">{error}</p><Button variant="outline" size="sm" onClick={() => void load()}>Retry</Button></div>}
    {loading ? <div aria-label="Loading study calendar" className="space-y-4"><Skeleton className="mx-auto h-8 w-64" /><Skeleton className="h-96" /></div> : <DndContext sensors={sensors} collisionDetection={pointerWithin} accessibility={{ screenReaderInstructions: { draggable: 'Drag an event to another time. To reschedule with a keyboard, open the event and edit its date and time.' } }} onDragStart={event => setActiveKey(event.active.data.current?.taskKey || null)} onDragCancel={() => setActiveKey(null)} onDragEnd={dropped}>
      <StudyPlannerCalendar date={date} view={view} tasks={visibleTasks} disabled={working} showCompleted={showCompleted} onShowCompleted={setShowCompleted} onDateChange={setDate} onViewChange={setView} onTask={editEvent} onCreate={setSelection} />
      {undo && <div role="status" className="sticky bottom-4 z-30 mt-3 flex items-center justify-between gap-3 rounded-control border bg-surface px-4 py-2 text-sm"><p className="min-w-0 truncate">Event moved: {undo.title}</p><Button variant="ghost" size="sm" disabled={working} onClick={() => { const task = data.items.find(task => task.key === undo.key); if (task) void schedule(task, undo.plan, true); }}><Undo2 />Undo</Button></div>}
      <DragOverlay>{activeTask && <Card className="max-w-64 gap-0 p-3 text-sm shadow-raised">{activeTask.title}</Card>}</DragOverlay>
    </DndContext>}
    {selection && <StudyPlannerEventDialog key={`${selection.task?.key || 'new'}:${selection.date}:${selection.startMinutes}`} selection={selection} tasks={data.items} busy={working} onClose={close} onSave={saveEvent} onComplete={complete} onDelete={remove} onOpen={openTask} />}
  </main></div>;
}
