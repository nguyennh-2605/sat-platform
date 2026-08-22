-- Preserve historical class performance for students who submitted before the
-- delivery model existed, even if they are no longer enrolled in the class.
INSERT INTO "DeliveryAssignee" ("deliveryId", "studentId", "assignedAt")
SELECT DISTINCT s."deliveryId", s."userId", COALESCE(s."startedAt", NOW())
FROM "Submission" s
WHERE s."deliveryId" IS NOT NULL
ON CONFLICT ("deliveryId", "studentId") DO NOTHING;
