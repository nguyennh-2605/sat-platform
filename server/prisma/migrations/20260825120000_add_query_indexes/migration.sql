CREATE INDEX "Class_teacherId_createdAt_idx" ON "Class"("teacherId", "createdAt");
CREATE INDEX "Test_authorId_id_idx" ON "Test"("authorId", "id");
CREATE INDEX "Test_isPublic_id_idx" ON "Test"("isPublic", "id");
CREATE INDEX "Submission_userId_startedAt_idx" ON "Submission"("userId", "startedAt");
CREATE INDEX "Submission_testId_status_idx" ON "Submission"("testId", "status");
CREATE INDEX "ErrorLog_userId_createdAt_idx" ON "ErrorLog"("userId", "createdAt");
CREATE INDEX "Notification_userId_createdAt_idx" ON "Notification"("userId", "createdAt");
