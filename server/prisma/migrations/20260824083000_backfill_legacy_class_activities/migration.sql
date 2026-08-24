-- Adapter tables let the new LMS activity layer coexist with legacy tests and homework.
CREATE TABLE "TestActivity" (
    "activityId" TEXT NOT NULL,
    "testDeliveryId" TEXT NOT NULL,
    CONSTRAINT "TestActivity_pkey" PRIMARY KEY ("activityId")
);

CREATE TABLE "HomeworkActivity" (
    "activityId" TEXT NOT NULL,
    "assignmentId" TEXT NOT NULL,
    CONSTRAINT "HomeworkActivity_pkey" PRIMARY KEY ("activityId")
);

CREATE UNIQUE INDEX "TestActivity_testDeliveryId_key" ON "TestActivity"("testDeliveryId");
CREATE UNIQUE INDEX "HomeworkActivity_assignmentId_key" ON "HomeworkActivity"("assignmentId");

ALTER TABLE "TestActivity" ADD CONSTRAINT "TestActivity_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "ClassActivity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TestActivity" ADD CONSTRAINT "TestActivity_testDeliveryId_fkey" FOREIGN KEY ("testDeliveryId") REFERENCES "TestDelivery"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "HomeworkActivity" ADD CONSTRAINT "HomeworkActivity_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "ClassActivity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "HomeworkActivity" ADD CONSTRAINT "HomeworkActivity_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "Assignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Preserve every published/draft test delivery as a canonical TEST activity.
INSERT INTO "ClassActivity" (
  "id", "type", "status", "classId", "lessonId", "title", "instructions",
  "availableAt", "dueAt", "maxAttempts", "scorePolicy", "completionRule",
  "passingScore", "audience", "createdById", "createdAt", "updatedAt"
)
SELECT
  'test-delivery:' || delivery."id", 'TEST'::"ClassActivityType", delivery."status",
  delivery."classId", delivery."lessonId", delivery."title", NULL,
  delivery."availableAt", delivery."dueAt", delivery."maxAttempts", delivery."scorePolicy",
  'SUBMIT'::"ActivityCompletionRule", NULL, 'ALL_STUDENTS'::"ActivityAudience",
  delivery."createdById", delivery."createdAt", CURRENT_TIMESTAMP
FROM "TestDelivery" delivery
ON CONFLICT ("id") DO NOTHING;

INSERT INTO "TestActivity" ("activityId", "testDeliveryId")
SELECT 'test-delivery:' || delivery."id", delivery."id"
FROM "TestDelivery" delivery
ON CONFLICT ("activityId") DO NOTHING;

INSERT INTO "ActivityAssignee" (
  "activityId", "studentId", "status", "assignedAt", "startedAt", "completedAt",
  "bestScore", "attemptCount", "excusedAt"
)
SELECT
  'test-delivery:' || assignee."deliveryId",
  assignee."studentId",
  CASE
    WHEN assignee."excusedAt" IS NOT NULL THEN 'EXCUSED'::"ActivityAssigneeStatus"
    WHEN BOOL_OR(submission."status" = 'COMPLETED') THEN 'COMPLETED'::"ActivityAssigneeStatus"
    WHEN COUNT(submission."id") > 0 THEN 'IN_PROGRESS'::"ActivityAssigneeStatus"
    ELSE 'ASSIGNED'::"ActivityAssigneeStatus"
  END,
  assignee."assignedAt",
  MIN(COALESCE(submission."beganAt", submission."startedAt")),
  MAX(CASE WHEN submission."status" = 'COMPLETED' THEN submission."endTime" END),
  MAX(CASE WHEN submission."status" = 'COMPLETED' THEN submission."score" END),
  COUNT(submission."id")::INTEGER,
  assignee."excusedAt"
FROM "DeliveryAssignee" assignee
LEFT JOIN "Submission" submission
  ON submission."deliveryId" = assignee."deliveryId" AND submission."userId" = assignee."studentId"
GROUP BY assignee."deliveryId", assignee."studentId", assignee."assignedAt", assignee."excusedAt"
ON CONFLICT ("activityId", "studentId") DO NOTHING;

-- Legacy non-announcement assignments remain operational while becoming HOMEWORK activities.
INSERT INTO "ClassActivity" (
  "id", "type", "status", "classId", "lessonId", "title", "instructions",
  "availableAt", "dueAt", "maxAttempts", "scorePolicy", "completionRule",
  "passingScore", "audience", "createdById", "createdAt", "updatedAt"
)
SELECT
  'homework:' || assignment."id", 'HOMEWORK'::"ClassActivityType", 'PUBLISHED'::"DeliveryStatus",
  assignment."classId", NULL, assignment."title", assignment."content",
  NULL, assignment."deadline", 1, 'FIRST'::"ScorePolicy", 'SUBMIT'::"ActivityCompletionRule",
  NULL, 'ALL_STUDENTS'::"ActivityAudience", classroom."teacherId", assignment."createdAt", CURRENT_TIMESTAMP
FROM "Assignment" assignment
JOIN "Class" classroom ON classroom."id" = assignment."classId"
WHERE LOWER(COALESCE(assignment."type", 'assignment')) <> 'announcement'
ON CONFLICT ("id") DO NOTHING;

INSERT INTO "HomeworkActivity" ("activityId", "assignmentId")
SELECT 'homework:' || assignment."id", assignment."id"
FROM "Assignment" assignment
WHERE LOWER(COALESCE(assignment."type", 'assignment')) <> 'announcement'
ON CONFLICT ("activityId") DO NOTHING;

INSERT INTO "ActivityAssignee" (
  "activityId", "studentId", "status", "assignedAt", "startedAt", "completedAt",
  "bestScore", "attemptCount", "excusedAt"
)
SELECT
  'homework:' || assignment."id",
  membership."B",
  CASE WHEN submission."id" IS NULL THEN 'ASSIGNED'::"ActivityAssigneeStatus" ELSE 'COMPLETED'::"ActivityAssigneeStatus" END,
  assignment."createdAt",
  submission."submittedAt",
  submission."submittedAt",
  CASE WHEN submission."score" IS NULL THEN NULL ELSE ROUND(submission."score")::INTEGER END,
  CASE WHEN submission."id" IS NULL THEN 0 ELSE 1 END,
  NULL
FROM "Assignment" assignment
JOIN "_StudentClasses" membership ON membership."A" = assignment."classId"
LEFT JOIN "HomeworkSubmission" submission ON submission."assignmentId" = assignment."id" AND submission."studentId" = membership."B"
WHERE LOWER(COALESCE(assignment."type", 'assignment')) <> 'announcement'
ON CONFLICT ("activityId", "studentId") DO NOTHING;
