import type { ContentBlock } from '@/types/quiz';

export type BankSubject = 'RW' | 'MATH';
export type BankQuestionType = 'MCQ' | 'SPR';
export type BankQuestionStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
export type BankQuestionDifficulty = 'EASY' | 'MEDIUM' | 'HARD';

export interface BankChoice { id: string; text: string }
export interface BankQuestion {
  id: string;
  ownerId: number;
  ownerName: string | null;
  scope: 'SYSTEM' | 'PERSONAL';
  status: BankQuestionStatus;
  subject: BankSubject;
  type: BankQuestionType;
  difficulty: BankQuestionDifficulty;
  domain: { code: string; name: string };
  skill: { code: string; name: string };
  versionId: string;
  version: number;
  blocks: ContentBlock[];
  questionText: string;
  choices: BankChoice[];
  correctAnswer?: string;
  explanation?: string | null;
  solutionLocked: boolean;
  progress?: { attemptCount: number; bestCorrect: boolean; lastCorrect: boolean | null } | null;
  createdAt: string;
  updatedAt: string;
}

export interface BankQuestionPage {
  items: BankQuestion[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}
