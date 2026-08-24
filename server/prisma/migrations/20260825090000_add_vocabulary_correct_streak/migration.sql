ALTER TABLE "VocabularyTermProgress"
ADD COLUMN "correctStreak" INTEGER NOT NULL DEFAULT 0;

-- Preserve existing mastered words. Once a word is answered incorrectly,
-- the streak resets and two new objective quiz answers are required.
UPDATE "VocabularyTermProgress"
SET "correctStreak" = 2
WHERE "mastery" = 'MASTERED';
