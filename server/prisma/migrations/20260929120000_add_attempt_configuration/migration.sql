CREATE TYPE "AttemptTimingPreset" AS ENUM (
  'STANDARD',
  'HALF_TIME',
  'EXTENDED_50',
  'EXTENDED_100',
  'CUSTOM',
  'UNTIMED'
);

ALTER TABLE "Submission"
  ADD COLUMN "attemptMode" "TestMode",
  ADD COLUMN "timingPreset" "AttemptTimingPreset" NOT NULL DEFAULT 'STANDARD',
  ADD COLUMN "allowedDurationSeconds" INTEGER,
  ADD COLUMN "moduleTimingSnapshot" JSONB;

UPDATE "Submission" AS submission
SET
  "attemptMode" = test."mode",
  "allowedDurationSeconds" = test."duration" * 60
FROM "Test" AS test
WHERE submission."testId" = test."id";

ALTER TABLE "Submission"
  ALTER COLUMN "attemptMode" SET NOT NULL,
  ALTER COLUMN "attemptMode" SET DEFAULT 'PRACTICE';
