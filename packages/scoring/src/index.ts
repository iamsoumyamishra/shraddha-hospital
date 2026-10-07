import { RATING_MAX, RATING_MIN, ScoringError, assertRating, isRating } from "./errors";
import type { Rating } from "./errors";
import { POLICY_V1, scoringPolicyRulesSchema } from "./policy";
import type { CompletionRule, RatingScale, ScoringPolicyRules, WeightStrategy } from "./policy";

export type { Rating };
export type { CompletionRule, RatingScale, ScoringPolicyRules, WeightStrategy };
export { POLICY_V1, scoringPolicyRulesSchema, ScoringError, isRating, assertRating, RATING_MIN, RATING_MAX };

/** Map a 1-5 rating onto 0-100. */
export function ratingToScore(rating: Rating): number {
  assertRating(rating);
  return ((rating - RATING_MIN) / (RATING_MAX - RATING_MIN)) * 100;
}

/**
 * Mean of the valid scored answers in one category.
 * Returns null when there are none: a category with no valid answer has no
 * score, which is different from a score of zero.
 */
export function computeCategoryScore(ratings: readonly Rating[]): number | null {
  if (ratings.length === 0) {
    return null;
  }
  let total = 0;
  for (const rating of ratings) {
    total += ratingToScore(rating);
  }
  return total / ratings.length;
}

export interface CategoryScoreInput {
  categoryId: string;
  categoryKey: string;
  /** Weight from the published survey. Must be finite and positive. */
  weight: number;
  /** Already-computed category score, or null when the category was not answered. */
  score: number | null;
}

export interface PatientIndexResult {
  /** 0-100, unrounded. Precision is preserved here and rounded only for display. */
  index: number;
  /** Categories that contributed, i.e. those with a score. */
  includedCategoryIds: string[];
  excludedCategoryIds: string[];
  /** Sum of the weights actually used after renormalisation. */
  weightTotal: number;
}

/**
 * Weighted mean of answered category scores, renormalised over answered
 * categories only. Categories without a score are excluded from both the
 * numerator and the denominator rather than treated as zero.
 */
export function computePatientIndex(
  categories: readonly CategoryScoreInput[],
  weights: WeightStrategy,
): PatientIndexResult {
  const answered = categories.filter((category) => category.score !== null);

  for (const category of categories) {
    assertPositiveWeight(category.weight, category.categoryKey);
  }

  if (answered.length === 0) {
    throw new ScoringError("Cannot compute a patient index: no category has a valid score");
  }

  const weightTotal = answered.reduce((sum, category) => sum + category.weight, 0);
  if (!Number.isFinite(weightTotal) || weightTotal <= 0) {
    throw new ScoringError(`Sum of category weights must be finite and positive, received ${weightTotal}`);
  }

  let weighted = 0;
  for (const category of answered) {
    const score = category.score as number;
    if (!Number.isFinite(score) || score < 0 || score > 100) {
      throw new ScoringError(
        `Category ${category.categoryKey} has a score outside 0-100: ${String(category.score)}`,
      );
    }
    weighted += score * category.weight;
  }

  // Renormalising divides by the weights actually used, so a patient who
  // experienced fewer services is not penalised for the categories that did
  // not apply to them. Without renormalisation the denominator is every
  // published weight, which lowers the index for unanswered categories.
  const denominator = weights.renormaliseOverAnswered
    ? weightTotal
    : categories.reduce((sum, category) => sum + category.weight, 0);

  if (!Number.isFinite(denominator) || denominator <= 0) {
    throw new ScoringError(`Weight denominator must be finite and positive, received ${denominator}`);
  }

  const index = weighted / denominator;

  return {
    index,
    includedCategoryIds: answered.map((category) => category.categoryId),
    excludedCategoryIds: categories
      .filter((category) => category.score === null)
      .map((category) => category.categoryId),
    weightTotal: denominator,
  };
}

export interface CompletionResult {
  status: "COMPLETE" | "INCOMPLETE";
  scoredCategoryCount: number;
  /** Categories that were applicable but produced no score. */
  unansweredCategoryIds: string[];
  missingRequiredQuestionIds: string[];
  /** True when the submission must be refused rather than stored as incomplete. */
  blocked: boolean;
  reason?: string;
}

export interface CompletionInput {
  /** Categories that produced a score. */
  scoredCategoryIds: readonly string[];
  /** Categories that were applicable but produced no score. */
  unansweredCategoryIds: readonly string[];
  /** Applicable required questions the respondent left without an answer. */
  missingRequiredQuestionIds: readonly string[];
  rule: CompletionRule;
}

/**
 * Decide whether a submission is complete. A submission that clears the
 * completion rule has an official index; one that does not is stored as
 * incomplete and never receives a number.
 */
