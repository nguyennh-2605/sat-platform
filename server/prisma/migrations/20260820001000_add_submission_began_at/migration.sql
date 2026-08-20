ALTER TABLE "Submission" ADD COLUMN "beganAt" TIMESTAMP(3);

-- Existing in-progress sessions have already been using startedAt as their clock.
UPDATE "Submission"
SET "beganAt" = "startedAt"
WHERE "status" = 'DOING';
