/*
  Warnings:

  - The values [PAUSED] on the enum `SubmissionStatus` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the `Passage` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "QuestionType" AS ENUM ('MCQ', 'SPR');

-- AlterEnum
BEGIN;
CREATE TYPE "SubmissionStatus_new" AS ENUM ('DOING', 'COMPLETED');
ALTER TABLE "Submission" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Submission" ALTER COLUMN "status" TYPE "SubmissionStatus_new" USING ("status"::text::"SubmissionStatus_new");
ALTER TYPE "SubmissionStatus" RENAME TO "SubmissionStatus_old";
ALTER TYPE "SubmissionStatus_new" RENAME TO "SubmissionStatus";
DROP TYPE "SubmissionStatus_old";
ALTER TABLE "Submission" ALTER COLUMN "status" SET DEFAULT 'DOING';
COMMIT;

-- AlterTable
ALTER TABLE "Question" ADD COLUMN     "type" "QuestionType" NOT NULL DEFAULT 'MCQ';

-- DropTable
DROP TABLE "Passage";
