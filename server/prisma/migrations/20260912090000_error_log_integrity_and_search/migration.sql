CREATE TYPE "ErrorLogOrigin" AS ENUM ('SYSTEM_QUESTION', 'MANUAL');

-- Add nullable columns first so this migration remains safe for existing rows
-- and for an older application process during a rolling deployment.
ALTER TABLE "ErrorLog"
ADD COLUMN "origin" "ErrorLogOrigin",
ADD COLUMN "questionSnapshot" JSONB,
ADD COLUMN "searchText" TEXT,
ADD COLUMN "version" INTEGER,
ADD COLUMN "clientMutationId" TEXT;

UPDATE "ErrorLog"
SET "origin" = CASE
  WHEN "questionId" IS NOT NULL THEN 'SYSTEM_QUESTION'::"ErrorLogOrigin"
  ELSE 'MANUAL'::"ErrorLogOrigin"
END
WHERE "origin" IS NULL;

UPDATE "ErrorLog"
SET "version" = 1
WHERE "version" IS NULL;

-- Keep one normalized, plain-text-ish projection for inexpensive search. HTML
-- entities may remain, but markup and repeated whitespace are removed safely.
UPDATE "ErrorLog"
SET "searchText" = NULLIF(
  btrim(
    regexp_replace(
      regexp_replace(
        concat_ws(' ', "source", "category", "whyWrong", "whyRight"),
        '<[^>]*>',
        ' ',
        'g'
      ),
      '[[:space:]]+',
      ' ',
      'g'
    )
  ),
  ''
);

ALTER TABLE "ErrorLog"
ALTER COLUMN "origin" SET DEFAULT 'MANUAL',
ALTER COLUMN "origin" SET NOT NULL,
ALTER COLUMN "version" SET DEFAULT 1,
ALTER COLUMN "version" SET NOT NULL;

DROP INDEX IF EXISTS "ErrorLog_userId_reviewedAt_createdAt_idx";

CREATE INDEX "ErrorLog_userId_reviewedAt_createdAt_id_idx"
ON "ErrorLog"("userId", "reviewedAt", "createdAt", "id");

CREATE INDEX "ErrorLog_userId_category_createdAt_id_idx"
ON "ErrorLog"("userId", "category", "createdAt", "id");

CREATE UNIQUE INDEX "ErrorLog_userId_clientMutationId_key"
ON "ErrorLog"("userId", "clientMutationId");
