CREATE TYPE "QuestionBankScope" AS ENUM ('SYSTEM', 'PERSONAL');
CREATE TYPE "QuestionBankStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');
CREATE TYPE "QuestionBankDifficulty" AS ENUM ('EASY', 'MEDIUM', 'HARD');
CREATE TYPE "RoadmapStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

ALTER TABLE "Test" ADD COLUMN "isDiscoverable" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Question" ADD COLUMN "sourceBankQuestionId" TEXT;
ALTER TABLE "Question" ADD COLUMN "sourceBankVersionId" TEXT;

CREATE TABLE "QuestionBankItem" (
    "id" TEXT NOT NULL,
    "ownerId" INTEGER NOT NULL,
    "scope" "QuestionBankScope" NOT NULL,
    "status" "QuestionBankStatus" NOT NULL DEFAULT 'DRAFT',
    "subject" "TestSubject" NOT NULL,
    "type" "QuestionType" NOT NULL DEFAULT 'MCQ',
    "difficulty" "QuestionBankDifficulty" NOT NULL DEFAULT 'MEDIUM',
    "domainCode" TEXT NOT NULL,
    "skillCode" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "QuestionBankItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "QuestionBankVersion" (
    "id" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "blocks" JSONB NOT NULL,
    "questionText" TEXT NOT NULL,
    "choices" JSONB NOT NULL,
    "correctAnswer" TEXT NOT NULL,
    "explanation" TEXT,
    "createdById" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "QuestionBankVersion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "StudentBankQuestionProgress" (
    "userId" INTEGER NOT NULL,
    "questionId" TEXT NOT NULL,
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "correctCount" INTEGER NOT NULL DEFAULT 0,
    "bestCorrect" BOOLEAN NOT NULL DEFAULT false,
    "lastCorrect" BOOLEAN,
    "firstAttemptAt" TIMESTAMP(3),
    "lastAttemptAt" TIMESTAMP(3),
    CONSTRAINT "StudentBankQuestionProgress_pkey" PRIMARY KEY ("userId", "questionId")
);

CREATE TABLE "Roadmap" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "RoadmapStatus" NOT NULL DEFAULT 'DRAFT',
    "createdById" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Roadmap_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RoadmapMilestone" (
    "id" TEXT NOT NULL,
    "roadmapId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "order" INTEGER NOT NULL,
    "theoryBlocks" JSONB NOT NULL,
    "requiredQuestionCount" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "RoadmapMilestone_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MilestoneSkill" (
    "milestoneId" TEXT NOT NULL,
    "skillCode" TEXT NOT NULL,
    CONSTRAINT "MilestoneSkill_pkey" PRIMARY KEY ("milestoneId", "skillCode")
);

CREATE TABLE "StudentMilestoneProgress" (
    "userId" INTEGER NOT NULL,
    "milestoneId" TEXT NOT NULL,
    "theoryConfirmedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "StudentMilestoneProgress_pkey" PRIMARY KEY ("userId", "milestoneId")
);

