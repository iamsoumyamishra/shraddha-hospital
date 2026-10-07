-- Additive provenance only. Existing surveys, answers and scores are preserved.
CREATE TABLE "paper_feedback_imports" (
  "id" UUID NOT NULL,
  "submissionId" UUID NOT NULL,
  "hospitalId" UUID NOT NULL,
  "reviewerStaffId" UUID NOT NULL,
  "sourceDigest" TEXT NOT NULL,
  "pageHashes" TEXT[] NOT NULL,
  "templateVersion" TEXT NOT NULL,
  "reviewedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "paper_feedback_imports_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "paper_feedback_imports_digest_check" CHECK ("sourceDigest" ~ '^[a-f0-9]{64}$'),
  CONSTRAINT "paper_feedback_imports_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "feedback_submissions"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "paper_feedback_imports_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "hospitals"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "paper_feedback_imports_reviewerStaffId_fkey" FOREIGN KEY ("reviewerStaffId") REFERENCES "staff_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "paper_feedback_imports_submissionId_key" ON "paper_feedback_imports"("submissionId");
CREATE UNIQUE INDEX "paper_feedback_imports_hospitalId_sourceDigest_key" ON "paper_feedback_imports"("hospitalId", "sourceDigest");
CREATE INDEX "paper_feedback_imports_hospitalId_reviewedAt_idx" ON "paper_feedback_imports"("hospitalId", "reviewedAt");
