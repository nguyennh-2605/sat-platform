CREATE TYPE "LearningFollowUpSource" AS ENUM ('SKILL_SIGNAL', 'STUDENT_CHECK_IN', 'ASSESSMENT', 'MANUAL');
CREATE TYPE "LearningFollowUpAction" AS ENUM ('TEST', 'HOMEWORK', 'CHECK_IN');
CREATE TYPE "LearningFollowUpStatus" AS ENUM ('OPEN', 'ASSIGNED', 'IN_PROGRESS', 'READY_TO_EVALUATE', 'RESOLVED', 'NEEDS_FOLLOW_UP', 'DISMISSED');
CREATE TYPE "AttendanceStatus" AS ENUM ('PRESENT', 'LATE', 'ABSENT', 'EXCUSED');

CREATE TABLE "LearningFollowUp" (
    "id" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "createdById" INTEGER NOT NULL,
    "sourceType" "LearningFollowUpSource" NOT NULL,
    "actionType" "LearningFollowUpAction" NOT NULL,
    "status" "LearningFollowUpStatus" NOT NULL DEFAULT 'OPEN',
    "subject" "TestSubject",
    "domainCode" TEXT,
    "domainName" TEXT,
    "skillCode" TEXT,
    "skillName" TEXT,
    "sourceDeliveryId" TEXT,
    "sourceStudentId" INTEGER,
    "reason" TEXT,
    "baselineAccuracy" INTEGER,
    "baselineCorrect" INTEGER,
    "baselineAnswerCount" INTEGER,
    "baselineStudentCount" INTEGER,
    "classificationCoverage" INTEGER,
    "resolutionNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "resolvedAt" TIMESTAMP(3),
    CONSTRAINT "LearningFollowUp_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LearningFollowUpTarget" (
    "followUpId" TEXT NOT NULL,
    "studentId" INTEGER NOT NULL,
    "baselineAccuracy" INTEGER,
    "baselineCorrect" INTEGER,
    "baselineAnswerCount" INTEGER,
    CONSTRAINT "LearningFollowUpTarget_pkey" PRIMARY KEY ("followUpId", "studentId")
);

CREATE TABLE "AttendanceSession" (
    "id" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "recordedById" INTEGER NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AttendanceSession_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AttendanceRecord" (
    "attendanceSessionId" TEXT NOT NULL,
    "studentId" INTEGER NOT NULL,
    "status" "AttendanceStatus" NOT NULL,
    "note" TEXT,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AttendanceRecord_pkey" PRIMARY KEY ("attendanceSessionId", "studentId")
);

ALTER TABLE "ClassActivity" ADD COLUMN "followUpId" TEXT;
ALTER TABLE "LessonFile" ADD COLUMN "fileAssetId" TEXT;

CREATE INDEX "LearningFollowUp_classId_status_createdAt_idx" ON "LearningFollowUp"("classId", "status", "createdAt");
CREATE INDEX "LearningFollowUp_createdById_createdAt_idx" ON "LearningFollowUp"("createdById", "createdAt");
CREATE INDEX "LearningFollowUp_skillCode_idx" ON "LearningFollowUp"("skillCode");
CREATE INDEX "LearningFollowUp_sourceDeliveryId_idx" ON "LearningFollowUp"("sourceDeliveryId");
CREATE INDEX "LearningFollowUpTarget_studentId_idx" ON "LearningFollowUpTarget"("studentId");
CREATE INDEX "ClassActivity_followUpId_idx" ON "ClassActivity"("followUpId");
CREATE UNIQUE INDEX "LessonFile_fileAssetId_key" ON "LessonFile"("fileAssetId");
CREATE UNIQUE INDEX "AttendanceSession_lessonId_key" ON "AttendanceSession"("lessonId");
CREATE INDEX "AttendanceSession_recordedById_recordedAt_idx" ON "AttendanceSession"("recordedById", "recordedAt");
CREATE INDEX "AttendanceRecord_studentId_status_idx" ON "AttendanceRecord"("studentId", "status");

ALTER TABLE "LearningFollowUp" ADD CONSTRAINT "LearningFollowUp_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LearningFollowUp" ADD CONSTRAINT "LearningFollowUp_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LearningFollowUpTarget" ADD CONSTRAINT "LearningFollowUpTarget_followUpId_fkey" FOREIGN KEY ("followUpId") REFERENCES "LearningFollowUp"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LearningFollowUpTarget" ADD CONSTRAINT "LearningFollowUpTarget_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ClassActivity" ADD CONSTRAINT "ClassActivity_followUpId_fkey" FOREIGN KEY ("followUpId") REFERENCES "LearningFollowUp"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "LessonFile" ADD CONSTRAINT "LessonFile_fileAssetId_fkey" FOREIGN KEY ("fileAssetId") REFERENCES "FileAsset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AttendanceSession" ADD CONSTRAINT "AttendanceSession_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AttendanceSession" ADD CONSTRAINT "AttendanceSession_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AttendanceRecord" ADD CONSTRAINT "AttendanceRecord_attendanceSessionId_fkey" FOREIGN KEY ("attendanceSessionId") REFERENCES "AttendanceSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AttendanceRecord" ADD CONSTRAINT "AttendanceRecord_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
