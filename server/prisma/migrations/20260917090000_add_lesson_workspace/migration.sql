CREATE TYPE "LessonBlockKind" AS ENUM ('TEXT', 'RESOURCE', 'ACTIVITY');

CREATE TABLE "LessonBlock" (
    "id" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "kind" "LessonBlockKind" NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "title" TEXT,
    "body" TEXT,
    "isRequired" BOOLEAN NOT NULL DEFAULT true,
    "resourceId" TEXT,
    "activityId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "LessonBlock_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LessonBlockProgress" (
    "blockId" TEXT NOT NULL,
    "studentId" INTEGER NOT NULL,
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastOpenedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    CONSTRAINT "LessonBlockProgress_pkey" PRIMARY KEY ("blockId", "studentId")
);

CREATE UNIQUE INDEX "LessonBlock_resourceId_key" ON "LessonBlock"("resourceId");
CREATE UNIQUE INDEX "LessonBlock_activityId_key" ON "LessonBlock"("activityId");
CREATE INDEX "LessonBlock_lessonId_order_idx" ON "LessonBlock"("lessonId", "order");
CREATE INDEX "LessonBlockProgress_studentId_completedAt_idx" ON "LessonBlockProgress"("studentId", "completedAt");

ALTER TABLE "LessonBlock" ADD CONSTRAINT "LessonBlock_lessonId_fkey"
FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "LessonBlock" ADD CONSTRAINT "LessonBlock_resourceId_fkey"
FOREIGN KEY ("resourceId") REFERENCES "LessonFile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "LessonBlock" ADD CONSTRAINT "LessonBlock_activityId_fkey"
FOREIGN KEY ("activityId") REFERENCES "ClassActivity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "LessonBlockProgress" ADD CONSTRAINT "LessonBlockProgress_blockId_fkey"
FOREIGN KEY ("blockId") REFERENCES "LessonBlock"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "LessonBlockProgress" ADD CONSTRAINT "LessonBlockProgress_studentId_fkey"
FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "LessonBlock" (
    "id", "lessonId", "kind", "order", "title", "isRequired", "resourceId", "createdAt", "updatedAt"
)
SELECT
    md5('lesson-block:resource:' || resource."id"),
    resource."lessonId",
    'RESOURCE'::"LessonBlockKind",
    ROW_NUMBER() OVER (PARTITION BY resource."lessonId" ORDER BY resource."order", resource."createdAt", resource."id") - 1,
    resource."name",
    resource."isRequired",
    resource."id",
    resource."createdAt",
    resource."updatedAt"
FROM "LessonFile" resource;

INSERT INTO "LessonBlock" (
    "id", "lessonId", "kind", "order", "title", "isRequired", "activityId", "createdAt", "updatedAt"
)
SELECT
    md5('lesson-block:activity:' || activity."id"),
    activity."lessonId",
    'ACTIVITY'::"LessonBlockKind",
    COALESCE(resource_count."count", 0)
      + ROW_NUMBER() OVER (PARTITION BY activity."lessonId" ORDER BY activity."createdAt", activity."id") - 1,
    activity."title",
    true,
    activity."id",
    activity."createdAt",
    activity."updatedAt"
FROM "ClassActivity" activity
LEFT JOIN (
    SELECT "lessonId", COUNT(*)::INTEGER AS "count"
    FROM "LessonFile"
    GROUP BY "lessonId"
) resource_count ON resource_count."lessonId" = activity."lessonId"
WHERE activity."lessonId" IS NOT NULL;
