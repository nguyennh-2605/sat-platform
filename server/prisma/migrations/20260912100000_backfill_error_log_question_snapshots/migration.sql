-- Preserve the historical question context for Error Logs created before
-- question snapshots were introduced. Future rows are snapshotted at submit.
UPDATE "ErrorLog" AS error_log
SET
  "origin" = 'SYSTEM_QUESTION'::"ErrorLogOrigin",
  "questionSnapshot" = jsonb_build_object(
    'type', question."type"::text,
    'blocks', question."blocks",
    'questionText', question."questionText",
    'choices', question."choices",
    'explanation', question."explanation",
    'order', question."order",
    'section', jsonb_build_object(
      'name', section."name",
      'order', section."order",
      'test', jsonb_build_object(
        'title', test."title",
        'subject', test."subject"::text
      )
    )
  )
FROM "Question" AS question
JOIN "Section" AS section ON section."id" = question."sectionId"
JOIN "Test" AS test ON test."id" = section."testId"
WHERE error_log."questionId" = question."id"
  AND error_log."questionSnapshot" IS NULL;

-- A deleted Question is no longer linked because the FK uses SET NULL. A
-- surviving Submission still proves that the entry originated in the system.
UPDATE "ErrorLog"
SET "origin" = 'SYSTEM_QUESTION'::"ErrorLogOrigin"
WHERE "origin" = 'MANUAL'::"ErrorLogOrigin"
  AND "submissionId" IS NOT NULL;
