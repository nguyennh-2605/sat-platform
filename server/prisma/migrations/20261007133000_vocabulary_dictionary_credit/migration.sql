-- Preserve dictionary attribution in teacher-owned immutable activity snapshots.
ALTER TABLE "VocabularyActivityItem" ADD COLUMN "dictionaryDefinition" BOOLEAN NOT NULL DEFAULT false;
