ALTER TABLE "Submission"
ADD COLUMN "currentModule" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN "moduleStartedAt" TIMESTAMP(3),
ADD COLUMN "moduleExpiresAt" TIMESTAMP(3);

UPDATE "Submission" AS submission
SET "currentModule" = CASE
  WHEN submission."currentQuestionIndex" >= COALESCE((
    SELECT COUNT(question.id)::INTEGER
    FROM "Section" AS section
    JOIN "Question" AS question ON question."sectionId" = section.id
    WHERE section."testId" = submission."testId"
      AND section."order" = 1
  ), 0)
  AND (SELECT COUNT(*) FROM "Section" AS section WHERE section."testId" = submission."testId") > 1
  THEN 2
  ELSE 1
END;
