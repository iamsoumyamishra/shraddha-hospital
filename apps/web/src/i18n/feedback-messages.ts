import { flattenMessages, type FlatMessages } from "./translation-workflow";

/** Only patient-facing wording participates in feedback language approval. */
export function feedbackMessages(catalog: unknown): FlatMessages {
  const flat = flattenMessages(catalog);
  return Object.fromEntries(Object.entries(flat).filter(([key]) =>
    key.startsWith("survey.") || key.startsWith("language.") ||
    ["brand.name", "brand.tagline", "ui.surveyProgress", "ui.surveyHint", "ui.openingFeedback"].includes(key),
  ));
}
