import { useEffect, useMemo, useState } from 'react';
import { closestCenter, DndContext, KeyboardSensor, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { addDays, endOfDay, format, isSameDay, startOfDay } from 'date-fns';
import { ArrowUpRight, CalendarDays, GripVertical, ListChecks, Plus, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { DateTimePicker } from '@/components/ui/DateTimePicker';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/AppUI';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import axiosClient from '@/lib/axios';
import { cn } from '@/lib/utils';
import type { StudentTaskItem, StudentTasksResponse } from './student-overview.types';

type TaskView = 'TODAY' | 'TOMORROW' | 'WEEK' | 'COMPLETED' | 'DATE';

const sourceLabels: Record<StudentTaskItem['type'], string> = { PERSONAL: 'Personal', ANNOUNCEMENT: 'Announcement', ASSIGNMENT: 'Assignment', TEST: 'Test', VOCABULARY: 'Vocabulary' };
const dateForTask = (task: StudentTaskItem) => task.dueAt ? new Date(task.dueAt) : task.type === 'ANNOUNCEMENT' ? new Date(task.createdAt) : null;

function filteredTasks(items: StudentTaskItem[], view: TaskView, selectedDate?: Date) {
  const today = startOfDay(new Date());
  const tomorrow = addDays(today, 1);
  const weekEnd = endOfDay(addDays(today, 6));
  return items.filter(task => {
    const date = dateForTask(task);
    if (view === 'COMPLETED') return task.completed;
    if (view === 'DATE') return Boolean(selectedDate && date && isSameDay(date, selectedDate));
    if (task.completed) return false;
    if (view === 'TOMORROW') return Boolean(date && isSameDay(date, tomorrow));
    if (view === 'WEEK') return Boolean(date && date >= today && date <= weekEnd);
    return !date || date < tomorrow;
  });
}

export function StudentTasksSection({ data, selectedDate, onClearDate, onOpen, onReload }: {
  data: StudentTasksResponse;
  selectedDate?: Date;
  onClearDate: () => void;
  onOpen: (item: StudentTaskItem) => void;
  onReload: () => Promise<void>;
}) {
  const [items, setItems] = useState(data.items);
  const [view, setView] = useState<TaskView>(selectedDate ? 'DATE' : 'TODAY');
  const [editor, setEditor] = useState<StudentTaskItem | 'NEW' | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<StudentTaskItem | null>(null);
  const [workingKey, setWorkingKey] = useState<string | null>(null);
  useEffect(() => setItems(data.items), [data.items]);
  useEffect(() => { if (selectedDate) setView('DATE'); }, [selectedDate]);
  const visible = useMemo(() => filteredTasks(items, view, selectedDate), [items, selectedDate, view]);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));

  const changeView = (next: TaskView) => { setView(next); if (next !== 'DATE') onClearDate(); };
  const toggle = async (task: StudentTaskItem, completed: boolean) => {
    if (!task.canComplete) return;
    const previous = items;
    setItems(current => current.map(item => item.key === task.key ? { ...item, completed, completedAt: completed ? new Date().toISOString() : null } : item));
    setWorkingKey(task.key);
    try { await axiosClient.put('/api/student/tasks/state', { itemKey: task.key, completed }); await onReload(); }
    catch (error) { setItems(previous); toast.error((error as { response?: { data?: { error?: string } } }).response?.data?.error || 'Unable to update task.'); }
    finally { setWorkingKey(null); }
  };
  const reorder = async (event: DragEndEvent) => {
    if (!event.over || event.active.id === event.over.id) return;
    const oldIndex = visible.findIndex(item => item.key === event.active.id);
    const newIndex = visible.findIndex(item => item.key === event.over?.id);
    if (oldIndex < 0 || newIndex < 0) return;
    const reorderedVisible = arrayMove(visible, oldIndex, newIndex);
    let visibleIndex = 0;
    const visibleKeys = new Set(visible.map(item => item.key));
    const nextItems = items.map(item => visibleKeys.has(item.key) ? reorderedVisible[visibleIndex++] : item);
    const previous = items;
    setItems(nextItems);
    try { await axiosClient.put('/api/student/tasks/order', { orderedKeys: nextItems.map(item => item.key) }); await onReload(); }
    catch (error) { setItems(previous); toast.error((error as { response?: { data?: { error?: string } } }).response?.data?.error || 'Unable to save task order.'); }
  };
  const remove = async () => {
    if (!deleteTarget) return;
    setWorkingKey(deleteTarget.key);
    try { await axiosClient.delete(`/api/student/tasks/${deleteTarget.id}`); setDeleteTarget(null); await onReload(); toast.success('Task deleted.'); }
    catch (error) { toast.error((error as { response?: { data?: { error?: string } } }).response?.data?.error || 'Unable to delete task.'); }
    finally { setWorkingKey(null); }
  };

  return <>
    <Card>
      <CardHeader className="border-b">
        <CardTitle>Tasks</CardTitle><CardDescription>Coursework and personal study tasks in one place.</CardDescription>
        <CardAction className="flex items-center gap-2"><Select value={view} onValueChange={value => changeView(value as TaskView)}><SelectTrigger size="sm" aria-label="Task view"><SelectValue /></SelectTrigger><SelectContent align="end"><SelectItem value="TODAY">Today</SelectItem><SelectItem value="TOMORROW">Tomorrow</SelectItem><SelectItem value="WEEK">This week</SelectItem><SelectItem value="COMPLETED">Completed</SelectItem>{selectedDate && <SelectItem value="DATE">{format(selectedDate, 'MMM d')}</SelectItem>}</SelectContent></Select><Button size="sm" onClick={() => setEditor('NEW')}><Plus />New task</Button></CardAction>
      </CardHeader>
      <CardContent className="px-0">
        {visible.length === 0 ? <div className="flex min-h-48 flex-col items-center justify-center px-6 text-center"><ListChecks className="size-9 text-muted-foreground" /><p className="mt-3 font-medium">Nothing here yet</p><p className="mt-1 text-sm text-muted-foreground">{view === 'COMPLETED' ? 'Completed tasks will collect here.' : 'Enjoy the open space or add a personal task.'}</p></div> :
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={event => void reorder(event)}><SortableContext items={visible.map(item => item.key)} strategy={verticalListSortingStrategy}><div className="divide-y">{visible.map(task => <SortableTaskRow key={task.key} task={task} busy={workingKey === task.key} onToggle={toggle} onOpen={onOpen} onEdit={setEditor} />)}</div></SortableContext></DndContext>}
      </CardContent>
    </Card>
    <TaskEditor task={editor} onClose={() => setEditor(null)} onDelete={task => { setEditor(null); setDeleteTarget(task); }} onSaved={async () => { setEditor(null); await onReload(); }} />
    <Modal open={Boolean(deleteTarget)} onClose={() => !workingKey && setDeleteTarget(null)} closeOnBackdrop={!workingKey} presentation="content-dialog" title="Delete this task?" subtitle={deleteTarget?.title} className="max-w-md!" footer={<><Button variant="outline" disabled={Boolean(workingKey)} onClick={() => setDeleteTarget(null)}>Cancel</Button><Button variant="destructive" disabled={Boolean(workingKey)} onClick={() => void remove()}>{workingKey ? 'Deleting…' : 'Delete task'}</Button></>}><p className="text-sm leading-6 text-muted-foreground">This removes the personal task permanently. Coursework from your classes cannot be deleted here.</p></Modal>
  </>;
}

