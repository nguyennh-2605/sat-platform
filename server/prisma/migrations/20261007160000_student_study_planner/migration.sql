-- A learner's intended study day is independent of coursework deadlines.
ALTER TABLE "UserTodoState" ADD COLUMN "plannedDate" VARCHAR(10);
