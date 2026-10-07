ALTER TABLE "answers" ADD COLUMN "textValue" TEXT;
ALTER TABLE "answers" DROP CONSTRAINT "answers_state_consistent";
ALTER TABLE "answers" ADD CONSTRAINT "answers_state_consistent" CHECK (
  ("state" = 'ANSWERED' AND (("value" IS NOT NULL AND "value" BETWEEN 1 AND 5 AND "textValue" IS NULL)
     OR ("value" IS NULL AND "textValue" IS NOT NULL AND length(btrim("textValue")) > 0 AND length("textValue") <= 2000)))
  OR ("state" IN ('NOT_APPLICABLE', 'SKIPPED') AND "value" IS NULL AND "textValue" IS NULL)
);
CREATE FUNCTION validate_answer_question_type() RETURNS trigger AS $$
DECLARE kind "QuestionType";
BEGIN
  SELECT "type" INTO kind FROM questions WHERE id = NEW."questionId";
  IF (kind = 'TEXT' AND (NEW."value" IS NOT NULL OR NEW."state" = 'NOT_APPLICABLE'))
    OR (kind IN ('RATING','OVERALL') AND NEW."textValue" IS NOT NULL)
    OR (kind = 'OVERALL' AND NEW."state" = 'NOT_APPLICABLE') THEN
    RAISE EXCEPTION 'Answer does not match published question type';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER answer_question_type BEFORE INSERT OR UPDATE ON answers
FOR EACH ROW EXECUTE FUNCTION validate_answer_question_type();
