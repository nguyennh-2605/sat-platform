CREATE TYPE "LessonBlockPhase" AS ENUM ('BEFORE_CLASS', 'DURING_CLASS', 'AFTER_CLASS');

ALTER TABLE "LessonBlock"
ADD COLUMN "phase" "LessonBlockPhase" NOT NULL DEFAULT 'DURING_CLASS';

DROP INDEX IF EXISTS "LessonBlock_lessonId_order_idx";
CREATE INDEX "LessonBlock_lessonId_phase_order_idx" ON "LessonBlock"("lessonId", "phase", "order");
