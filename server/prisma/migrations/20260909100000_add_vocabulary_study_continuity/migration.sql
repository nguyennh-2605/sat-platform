ALTER TABLE "VocabularyStudySession"
ADD COLUMN "rangeStart" INTEGER,
ADD COLUMN "rangeEnd" INTEGER,
ADD COLUMN "shuffle" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "lastActivityAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "VocabularySessionQuestion"
ADD COLUMN "sourceOrder" INTEGER;

CREATE INDEX "VocabularyStudySession_userId_setId_mode_status_lastActivityAt_idx"
ON "VocabularyStudySession"("userId", "setId", "mode", "status", "lastActivityAt");
