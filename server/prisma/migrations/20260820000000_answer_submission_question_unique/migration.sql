-- Remove legacy duplicates caused by concurrent/retried submit requests.
DELETE FROM "Answer" older
USING "Answer" newer
WHERE older."submissionId" = newer."submissionId"
  AND older."questionId" = newer."questionId"
  AND older."id" < newer."id";

CREATE UNIQUE INDEX "Answer_submissionId_questionId_key"
ON "Answer"("submissionId", "questionId");