CREATE TABLE "BankQuestionAttempt" (
    "id" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "questionId" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "milestoneId" TEXT,
    "selectedChoice" TEXT,
    "isCorrect" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BankQuestionAttempt_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "QuestionBankVersion_questionId_version_key" ON "QuestionBankVersion"("questionId", "version");
CREATE UNIQUE INDEX "RoadmapMilestone_roadmapId_order_key" ON "RoadmapMilestone"("roadmapId", "order");
CREATE INDEX "QuestionBankItem_scope_status_subject_domainCode_skillCode_idx" ON "QuestionBankItem"("scope", "status", "subject", "domainCode", "skillCode");
CREATE INDEX "QuestionBankItem_ownerId_status_updatedAt_idx" ON "QuestionBankItem"("ownerId", "status", "updatedAt");
CREATE INDEX "QuestionBankVersion_questionId_createdAt_idx" ON "QuestionBankVersion"("questionId", "createdAt");
CREATE INDEX "StudentBankQuestionProgress_userId_lastAttemptAt_idx" ON "StudentBankQuestionProgress"("userId", "lastAttemptAt");
CREATE INDEX "Roadmap_status_updatedAt_idx" ON "Roadmap"("status", "updatedAt");
CREATE INDEX "RoadmapMilestone_roadmapId_order_idx" ON "RoadmapMilestone"("roadmapId", "order");
CREATE INDEX "MilestoneSkill_skillCode_idx" ON "MilestoneSkill"("skillCode");
CREATE INDEX "StudentMilestoneProgress_userId_completedAt_idx" ON "StudentMilestoneProgress"("userId", "completedAt");
CREATE INDEX "BankQuestionAttempt_userId_questionId_createdAt_idx" ON "BankQuestionAttempt"("userId", "questionId", "createdAt");
CREATE INDEX "BankQuestionAttempt_userId_milestoneId_createdAt_idx" ON "BankQuestionAttempt"("userId", "milestoneId", "createdAt");
CREATE INDEX "Question_sourceBankQuestionId_idx" ON "Question"("sourceBankQuestionId");
CREATE INDEX "Question_sourceBankVersionId_idx" ON "Question"("sourceBankVersionId");

ALTER TABLE "QuestionBankItem" ADD CONSTRAINT "QuestionBankItem_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "QuestionBankItem" ADD CONSTRAINT "QuestionBankItem_domainCode_fkey" FOREIGN KEY ("domainCode") REFERENCES "QuestionDomain"("code") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "QuestionBankItem" ADD CONSTRAINT "QuestionBankItem_skillCode_fkey" FOREIGN KEY ("skillCode") REFERENCES "QuestionSkill"("code") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "QuestionBankVersion" ADD CONSTRAINT "QuestionBankVersion_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "QuestionBankItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "QuestionBankVersion" ADD CONSTRAINT "QuestionBankVersion_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Question" ADD CONSTRAINT "Question_sourceBankQuestionId_fkey" FOREIGN KEY ("sourceBankQuestionId") REFERENCES "QuestionBankItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Question" ADD CONSTRAINT "Question_sourceBankVersionId_fkey" FOREIGN KEY ("sourceBankVersionId") REFERENCES "QuestionBankVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "StudentBankQuestionProgress" ADD CONSTRAINT "StudentBankQuestionProgress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StudentBankQuestionProgress" ADD CONSTRAINT "StudentBankQuestionProgress_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "QuestionBankItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Roadmap" ADD CONSTRAINT "Roadmap_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RoadmapMilestone" ADD CONSTRAINT "RoadmapMilestone_roadmapId_fkey" FOREIGN KEY ("roadmapId") REFERENCES "Roadmap"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MilestoneSkill" ADD CONSTRAINT "MilestoneSkill_milestoneId_fkey" FOREIGN KEY ("milestoneId") REFERENCES "RoadmapMilestone"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MilestoneSkill" ADD CONSTRAINT "MilestoneSkill_skillCode_fkey" FOREIGN KEY ("skillCode") REFERENCES "QuestionSkill"("code") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StudentMilestoneProgress" ADD CONSTRAINT "StudentMilestoneProgress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StudentMilestoneProgress" ADD CONSTRAINT "StudentMilestoneProgress_milestoneId_fkey" FOREIGN KEY ("milestoneId") REFERENCES "RoadmapMilestone"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BankQuestionAttempt" ADD CONSTRAINT "BankQuestionAttempt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BankQuestionAttempt" ADD CONSTRAINT "BankQuestionAttempt_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "QuestionBankItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BankQuestionAttempt" ADD CONSTRAINT "BankQuestionAttempt_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "QuestionBankVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BankQuestionAttempt" ADD CONSTRAINT "BankQuestionAttempt_milestoneId_fkey" FOREIGN KEY ("milestoneId") REFERENCES "RoadmapMilestone"("id") ON DELETE SET NULL ON UPDATE CASCADE;
