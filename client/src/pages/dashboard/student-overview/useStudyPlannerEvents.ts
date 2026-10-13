import { useRef, useState } from 'react';
import { appToast } from '@/components/ui/toast';
import axiosClient from '@/lib/axios';
import { invalidateQueryCache } from '@/lib/queryCache';
import { taskError, type StudyEventSelection, type StudyPlanInput } from './task-planning';
import type { StudyEventDraft } from './StudyPlannerEventDialog';
import type { StudentTaskItem } from './student-overview.types';

// Overview and the calendar share persistence, capabilities and dialog behavior.
export function useStudyPlannerEvents({ onReload, onOpen, onChanged }: {
  onReload: () => Promise<void>;
  onOpen: (task: StudentTaskItem) => void;
  onChanged?: (draft?: StudyEventDraft) => void;
}) {
  const [selection, setSelection] = useState<StudyEventSelection | null>(null);
  const [working, setWorking] = useState(false);
  const inFlight = useRef(false);
  const mutate = async (action: () => Promise<unknown>, success: () => void, fallback: string) => {
    if (inFlight.current) return false;
    inFlight.current = true; setWorking(true);
    try {
      await action(); invalidateQueryCache('/api/student'); success(); await onReload(); return true;
    } catch (failure) { appToast.error(taskError(failure, fallback)); return false; }
    finally { inFlight.current = false; setWorking(false); }
  };
  const close = () => { if (!inFlight.current) setSelection(null); };
  const saveEvent = async (draft: StudyEventDraft) => {
    const plan: StudyPlanInput = { plannedDate: draft.plannedDate, plannedStartMinutes: draft.plannedStartMinutes, plannedEndMinutes: draft.plannedEndMinutes };
    return mutate(() => draft.task
      ? draft.task.canEdit ? axiosClient.patch(`/api/student/tasks/${draft.task.id}`, { title: draft.title, details: draft.details, dueAt: draft.dueAt, calendarColor: draft.calendarColor, ...plan }) : axiosClient.put('/api/student/tasks/schedule', { itemKey: draft.task.key, calendarColor: draft.calendarColor, ...plan })
      : axiosClient.post('/api/student/tasks', { title: draft.title, details: draft.details, calendarColor: draft.calendarColor, ...plan }),
    () => { setSelection(null); onChanged?.(draft); }, 'Unable to save event. Please retry.');
  };
  const complete = async (task: StudentTaskItem) => {
    if (task.canComplete) await mutate(() => axiosClient.put('/api/student/tasks/state', { itemKey: task.key, completed: !task.completed }), () => { setSelection(null); onChanged?.(); }, 'Unable to update completion.');
  };
  const remove = async (task: StudentTaskItem) => {
    if (task.canDelete) await mutate(() => axiosClient.delete(`/api/student/tasks/${task.id}`), () => { setSelection(null); onChanged?.(); }, 'Unable to delete event.');
  };
  const openTask = (task: StudentTaskItem) => { if (task.href && !inFlight.current) { setSelection(null); onOpen(task); } };
  return { selection, setSelection, working, inFlight, mutate, close, saveEvent, complete, remove, openTask };
}
