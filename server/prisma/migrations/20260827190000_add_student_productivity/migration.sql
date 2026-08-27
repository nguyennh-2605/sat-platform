ALTER TABLE "User"
ADD COLUMN "currentSatScore" INTEGER,
ADD COLUMN "targetSatScore" INTEGER;

ALTER TABLE "UserTodoState"
ALTER COLUMN "handledAt" DROP NOT NULL,
ALTER COLUMN "handledAt" DROP DEFAULT,
ADD COLUMN "completedAt" TIMESTAMP(3),
ADD COLUMN "position" INTEGER,
ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE INDEX "UserTodoState_userId_position_idx"
ON "UserTodoState"("userId", "position");

CREATE TABLE "StudentTask" (
    "id" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "details" TEXT,
    "dueAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "position" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StudentTask_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "StudentTask_userId_completedAt_dueAt_idx"
ON "StudentTask"("userId", "completedAt", "dueAt");

CREATE INDEX "StudentTask_userId_position_idx"
ON "StudentTask"("userId", "position");

ALTER TABLE "StudentTask"
ADD CONSTRAINT "StudentTask_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

