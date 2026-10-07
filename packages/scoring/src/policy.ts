import { z } from "zod";

/**
 * Shape of the `rules` JSON on a ScoringPolicyVersion row. Policies are stored
 * as data, not code, so a scoring change is a new policy version rather than a
 * deployment. Parsing every read keeps a malformed policy from reaching the maths.
 */
export const ratingScaleSchema = z.object({
  min: z.literal(1),
  max: z.literal(5),
  labels: z.array(z.string().min(1)).length(5),
});

export const completionRuleSchema = z.object({
  /**
   * Minimum number of scored categories required for an official index.
   * Provisional value for v1: confirm against pilot data before publishing.
   */
  minScoredCategories: z.number().int().min(1),
  /** Missing required applicable answers block submission outright. */
  blockOnMissingRequired: z.boolean(),
  /** Otherwise the submission is accepted but carries no official index. */
  allowIncomplete: z.boolean(),
});

export const weightStrategySchema = z.object({
  mode: z.literal("EQUAL_CATEGORY"),
  /**
   * When true, a submission's weights are renormalised across answered
   * categories only, so a patient who used fewer services is not penalised.
   */
  renormaliseOverAnswered: z.boolean(),
});

export const displaySchema = z.object({
  decimals: z.number().int().min(0).max(3),
});

export const scoringPolicyRulesSchema = z.object({
  scale: ratingScaleSchema,
  completion: completionRuleSchema,
  weights: weightStrategySchema,
  display: displaySchema,
});

export type RatingScale = z.infer<typeof ratingScaleSchema>;
export type CompletionRule = z.infer<typeof completionRuleSchema>;
export type WeightStrategy = z.infer<typeof weightStrategySchema>;
export type ScoringPolicyRules = z.infer<typeof scoringPolicyRulesSchema>;

export const POLICY_V1: ScoringPolicyRules = {
  scale: {
    min: 1,
    max: 5,
    labels: [
      "Very dissatisfied",
      "Dissatisfied",
      "Neutral",
      "Satisfied",
      "Very satisfied",
    ],
  },
  completion: {
    minScoredCategories: 4,
    blockOnMissingRequired: true,
    allowIncomplete: true,
  },
  weights: {
    mode: "EQUAL_CATEGORY",
    renormaliseOverAnswered: true,
  },
  display: {
    decimals: 1,
  },
};