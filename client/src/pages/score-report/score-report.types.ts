import type { ContentBlock } from '../../types/quiz';

export interface OutcomeSummary {
  total: number;
  correct: number;
  incorrect: number;
  omitted: number;
  activeDurationMs: number;
  timedQuestions: number;
  accuracy: number | null;
  timingCoverage: number | null;
}

export interface QuestionClassification {
  code: string;
  name: string;
  sortOrder: number;
}

export interface QuestionModule {
  id: number | null;
  name: string;
  order: number;
}

export interface QuestionResult {
  id: number | string;
  type: 'MCQ' | 'SPR';
  questionNumber: number;
  module: QuestionModule;
  correctAnswer: string | null;
  userAnswer?: string | null;
  isCorrect: boolean | null;
  isOmitted: boolean;
  blocks: ContentBlock[];
  questionText: string;
  choices: { id: string; text: string }[];
  explanation: string | null;
  domain: QuestionClassification | null;
  skill: QuestionClassification | null;
  activeDurationMs: number | null;
  errorLogId: string | null;
}

export interface ModulePerformance extends OutcomeSummary, QuestionModule {}

export interface SkillPerformance extends OutcomeSummary, QuestionClassification {}

export interface DomainPerformance extends OutcomeSummary, QuestionClassification {
  skills: SkillPerformance[];
}

export interface ScoreReportData {
  submissionId: number;
  examTitle: string;
  subject: 'RW' | 'MATH';
  mode: 'PRACTICE' | 'EXAM';
  attemptNo: number;
  date: string;
  startedAt: string;
  completedAt: string | null;
  duration: string;
  elapsedDurationMs: number | null;
  activeDurationMs: number | null;
  summary: OutcomeSummary;
  modules: ModulePerformance[];
  domains: DomainPerformance[];
  pacing: {
    activeDurationMs: number | null;
    averageActiveDurationMs: number | null;
    timedQuestions: number;
    totalQuestions: number;
    timingCoverage: number | null;
    slowestQuestion: {
      id: number | string;
      questionNumber: number;
      moduleOrder: number;
      activeDurationMs: number;
    } | null;
  };
  classificationCoverage: {
    classified: number;
    total: number;
    percentage: number | null;
  };
  solutionsLocked?: boolean;
  solutionAvailableAt?: string | null;
  questions: QuestionResult[];
}
