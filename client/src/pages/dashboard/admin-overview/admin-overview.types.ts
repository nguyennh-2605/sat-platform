export type OverviewRange = '7d' | '30d' | '90d';
export type ActivityMetric = 'attempts' | 'completions' | 'studentsTakingTests';

export interface AdminOverviewResponse {
  generatedAt: string;
  range: {
    key: OverviewRange;
    from: string;
    to: string;
    previousFrom: string;
    previousTo: string;
  };
  summary: {
    students: { total: number; createdInPeriod: number };
    teachers: { total: number; createdInPeriod: number };
    classrooms: { total: number; createdInPeriod: number };
    testAttempts: { current: number; previous: number; changePercent: number | null };
  };
  attention: Array<{
    code: string;
    severity: 'critical' | 'warning';
    count: number;
    title: string;
    href: string;
  }>;
  tests: {
    system: { published: number; draft: number; archived: number };
    teacher: { total: number; createdInPeriod: number };
  };
  classrooms: {
    total: number;
    teachersWithClasses: number;
    uniqueEnrolledStudents: number;
    createdInPeriod: number;
  };
}

export interface AdminActivityResponse {
  range: {
    key: OverviewRange;
    from: string;
    to: string;
    previousFrom: string;
    previousTo: string;
    granularity: 'DAY' | 'WEEK';
  };
  series: Array<{
    bucket: string;
    attempts: number;
    completions: number;
    studentsTakingTests: number;
  }>;
}
