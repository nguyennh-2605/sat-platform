CREATE TYPE "TestStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

ALTER TABLE "Test"
ADD COLUMN "status" "TestStatus" NOT NULL DEFAULT 'PUBLISHED',
ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "Test" ALTER COLUMN "status" SET DEFAULT 'DRAFT';

DROP INDEX IF EXISTS "Test_authorId_id_idx";
DROP INDEX IF EXISTS "Test_isPublic_id_idx";

CREATE INDEX "Test_authorId_status_updatedAt_idx" ON "Test"("authorId", "status", "updatedAt");
CREATE INDEX "Test_isPublic_status_updatedAt_idx" ON "Test"("isPublic", "status", "updatedAt");
