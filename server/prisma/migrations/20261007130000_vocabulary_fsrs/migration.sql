-- Add scheduling alongside existing progress; no learner records are rewritten.
ALTER TABLE "VocabularySet" ADD COLUMN "autoKey" VARCHAR(40);
CREATE UNIQUE INDEX "VocabularySet_ownerId_autoKey_key" ON "VocabularySet"("ownerId", "autoKey");
ALTER TABLE "VocabularyTerm" ADD COLUMN "dictionaryDefinition" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "VocabularySessionQuestion" ADD COLUMN "dictionaryDefinition" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "VocabularyTermProgress"
  ADD COLUMN "dueAt" TIMESTAMP(3),
  ADD COLUMN "fsrsStability" DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN "fsrsDifficulty" DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN "fsrsState" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "fsrsReps" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "fsrsLapses" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "fsrsLearningSteps" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "fsrsScheduledDays" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "fsrsElapsedDays" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "fsrsLastReview" TIMESTAMP(3);
CREATE INDEX "VocabularyTermProgress_userId_dueAt_idx" ON "VocabularyTermProgress"("userId", "dueAt");
ALTER TABLE "VocabularyStudySession" ALTER COLUMN "setId" DROP NOT NULL;
ALTER TABLE "VocabularyStudySession" ADD COLUMN "isDaily" BOOLEAN NOT NULL DEFAULT false;
CREATE TABLE "VocabularyReviewLog" (
  "id" TEXT NOT NULL,
  "userId" INTEGER NOT NULL,
  "termId" TEXT NOT NULL,
  "questionId" TEXT,
  "rating" INTEGER NOT NULL,
  "reviewedAt" TIMESTAMP(3) NOT NULL,
  "nextDueAt" TIMESTAMP(3) NOT NULL,
  "previousState" JSONB NOT NULL,
  "nextState" JSONB NOT NULL,
  CONSTRAINT "VocabularyReviewLog_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "VocabularyReviewLog_rating_check" CHECK ("rating" BETWEEN 1 AND 4)
);
CREATE UNIQUE INDEX "VocabularyReviewLog_questionId_key" ON "VocabularyReviewLog"("questionId");
CREATE INDEX "VocabularyReviewLog_userId_reviewedAt_idx" ON "VocabularyReviewLog"("userId", "reviewedAt");
CREATE INDEX "VocabularyReviewLog_userId_termId_reviewedAt_idx" ON "VocabularyReviewLog"("userId", "termId", "reviewedAt");
ALTER TABLE "VocabularyReviewLog" ADD CONSTRAINT "VocabularyReviewLog_userId_termId_fkey" FOREIGN KEY ("userId", "termId") REFERENCES "VocabularyTermProgress"("userId", "termId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VocabularyReviewLog" ADD CONSTRAINT "VocabularyReviewLog_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "VocabularySessionQuestion"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "VocabularyStudySession_daily_active_idx" ON "VocabularyStudySession"("userId", "isDaily", "status", "lastActivityAt");
