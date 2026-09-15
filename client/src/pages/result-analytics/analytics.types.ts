export type AnalyticsRange = '30' | '90' | 'all';
export type AnalyticsSubject = 'ALL' | 'RW' | 'MATH';
export type AnalyticsSource = 'ALL' | 'CLASSROOM' | 'SELF_STUDY';
export type Confidence = 'NOT_ENOUGH_DATA' | 'EARLY_SIGNAL' | 'RANKABLE';

export interface AnalyticsSnapshot {
  overallAccuracy: number | null;
  rwAccuracy: number | null;
  mathAccuracy: number | null;
  questionsAnswered: number;
  correctAnswers: number;
  completedTests: number;
}

export interface FocusArea {
  kind: 'DOMAIN' | 'SKILL';
  code: string;
  name: string;
  category: string;
  subject: 'RW' | 'MATH';
  domainCode: string;
  domainName: string;
  accuracy: number;
  attempted: number;
  trendDelta: number | null;
  mistakes: number;
  needsReview: number;
  reasons: string[];
  action: 'REVIEW_MISTAKES' | 'VIEW_BREAKDOWN';
}

export interface SkillPerformanceItem {
  code: string;
  name: string;
  correct: number;
  attempted: number;
  accuracy: number | null;
  confidence: Confidence;
  trendDelta: number | null;
  mistakes: number;
  needsReview: number;
  avgTimeMs: number | null;
}

export interface DomainPerformanceItem extends SkillPerformanceItem {
  subject: 'RW' | 'MATH';
  sortOrder: number;
  skills: SkillPerformanceItem[];
}

export interface AccuracyTrendPoint {
  submissionId: number;
  date: string;
  testName: string;
  subject: 'RW' | 'MATH';
  correctCount: number;
  totalQuestions: number;
  accuracy: number;
}

export interface MistakeArea {
  name: string;
  category: string;
  saved: number;
  needsReview: number;
  reviewed: number;
}

export interface MistakeReviewData {
  saved: number;
  needsReview: number;
  reviewed: number;
  completion: number | null;
  topAreas: MistakeArea[];
}

export interface PacingSkill {
  code: string;
  name: string;
  domainName: string;
  subject: 'RW' | 'MATH';
  timedQuestions: number;
  avgTimeMs: number;
  accuracy: number | null;
}

export interface PacingData {
  available: boolean;
  timedQuestions: number;
  answeredQuestions: number;
  coverage: number | null;
  averageTimeMs: number | null;
  correctAverageMs: number | null;
  incorrectAverageMs: number | null;
  slowQuestions: number;
  patterns: {
    fastCorrect: number;
    slowCorrect: number;
    fastWrong: number;
    slowWrong: number;
  };
  skills: PacingSkill[];
}

export interface AnalyticsResponse {
  generatedAt: string;
  meta: {
    range: string;
    subject: AnalyticsSubject;
    classificationCoverage: { classified: number; total: number; percentage: number | null; unclassified: number };
    timingCoverage: { timedQuestions: number; answeredQuestions: number; percentage: number | null };
  };
  snapshot: AnalyticsSnapshot;
  focusAreas: FocusArea[];
  accuracyTrend: AccuracyTrendPoint[];
  skillPerformance: DomainPerformanceItem[];
  mistakeReview: MistakeReviewData;
  pacing: PacingData;
}

export interface AttemptItem {
  id: number;
  testName: string;
  subject: 'RW' | 'MATH';
  mode: 'PRACTICE' | 'EXAM';
  accuracy: number | null;
  correctCount: number;
  totalQuestions: number;
  durationMs: number | null;
  durationSource: 'ACTIVE' | 'ELAPSED' | null;
  source: Exclude<AnalyticsSource, 'ALL'>;
  completedAt: string;
}

export interface AttemptsResponse {
  items: AttemptItem[];
  nextCursor: string | null;
}

export type StudyActivityType = 'PRACTICE' | 'VOCABULARY' | 'ERROR_LOG' | 'HOMEWORK' | 'OTHER';

export interface StudyTimeSummaryResponse {
  range: AnalyticsRange;
  timeZone: string;
  generatedAt: string;
  period: { from: string | null; to: string };
  summary: {
    trackedMs: number;
    sessionCount: number;
    activeDays: number;
    currentStreak: number;
    longestStreak: number;
    averageSessionMs: number | null;
  };
  daily: Array<{ date: string; trackedMs: number; sessionCount: number }>;
  activities: Array<{ activityType: StudyActivityType; trackedMs: number; sessionCount: number; percentage: number }>;
  chartWindow: { from: string; to: string; truncated: boolean };
}

