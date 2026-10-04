-- Integrity constraints that Prisma's schema language cannot express.
-- These are the guarantees AGENTS.md requires to live in the database rather
-- than in application checks alone.

-- Scope integrity: a membership row must carry exactly the foreign keys its
-- scope type implies.
ALTER TABLE "memberships"
  ADD CONSTRAINT "memberships_scope_consistent"
  CHECK (
    ("scopeType" = 'HOSPITAL'   AND "branchId" IS NULL     AND "departmentId" IS NULL) OR
    ("scopeType" = 'BRANCH'     AND "branchId" IS NOT NULL AND "departmentId" IS NULL) OR
    ("scopeType" = 'DEPARTMENT' AND "branchId" IS NOT NULL AND "departmentId" IS NOT NULL)
  );

-- An answer is either a real 1-5 rating or explicitly not applicable.
-- NOT_APPLICABLE must not carry a value, so "not applicable" can never
-- quietly become a score.
ALTER TABLE "answers"
  ADD CONSTRAINT "answers_state_consistent"
  CHECK (
    ("state" = 'ANSWERED'       AND "value" BETWEEN 1 AND 5) OR
    ("state" = 'NOT_APPLICABLE' AND "value" IS NULL)
  );

-- A submission is complete only when it carries an index; an incomplete
-- submission must not present an official number.
ALTER TABLE "feedback_submissions"
  ADD CONSTRAINT "submissions_index_consistent"
  CHECK (
    ("status" = 'COMPLETE'   AND "patientIndex" IS NOT NULL AND "patientIndex" >= 0 AND "patientIndex" <= 100) OR
    ("status" = 'INCOMPLETE' AND "patientIndex" IS NULL)
  );

-- The standalone overall-experience rating uses the same 1-5 scale.
ALTER TABLE "feedback_submissions"
  ADD CONSTRAINT "submissions_overall_rating_range"
  CHECK ("overallRating" IS NULL OR "overallRating" BETWEEN 1 AND 5);

-- A category score is present only when that category actually had a scored
-- answer. This is what makes "no valid answer" impossible to store as zero.
ALTER TABLE "category_scores"
  ADD CONSTRAINT "category_scores_value_consistent"
  CHECK (
    ("score" IS NULL     AND "answeredCount" = 0) OR
    ("score" IS NOT NULL AND "answeredCount" > 0  AND "score" >= 0 AND "score" <= 100)
  );