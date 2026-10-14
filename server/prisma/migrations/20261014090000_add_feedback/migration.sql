-- CreateEnum
CREATE TYPE "FeedbackLevel" AS ENUM ('CRITICAL', 'MAJOR', 'MINOR', 'IMPROVEMENT', 'GENERAL');

-- CreateEnum
CREATE TYPE "FeedbackStatus" AS ENUM ('NEW', 'IN_PROGRESS', 'RESOLVED');

-- AlterEnum
ALTER TYPE "FileAssetPurpose" ADD VALUE 'FEEDBACK_IMAGE';

-- CreateTable
CREATE TABLE "Feedback" (
    "id" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "level" "FeedbackLevel" NOT NULL,
    "message" VARCHAR(5000) NOT NULL,
    "pagePath" VARCHAR(500),
    "status" "FeedbackStatus" NOT NULL DEFAULT 'NEW',
    "reviewedById" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Feedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeedbackAttachment" (
    "feedbackId" TEXT NOT NULL,
    "fileAssetId" TEXT NOT NULL,

    CONSTRAINT "FeedbackAttachment_pkey" PRIMARY KEY ("feedbackId","fileAssetId")
);

-- CreateIndex
CREATE INDEX "Feedback_status_createdAt_id_idx" ON "Feedback"("status", "createdAt", "id");

-- CreateIndex
CREATE INDEX "Feedback_level_createdAt_id_idx" ON "Feedback"("level", "createdAt", "id");

-- CreateIndex
CREATE INDEX "Feedback_createdAt_id_idx" ON "Feedback"("createdAt", "id");

-- CreateIndex
CREATE INDEX "Feedback_userId_createdAt_idx" ON "Feedback"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "FeedbackAttachment_fileAssetId_key" ON "FeedbackAttachment"("fileAssetId");

-- AddForeignKey
ALTER TABLE "Feedback" ADD CONSTRAINT "Feedback_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Feedback" ADD CONSTRAINT "Feedback_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeedbackAttachment" ADD CONSTRAINT "FeedbackAttachment_feedbackId_fkey" FOREIGN KEY ("feedbackId") REFERENCES "Feedback"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeedbackAttachment" ADD CONSTRAINT "FeedbackAttachment_fileAssetId_fkey" FOREIGN KEY ("fileAssetId") REFERENCES "FileAsset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

