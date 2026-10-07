-- Add the approval workflow without changing existing teacher/admin roles or learner data.
CREATE TYPE "TeacherAccessStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

CREATE TABLE "TeacherAccessRequest" (
  "id" TEXT NOT NULL,
  "userId" INTEGER NOT NULL,
  "reason" VARCHAR(1000) NOT NULL,
  "status" "TeacherAccessStatus" NOT NULL DEFAULT 'PENDING',
  "reviewNote" VARCHAR(1000),
  "reviewedById" INTEGER,
  "reviewedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TeacherAccessRequest_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "TeacherAccessRequest_userId_key" ON "TeacherAccessRequest"("userId");
CREATE INDEX "TeacherAccessRequest_status_createdAt_id_idx" ON "TeacherAccessRequest"("status", "createdAt", "id");
ALTER TABLE "TeacherAccessRequest" ADD CONSTRAINT "TeacherAccessRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TeacherAccessRequest" ADD CONSTRAINT "TeacherAccessRequest_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
