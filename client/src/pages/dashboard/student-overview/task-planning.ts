import { format, isValid, parseISO } from 'date-fns';
import type { StudentTaskItem } from './student-overview.types';

// Day-only planning and platform deadlines both use the platform's study timezone.
export const studyDay = (date: Date) => format(date, 'yyyy-MM-dd');
export const parseStudyDay = (value: string | null) => {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value) || value < '2000-01-01' || value > '2100-12-31') return null;
  const date = parseISO(value);
  return isValid(date) && studyDay(date) === value ? date : null;
};
export const studyToday = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
export const studyEventsForDay = (tasks: StudentTaskItem[], day: string) => tasks.filter(task => task.plannedDate === day).sort(compareStudyEvents);
export const compareStudyEvents = (first: StudentTaskItem, second: StudentTaskItem) =>
  (first.plannedDate || '').localeCompare(second.plannedDate || '') ||
  (first.plannedStartMinutes ?? -1) - (second.plannedStartMinutes ?? -1) || first.key.localeCompare(second.key);
export const taskError = (error: unknown, fallback: string) => (error as { response?: { data?: { error?: string } } }).response?.data?.error || fallback;
export const taskTypeLabels: Record<StudentTaskItem['type'], string> = { PERSONAL: 'Personal', ANNOUNCEMENT: 'Announcement', ASSIGNMENT: 'Assignment', TEST: 'Test', QUIZ: 'Quiz', VOCABULARY: 'Vocabulary' };
export const studyEventTitle = (title: string) => title.trimStart().replace(/^\p{L}/u, letter => letter.toUpperCase());

export interface StudyPlanInput {
  plannedDate: string | null;
  plannedStartMinutes: number | null;
  plannedEndMinutes: number | null;
}
export interface StudyEventSelection {
  date: string;
  startMinutes: number | null;
  endMinutes: number | null;
  task?: StudentTaskItem;
}
export const studyTime = (minutes: number) => `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
export const studyEventTime = (task: StudentTaskItem) => task.plannedStartMinutes != null && task.plannedEndMinutes != null
  ? `${studyTime(task.plannedStartMinutes)} – ${studyTime(task.plannedEndMinutes)}` : 'All day';
export const parseStudyTime = (value: string) => {
  if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value) && value !== '24:00') return null;
  const [hours, minutes] = value.split(':').map(Number);
  return hours * 60 + minutes;
};

// Connected overlap groups share equal-width lanes; adjacent events keep the full column.
export function layoutStudyEvents(tasks: StudentTaskItem[]) {
  const timed = tasks.filter(task => task.plannedStartMinutes != null && task.plannedEndMinutes != null)
    .sort((first, second) => first.plannedStartMinutes! - second.plannedStartMinutes! || second.plannedEndMinutes! - first.plannedEndMinutes! || first.key.localeCompare(second.key));
  const result: Array<{ task: StudentTaskItem; lane: number; lanes: number }> = [];
  let group: StudentTaskItem[] = [];
  let groupEnd = 0;
  const flush = () => {
    const laneEnds: number[] = [];
    const placed = group.map(task => {
      let lane = laneEnds.findIndex(end => end <= task.plannedStartMinutes!);
      if (lane === -1) lane = laneEnds.length;
      laneEnds[lane] = task.plannedEndMinutes!;
      return { task, lane };
    });
    result.push(...placed.map(event => ({ ...event, lanes: laneEnds.length })));
    group = [];
  };
  for (const task of timed) {
    if (group.length && task.plannedStartMinutes! >= groupEnd) flush();
    if (!group.length) groupEnd = 0;
    group.push(task);
    groupEnd = Math.max(groupEnd, task.plannedEndMinutes!);
  }
  flush();
  return result;
}
