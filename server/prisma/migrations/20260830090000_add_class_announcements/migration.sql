CREATE TABLE "ClassAnnouncement" (
    "id" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "authorId" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT,
    "fileUrls" TEXT[] NOT NULL,
    "links" TEXT[] NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ClassAnnouncement_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ClassAnnouncement_classId_createdAt_idx" ON "ClassAnnouncement"("classId", "createdAt");
CREATE INDEX "ClassAnnouncement_authorId_createdAt_idx" ON "ClassAnnouncement"("authorId", "createdAt");

ALTER TABLE "ClassAnnouncement" ADD CONSTRAINT "ClassAnnouncement_classId_fkey"
FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ClassAnnouncement" ADD CONSTRAINT "ClassAnnouncement_authorId_fkey"
FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "ClassAnnouncement" ("id", "classId", "authorId", "title", "content", "fileUrls", "links", "createdAt", "updatedAt")
SELECT a."id", a."classId", c."teacherId", a."title", a."content", a."fileUrls", a."links", a."createdAt", a."createdAt"
FROM "Assignment" a
JOIN "Class" c ON c."id" = a."classId"
WHERE a."type" = 'announcement'
ON CONFLICT ("id") DO NOTHING;

UPDATE "UserTodoState" state
SET "itemKey" = 'student-announcement:' || SUBSTRING(state."itemKey" FROM LENGTH('student-post:') + 1)
WHERE state."itemKey" LIKE 'student-post:%'
  AND EXISTS (
    SELECT 1 FROM "ClassAnnouncement" announcement
    WHERE announcement."id" = SUBSTRING(state."itemKey" FROM LENGTH('student-post:') + 1)
  );
