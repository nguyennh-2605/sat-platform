/*
  Warnings:

  - You are about to drop the column `type` on the `Test` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "TestCategory" AS ENUM ('REAL', 'CLASS', 'PRACTICE');

-- CreateEnum
CREATE TYPE "TestSubject" AS ENUM ('RW', 'MATH');

-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'ADMIN';

-- AlterTable
ALTER TABLE "Test" DROP COLUMN "type",
ADD COLUMN     "authorId" INTEGER,
ADD COLUMN     "category" "TestCategory" NOT NULL DEFAULT 'PRACTICE',
ADD COLUMN     "isPublic" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "subject" "TestSubject" NOT NULL DEFAULT 'RW',
ADD COLUMN     "testDate" TEXT;

-- CreateTable
CREATE TABLE "ClassTest" (
    "id" SERIAL NOT NULL,
    "classId" TEXT NOT NULL,
    "testId" INTEGER NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dueDate" TIMESTAMP(3),
    "isHidden" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "ClassTest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ClassTest_classId_testId_key" ON "ClassTest"("classId", "testId");

-- AddForeignKey
ALTER TABLE "Test" ADD CONSTRAINT "Test_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassTest" ADD CONSTRAINT "ClassTest_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassTest" ADD CONSTRAINT "ClassTest_testId_fkey" FOREIGN KEY ("testId") REFERENCES "Test"("id") ON DELETE CASCADE ON UPDATE CASCADE;
