export type TeacherActivityType = 'TEST' | 'VOCABULARY' | 'HOMEWORK' | 'RESOURCE';

export interface TeacherOverviewResponse {
  generatedAt: string;
  scope: {
    selectedClassId: string | null;
    classes: Array<{ id: string; name: string }>;
  };
  needsAttention: Array<{
    id: string;
    type: TeacherActivityType;
    title: string;
    classId: string;
    className: string;
    dueAt: string;
    reason: 'OVERDUE' | 'DUE_SOON';
    reasonLabel: string;
    stats: { assigned: number; completed: number; inProgress: number; incomplete: number; missing: number };
    href: string;
    actionLabel: string;
  }>;
  upcoming: Array<{
    id: string;
    eventType: 'AVAILABLE' | 'DUE' | 'LESSON';
    activityType: TeacherActivityType | null;
    title: string;
    classId: string;
    className: string;
    occursAt: string;
    href: string;
  }>;
  classes: Array<{
    id: string;
    name: string;
    color: string;
    studentCount: number;
    activityCount: number;
    completionRate: number | null;
    averageScore: number | null;
    attentionCount: number;
    href: string;
  }>;
  checkIns: Array<{
    studentId: number;
    studentName: string;
    studentEmail: string;
    classId: string;
    className: string;
    reason: 'OVERDUE' | 'INACTIVE' | 'DECLINING_SCORE';
    reasonLabel: string;
    href: string;
  }>;
}

export interface TeacherInsightsResponse {
  generatedAt: string;
  rangeDays: number;
  sufficient: boolean;
  classificationCoverage: { classified: number; total: number; percentage: number | null };
  completedSubmissions: number;
  studentCount: number;
  domains: TeacherPerformanceItem[];
  skills: TeacherPerformanceItem[];
}

export interface TeacherPerformanceItem {
  code: string;
  name: string;
  subject: 'RW' | 'MATH';
  correct: number;
  answerCount: number;
  studentCount: number;
  accuracy: number;
}
