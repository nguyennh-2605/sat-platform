CREATE TYPE "StudySessionStatus" AS ENUM ('RUNNING', 'PAUSED', 'COMPLETED', 'CANCELLED');
CREATE TYPE "StudySessionSource" AS ENUM ('FOCUS_CLOCK', 'TEST', 'VOCABULARY', 'HOMEWORK');
CREATE TYPE "StudyActivityType" AS ENUM ('PRACTICE', 'VOCABULARY', 'ERROR_LOG', 'HOMEWORK', 'OTHER');
CREATE TYPE "StudyResourceType" AS ENUM ('TEST', 'VOCABULARY_SET', 'ASSIGNMENT');

CREATE TABLE "StudySession" (
    "id" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "status" "StudySessionStatus" NOT NULL DEFAULT 'RUNNING',
    "source" "StudySessionSource" NOT NULL DEFAULT 'FOCUS_CLOCK',
    "activityType" "StudyActivityType" NOT NULL DEFAULT 'OTHER',
    "resourceType" "StudyResourceType",
    "resourceId" TEXT,
    "label" TEXT,
    "plannedDurationMs" INTEGER NOT NULL,
    "accumulatedMs" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastResumedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 1,
    "clientMutationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudySession_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "StudySession_userId_clientMutationId_key"
ON "StudySession"("userId", "clientMutationId");

CREATE UNIQUE INDEX "StudySession_one_active_per_user_key"
ON "StudySession"("userId")
WHERE "status" IN ('RUNNING', 'PAUSED');

CREATE INDEX "StudySession_userId_status_startedAt_idx"
ON "StudySession"("userId", "status", "startedAt");

CREATE INDEX "StudySession_userId_endedAt_idx"
ON "StudySession"("userId", "endedAt");

ALTER TABLE "StudySession"
ADD CONSTRAINT "StudySession_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
