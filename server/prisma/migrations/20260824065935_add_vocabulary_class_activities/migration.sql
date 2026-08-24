-- CreateEnum
CREATE TYPE "VocabularySetScope" AS ENUM ('SYSTEM', 'PERSONAL');

-- CreateEnum
CREATE TYPE "VocabularySetStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "VocabularyMastery" AS ENUM ('NOT_STUDIED', 'LEARNING', 'MASTERED');

-- CreateEnum
CREATE TYPE "VocabularyStudyMode" AS ENUM ('FLASHCARD', 'QUIZ');

-- CreateEnum
CREATE TYPE "VocabularySessionStatus" AS ENUM ('IN_PROGRESS', 'COMPLETED');

-- CreateEnum
CREATE TYPE "ClassActivityType" AS ENUM ('TEST', 'VOCABULARY', 'HOMEWORK', 'RESOURCE');

-- CreateEnum
CREATE TYPE "ActivityCompletionRule" AS ENUM ('VIEW_ALL', 'SUBMIT', 'SCORE_AT_LEAST', 'MANUAL');

-- CreateEnum
CREATE TYPE "ActivityAudience" AS ENUM ('ALL_STUDENTS', 'SELECTED');

-- CreateEnum
CREATE TYPE "ActivityAssigneeStatus" AS ENUM ('ASSIGNED', 'IN_PROGRESS', 'COMPLETED', 'MISSING', 'EXCUSED');

-- CreateTable
CREATE TABLE "VocabularySet" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "scope" "VocabularySetScope" NOT NULL,
    "status" "VocabularySetStatus" NOT NULL DEFAULT 'DRAFT',
    "sourceLanguage" TEXT NOT NULL DEFAULT 'en',
    "translationLanguage" TEXT NOT NULL DEFAULT 'vi',
    "version" INTEGER NOT NULL DEFAULT 1,
    "ownerId" INTEGER,
    "createdById" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "publishedAt" TIMESTAMP(3),

    CONSTRAINT "VocabularySet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VocabularyTerm" (
    "id" TEXT NOT NULL,
    "setId" TEXT NOT NULL,
    "word" TEXT NOT NULL,
    "normalizedWord" TEXT NOT NULL,
    "meaning" TEXT NOT NULL,
    "translation" TEXT NOT NULL,
    "exampleSentence" TEXT,
    "order" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VocabularyTerm_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VocabularyTermProgress" (
    "userId" INTEGER NOT NULL,
    "termId" TEXT NOT NULL,
    "mastery" "VocabularyMastery" NOT NULL DEFAULT 'NOT_STUDIED',
    "seenCount" INTEGER NOT NULL DEFAULT 0,
    "correctCount" INTEGER NOT NULL DEFAULT 0,
    "incorrectCount" INTEGER NOT NULL DEFAULT 0,
    "lastReviewedAt" TIMESTAMP(3),

    CONSTRAINT "VocabularyTermProgress_pkey" PRIMARY KEY ("userId","termId")
);

-- CreateTable
CREATE TABLE "ClassActivity" (
    "id" TEXT NOT NULL,
    "type" "ClassActivityType" NOT NULL,
    "status" "DeliveryStatus" NOT NULL DEFAULT 'DRAFT',
    "classId" TEXT NOT NULL,
    "lessonId" TEXT,
    "title" TEXT NOT NULL,
    "instructions" TEXT,
    "availableAt" TIMESTAMP(3),
    "dueAt" TIMESTAMP(3),
    "maxAttempts" INTEGER NOT NULL DEFAULT 1,
    "scorePolicy" "ScorePolicy" NOT NULL DEFAULT 'FIRST',
    "completionRule" "ActivityCompletionRule" NOT NULL DEFAULT 'SUBMIT',
    "passingScore" INTEGER,
    "audience" "ActivityAudience" NOT NULL DEFAULT 'ALL_STUDENTS',
    "createdById" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClassActivity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActivityAssignee" (
    "activityId" TEXT NOT NULL,
    "studentId" INTEGER NOT NULL,
    "status" "ActivityAssigneeStatus" NOT NULL DEFAULT 'ASSIGNED',
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "bestScore" INTEGER,
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "excusedAt" TIMESTAMP(3),

    CONSTRAINT "ActivityAssignee_pkey" PRIMARY KEY ("activityId","studentId")
);

-- CreateTable
CREATE TABLE "VocabularyActivity" (
    "activityId" TEXT NOT NULL,
    "vocabularySetId" TEXT NOT NULL,
    "sourceSetVersion" INTEGER NOT NULL,
    "questionCount" INTEGER,

    CONSTRAINT "VocabularyActivity_pkey" PRIMARY KEY ("activityId")
);

