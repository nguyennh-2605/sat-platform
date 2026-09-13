import type { ContentBlock } from '../../types/quiz';
type ReviewStatus = 'ALL' | 'NEEDS_REVIEW' | 'REVIEWED';

interface ErrorQuestion {
  type: 'MCQ' | 'SPR';
  blocks: ContentBlock[];
  questionText: string;
  choices: Array<{ id: string; text: string } | string>;
  explanation?: string | null;
  order: number;
  section?: {
    name?: string;
    order?: number;
    test?: { title?: string; subject?: string };
  };
}

interface ErrorEntry {
  id: string;
  version?: number;
  origin?: 'SYSTEM_QUESTION' | 'MANUAL';
  source: string | null;
  sourceUrl: string | null;
  category: string | null;
  userAnswer: string | null;
  correctAnswer: string | null;
  whyWrong: string | null;
  whyRight: string | null;
  reviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
  submissionId: number | null;
  questionId: number | null;
}

export type { ReviewStatus, ErrorEntry, ErrorQuestion };
