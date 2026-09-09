CREATE TYPE "ErrorLogRootCause" AS ENUM (
  'KNOWLEDGE_GAP',
  'MISREAD_QUESTION',
  'MISREAD_PASSAGE',
  'WRONG_REASONING',
  'CARELESS_MISTAKE',
  'TIME_PRESSURE',
  'CALCULATION_ERROR',
  'GUESSED'
);

ALTER TABLE "ErrorLog"
ADD COLUMN "whyChosen" TEXT,
ADD COLUMN "takeaway" TEXT,
ADD COLUMN "rootCause" "ErrorLogRootCause",
ADD COLUMN "reviewedAt" TIMESTAMP(3),
ADD COLUMN "submissionId" INTEGER,
ADD COLUMN "questionId" INTEGER;

CREATE INDEX "ErrorLog_userId_reviewedAt_createdAt_idx"
ON "ErrorLog"("userId", "reviewedAt", "createdAt");

CREATE UNIQUE INDEX "ErrorLog_userId_submissionId_questionId_key"
ON "ErrorLog"("userId", "submissionId", "questionId");

ALTER TABLE "ErrorLog"
ADD CONSTRAINT "ErrorLog_submissionId_fkey"
FOREIGN KEY ("submissionId") REFERENCES "Submission"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ErrorLog"
ADD CONSTRAINT "ErrorLog_questionId_fkey"
FOREIGN KEY ("questionId") REFERENCES "Question"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
