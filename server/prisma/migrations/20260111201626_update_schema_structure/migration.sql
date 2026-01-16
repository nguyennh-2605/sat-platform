/*
  Warnings:

  - You are about to drop the column `name` on the `Test` table. All the data in the column will be lost.
  - You are about to drop the column `totalDuration` on the `Test` table. All the data in the column will be lost.
  - The `role` column on the `User` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - Added the required column `title` to the `Test` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Submission" ADD COLUMN     "submitReason" TEXT;

-- AlterTable
ALTER TABLE "Test" DROP COLUMN "name",
DROP COLUMN "totalDuration",
ADD COLUMN     "description" TEXT,
ADD COLUMN     "duration" INTEGER NOT NULL DEFAULT 1920,
ADD COLUMN     "title" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "User" DROP COLUMN "role",
ADD COLUMN     "role" "Role" NOT NULL DEFAULT 'STUDENT';

-- AddForeignKey
ALTER TABLE "Answer" ADD CONSTRAINT "Answer_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
