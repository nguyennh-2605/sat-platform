CREATE TYPE "TestScope" AS ENUM ('SYSTEM', 'PERSONAL');

ALTER TABLE "Test"
ADD COLUMN "scope" "TestScope" NOT NULL DEFAULT 'PERSONAL';

-- Existing administrator-authored and explicitly public tests are platform content.
-- Treat authorId as attribution for these rows, not as their ownership boundary.
UPDATE "Test"
SET "scope" = 'SYSTEM'
WHERE "isPublic" = true
   OR "authorId" IN (
     SELECT "id"
     FROM "User"
     WHERE "role" = 'ADMIN'
   );

-- Folders are user-owned. Platform tests must not remain coupled to one admin's folder.
UPDATE "Test"
SET "folderId" = NULL
WHERE "scope" = 'SYSTEM';

CREATE INDEX "Test_scope_status_updatedAt_idx"
ON "Test"("scope", "status", "updatedAt");
