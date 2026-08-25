CREATE TYPE "CourseContentStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'PUBLISHED', 'ARCHIVED');
CREATE TYPE "LessonResourceKind" AS ENUM ('FILE', 'VIDEO', 'LINK', 'EMBED');
CREATE TYPE "LessonProgressStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'COMPLETED');

ALTER TABLE "Week"
  ADD COLUMN "description" TEXT,
  ADD COLUMN "status" "CourseContentStatus" NOT NULL DEFAULT 'DRAFT',
  ADD COLUMN "availableAt" TIMESTAMP(3),
  ADD COLUMN "publishedAt" TIMESTAMP(3),
  ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "Lesson"
  ADD COLUMN "summary" TEXT,
  ADD COLUMN "status" "CourseContentStatus" NOT NULL DEFAULT 'DRAFT',
  ADD COLUMN "scheduledAt" TIMESTAMP(3),
  ADD COLUMN "durationMinutes" INTEGER,
  ADD COLUMN "availableAt" TIMESTAMP(3),
  ADD COLUMN "publishedAt" TIMESTAMP(3),
  ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "LessonFile"
  ADD COLUMN "kind" "LessonResourceKind" NOT NULL DEFAULT 'FILE',
  ADD COLUMN "provider" TEXT,
  ADD COLUMN "mimeType" TEXT,
  ADD COLUMN "thumbnailUrl" TEXT,
  ADD COLUMN "durationSeconds" INTEGER,
  ADD COLUMN "order" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "isRequired" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "availableAt" TIMESTAMP(3),
  ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "LessonAssignment" ADD COLUMN "assignmentId" TEXT;

-- Existing curriculum was visible before publication states existed.
UPDATE "Week" SET "status" = 'PUBLISHED', "publishedAt" = "createdAt";
UPDATE "Lesson" SET "status" = 'PUBLISHED', "publishedAt" = "createdAt";

CREATE TABLE "LessonProgress" (
  "lessonId" TEXT NOT NULL,
  "studentId" INTEGER NOT NULL,
  "status" "LessonProgressStatus" NOT NULL DEFAULT 'NOT_STARTED',
  "progress" INTEGER NOT NULL DEFAULT 0,
  "startedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "lastOpenedAt" TIMESTAMP(3),
  CONSTRAINT "LessonProgress_pkey" PRIMARY KEY ("lessonId", "studentId")
);

CREATE TABLE "ResourceProgress" (
  "fileId" TEXT NOT NULL,
  "studentId" INTEGER NOT NULL,
  "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastOpenedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),
  "positionSeconds" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "ResourceProgress_pkey" PRIMARY KEY ("fileId", "studentId")
);

CREATE UNIQUE INDEX "LessonAssignment_assignmentId_key" ON "LessonAssignment"("assignmentId");
CREATE INDEX "Week_classId_status_order_idx" ON "Week"("classId", "status", "order");
CREATE INDEX "Lesson_weekId_status_order_idx" ON "Lesson"("weekId", "status", "order");
CREATE INDEX "LessonFile_lessonId_order_idx" ON "LessonFile"("lessonId", "order");
CREATE INDEX "LessonProgress_studentId_status_idx" ON "LessonProgress"("studentId", "status");
CREATE INDEX "ResourceProgress_studentId_completedAt_idx" ON "ResourceProgress"("studentId", "completedAt");

ALTER TABLE "LessonAssignment" ADD CONSTRAINT "LessonAssignment_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "Assignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LessonProgress" ADD CONSTRAINT "LessonProgress_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LessonProgress" ADD CONSTRAINT "LessonProgress_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ResourceProgress" ADD CONSTRAINT "ResourceProgress_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "LessonFile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ResourceProgress" ADD CONSTRAINT "ResourceProgress_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