-- CreateTable
CREATE TABLE "VocabularyActivityItem" (
    "id" TEXT NOT NULL,
    "activityId" TEXT NOT NULL,
    "sourceTermId" TEXT,
    "word" TEXT NOT NULL,
    "meaning" TEXT NOT NULL,
    "translation" TEXT NOT NULL,
    "exampleSentence" TEXT,
    "order" INTEGER NOT NULL,

    CONSTRAINT "VocabularyActivityItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VocabularyStudySession" (
    "id" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "setId" TEXT NOT NULL,
    "activityId" TEXT,
    "mode" "VocabularyStudyMode" NOT NULL,
    "status" "VocabularySessionStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "totalItems" INTEGER NOT NULL,
    "correctCount" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "VocabularyStudySession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VocabularySessionQuestion" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "sourceTermId" TEXT,
    "prompt" TEXT NOT NULL,
    "correctMeaning" TEXT NOT NULL,
    "translation" TEXT NOT NULL,
    "exampleSentence" TEXT,
    "options" JSONB NOT NULL,
    "order" INTEGER NOT NULL,
    "selectedMeaning" TEXT,
    "isCorrect" BOOLEAN,
    "answeredAt" TIMESTAMP(3),

    CONSTRAINT "VocabularySessionQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VocabularySet_scope_status_publishedAt_idx" ON "VocabularySet"("scope", "status", "publishedAt");

-- CreateIndex
CREATE INDEX "VocabularySet_ownerId_updatedAt_idx" ON "VocabularySet"("ownerId", "updatedAt");

-- CreateIndex
CREATE INDEX "VocabularyTerm_normalizedWord_idx" ON "VocabularyTerm"("normalizedWord");

-- CreateIndex
CREATE UNIQUE INDEX "VocabularyTerm_setId_normalizedWord_key" ON "VocabularyTerm"("setId", "normalizedWord");

-- CreateIndex
CREATE UNIQUE INDEX "VocabularyTerm_setId_order_key" ON "VocabularyTerm"("setId", "order");

-- CreateIndex
CREATE INDEX "VocabularyTermProgress_userId_mastery_idx" ON "VocabularyTermProgress"("userId", "mastery");

-- CreateIndex
CREATE INDEX "ClassActivity_classId_status_dueAt_idx" ON "ClassActivity"("classId", "status", "dueAt");

-- CreateIndex
CREATE INDEX "ClassActivity_lessonId_idx" ON "ClassActivity"("lessonId");

-- CreateIndex
CREATE INDEX "ActivityAssignee_studentId_status_idx" ON "ActivityAssignee"("studentId", "status");

-- CreateIndex
CREATE INDEX "VocabularyActivityItem_sourceTermId_idx" ON "VocabularyActivityItem"("sourceTermId");

-- CreateIndex
CREATE UNIQUE INDEX "VocabularyActivityItem_activityId_order_key" ON "VocabularyActivityItem"("activityId", "order");

-- CreateIndex
CREATE INDEX "VocabularyStudySession_userId_status_startedAt_idx" ON "VocabularyStudySession"("userId", "status", "startedAt");

-- CreateIndex
CREATE INDEX "VocabularyStudySession_activityId_userId_idx" ON "VocabularyStudySession"("activityId", "userId");

-- CreateIndex
CREATE INDEX "VocabularySessionQuestion_sourceTermId_idx" ON "VocabularySessionQuestion"("sourceTermId");

-- CreateIndex
CREATE UNIQUE INDEX "VocabularySessionQuestion_sessionId_order_key" ON "VocabularySessionQuestion"("sessionId", "order");

-- AddForeignKey
ALTER TABLE "VocabularySet" ADD CONSTRAINT "VocabularySet_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VocabularySet" ADD CONSTRAINT "VocabularySet_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VocabularyTerm" ADD CONSTRAINT "VocabularyTerm_setId_fkey" FOREIGN KEY ("setId") REFERENCES "VocabularySet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VocabularyTermProgress" ADD CONSTRAINT "VocabularyTermProgress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VocabularyTermProgress" ADD CONSTRAINT "VocabularyTermProgress_termId_fkey" FOREIGN KEY ("termId") REFERENCES "VocabularyTerm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassActivity" ADD CONSTRAINT "ClassActivity_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassActivity" ADD CONSTRAINT "ClassActivity_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassActivity" ADD CONSTRAINT "ClassActivity_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityAssignee" ADD CONSTRAINT "ActivityAssignee_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "ClassActivity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityAssignee" ADD CONSTRAINT "ActivityAssignee_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VocabularyActivity" ADD CONSTRAINT "VocabularyActivity_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "ClassActivity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VocabularyActivity" ADD CONSTRAINT "VocabularyActivity_vocabularySetId_fkey" FOREIGN KEY ("vocabularySetId") REFERENCES "VocabularySet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VocabularyActivityItem" ADD CONSTRAINT "VocabularyActivityItem_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "VocabularyActivity"("activityId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VocabularyActivityItem" ADD CONSTRAINT "VocabularyActivityItem_sourceTermId_fkey" FOREIGN KEY ("sourceTermId") REFERENCES "VocabularyTerm"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VocabularyStudySession" ADD CONSTRAINT "VocabularyStudySession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VocabularyStudySession" ADD CONSTRAINT "VocabularyStudySession_setId_fkey" FOREIGN KEY ("setId") REFERENCES "VocabularySet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VocabularyStudySession" ADD CONSTRAINT "VocabularyStudySession_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "ClassActivity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VocabularySessionQuestion" ADD CONSTRAINT "VocabularySessionQuestion_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "VocabularyStudySession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VocabularySessionQuestion" ADD CONSTRAINT "VocabularySessionQuestion_sourceTermId_fkey" FOREIGN KEY ("sourceTermId") REFERENCES "VocabularyTerm"("id") ON DELETE SET NULL ON UPDATE CASCADE;
