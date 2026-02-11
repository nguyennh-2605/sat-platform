/*
  Warnings:

  - You are about to drop the column `startTime` on the `Submission` table. All the data in the column will be lost.
  - You are about to drop the column `submitReason` on the `Submission` table. All the data in the column will be lost.
  - You are about to drop the column `terminated` on the `Submission` table. All the data in the column will be lost.
  - The `status` column on the `Submission` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- CreateEnum
CREATE TYPE "SubmissionStatus" AS ENUM ('DOING', 'PAUSED', 'COMPLETED');

-- AlterTable
ALTER TABLE "Submission" DROP COLUMN "startTime",
DROP COLUMN "submitReason",
DROP COLUMN "terminated",
ADD COLUMN     "currentQuestionIndex" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "savedAnswers" JSONB,
ADD COLUMN     "timeRemaining" INTEGER,
DROP COLUMN "status",
ADD COLUMN     "status" "SubmissionStatus" NOT NULL DEFAULT 'DOING';
