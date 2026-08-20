ALTER TABLE "Assignment"
ADD COLUMN "type" TEXT NOT NULL DEFAULT 'assignment';

UPDATE "Assignment"
SET "type" = 'announcement'
WHERE "deadline" IS NULL
  AND cardinality("testIds") = 0;
