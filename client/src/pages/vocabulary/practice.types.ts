export type PracticeFocus = 'MIXED' | 'REVIEW' | 'NEW';
export interface PracticeOverview {
  dueCount: number;
  newCount: number;
  scheduledCount: number;
  studiedToday: number;
  dailyReviewLimit: number;
  dailyNewLimit: number;
  nextDueAt: string | null;
  activeSession: { id: string; answeredCount: number; totalItems: number } | null;
}
export interface PracticeQuestion {
  id: string;
  prompt: string;
  options: string[];
  selectedMeaning?: string | null;
  isCorrect?: boolean | null;
  meaning?: string;
  translation?: string;
  nextDueAt?: string | null;
  dictionaryDefinition?: boolean;
}
export interface DailySession {
  id: string;
  isDaily: boolean;
  status: 'IN_PROGRESS' | 'COMPLETED';
  totalItems: number;
  answeredCount: number;
  correctCount: number;
  questions: PracticeQuestion[];
}
export function vocabularyError(error: unknown, fallback: string) {
  const data = (error as { response?: { data?: { error?: string; message?: string } } })?.response?.data;
  return data?.error || data?.message || fallback;
}
export function formatNextReview(date: string) {
  const target = new Date(date);
  if (target.getTime() <= Date.now()) return 'Ready to review';
  return target.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}