export function evaluateCompletion(input: CompletionInput): CompletionResult {
  const scoredCategoryCount = input.scoredCategoryIds.length;
  const base = {
    scoredCategoryCount,
    unansweredCategoryIds: [...input.unansweredCategoryIds],
    missingRequiredQuestionIds: [...input.missingRequiredQuestionIds],
  };

  if (input.missingRequiredQuestionIds.length > 0 && input.rule.blockOnMissingRequired) {
    return {
      ...base,
      status: "INCOMPLETE",
      blocked: true,
      reason: "Required questions were left unanswered",
    };
  }

  const meetsThreshold = scoredCategoryCount >= input.rule.minScoredCategories;

  if (meetsThreshold) {
    return { ...base, status: "COMPLETE", blocked: false };
  }

  if (!input.rule.allowIncomplete) {
    return {
      ...base,
      status: "INCOMPLETE",
      blocked: true,
      reason: `Fewer than ${input.rule.minScoredCategories} scored categories`,
    };
  }

  return {
    ...base,
    status: "INCOMPLETE",
    blocked: false,
    reason: `Fewer than ${input.rule.minScoredCategories} scored categories`,
  };
}

function assertPositiveWeight(weight: number, categoryKey: string): void {
  if (typeof weight !== "number" || !Number.isFinite(weight) || weight <= 0) {
    throw new ScoringError(
      `Category ${categoryKey} must have a finite positive weight, received ${String(weight)}`,
    );
  }
}

export interface ScoredAnswerInput {
  questionId: string;
  categoryId: string;
  rating: Rating | null;
}

export interface CategoryScoreResult {
  categoryId: string;
  categoryKey: string;
  weight: number;
  score: number | null;
  answeredCount: number;
}

export interface SubmissionScoreResult {
  status: "COMPLETE" | "INCOMPLETE";
  patientIndex: number | null;
  categories: CategoryScoreResult[];
  scoredCategoryIds: string[];
  unansweredCategoryIds: string[];
  missingRequiredQuestionIds: string[];
  blocked: boolean;
}

/**
 * Full server-side scoring for one submission. This is the only function that
 * decides what gets stored; the client preview reuses the same maths but its
 * result is never authoritative.
 */
export function computeSubmissionScores(input: {
  categories: readonly { categoryId: string; categoryKey: string; weight: number }[];
  answers: readonly ScoredAnswerInput[];
  requiredQuestionIds: readonly string[];
  answeredQuestionIds: readonly string[];
  rules: ScoringPolicyRules;
}): SubmissionScoreResult {
  const categoryById = new Map(input.categories.map((category) => [category.categoryId, category]));

  for (const answer of input.answers) {
    if (!categoryById.has(answer.categoryId)) {
      throw new ScoringError(`Answer references unknown category ${answer.categoryId}`);
    }
  }

  const ratingsByCategory = new Map<string, Rating[]>();
  for (const answer of input.answers) {
    if (answer.rating === null) {
      continue;
    }
    assertRating(answer.rating);
    const bucket = ratingsByCategory.get(answer.categoryId) ?? [];
    bucket.push(answer.rating);
    ratingsByCategory.set(answer.categoryId, bucket);
  }

  const categories: CategoryScoreResult[] = input.categories.map((category) => {
    const ratings = ratingsByCategory.get(category.categoryId) ?? [];
    return {
      categoryId: category.categoryId,
      categoryKey: category.categoryKey,
      weight: category.weight,
      score: computeCategoryScore(ratings),
      answeredCount: ratings.length,
    };
  });

  const scoredCategoryIds = categories
    .filter((category) => category.score !== null)
    .map((category) => category.categoryId);
  const unansweredCategoryIds = categories
    .filter((category) => category.score === null)
    .map((category) => category.categoryId);

  const answered = new Set(input.answeredQuestionIds);
  const missingRequiredQuestionIds = input.requiredQuestionIds.filter((id) => !answered.has(id));

  const completion = evaluateCompletion({
    scoredCategoryIds,
    unansweredCategoryIds,
    missingRequiredQuestionIds,
    rule: input.rules.completion,
  });

  if (completion.blocked || completion.status === "INCOMPLETE") {
    return {
      status: "INCOMPLETE",
      patientIndex: null,
      categories,
      scoredCategoryIds,
      unansweredCategoryIds,
      missingRequiredQuestionIds,
      blocked: completion.blocked,
    };
  }

  const weighted = computePatientIndex(
    categories.map((category) => ({
      categoryId: category.categoryId,
      categoryKey: category.categoryKey,
      weight: category.weight,
      score: category.score,
    })),
    input.rules.weights,
  );

  return {
    status: "COMPLETE",
    patientIndex: weighted.index,
    categories,
    scoredCategoryIds,
    unansweredCategoryIds,
    missingRequiredQuestionIds: [],
    blocked: false,
  };
}

/** Round for display only. Stored values keep full precision. */
export function roundForDisplay(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}