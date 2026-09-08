ALTER TABLE "ClassAnnouncement"
ADD COLUMN "isPinned" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "ClassAnnouncement_classId_isPinned_createdAt_idx"
ON "ClassAnnouncement"("classId", "isPinned", "createdAt");
