-- Learner-owned calendar times in the platform study timezone; legacy plans stay all-day.
ALTER TABLE "UserTodoState"
  ADD COLUMN "plannedStartMinutes" INTEGER,
  ADD COLUMN "plannedEndMinutes" INTEGER;

ALTER TABLE "UserTodoState" ADD CONSTRAINT "UserTodoState_planned_time_range_check" CHECK (
  ("plannedStartMinutes" IS NULL AND "plannedEndMinutes" IS NULL)
  OR (
    "plannedDate" IS NOT NULL
    AND "plannedStartMinutes" IS NOT NULL AND "plannedEndMinutes" IS NOT NULL
    AND "plannedStartMinutes" >= 0
    AND "plannedEndMinutes" <= 1440
    AND "plannedEndMinutes" - "plannedStartMinutes" >= 15
  )
);
