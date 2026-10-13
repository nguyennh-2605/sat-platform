-- A learner's event color is independent of the source task's category.
ALTER TABLE "UserTodoState" ADD COLUMN "calendarColor" VARCHAR(12);
ALTER TABLE "UserTodoState" ADD CONSTRAINT "UserTodoState_calendar_color_check"
  CHECK ("calendarColor" IS NULL OR "calendarColor" IN ('BLUE', 'VIOLET', 'TEAL', 'AMBER'));
