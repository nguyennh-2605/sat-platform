CREATE TABLE "UserTodoState" (
    "userId" INTEGER NOT NULL,
    "itemKey" TEXT NOT NULL,
    "handledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserTodoState_pkey" PRIMARY KEY ("userId", "itemKey")
);

CREATE INDEX "UserTodoState_userId_handledAt_idx" ON "UserTodoState"("userId", "handledAt");

ALTER TABLE "UserTodoState"
ADD CONSTRAINT "UserTodoState_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
