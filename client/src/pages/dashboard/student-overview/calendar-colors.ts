import type { StudentTaskItem, StudyEventColor } from './student-overview.types';

export const calendarColors: Record<StudyEventColor, { label: string; surface: string; dot: string }> = {
  BLUE: { label: 'Blue', surface: 'bg-calendar-personal-soft', dot: 'bg-calendar-personal' },
  VIOLET: { label: 'Violet', surface: 'bg-calendar-coursework-soft', dot: 'bg-calendar-coursework' },
  TEAL: { label: 'Teal', surface: 'bg-calendar-vocabulary-soft', dot: 'bg-calendar-vocabulary' },
  AMBER: { label: 'Amber', surface: 'bg-calendar-announcement-soft', dot: 'bg-calendar-announcement' },
};

export function eventColor(task: StudentTaskItem): StudyEventColor {
  if (task.calendarColor && task.calendarColor in calendarColors) return task.calendarColor;
  if (task.type === 'ANNOUNCEMENT') return 'AMBER';
  if (task.type === 'VOCABULARY') return 'TEAL';
  return task.type === 'PERSONAL' ? 'BLUE' : 'VIOLET';
}
