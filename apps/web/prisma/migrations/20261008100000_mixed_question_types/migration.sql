-- New enum values must commit before constraints use them.
ALTER TYPE "QuestionType" ADD VALUE 'TEXT';
ALTER TYPE "QuestionType" ADD VALUE 'OVERALL';
ALTER TYPE "AnswerState" ADD VALUE 'SKIPPED';
