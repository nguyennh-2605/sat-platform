import { useEffect, useId, useRef, useState } from 'react';
import { format } from 'date-fns';
import { ArrowRight, Check, Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { DateTimePicker } from '@/components/ui/DateTimePicker';
import { Modal } from '@/components/ui/AppUI';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { calendarColors, eventColor } from './calendar-colors';
import { parseStudyDay, parseStudyTime, studyTime, studyEventTitle, taskTypeLabels, type StudyEventSelection, type StudyPlanInput } from './task-planning';
import type { StudentTaskItem, StudyEventColor } from './student-overview.types';

export interface StudyEventDraft extends StudyPlanInput {
  task?: StudentTaskItem;
  title: string;
  details: string;
  dueAt?: string | null;
  calendarColor: StudyEventColor | null;
}

export function StudyPlannerEventDialog({ selection, tasks, busy, onClose, onSave, onComplete, onDelete, onOpen }: {
  selection: StudyEventSelection; tasks: StudentTaskItem[]; busy: boolean; onClose: () => void;
  onSave: (draft: StudyEventDraft) => Promise<boolean>; onComplete: (task: StudentTaskItem) => Promise<void>;
  onDelete: (task: StudentTaskItem) => Promise<void>; onOpen: (task: StudentTaskItem) => void;
}) {
  const fieldId = useId();
  const initial = {
    title: studyEventTitle(selection.task?.title || ''), notes: selection.task?.description || '', date: selection.date,
    start: studyTime(selection.startMinutes ?? 540), end: studyTime(selection.endMinutes ?? 600),
    allDay: selection.startMinutes === null, dueAt: selection.task?.dueAt || '', linkedKey: selection.task?.key || '__new',
    color: (selection.task ? selection.task.calendarColor || 'AUTO' : 'BLUE') as StudyEventColor | 'AUTO',
  };
  const [draft, setDraft] = useState(initial);
  const [editing, setEditing] = useState(!selection.task);
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (editing && selection.task) formRef.current?.querySelector<HTMLElement>('input:not([disabled]), button:not([disabled]), textarea:not([disabled])')?.focus();
  }, [editing, selection.task]);
  const [error, setError] = useState('');
  const [confirmation, setConfirmation] = useState<'discard' | 'delete' | null>(null);
  const task = selection.task || tasks.find(task => task.key === draft.linkedKey);
  const dirty = JSON.stringify(draft) !== JSON.stringify(initial);
  const editable = !task || task.canEdit;
  const requestClose = () => {
    if (busy) return;
    if (confirmation) { setConfirmation(null); return; }
    if (dirty) setConfirmation('discard'); else onClose();
  };
  const submit = async () => {
    const start = parseStudyTime(draft.start);
    const parsedEnd = parseStudyTime(draft.end);
    const end = parsedEnd === 0 ? 1440 : parsedEnd;
    if (!parseStudyDay(draft.date)) { setError('Choose a valid event date.'); return; }
    if (!draft.title.trim()) { setError('Enter an event title.'); return; }
    if (!draft.allDay && (start === null || end === null || start >= end || end - start < 15)) {
      setError('End time must be at least 15 minutes after start time.'); return;
    }
    setError('');
    await onSave({ task, title: studyEventTitle(draft.title.trim()), details: draft.notes, dueAt: draft.dueAt || null, calendarColor: draft.color === 'AUTO' ? null : draft.color, plannedDate: draft.date, plannedStartMinutes: draft.allDay ? null : start, plannedEndMinutes: draft.allDay ? null : end });
  };
  const link = (key: string) => {
    const linked = tasks.find(task => task.key === key);
    setDraft(current => ({ ...current, linkedKey: key, title: studyEventTitle(linked?.title || ''), notes: linked?.description || '', dueAt: linked?.dueAt || '', color: linked ? linked.calendarColor || 'AUTO' : 'BLUE' }));
  };
  const detailsFooter = task && <div className="flex w-full flex-wrap justify-end gap-2">
    {task.canComplete && <Button disabled={busy} onClick={() => void onComplete(task)}><Check />{task.completed ? 'Reopen event' : 'Mark complete'}</Button>}
    <Button variant="outline" disabled={busy} onClick={() => setEditing(true)}><Pencil />Edit</Button>
    {task.canDelete && <Button variant="destructive" disabled={busy} onClick={() => setConfirmation('delete')}><Trash2 />Delete</Button>}
    {task.href && <Button variant="outline" disabled={busy} onClick={() => onOpen(task)}>Open coursework<ArrowRight /></Button>}
  </div>;
  return <Modal presentation="content-dialog" alignment="viewport" open onClose={requestClose} title={confirmation === 'delete' ? 'Delete this event?' : confirmation === 'discard' ? 'Discard changes?' : !editing ? 'Event details' : selection.task ? 'Edit event' : 'Add event'} subtitle={confirmation ? undefined : task?.className || 'Your study calendar'} footer={confirmation === 'delete' ? <><Button variant="outline" disabled={busy} onClick={() => setConfirmation(null)}>Cancel</Button><Button variant="destructive" disabled={busy} onClick={() => task && void onDelete(task)}>Delete event</Button></> : confirmation === 'discard' ? <><Button variant="outline" onClick={() => setConfirmation(null)}>Keep editing</Button><Button variant="destructive" onClick={onClose}>Discard changes</Button></> : !editing ? detailsFooter : <><Button variant="outline" disabled={busy} onClick={requestClose}>Cancel</Button><Button disabled={busy} onClick={() => void submit()}>{busy ? 'Saving…' : selection.task ? 'Save changes' : 'Create event'}</Button></>}>
    {confirmation ? <p className="text-sm text-muted-foreground">{confirmation === 'delete' ? 'This deletes your personal event and its study plan.' : 'Your changes have not been saved.'}</p> : !editing && task ? <dl className="space-y-4 text-sm">
      <div className="grid grid-cols-[4rem_minmax(0,1fr)] items-baseline gap-x-4"><dt className="font-medium text-subtle">Event</dt><dd className={`min-w-0 break-words text-base font-semibold ${task.completed ? 'line-through' : ''}`}>{studyEventTitle(task.title)}</dd></div>
      <div className="grid grid-cols-[4rem_minmax(0,1fr)] items-baseline gap-x-4"><dt className="font-medium text-subtle">Time</dt><dd className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1"><span>{format(parseStudyDay(selection.date)!, 'EEEE, MMM d, yyyy')}</span><span className="whitespace-nowrap text-subtle">{selection.startMinutes === null ? 'All day' : `${studyTime(selection.startMinutes)} – ${studyTime(selection.endMinutes!)}`}</span></dd></div>
      <div className="grid grid-cols-[4rem_minmax(0,1fr)] items-baseline gap-x-4"><dt className="font-medium text-subtle">Notes</dt><dd className="min-w-0 whitespace-pre-wrap break-words">{task.description || <span className="text-muted-foreground">No notes</span>}</dd></div>
      <div className="grid grid-cols-[4rem_minmax(0,1fr)] items-baseline gap-x-4"><dt className="font-medium text-subtle">Color</dt><dd className="flex min-w-0 items-center gap-2"><span aria-hidden="true" className={`size-2.5 rounded-full ${calendarColors[eventColor(task)].dot}`} />{calendarColors[eventColor(task)].label}</dd></div>
    </dl> : <form ref={formRef} className="space-y-4" onSubmit={event => { event.preventDefault(); void submit(); }}>
      {!selection.task && tasks.some(task => !task.plannedDate) && <div className="space-y-2"><p id={`${fieldId}-link`} className="text-sm font-medium">Link a task (optional)</p><Select value={draft.linkedKey} onValueChange={link} disabled={busy}><SelectTrigger className="w-full" aria-labelledby={`${fieldId}-link`}><SelectValue /></SelectTrigger><SelectContent><SelectItem value="__new">Create a new event</SelectItem>{tasks.filter(task => !task.plannedDate).map(task => <SelectItem key={task.key} value={task.key}>{task.title} · {taskTypeLabels[task.type]}</SelectItem>)}</SelectContent></Select></div>}
      <label className="block space-y-2 text-sm font-medium" htmlFor={`${fieldId}-title`}><span>Event title</span><Input id={`${fieldId}-title`} value={draft.title} maxLength={160} disabled={busy || !editable} onChange={event => setDraft(current => ({ ...current, title: event.target.value }))} onBlur={() => setDraft(current => ({ ...current, title: studyEventTitle(current.title) }))} autoComplete="off" /></label>
      <div className="space-y-2"><p id={`${fieldId}-color`} className="text-sm font-medium">Event color</p><Select value={draft.color} disabled={busy} onValueChange={color => setDraft(current => ({ ...current, color: color as StudyEventColor | 'AUTO' }))}><SelectTrigger className="w-full" aria-labelledby={`${fieldId}-color`}><SelectValue /></SelectTrigger><SelectContent><SelectItem value="AUTO">Automatic</SelectItem>{(Object.keys(calendarColors) as StudyEventColor[]).map(color => <SelectItem key={color} value={color}><span aria-hidden="true" className={`size-2.5 rounded-full ${calendarColors[color].dot}`} />{calendarColors[color].label}</SelectItem>)}</SelectContent></Select></div>
      <div className="space-y-2"><p className="text-sm font-medium">Date</p><DateTimePicker mode="date" value={draft.date} minDate="2000-01-01" clearable={false} ariaLabel="Event date" disabled={busy} onChange={date => setDraft(current => ({ ...current, date }))} /></div>
      <label className="flex items-center gap-2 text-sm"><Checkbox checked={draft.allDay} disabled={busy} onCheckedChange={value => setDraft(current => ({ ...current, allDay: value === true }))} />All-day event</label>
      {!draft.allDay && <><div className="grid grid-cols-2 gap-3"><label className="block space-y-2 text-sm font-medium" htmlFor={`${fieldId}-start`}><span>Start time</span><Input id={`${fieldId}-start`} inputMode="numeric" maxLength={5} placeholder="HH:mm" value={draft.start} disabled={busy} onChange={event => setDraft(current => ({ ...current, start: event.target.value }))} /></label><label className="block space-y-2 text-sm font-medium" htmlFor={`${fieldId}-end`}><span>End time</span><Input id={`${fieldId}-end`} inputMode="numeric" maxLength={5} placeholder="HH:mm" value={draft.end} disabled={busy} onChange={event => setDraft(current => ({ ...current, end: event.target.value }))} /></label></div><p className="text-xs text-muted-foreground">Use 24-hour time (HH:mm). 24:00 is the end of this day.</p></>}
      <label className="block space-y-2 text-sm font-medium" htmlFor={`${fieldId}-notes`}><span>Notes</span><Textarea id={`${fieldId}-notes`} value={draft.notes} maxLength={1000} disabled={busy || !editable} onChange={event => setDraft(current => ({ ...current, notes: event.target.value }))} /></label>
      {selection.task?.canEdit && <div className="space-y-2"><p className="text-sm font-medium">Deadline (optional)</p><DateTimePicker value={draft.dueAt} disabled={busy} ariaLabel="Personal task deadline" onChange={dueAt => setDraft(current => ({ ...current, dueAt }))} /></div>}
      {task?.completionMode === 'SOURCE' && <p className="text-xs text-muted-foreground">The coursework deadline stays unchanged. Completion updates when you finish the learning activity.</p>}
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    </form>}
  </Modal>;
}
