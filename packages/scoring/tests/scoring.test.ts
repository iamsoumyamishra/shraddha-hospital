import { describe, expect, it } from "vitest";
import {
  POLICY_V1,
  ScoringError,
  computeCategoryScore,
  computePatientIndex,
  computeSubmissionScores,
  evaluateCompletion,
  ratingToScore,
  roundForDisplay,
  type Rating,
} from "@hospital/scoring";
import { EQUAL } from "./fixtures";

describe("ratingToScore", () => {
  it("maps the 1-5 scale onto 0-100", () => {
    expect(ratingToScore(1)).toBe(0);
    expect(ratingToScore(2)).toBe(25);
    expect(ratingToScore(3)).toBe(50);
    expect(ratingToScore(4)).toBe(75);
    expect(ratingToScore(5)).toBe(100);
  });

  it("preserves full precision rather than pre-rounding", () => {
    expect(ratingToScore(3)).toBe(50);
    const sum = [1, 2, 3, 4, 5].map((r) => ratingToScore(r as Rating)).reduce((a, b) => a + b, 0);
    expect(sum / 5).toBe(50);
  });

  it.each([
    [0],
    [6],
    [-1],
    [2.5],
    [Number.NaN],
    [Number.POSITIVE_INFINITY],
  ])("rejects out-of-range or non-integer rating %s", (value) => {
    expect(() => ratingToScore(value as Rating)).toThrow(ScoringError);
  });
});

describe("computeCategoryScore", () => {
  it("averages the valid scored answers in a category", () => {
    expect(computeCategoryScore([4, 5, 3])).toBe(75);
    expect(computeCategoryScore([5])).toBe(100);
  });

  it("returns null rather than zero when there are no valid answers", () => {
    expect(computeCategoryScore([])).toBeNull();
  });

  it("does not let an unanswered question drag the average down", () => {
    expect(computeCategoryScore([5, 5])).toBe(100);
  });
});

describe("computePatientIndex", () => {
  it("reproduces the worked example from the scoring specification", () => {
    // 75, 25, 100, 75, 100, 50 with equal weights -> 70.833... -> displays as 70.8
    const scores = [75, 25, 100, 75, 100, 50];
    const result = computePatientIndex(
      scores.map((score, index) => ({
        categoryId: `c${index}`,
        categoryKey: `category-${index}`,
        weight: 1,
        score,
      })),
      EQUAL,
    );

    expect(result.index).toBeCloseTo(70.8333, 4);
    expect(roundForDisplay(result.index, POLICY_V1.display.decimals)).toBe(70.8);
  });

  it("renormalises over answered categories only", () => {
    // Three answered categories, three with no score. The unanswered ones must
    // not be treated as zero, so the index is the mean of the answered three.
    const result = computePatientIndex(
      [
        { categoryId: "a", categoryKey: "a", weight: 1, score: 100 },
        { categoryId: "b", categoryKey: "b", weight: 1, score: 50 },
        { categoryId: "c", categoryKey: "c", weight: 1, score: 0 },
        { categoryId: "d", categoryKey: "d", weight: 1, score: null },
        { categoryId: "e", categoryKey: "e", weight: 1, score: null },
        { categoryId: "f", categoryKey: "f", weight: 1, score: null },
      ],
      EQUAL,
    );

    expect(result.index).toBeCloseTo(50, 6);
    expect(result.includedCategoryIds).toEqual(["a", "b", "c"]);
    expect(result.excludedCategoryIds).toEqual(["d", "e", "f"]);
    expect(result.weightTotal).toBe(3);
  });

  it("honours unequal published weights", () => {
    const result = computePatientIndex(
      [
        { categoryId: "a", categoryKey: "a", weight: 3, score: 100 },
        { categoryId: "b", categoryKey: "b", weight: 1, score: 0 },
      ],
      EQUAL,
    );

    expect(result.index).toBeCloseTo(75, 6);
  });

  it("rejects when no category has a valid score", () => {
    expect(() =>
      computePatientIndex(
        [
          { categoryId: "a", categoryKey: "a", weight: 1, score: null },
          { categoryId: "b", categoryKey: "b", weight: 1, score: null },
        ],
        EQUAL,
      ),
    ).toThrow(ScoringError);
  });

  it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY])(
    "rejects non-positive or non-finite weight %s",
    (weight) => {
      expect(() =>
        computePatientIndex(
          [{ categoryId: "a", categoryKey: "a", weight: weight as number, score: 50 }],
          EQUAL,
        ),
      ).toThrow(ScoringError);
    },
  );

  it.each([-0.1, 100.1, Number.NaN])("rejects an out-of-range category score %s", (score) => {
    expect(() =>
      computePatientIndex(
        [{ categoryId: "a", categoryKey: "a", weight: 1, score: score as number }],
        EQUAL,
      ),
    ).toThrow(ScoringError);
  });
});

