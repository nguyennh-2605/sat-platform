CREATE TYPE "DeliveryStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'CLOSED');
CREATE TYPE "ScorePolicy" AS ENUM ('FIRST', 'BEST', 'LATEST');

CREATE TABLE "TestDelivery" (
    "id" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "testId" INTEGER NOT NULL,
    "lessonId" TEXT,
    "title" TEXT NOT NULL,
    "availableAt" TIMESTAMP(3),
    "dueAt" TIMESTAMP(3),
    "maxAttempts" INTEGER NOT NULL DEFAULT 1,
    "scorePolicy" "ScorePolicy" NOT NULL DEFAULT 'FIRST',
    "status" "DeliveryStatus" NOT NULL DEFAULT 'PUBLISHED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" INTEGER NOT NULL,
    "legacyClassTestId" INTEGER,
    "sourceAssignmentId" TEXT,
    "sourceLessonAssignmentId" TEXT,
    CONSTRAINT "TestDelivery_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DeliveryAssignee" (
    "deliveryId" TEXT NOT NULL,
    "studentId" INTEGER NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "excusedAt" TIMESTAMP(3),
    CONSTRAINT "DeliveryAssignee_pkey" PRIMARY KEY ("deliveryId", "studentId")
);

CREATE TABLE "QuestionTiming" (
    "id" SERIAL NOT NULL,
    "submissionId" INTEGER NOT NULL,
    "questionId" INTEGER NOT NULL,
    "activeDurationMs" INTEGER NOT NULL,
    "visitCount" INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT "QuestionTiming_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Submission"
ADD COLUMN "deliveryId" TEXT,
ADD COLUMN "attemptNo" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN "questionTimingSnapshot" JSONB;

CREATE UNIQUE INDEX "TestDelivery_legacyClassTestId_key" ON "TestDelivery"("legacyClassTestId");
CREATE INDEX "TestDelivery_classId_dueAt_idx" ON "TestDelivery"("classId", "dueAt");
CREATE INDEX "TestDelivery_testId_idx" ON "TestDelivery"("testId");
CREATE INDEX "TestDelivery_sourceAssignmentId_testId_idx" ON "TestDelivery"("sourceAssignmentId", "testId");
CREATE INDEX "TestDelivery_sourceLessonAssignmentId_testId_idx" ON "TestDelivery"("sourceLessonAssignmentId", "testId");
CREATE INDEX "DeliveryAssignee_studentId_idx" ON "DeliveryAssignee"("studentId");
CREATE UNIQUE INDEX "QuestionTiming_submissionId_questionId_key" ON "QuestionTiming"("submissionId", "questionId");
CREATE INDEX "QuestionTiming_questionId_idx" ON "QuestionTiming"("questionId");

ALTER TABLE "TestDelivery" ADD CONSTRAINT "TestDelivery_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TestDelivery" ADD CONSTRAINT "TestDelivery_testId_fkey" FOREIGN KEY ("testId") REFERENCES "Test"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TestDelivery" ADD CONSTRAINT "TestDelivery_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TestDelivery" ADD CONSTRAINT "TestDelivery_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DeliveryAssignee" ADD CONSTRAINT "DeliveryAssignee_deliveryId_fkey" FOREIGN KEY ("deliveryId") REFERENCES "TestDelivery"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DeliveryAssignee" ADD CONSTRAINT "DeliveryAssignee_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Submission" ADD CONSTRAINT "Submission_deliveryId_fkey" FOREIGN KEY ("deliveryId") REFERENCES "TestDelivery"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "QuestionTiming" ADD CONSTRAINT "QuestionTiming_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "Submission"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "QuestionTiming" ADD CONSTRAINT "QuestionTiming_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Preserve direct class assignments as independent deliveries.
INSERT INTO "TestDelivery" (
  "id", "classId", "testId", "title", "availableAt", "dueAt", "createdAt",
  "createdById", "legacyClassTestId"
)
SELECT
  md5('class-test:' || ct."id"::text), ct."classId", ct."testId", t."title",
  ct."assignedAt", ct."dueDate", ct."assignedAt", c."teacherId", ct."id"
FROM "ClassTest" ct
JOIN "Class" c ON c."id" = ct."classId"
JOIN "Test" t ON t."id" = ct."testId";

-- Preserve test-containing classroom posts as their own deliveries.
INSERT INTO "TestDelivery" (
  "id", "classId", "testId", "title", "dueAt", "createdAt", "createdById", "sourceAssignmentId"
)
SELECT
  md5('assignment:' || a."id" || ':' || test_id::text), a."classId", test_id,
  a."title", a."deadline", a."createdAt", c."teacherId", a."id"
FROM "Assignment" a
JOIN "Class" c ON c."id" = a."classId"
CROSS JOIN LATERAL unnest(a."testIds") AS selected(test_id)
JOIN "Test" t ON t."id" = test_id;

-- Preserve tests attached through the legacy weekly lesson flow.
INSERT INTO "TestDelivery" (
  "id", "classId", "testId", "lessonId", "title", "dueAt", "createdAt",
  "createdById", "sourceLessonAssignmentId"
)
SELECT
  md5('lesson-assignment:' || la."id" || ':' || test_id::text), w."classId", test_id,
  l."id", la."title", la."dueDate", la."createdAt", c."teacherId", la."id"
FROM "LessonAssignment" la
JOIN "Lesson" l ON l."id" = la."lessonId"
JOIN "Week" w ON w."id" = l."weekId"
JOIN "Class" c ON c."id" = w."classId"
CROSS JOIN LATERAL unnest(la."testIds") AS selected(test_id)
JOIN "Test" t ON t."id" = test_id;

INSERT INTO "DeliveryAssignee" ("deliveryId", "studentId", "assignedAt")
SELECT d."id", memberships."B", d."createdAt"
FROM "TestDelivery" d
JOIN "_StudentClasses" memberships ON memberships."A" = d."classId"
ON CONFLICT DO NOTHING;

UPDATE "Submission" s
SET "deliveryId" = d."id"
FROM "TestDelivery" d
WHERE s."assignmentId" IS NOT NULL
  AND d."sourceAssignmentId" = s."assignmentId"
  AND d."testId" = s."testId";

UPDATE "Submission" s
SET "deliveryId" = d."id"
FROM "TestDelivery" d
WHERE s."deliveryId" IS NULL
  AND s."classTestId" IS NOT NULL
  AND d."legacyClassTestId" = s."classTestId";

WITH numbered AS (
  SELECT "id", row_number() OVER (
    PARTITION BY "deliveryId", "userId" ORDER BY "startedAt", "id"
  ) AS attempt_no
  FROM "Submission"
  WHERE "deliveryId" IS NOT NULL
)
UPDATE "Submission" s
SET "attemptNo" = numbered.attempt_no
FROM numbered
WHERE s."id" = numbered."id";

CREATE UNIQUE INDEX "Submission_deliveryId_userId_attemptNo_key" ON "Submission"("deliveryId", "userId", "attemptNo");
CREATE INDEX "Submission_deliveryId_status_idx" ON "Submission"("deliveryId", "status");
