import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { loadPublishedSurvey, SurveyNotFoundError, TranslationNotPublishedError } from "@/modules/survey/load-published-survey";
import { FeedbackForm } from "@/components/feedback/feedback-form";

export const dynamic = "force-dynamic";

export default async function FeedbackSurveyPage({
  params,
}: {
  params: Promise<{ locale: string; surveySlug: string }>;
}) {
  const { locale, surveySlug } = await params;
  setRequestLocale(locale);

  let survey: Awaited<ReturnType<typeof loadPublishedSurvey>>;
  try {
    survey = await loadPublishedSurvey(surveySlug, locale);
  } catch (error) {
    if (error instanceof SurveyNotFoundError || error instanceof TranslationNotPublishedError) {
      notFound();
    }
    throw error;
  }

  return (
    <main className="mx-auto w-full max-w-3xl px-5 py-6 sm:px-8 sm:py-10">
      <FeedbackForm
        survey={{
          slug: survey.slug,
          title: survey.title,
          description: survey.description,
          visitTypes: survey.visitTypes,
          presentation: survey.presentation,
          categoryLabels: survey.presentation.categoryLabels,
          questions: survey.questions.map((question) => ({
            id: question.id,
            key: question.key,
            categoryKey: question.categoryKey,
            sortOrder: question.sortOrder,
            prompt: question.prompt,
          })),
          ratingScale: survey.scoringPolicy.rules.scale,
        }}
      />
    </main>
  );
}