function SortableTaskRow({ task, busy, onToggle, onOpen, onEdit }: { task: StudentTaskItem; busy: boolean; onToggle: (task: StudentTaskItem, completed: boolean) => void; onOpen: (task: StudentTaskItem) => void; onEdit: (task: StudentTaskItem) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.key });
  const due = task.dueAt ? new Date(task.dueAt) : null;
  const hasAction = Boolean(task.href || task.canEdit);
  const activate = () => task.href ? onOpen(task) : task.canEdit && onEdit(task);
  return <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }} className={cn('group flex items-center gap-2 px-4 py-2', isDragging && 'relative z-10 bg-card shadow-raised ring-1 ring-foreground/10')}>
    <Button variant="ghost" size="icon-xs" className="cursor-grab touch-none text-muted-foreground active:cursor-grabbing" aria-label={`Reorder ${task.title}`} {...attributes} {...listeners}><GripVertical /></Button>
    <Checkbox checked={task.completed} disabled={!task.canComplete || busy} onCheckedChange={checked => onToggle(task, Boolean(checked))} aria-label={task.canComplete ? `${task.completed ? 'Reopen' : 'Complete'} ${task.title}` : `${task.title} completion is updated from coursework`} />
    <div className="min-w-0 flex-1">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <span className={cn('truncate text-sm font-medium text-foreground', task.completed && 'text-muted-foreground line-through')}>{task.title}</span>
            <Badge variant="outline" className="px-3 py-1 font-normal text-muted-foreground">{sourceLabels[task.type]}</Badge>
            {task.priority === 'OVERDUE' && !task.completed && <Badge variant="destructive">Overdue</Badge>}
          </div>
          {task.className && <p className="mt-1 truncate text-xs text-muted-foreground">From <span className="font-medium text-foreground">{task.className}</span></p>}
        </div>
        <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground lg:shrink-0 lg:flex-nowrap lg:justify-end">
          {due && <span className={cn('inline-flex items-center gap-1.5 whitespace-nowrap', task.priority === 'OVERDUE' && !task.completed && 'text-destructive')}><CalendarDays className="size-4" aria-hidden="true" />{format(due, 'MMM d, h:mm a')}</span>}
          {hasAction && <Button variant="ghost" size="icon-sm" onClick={activate} aria-label={`${task.href ? 'Open' : 'Edit'} ${task.title}`}><ArrowUpRight /></Button>}
        </div>
      </div>
    </div>
  </div>;
}

