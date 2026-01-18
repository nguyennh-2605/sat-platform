/*
  Warnings:

  - You are about to drop the column `passage` on the `Question` table. All the data in the column will be lost.
  - You are about to drop the column `text` on the `Question` table. All the data in the column will be lost.
  - Added the required column `blocks` to the `Question` table without a default value. This is not possible if the table is not empty.
  - Added the required column `questionText` to the `Question` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Question" DROP COLUMN "passage",
DROP COLUMN "text",
ADD COLUMN     "blocks" JSONB NOT NULL,
ADD COLUMN     "questionText" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Submission" ADD COLUMN     "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'DOING';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "avatar" TEXT,
ALTER COLUMN "password" DROP NOT NULL;
