-- Keep classroom feeds and assignment review queues index-backed as their
-- activity and submission histories grow.
CREATE INDEX "Assignment_classId_createdAt_idx"
ON "Assignment"("classId", "createdAt");

CREATE INDEX "HomeworkSubmission_assignmentId_status_submittedAt_idx"
ON "HomeworkSubmission"("assignmentId", "status", "submittedAt");

CREATE INDEX "ClassActivity_classId_createdAt_idx"
ON "ClassActivity"("classId", "createdAt");
