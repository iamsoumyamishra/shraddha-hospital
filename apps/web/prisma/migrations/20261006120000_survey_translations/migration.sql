CREATE TABLE "survey_translations" (
  "id" UUID NOT NULL,
  "surveyVersionId" UUID NOT NULL,
  "locale" TEXT NOT NULL,
  "content" JSONB NOT NULL,
  "sourceHash" TEXT NOT NULL,
  "translationHash" TEXT NOT NULL,
  "status" "TranslationStatus" NOT NULL DEFAULT 'DRAFT',
  "reviewedBy" TEXT,
  "reviewedAt" TIMESTAMPTZ(3),
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "survey_translations_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "survey_translations_surveyVersionId_fkey" FOREIGN KEY ("surveyVersionId") REFERENCES "survey_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "survey_translation_review" CHECK ("status" <> 'PUBLISHED' OR (length(trim("reviewedBy")) > 0 AND "reviewedBy" IS NOT NULL AND "reviewedAt" IS NOT NULL))
);
CREATE UNIQUE INDEX "survey_translations_surveyVersionId_locale_key" ON "survey_translations"("surveyVersionId", "locale");
-- A published locale is immutable. Corrected wording needs a new survey version.
CREATE FUNCTION protect_published_survey_translation() RETURNS trigger AS $$
BEGIN
  IF OLD.status = 'PUBLISHED' THEN
    RAISE EXCEPTION 'Published survey translations are immutable; create a new survey version';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER immutable_published_survey_translation
BEFORE UPDATE ON "survey_translations"
FOR EACH ROW EXECUTE FUNCTION protect_published_survey_translation();