function TaskEditor({ task, onClose, onDelete, onSaved }: { task: StudentTaskItem | 'NEW' | null; onClose: () => void; onDelete: (task: StudentTaskItem) => void; onSaved: () => Promise<void> }) {
  const editing = task && task !== 'NEW' ? task : null;
  const [title, setTitle] = useState(''); const [details, setDetails] = useState(''); const [dueAt, setDueAt] = useState(''); const [saving, setSaving] = useState(false);
  useEffect(() => { if (!task) return; setTitle(editing?.title || ''); setDetails(editing?.description || ''); setDueAt(editing?.dueAt || ''); }, [task, editing]);
  const save = async () => {
    if (!title.trim()) return toast.error('Enter a task title.');
    setSaving(true);
    try { const body = { title, details, dueAt: dueAt || null }; if (editing) await axiosClient.patch(`/api/student/tasks/${editing.id}`, body); else await axiosClient.post('/api/student/tasks', body); await onSaved(); toast.success(editing ? 'Task updated.' : 'Task added.'); }
    catch (error) { toast.error((error as { response?: { data?: { error?: string } } }).response?.data?.error || 'Unable to save task.'); }
    finally { setSaving(false); }
  };
  const footer = <div className="flex w-full items-center justify-between gap-3">
    <div>{editing?.canDelete && <Button variant="destructive" disabled={saving} onClick={() => onDelete(editing)}><Trash2 />Delete</Button>}</div>
    <div className="flex items-center gap-2"><Button variant="outline" disabled={saving} onClick={onClose}>Cancel</Button><Button disabled={saving || !title.trim()} onClick={() => void save()}>{saving ? 'Saving…' : editing ? 'Save changes' : 'Add task'}</Button></div>
  </div>;
  return <Modal open={Boolean(task)} onClose={() => !saving && onClose()} closeOnBackdrop={!saving} presentation="content-dialog" title={editing ? 'Edit task' : 'New task'} subtitle="Plan a personal study action alongside your coursework." footer={footer}><div className="space-y-4"><label className="block space-y-2 text-sm font-medium">Task title<Input autoFocus maxLength={160} value={title} onChange={event => setTitle(event.target.value)} placeholder="What do you want to get done?" /></label><label className="block space-y-2 text-sm font-medium">Notes <span className="font-normal text-muted-foreground">(optional)</span><Textarea maxLength={1000} value={details} onChange={event => setDetails(event.target.value)} placeholder="Add context or a study plan" /></label><label className="block space-y-2 text-sm font-medium">Due date <span className="font-normal text-muted-foreground">(optional)</span><DateTimePicker value={dueAt} onChange={setDueAt} ariaLabel="Task due date" className="w-full" /></label></div></Modal>;
}
