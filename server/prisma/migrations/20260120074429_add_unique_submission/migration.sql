/*
  Warnings:

  - A unique constraint covering the columns `[studentId,assignmentId]` on the table `HomeworkSubmission` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "HomeworkSubmission_studentId_assignmentId_key" ON "HomeworkSubmission"("studentId", "assignmentId");
