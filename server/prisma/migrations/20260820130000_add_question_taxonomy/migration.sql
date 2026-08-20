CREATE TABLE "QuestionDomain" (
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "subject" "TestSubject" NOT NULL,
  "sortOrder" INTEGER NOT NULL,
  CONSTRAINT "QuestionDomain_pkey" PRIMARY KEY ("code")
);

CREATE TABLE "QuestionSkill" (
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "domainCode" TEXT NOT NULL,
  "sortOrder" INTEGER NOT NULL,
  CONSTRAINT "QuestionSkill_pkey" PRIMARY KEY ("code")
);

ALTER TABLE "Question" ADD COLUMN "domainCode" TEXT;
ALTER TABLE "Question" ADD COLUMN "skillCode" TEXT;

CREATE INDEX "Question_domainCode_idx" ON "Question"("domainCode");
CREATE INDEX "Question_skillCode_idx" ON "Question"("skillCode");
CREATE INDEX "QuestionDomain_subject_sortOrder_idx" ON "QuestionDomain"("subject", "sortOrder");
CREATE INDEX "QuestionSkill_domainCode_sortOrder_idx" ON "QuestionSkill"("domainCode", "sortOrder");

ALTER TABLE "QuestionSkill"
  ADD CONSTRAINT "QuestionSkill_domainCode_fkey"
  FOREIGN KEY ("domainCode") REFERENCES "QuestionDomain"("code") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Question"
  ADD CONSTRAINT "Question_domainCode_fkey"
  FOREIGN KEY ("domainCode") REFERENCES "QuestionDomain"("code") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Question"
  ADD CONSTRAINT "Question_skillCode_fkey"
  FOREIGN KEY ("skillCode") REFERENCES "QuestionSkill"("code") ON DELETE SET NULL ON UPDATE CASCADE;

INSERT INTO "QuestionDomain" ("code", "name", "subject", "sortOrder") VALUES
  ('RW_INFORMATION_AND_IDEAS', 'Information and Ideas', 'RW', 1),
  ('RW_CRAFT_AND_STRUCTURE', 'Craft and Structure', 'RW', 2),
  ('RW_EXPRESSION_OF_IDEAS', 'Expression of Ideas', 'RW', 3),
  ('RW_STANDARD_ENGLISH_CONVENTIONS', 'Standard English Conventions', 'RW', 4),
  ('MATH_ALGEBRA', 'Algebra', 'MATH', 1),
  ('MATH_ADVANCED_MATH', 'Advanced Math', 'MATH', 2),
  ('MATH_PROBLEM_SOLVING_AND_DATA_ANALYSIS', 'Problem-Solving and Data Analysis', 'MATH', 3),
  ('MATH_GEOMETRY_AND_TRIGONOMETRY', 'Geometry and Trigonometry', 'MATH', 4);

