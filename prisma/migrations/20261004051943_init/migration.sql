-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "StaffRole" AS ENUM ('HOSPITAL_ADMIN', 'BRANCH_MANAGER', 'DEPARTMENT_HEAD', 'ANALYST');

-- CreateEnum
CREATE TYPE "ScopeType" AS ENUM ('HOSPITAL', 'BRANCH', 'DEPARTMENT');

-- CreateEnum
CREATE TYPE "SurveyStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'RETIRED');

-- CreateEnum
CREATE TYPE "QuestionType" AS ENUM ('RATING');

-- CreateEnum
CREATE TYPE "TranslationStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'RETIRED');

-- CreateEnum
CREATE TYPE "SubmissionStatus" AS ENUM ('COMPLETE', 'INCOMPLETE');

-- CreateEnum
CREATE TYPE "RespondentRole" AS ENUM ('PATIENT', 'CAREGIVER');

-- CreateEnum
CREATE TYPE "AnswerState" AS ENUM ('ANSWERED', 'NOT_APPLICABLE');

-- CreateEnum
CREATE TYPE "CaseStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'RESOLVED');

-- CreateTable
CREATE TABLE "hospitals" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Kolkata',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "hospitals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "branches" (
    "id" UUID NOT NULL,
    "hospitalId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "branches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "departments" (
    "id" UUID NOT NULL,
    "hospitalId" UUID NOT NULL,
    "branchId" UUID,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "departments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "staff_users" (
    "id" UUID NOT NULL,
    "authUserId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "staff_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "memberships" (
    "id" UUID NOT NULL,
    "staffUserId" UUID NOT NULL,
    "hospitalId" UUID NOT NULL,
    "role" "StaffRole" NOT NULL,
    "scopeType" "ScopeType" NOT NULL,
    "branchId" UUID,
    "departmentId" UUID,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "memberships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scoring_policy_versions" (
    "id" UUID NOT NULL,
    "hospitalId" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "rules" JSONB NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "scoring_policy_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "survey_versions" (
    "id" UUID NOT NULL,
    "hospitalId" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "visitTypes" TEXT[],
    "status" "SurveyStatus" NOT NULL DEFAULT 'DRAFT',
    "scoringPolicyVersionId" UUID NOT NULL,
    "publishedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "survey_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categories" (
    "id" UUID NOT NULL,
    "surveyVersionId" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "weight" DECIMAL(10,4) NOT NULL DEFAULT 1,
    "sortOrder" INTEGER NOT NULL,
    "isCore" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "questions" (
    "id" UUID NOT NULL,
    "surveyVersionId" UUID NOT NULL,
    "categoryId" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "type" "QuestionType" NOT NULL DEFAULT 'RATING',
    "isRequired" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL,
    "appliesWhen" JSONB,

    CONSTRAINT "questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "question_translations" (
    "id" UUID NOT NULL,
    "questionId" UUID NOT NULL,
    "locale" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "helpText" TEXT,
    "status" "TranslationStatus" NOT NULL DEFAULT 'DRAFT',
    "reviewedById" UUID,
    "reviewedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "question_translations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "feedback_submissions" (
    "id" UUID NOT NULL,
    "publicId" TEXT NOT NULL,
    "surveyVersionId" UUID NOT NULL,
    "scoringPolicyVersionId" UUID NOT NULL,
    "hospitalId" UUID NOT NULL,
    "branchId" UUID,
    "departmentId" UUID,
    "status" "SubmissionStatus" NOT NULL,
    "patientIndex" DECIMAL(7,4),
    "respondentRole" "RespondentRole" NOT NULL DEFAULT 'PATIENT',
    "locale" TEXT NOT NULL DEFAULT 'en',
    "visitType" TEXT NOT NULL,
    "servicesUsed" TEXT[],
    "overallRating" INTEGER,
    "comment" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "submittedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "feedback_submissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "answers" (
    "id" UUID NOT NULL,
    "submissionId" UUID NOT NULL,
    "questionId" UUID NOT NULL,
    "state" "AnswerState" NOT NULL DEFAULT 'ANSWERED',
    "value" INTEGER,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "answers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "category_scores" (
    "id" UUID NOT NULL,
    "submissionId" UUID NOT NULL,
    "categoryId" UUID NOT NULL,
    "scoringPolicyVersionId" UUID NOT NULL,
    "score" DECIMAL(7,4),
    "answeredCount" INTEGER NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "category_scores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "follow_up_contacts" (
    "id" UUID NOT NULL,
    "submissionId" UUID NOT NULL,
    "displayName" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "consentGiven" BOOLEAN NOT NULL DEFAULT false,
    "privacyNoticeVersion" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "follow_up_contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "feedback_cases" (
    "id" UUID NOT NULL,
    "submissionId" UUID NOT NULL,
    "hospitalId" UUID NOT NULL,
    "branchId" UUID,
    "assignedToId" UUID,
    "status" "CaseStatus" NOT NULL DEFAULT 'OPEN',
    "resolutionNote" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "resolvedAt" TIMESTAMPTZ(3),

    CONSTRAINT "feedback_cases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL,
    "hospitalId" UUID,
    "actorStaffId" UUID,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "hospitals_slug_key" ON "hospitals"("slug");

-- CreateIndex
CREATE INDEX "branches_hospitalId_idx" ON "branches"("hospitalId");

-- CreateIndex
CREATE UNIQUE INDEX "branches_hospitalId_code_key" ON "branches"("hospitalId", "code");

-- CreateIndex
CREATE INDEX "departments_hospitalId_idx" ON "departments"("hospitalId");

-- CreateIndex
CREATE INDEX "departments_branchId_idx" ON "departments"("branchId");

-- CreateIndex
CREATE UNIQUE INDEX "departments_hospitalId_code_key" ON "departments"("hospitalId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "staff_users_authUserId_key" ON "staff_users"("authUserId");

-- CreateIndex
CREATE UNIQUE INDEX "staff_users_email_key" ON "staff_users"("email");

-- CreateIndex
CREATE INDEX "memberships_staffUserId_idx" ON "memberships"("staffUserId");

-- CreateIndex
CREATE INDEX "memberships_hospitalId_scopeType_idx" ON "memberships"("hospitalId", "scopeType");

-- CreateIndex
CREATE INDEX "memberships_branchId_idx" ON "memberships"("branchId");

-- CreateIndex
CREATE INDEX "memberships_departmentId_idx" ON "memberships"("departmentId");

-- CreateIndex
CREATE UNIQUE INDEX "memberships_staffUserId_hospitalId_scopeType_branchId_depar_key" ON "memberships"("staffUserId", "hospitalId", "scopeType", "branchId", "departmentId");

-- CreateIndex
CREATE INDEX "scoring_policy_versions_hospitalId_isActive_idx" ON "scoring_policy_versions"("hospitalId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "scoring_policy_versions_hospitalId_version_key" ON "scoring_policy_versions"("hospitalId", "version");

-- CreateIndex
CREATE INDEX "survey_versions_hospitalId_slug_status_idx" ON "survey_versions"("hospitalId", "slug", "status");

-- CreateIndex
CREATE INDEX "survey_versions_scoringPolicyVersionId_idx" ON "survey_versions"("scoringPolicyVersionId");

-- CreateIndex
CREATE UNIQUE INDEX "survey_versions_hospitalId_slug_version_key" ON "survey_versions"("hospitalId", "slug", "version");

-- CreateIndex
CREATE INDEX "categories_surveyVersionId_sortOrder_idx" ON "categories"("surveyVersionId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "categories_surveyVersionId_key_key" ON "categories"("surveyVersionId", "key");

-- CreateIndex
CREATE INDEX "questions_surveyVersionId_sortOrder_idx" ON "questions"("surveyVersionId", "sortOrder");

-- CreateIndex
CREATE INDEX "questions_categoryId_idx" ON "questions"("categoryId");

-- CreateIndex
CREATE UNIQUE INDEX "questions_surveyVersionId_key_key" ON "questions"("surveyVersionId", "key");

-- CreateIndex
CREATE INDEX "question_translations_locale_status_idx" ON "question_translations"("locale", "status");

-- CreateIndex
CREATE UNIQUE INDEX "question_translations_questionId_locale_key" ON "question_translations"("questionId", "locale");

-- CreateIndex
CREATE UNIQUE INDEX "feedback_submissions_publicId_key" ON "feedback_submissions"("publicId");

-- CreateIndex
CREATE INDEX "feedback_submissions_hospitalId_submittedAt_idx" ON "feedback_submissions"("hospitalId", "submittedAt");

-- CreateIndex
CREATE INDEX "feedback_submissions_surveyVersionId_submittedAt_idx" ON "feedback_submissions"("surveyVersionId", "submittedAt");

-- CreateIndex
CREATE INDEX "feedback_submissions_branchId_submittedAt_idx" ON "feedback_submissions"("branchId", "submittedAt");

-- CreateIndex
CREATE INDEX "feedback_submissions_departmentId_submittedAt_idx" ON "feedback_submissions"("departmentId", "submittedAt");

-- CreateIndex
CREATE INDEX "feedback_submissions_status_submittedAt_idx" ON "feedback_submissions"("status", "submittedAt");

-- CreateIndex
CREATE UNIQUE INDEX "feedback_submissions_surveyVersionId_idempotencyKey_key" ON "feedback_submissions"("surveyVersionId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "answers_questionId_idx" ON "answers"("questionId");

-- CreateIndex
CREATE UNIQUE INDEX "answers_submissionId_questionId_key" ON "answers"("submissionId", "questionId");

-- CreateIndex
CREATE INDEX "category_scores_categoryId_idx" ON "category_scores"("categoryId");

-- CreateIndex
CREATE INDEX "category_scores_scoringPolicyVersionId_idx" ON "category_scores"("scoringPolicyVersionId");

-- CreateIndex
CREATE UNIQUE INDEX "category_scores_submissionId_categoryId_key" ON "category_scores"("submissionId", "categoryId");

-- CreateIndex
CREATE UNIQUE INDEX "follow_up_contacts_submissionId_key" ON "follow_up_contacts"("submissionId");

-- CreateIndex
CREATE UNIQUE INDEX "feedback_cases_submissionId_key" ON "feedback_cases"("submissionId");

-- CreateIndex
CREATE INDEX "feedback_cases_hospitalId_status_idx" ON "feedback_cases"("hospitalId", "status");

-- CreateIndex
CREATE INDEX "feedback_cases_branchId_status_idx" ON "feedback_cases"("branchId", "status");

-- CreateIndex
CREATE INDEX "feedback_cases_assignedToId_idx" ON "feedback_cases"("assignedToId");

-- CreateIndex
CREATE INDEX "audit_logs_hospitalId_createdAt_idx" ON "audit_logs"("hospitalId", "createdAt");

-- CreateIndex
CREATE INDEX "audit_logs_actorStaffId_createdAt_idx" ON "audit_logs"("actorStaffId", "createdAt");

-- AddForeignKey
ALTER TABLE "branches" ADD CONSTRAINT "branches_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "hospitals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "departments" ADD CONSTRAINT "departments_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "hospitals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "departments" ADD CONSTRAINT "departments_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_staffUserId_fkey" FOREIGN KEY ("staffUserId") REFERENCES "staff_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "hospitals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scoring_policy_versions" ADD CONSTRAINT "scoring_policy_versions_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "hospitals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "survey_versions" ADD CONSTRAINT "survey_versions_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "hospitals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "survey_versions" ADD CONSTRAINT "survey_versions_scoringPolicyVersionId_fkey" FOREIGN KEY ("scoringPolicyVersionId") REFERENCES "scoring_policy_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "categories" ADD CONSTRAINT "categories_surveyVersionId_fkey" FOREIGN KEY ("surveyVersionId") REFERENCES "survey_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "questions" ADD CONSTRAINT "questions_surveyVersionId_fkey" FOREIGN KEY ("surveyVersionId") REFERENCES "survey_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "questions" ADD CONSTRAINT "questions_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "question_translations" ADD CONSTRAINT "question_translations_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feedback_submissions" ADD CONSTRAINT "feedback_submissions_surveyVersionId_fkey" FOREIGN KEY ("surveyVersionId") REFERENCES "survey_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feedback_submissions" ADD CONSTRAINT "feedback_submissions_scoringPolicyVersionId_fkey" FOREIGN KEY ("scoringPolicyVersionId") REFERENCES "scoring_policy_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feedback_submissions" ADD CONSTRAINT "feedback_submissions_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "hospitals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feedback_submissions" ADD CONSTRAINT "feedback_submissions_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feedback_submissions" ADD CONSTRAINT "feedback_submissions_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "answers" ADD CONSTRAINT "answers_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "feedback_submissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "answers" ADD CONSTRAINT "answers_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "questions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "category_scores" ADD CONSTRAINT "category_scores_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "feedback_submissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "category_scores" ADD CONSTRAINT "category_scores_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "category_scores" ADD CONSTRAINT "category_scores_scoringPolicyVersionId_fkey" FOREIGN KEY ("scoringPolicyVersionId") REFERENCES "scoring_policy_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "follow_up_contacts" ADD CONSTRAINT "follow_up_contacts_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "feedback_submissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feedback_cases" ADD CONSTRAINT "feedback_cases_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "feedback_submissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feedback_cases" ADD CONSTRAINT "feedback_cases_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "staff_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "hospitals"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actorStaffId_fkey" FOREIGN KEY ("actorStaffId") REFERENCES "staff_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
