import { describe, expect, it } from 'vitest';
import { layoutStudyEvents, parseStudyDay, parseStudyTime, studyDay, studyTime } from './task-planning';
import type { StudentTaskItem } from './student-overview.types';

describe('planner date links', () => {
  it('keeps a valid study day, including leap days, without timezone conversion', () => {
    for (const value of ['2026-10-13', '2028-02-29', '2000-01-01', '2100-12-31']) {
      expect(studyDay(parseStudyDay(value)!)).toBe(value);
    }
  });

  it('falls back for invalid, out-of-range or timestamp parameters', () => {
    for (const value of [null, '', '2026-02-29', '2026-13-01', '1999-12-31', '2101-01-01', '2026-10-13T00:00:00Z']) {
      expect(parseStudyDay(value)).toBeNull();
    }
  });
});

describe('calendar time placement', () => {
  it('handles midnight and rejects invalid clock input', () => {
    expect(parseStudyTime('00:00')).toBe(0);
    expect(parseStudyTime('24:00')).toBe(1440);
    expect(studyTime(570)).toBe('09:30');
    for (const value of ['', '25:00', '12:60', '9:00']) expect(parseStudyTime(value)).toBeNull();
  });
  it('separates overlapping events while adjacent events regain the full day width', () => {
    const task = (key: string, start: number, end: number) => ({ key, plannedStartMinutes: start, plannedEndMinutes: end }) as StudentTaskItem;
    const placed = layoutStudyEvents([task('first', 540, 600), task('overlap', 570, 630), task('adjacent', 630, 690)]);
    expect(placed.map(event => [event.task.key, event.lane, event.lanes])).toEqual([['first', 0, 2], ['overlap', 1, 2], ['adjacent', 0, 1]]);
  });
});
