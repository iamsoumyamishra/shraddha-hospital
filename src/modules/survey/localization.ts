import { z } from "zod";
import type { FlatMessages } from "@/i18n/translation-workflow";

export const presentationSchema = z.object({
  services: z.array(z.object({ key: z.string().min(1), label: z.string().min(1) })).max(30),
  categoryLabels: z.record(z.string(), z.string()),
});
export interface SurveySource {
  title: string;
  description: string | null;
  visitTypes: string[];
  presentation: z.infer<typeof presentationSchema>;
  ratingLabels: string[];
  questions: Array<{ key: string; prompt: string }>;
}
export function surveySourceMessages(survey: SurveySource): FlatMessages {
  return {
    title: survey.title, description: survey.description ?? "",
    ...Object.fromEntries(survey.visitTypes.map((key) => [`visitTypes.${key}`, key.replaceAll("_", " ")])),
    ...Object.fromEntries(survey.presentation.services.map((service) => [`services.${service.key}`, service.label])),
    ...Object.fromEntries(Object.entries(survey.presentation.categoryLabels).map(([key, label]) => [`categories.${key}`, label])),
    ...Object.fromEntries(survey.ratingLabels.map((label, index) => [`ratings.${index + 1}`, label])),
    ...Object.fromEntries(survey.questions.map((question) => [`questions.${question.key}`, question.prompt])),
  };
}
