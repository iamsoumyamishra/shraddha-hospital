import "server-only";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { scoringPolicyRulesSchema, type ScoringPolicyRules } from "@hospital/scoring";
import type { Rating } from "@hospital/scoring";
import { presentationSchema, surveySourceMessages } from "./localization";
import { isReviewed, type TranslationReview } from "@/i18n/translation-workflow";
import { getEnabledLocales } from "@/i18n/availability";
import type { Locale } from "@/i18n/catalog";

/** Stable service/category identifiers with locale-specific public labels. */
export type SurveyPresentation = z.infer<typeof presentationSchema>;

export interface PublishedQuestion {
  id: string;
  key: string;
  type: "RATING" | "TEXT" | "OVERALL";
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
  visitTypeLabels: Record<string, string>;
  ratingLabels: string[];
  availableLocales: Locale[];
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
  versionId?: string,
): Promise<PublishedSurvey> {
  // A pinned UUID must stay within the hospital selected by trusted public
  // survey configuration. Ambiguous cross-hospital slugs fail closed.
  const hospitalSlug = process.env.PUBLIC_SURVEY_HOSPITAL_SLUG?.trim();
  const scopes = await prisma.surveyVersion.findMany({
    where: { slug, status: "PUBLISHED", ...(hospitalSlug ? { hospital: { slug: hospitalSlug } } : {}) },
    select: { hospitalId: true }, distinct: ["hospitalId"], take: 2,
  });
  if (scopes.length !== 1) throw new SurveyNotFoundError(slug);
  const survey = await prisma.surveyVersion.findFirst({
    where: { slug, hospitalId: scopes[0]!.hospitalId, status: "PUBLISHED", ...(versionId ? { id: versionId } : {}) },
    orderBy: { version: "desc" },
    include: {
      scoringPolicyVersion: true,
      translations: { where: { status: "PUBLISHED" } },
      categories: { orderBy: { sortOrder: "asc" } },
      questions: {
        orderBy: { sortOrder: "asc" },
        include: {
          translations: { where: { locale: "en", status: "PUBLISHED" } },
        },
      },
    },
  });

  if (!survey) {
    throw new SurveyNotFoundError(slug);
  }

  const presentation = presentationSchema.parse(survey.patientPresentation);
  const rules = scoringPolicyRulesSchema.parse(survey.scoringPolicyVersion.rules);
  const source = surveySourceMessages({ title: survey.title, description: survey.description,
    visitTypes: survey.visitTypes, presentation, ratingLabels: rules.scale.labels,
    questions: survey.questions.map((question) => {
      const english = question.translations[0];
      if (!english) throw new TranslationNotPublishedError(question.id, "en");
      return { key: question.key, prompt: english.prompt };
    }) });
  const enabled = getEnabledLocales();
  const published = survey.translations.filter((entry) => {
    const target = z.record(z.string(), z.string()).safeParse(entry.content);
    return target.success && isReviewed(source, target.data, {
      sourceHash: entry.sourceHash, translationHash: entry.translationHash,
      reviewedBy: entry.reviewedBy ?? "", reviewedAt: entry.reviewedAt?.toISOString() ?? "",
    } satisfies TranslationReview);
  });
  const availableLocales = enabled.filter((candidate) => candidate === "en" || published.some((entry) => entry.locale === candidate));
  if (!availableLocales.includes(locale as Locale)) throw new TranslationNotPublishedError(survey.id, locale);
  const wording = locale === "en" ? source : z.record(z.string(), z.string()).parse(published.find((entry) => entry.locale === locale)!.content);

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
      type: question.type,
      categoryId: question.categoryId,
      categoryKey: category.key,
      sortOrder: question.sortOrder,
      prompt: wording[`questions.${question.key}`]!,
      isRequired: question.isRequired,
    };
  });

  return {
    id: survey.id,
    slug: survey.slug,
    version: survey.version,
    title: wording.title!,
    description: wording.description || null,
    visitTypes: survey.visitTypes,
    locale,
    presentation: {
      services: presentation.services.map((service) => ({ key: service.key, label: wording[`services.${service.key}`]! })),
      categoryLabels: Object.fromEntries(Object.keys(presentation.categoryLabels).map((key) => [key, wording[`categories.${key}`]!])),
    },
    visitTypeLabels: Object.fromEntries(survey.visitTypes.map((key) => [key, wording[`visitTypes.${key}`]!])),
    ratingLabels: rules.scale.labels.map((_, index) => wording[`ratings.${index + 1}`]!),
    availableLocales,
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
      rules,
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
