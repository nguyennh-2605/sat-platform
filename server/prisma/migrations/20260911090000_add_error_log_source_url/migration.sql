ALTER TABLE "ErrorLog" ADD COLUMN "sourceUrl" TEXT;

-- Root cause is no longer part of the review completion rule. Preserve the
-- legacy classification while promoting rows that already have both reflections.
UPDATE "ErrorLog"
SET "reviewedAt" = COALESCE("reviewedAt", "updatedAt")
WHERE btrim(regexp_replace(replace(replace(COALESCE("whyWrong", ''), '&nbsp;', ''), '&#160;', ''), '<[^>]*>', '', 'g')) <> ''
  AND btrim(regexp_replace(replace(replace(COALESCE("whyRight", ''), '&nbsp;', ''), '&#160;', ''), '<[^>]*>', '', 'g')) <> '';
