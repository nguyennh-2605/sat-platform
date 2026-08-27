import type { ClassroomTodoItem } from '@/features/classroom/ClassroomTodoPanel';

export type StudentSubject = 'RW' | 'MATH';

export interface StudentFocus {
  type: 'CLASSROOM' | 'TEST' | 'VOCABULARY' | 'ERROR_LOG' | 'BASELINE' | 'SUBJECT' | 'PRACTICE';
  title: string;
  description: string;
  actionLabel: string;
  href: string;
  progress?: number;
  dueAt?: string | null;
  source: 'CLASSROOM' | 'SELF_STUDY';
  testId?: number | null;
  deliveryId?: string | null;
  durationMinutes?: number | null;
  todoKey?: string;
}

export interface StudentPracticePick {
  id: number;
  title: string;
  description?: string | null;
  subject: StudentSubject;
  mode: 'PRACTICE' | 'EXAM';
  duration: number;
  questionCount: number;
  attemptStatus: 'NOT_STARTED' | 'DOING' | 'COMPLETED';
  progress: number;
}

export interface StudentOverviewResponse {
  generatedAt: string;
  preferences: {
    satTestDate: string | null;
    currentScore: number | null;
    targetScore: number | null;
  };
  focus: StudentFocus | null;
  progress: {
    windowDays: number;
    overallAccuracy: number | null;
    completedTests: number;
    questionsAnswered: number;
    rwAccuracy: number | null;
    mathAccuracy: number | null;
    trend: Array<{ date: string; title: string; subject: StudentSubject; accuracy: number }>;
  };
  practice: StudentPracticePick[];
  recentResults: Array<{
    submissionId: number;
    title: string;
    subject: StudentSubject;
    correctCount: number;
    totalQuestions: number;
    accuracy: number;
    completedAt: string;
  }>;
  review: { savedMistakeCount: number; href: string };
  classroom: { available: boolean; membershipCount: number; todos: ClassroomTodoItem[] };
}

export type StudentTaskSource = 'PERSONAL' | 'ANNOUNCEMENT' | 'ASSIGNMENT' | 'TEST' | 'VOCABULARY';

export interface StudentTaskItem {
  key: string;
  id: string;
  source: 'PERSONAL' | 'CLASSROOM';
  type: StudentTaskSource;
  title: string;
  description: string | null;
  className: string | null;
  classId: string | null;
  assignmentId: string | null;
  activityId: string | null;
  testId: number | null;
  deliveryId: string | null;
  durationMinutes: number | null;
  createdAt: string;
  dueAt: string | null;
  completedAt: string | null;
  completed: boolean;
  completionMode: 'USER' | 'SOURCE';
  priority: 'OVERDUE' | 'DUE_SOON' | 'NORMAL';
  position: number | null;
  href: string;
  canEdit: boolean;
  canDelete: boolean;
  canComplete: boolean;
}

export interface StudentTasksResponse {
  items: StudentTaskItem[];
  summary: {
    todayRemaining: number;
    weekCompleted: number;
    weekTotal: number;
    weekPercentage: number;
  };
  calendar: Array<{ date: string; total: number; incomplete: number }>;
}
