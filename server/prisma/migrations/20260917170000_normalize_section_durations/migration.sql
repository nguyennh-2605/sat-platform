WITH ranked_sections AS (
  SELECT
    section.id,
    test.duration AS "totalDuration",
    COUNT(*) OVER (PARTITION BY section."testId") AS "moduleCount",
    ROW_NUMBER() OVER (PARTITION BY section."testId" ORDER BY section."order", section.id) AS "moduleNumber"
  FROM "Section" AS section
  JOIN "Test" AS test ON test.id = section."testId"
)
UPDATE "Section" AS section
SET duration = CASE
  WHEN ranked_sections."moduleCount" = 1 THEN ranked_sections."totalDuration"
  WHEN ranked_sections."moduleNumber" = 1 THEN FLOOR(ranked_sections."totalDuration" / 2.0)::INTEGER
  ELSE ranked_sections."totalDuration" - FLOOR(ranked_sections."totalDuration" / 2.0)::INTEGER
END
FROM ranked_sections
WHERE section.id = ranked_sections.id
  AND ranked_sections."moduleCount" BETWEEN 1 AND 2
  AND ranked_sections."totalDuration" >= ranked_sections."moduleCount";
