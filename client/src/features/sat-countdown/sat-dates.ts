export interface SatDateOption {
  date: string;
  anticipated?: boolean;
}

export const SAT_DATE_OPTIONS: readonly SatDateOption[] = [
  { date: '2026-09-12' },
  { date: '2026-10-03' },
  { date: '2026-11-07' },
  { date: '2026-12-05' },
  { date: '2027-03-06' },
  { date: '2027-05-01' },
  { date: '2027-06-05' },
  { date: '2027-08-28', anticipated: true },
  { date: '2027-09-18', anticipated: true },
  { date: '2027-10-02', anticipated: true },
  { date: '2027-11-06', anticipated: true },
  { date: '2027-12-04', anticipated: true },
  { date: '2028-03-04', anticipated: true },
  { date: '2028-05-06', anticipated: true },
  { date: '2028-06-03', anticipated: true },
];

export const OFFICIAL_SAT_DATES = SAT_DATE_OPTIONS.map(option => option.date);

export const atSatTime = (value: string) => new Date(`${value}T07:45:00`);

export const fallbackSatDate = (now = Date.now()) => atSatTime(
  OFFICIAL_SAT_DATES.find(value => atSatTime(value).getTime() > now) || OFFICIAL_SAT_DATES.at(-1)!,
);

export const upcomingSatDates = (now = Date.now(), limit = 10) => SAT_DATE_OPTIONS
  .filter(option => atSatTime(option.date).getTime() > now)
  .slice(0, limit);