describe("evaluateCompletion", () => {
  const rule = POLICY_V1.completion;

  it("treats exactly the threshold number of scored categories as complete", () => {
    const result = evaluateCompletion({
      scoredCategoryIds: ["a", "b", "c", "d"],
      unansweredCategoryIds: ["e", "f"],
      missingRequiredQuestionIds: [],
      rule,
    });

    expect(result.status).toBe("COMPLETE");
    expect(result.blocked).toBe(false);
    expect(result.scoredCategoryCount).toBe(4);
  });

  it("falls one category below the threshold", () => {
    const result = evaluateCompletion({
      scoredCategoryIds: ["a", "b", "c"],
      unansweredCategoryIds: ["d", "e", "f"],
      missingRequiredQuestionIds: [],
      rule,
    });

    expect(result.status).toBe("INCOMPLETE");
    expect(result.blocked).toBe(false);
    expect(result.scoredCategoryCount).toBe(3);
  });

  it("blocks submission when required applicable questions are missing", () => {
    const result = evaluateCompletion({
      scoredCategoryIds: ["a", "b", "c", "d", "e"],
      unansweredCategoryIds: [],
      missingRequiredQuestionIds: ["q9"],
      rule,
    });

    expect(result.status).toBe("INCOMPLETE");
    expect(result.blocked).toBe(true);
  });

  it("counts distinct scored categories, not answers", () => {
    const result = evaluateCompletion({
      scoredCategoryIds: ["a"],
      unansweredCategoryIds: [],
      missingRequiredQuestionIds: [],
      rule,
    });

    expect(result.scoredCategoryCount).toBe(1);
    expect(result.status).toBe("INCOMPLETE");
  });
});

describe("computeSubmissionScores", () => {
  const categories = [
    { categoryId: "reception", categoryKey: "reception", weight: 1 },
    { categoryId: "pharmacy", categoryKey: "pharmacy", weight: 1 },
    { categoryId: "laboratory", categoryKey: "laboratory", weight: 1 },
    { categoryId: "cleanliness", categoryKey: "cleanliness", weight: 1 },
  ];

  it("produces an index and per-category scores for a complete submission", () => {
    const result = computeSubmissionScores({
      categories,
      answers: [
        { questionId: "q1", categoryId: "reception", rating: 4 },
        { questionId: "q2", categoryId: "pharmacy", rating: 5 },
        { questionId: "q3", categoryId: "laboratory", rating: 4 },
        { questionId: "q4", categoryId: "cleanliness", rating: 3 },
      ],
      requiredQuestionIds: ["q1", "q2", "q3", "q4"],
      answeredQuestionIds: ["q1", "q2", "q3", "q4"],
      rules: POLICY_V1,
    });

    // 75, 100, 75, 50 across four equally weighted categories.
    expect(result.status).toBe("COMPLETE");
    expect(result.patientIndex).not.toBeNull();
    expect(roundForDisplay(result.patientIndex as number, 1)).toBe(75);
    expect(result.categories.every((category) => category.answeredCount === 1)).toBe(true);
  });

  it("excludes not-applicable answers from numerator and denominator", () => {
    const result = computeSubmissionScores({
      categories,
      answers: [
        { questionId: "q1", categoryId: "reception", rating: 5 },
        { questionId: "q2", categoryId: "reception", rating: null },
        { questionId: "q3", categoryId: "pharmacy", rating: 5 },
        { questionId: "q4", categoryId: "laboratory", rating: 5 },
        { questionId: "q5", categoryId: "cleanliness", rating: 5 },
      ],
      requiredQuestionIds: ["q1", "q3", "q4", "q5"],
      answeredQuestionIds: ["q1", "q2", "q3", "q4", "q5"],
      rules: POLICY_V1,
    });

    expect(result.status).toBe("COMPLETE");
    const reception = result.categories.find((category) => category.categoryId === "reception");
    expect(reception?.answeredCount).toBe(1);
    expect(reception?.score).toBe(100);
  });

  it("withholds the index entirely when below the completion threshold", () => {
    const result = computeSubmissionScores({
      categories,
      answers: [
        { questionId: "q1", categoryId: "reception", rating: 5 },
        { questionId: "q2", categoryId: "pharmacy", rating: 5 },
      ],
      requiredQuestionIds: [],
      answeredQuestionIds: ["q1", "q2"],
      rules: POLICY_V1,
    });

    expect(result.status).toBe("INCOMPLETE");
    expect(result.patientIndex).toBeNull();
    expect(result.categories.find((c) => c.categoryId === "laboratory")?.score).toBeNull();
  });

  it("rejects an answer pointing at a category that is not in the survey", () => {
    expect(() =>
      computeSubmissionScores({
        categories,
        answers: [{ questionId: "q1", categoryId: "not-a-category", rating: 5 }],
        requiredQuestionIds: [],
        answeredQuestionIds: [],
        rules: POLICY_V1,
      }),
    ).toThrow(ScoringError);
  });

  it("rejects an out-of-range rating before it can reach storage", () => {
    expect(() =>
      computeSubmissionScores({
        categories,
        answers: [{ questionId: "q1", categoryId: "reception", rating: 6 as Rating }],
        requiredQuestionIds: [],
        answeredQuestionIds: [],
        rules: POLICY_V1,
      }),
    ).toThrow(ScoringError);
  });
});

describe("roundForDisplay", () => {
  it("rounds to the configured number of decimals", () => {
    expect(roundForDisplay(70.8333, 1)).toBe(70.8);
    expect(roundForDisplay(70.8333, 0)).toBe(71);
    expect(roundForDisplay(70.8333, 2)).toBe(70.83);
  });

  it("does not mutate stored precision", () => {
    const raw = 70.833333333;
    roundForDisplay(raw, 1);
    expect(raw).toBe(70.833333333);
  });
});