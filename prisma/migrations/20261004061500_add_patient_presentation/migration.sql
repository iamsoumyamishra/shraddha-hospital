-- Add versioned patient-facing survey chrome (services-used options and category
-- headings) to survey_versions. Additive only: existing rows get an empty
-- presentation object and no survey content changes.
ALTER TABLE "survey_versions"
ADD COLUMN "patientPresentation" JSONB NOT NULL DEFAULT '{}'::jsonb;