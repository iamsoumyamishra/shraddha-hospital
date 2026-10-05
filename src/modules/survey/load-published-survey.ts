import "server-only";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { scoringPolicyRulesSchema, type ScoringPolicyRules } from "@/modules/scoring";
import type { Rating } from "@/modules/scoring";

/**
 * Patient-facing survey chrome stored with the survey version.
 *
 * Keys are language-independent; the labels are the reviewed wording that ships
 * with this version.
 */
const presentationSchema = z.object({
  services: z
    .array(z.object({ key: z.string().min(1), label: z.string().min(1) }))
    .max(30),
  categoryLabels: z.record(z.string(), z.string()),
});

export type SurveyPresentation = z.infer<typeof presentationSchema>;

export interface PublishedQuestion {
  id: string;
  key: string;
  categoryId: string;
  categoryKey: string;
  sortOrder: number;
  prompt: string;
  /**
   * Whether the respondent must give an answer, including an explicit
   * "Not applicable". Read from the stored question rather than assumed, so a
   * later survey version can mark a question optional without a code change.
   */
  isRequired: boolean;
}

export interface PublishedSurvey {
  id: string;
  slug: string;
  version: number;
  title: string;
  description: string | null;
  visitTypes: string[];
  locale: string;
  presentation: SurveyPresentation;
  categories: {
    id: string;
    key: string;
    weight: number;
    sortOrder: number;
  }[];
  questions: PublishedQuestion[];
  scoringPolicy: {
    id: string;
    version: number;
    rules: ScoringPolicyRules;
  };
}

export class SurveyNotFoundError extends Error {
  constructor(slug: string) {
    super(`No published survey found for slug "${slug}"`);
    this.name = "SurveyNotFoundError";
  }
}

export class TranslationNotPublishedError extends Error {
  constructor(questionId: string, locale: string) {
    super(`Question ${questionId} has no published translation for locale "${locale}"`);
    this.name = "TranslationNotPublishedError";
  }
}

/**
 * Load the published survey for a slug, with published translations only.
 *
 * Draft translations are never returned: machine or unreviewed wording must not
 * reach a patient, and the wording a patient sees has to be pinned to this
 * survey version rather than translated at request time.
 */
export async function loadPublishedSurvey(
  slug: string,
  locale: string,
): Promise<PublishedSurvey> {
  const survey = await prisma.surveyVersion.findFirst({
    where: { slug, status: "PUBLISHED" },
    orderBy: { version: "desc" },
    include: {
      scoringPolicyVersion: true,
      categories: { orderBy: { sortOrder: "asc" } },
      questions: {
        orderBy: { sortOrder: "asc" },
        include: {
          translations: { where: { locale, status: "PUBLISHED" } },
        },
      },
    },
  });

  if (!survey) {
    throw new SurveyNotFoundError(slug);
  }

  const questions: PublishedQuestion[] = survey.questions.map((question) => {
    const translation = question.translations[0];
    if (!translation) {
      throw new TranslationNotPublishedError(question.id, locale);
    }
    const category = survey.categories.find((entry) => entry.id === question.categoryId);
    if (!category) {
      throw new Error(`Question ${question.key} references a missing category`);
    }
    return {
      id: question.id,
      key: question.key,
      categoryId: question.categoryId,
      categoryKey: category.key,
      sortOrder: question.sortOrder,
      prompt: translation.prompt,
      isRequired: question.isRequired,
    };
  });

  return {
    id: survey.id,
    slug: survey.slug,
    version: survey.version,
    title: survey.title,
    description: survey.description,
    visitTypes: survey.visitTypes,
    locale,
    presentation: presentationSchema.parse(survey.patientPresentation),
    categories: survey.categories.map((category) => ({
      id: category.id,
      key: category.key,
      weight: Number(category.weight),
      sortOrder: category.sortOrder,
    })),
    questions,
    scoringPolicy: {
      id: survey.scoringPolicyVersionId,
      version: survey.scoringPolicyVersion.version,
      rules: scoringPolicyRulesSchema.parse(survey.scoringPolicyVersion.rules),
    },
  };
}

/** Question IDs a published survey asks. Used to reject unrelated IDs on submit. */
export function publishedQuestionIdSet(survey: PublishedSurvey): Set<string> {
  return new Set(survey.questions.map((question) => question.id));
}

export function requiredQuestionIds(survey: PublishedSurvey): string[] {
  return survey.questions.map((question) => question.id);
}

export type { Rating };