INSERT INTO "QuestionSkill" ("code", "name", "domainCode", "sortOrder") VALUES
  ('RW_CENTRAL_IDEAS_AND_DETAILS', 'Central Ideas and Details', 'RW_INFORMATION_AND_IDEAS', 1),
  ('RW_COMMAND_OF_EVIDENCE_TEXTUAL', 'Command of Evidence – Textual', 'RW_INFORMATION_AND_IDEAS', 2),
  ('RW_COMMAND_OF_EVIDENCE_QUANTITATIVE', 'Command of Evidence – Quantitative', 'RW_INFORMATION_AND_IDEAS', 3),
  ('RW_INFERENCES', 'Inferences', 'RW_INFORMATION_AND_IDEAS', 4),
  ('RW_WORDS_IN_CONTEXT', 'Words in Context', 'RW_CRAFT_AND_STRUCTURE', 1),
  ('RW_TEXT_STRUCTURE_AND_PURPOSE', 'Text Structure and Purpose', 'RW_CRAFT_AND_STRUCTURE', 2),
  ('RW_CROSS_TEXT_CONNECTIONS', 'Cross-Text Connections', 'RW_CRAFT_AND_STRUCTURE', 3),
  ('RW_RHETORICAL_SYNTHESIS', 'Rhetorical Synthesis', 'RW_EXPRESSION_OF_IDEAS', 1),
  ('RW_TRANSITIONS', 'Transitions', 'RW_EXPRESSION_OF_IDEAS', 2),
  ('RW_BOUNDARIES', 'Boundaries', 'RW_STANDARD_ENGLISH_CONVENTIONS', 1),
  ('RW_FORM_STRUCTURE_AND_SENSE', 'Form, Structure, and Sense', 'RW_STANDARD_ENGLISH_CONVENTIONS', 2),
  ('MATH_LINEAR_EQUATIONS_ONE_VARIABLE', 'Linear Equations in One Variable', 'MATH_ALGEBRA', 1),
  ('MATH_LINEAR_FUNCTIONS', 'Linear Functions', 'MATH_ALGEBRA', 2),
  ('MATH_LINEAR_EQUATIONS_TWO_VARIABLES', 'Linear Equations in Two Variables', 'MATH_ALGEBRA', 3),
  ('MATH_SYSTEMS_LINEAR_EQUATIONS', 'Systems of Linear Equations', 'MATH_ALGEBRA', 4),
  ('MATH_LINEAR_INEQUALITIES', 'Linear Inequalities', 'MATH_ALGEBRA', 5),
  ('MATH_EQUIVALENT_EXPRESSIONS', 'Equivalent Expressions', 'MATH_ADVANCED_MATH', 1),
  ('MATH_NONLINEAR_EQUATIONS', 'Nonlinear Equations', 'MATH_ADVANCED_MATH', 2),
  ('MATH_SYSTEMS_NONLINEAR_EQUATIONS', 'Systems of Equations', 'MATH_ADVANCED_MATH', 3),
  ('MATH_NONLINEAR_FUNCTIONS', 'Nonlinear Functions', 'MATH_ADVANCED_MATH', 4),
  ('MATH_RATIOS_RATES_UNITS', 'Ratios, Rates, and Units', 'MATH_PROBLEM_SOLVING_AND_DATA_ANALYSIS', 1),
  ('MATH_PERCENTAGES', 'Percentages', 'MATH_PROBLEM_SOLVING_AND_DATA_ANALYSIS', 2),
  ('MATH_ONE_VARIABLE_DATA', 'One-Variable Data', 'MATH_PROBLEM_SOLVING_AND_DATA_ANALYSIS', 3),
  ('MATH_TWO_VARIABLE_DATA', 'Two-Variable Data', 'MATH_PROBLEM_SOLVING_AND_DATA_ANALYSIS', 4),
  ('MATH_PROBABILITY', 'Probability and Conditional Probability', 'MATH_PROBLEM_SOLVING_AND_DATA_ANALYSIS', 5),
  ('MATH_STATISTICAL_INFERENCE', 'Statistical Inference and Margin of Error', 'MATH_PROBLEM_SOLVING_AND_DATA_ANALYSIS', 6),
  ('MATH_STATISTICAL_CLAIMS', 'Evaluating Statistical Claims', 'MATH_PROBLEM_SOLVING_AND_DATA_ANALYSIS', 7),
  ('MATH_AREA_AND_VOLUME', 'Area and Volume', 'MATH_GEOMETRY_AND_TRIGONOMETRY', 1),
  ('MATH_LINES_ANGLES_TRIANGLES', 'Lines, Angles, and Triangles', 'MATH_GEOMETRY_AND_TRIGONOMETRY', 2),
  ('MATH_RIGHT_TRIANGLES_AND_TRIGONOMETRY', 'Right Triangles and Trigonometry', 'MATH_GEOMETRY_AND_TRIGONOMETRY', 3),
  ('MATH_CIRCLES', 'Circles', 'MATH_GEOMETRY_AND_TRIGONOMETRY', 4);
