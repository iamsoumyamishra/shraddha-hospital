import { describe, expect, it } from "vitest";
import { managementRequestSchema, surveyDraftSchema } from "@/modules/survey/management-schema";

const question = { key: "reception", categoryKey: "reception", prompts: { en: "How was reception?", hi: "", mr: "" } };
const draft = { title: "Patient feedback", description: "", questions: [question] };

describe("survey editor validation", () => {
  it("allows untranslated drafts but requires complete English wording", () => {
    expect(surveyDraftSchema.safeParse(draft).success).toBe(true);
    expect(surveyDraftSchema.safeParse({ ...draft, questions: [{ ...question, prompts: { ...question.prompts, en: " " } }] }).success).toBe(false);
  });
  it("rejects duplicate identifiers, empty surveys and excessive wording", () => {
    expect(surveyDraftSchema.safeParse({ ...draft, questions: [question, question] }).success).toBe(false);
    expect(surveyDraftSchema.safeParse({ ...draft, questions: [] }).success).toBe(false);
    expect(surveyDraftSchema.safeParse({ ...draft, questions: [{ ...question, prompts: { ...question.prompts, en: "x".repeat(1001) } }] }).success).toBe(false);
  });
  it("rejects client-selected hospital IDs, scoring policies and invalid revisions", () => {
    expect(managementRequestSchema.safeParse({ action: "clone", surveyId: "00000000-0000-4000-8000-000000000001", hospitalId: "foreign" }).success).toBe(false);
    expect(surveyDraftSchema.safeParse({ ...draft, scoringPolicyVersionId: "foreign" }).success).toBe(false);
    expect(managementRequestSchema.safeParse({ action: "publish", surveyId: "00000000-0000-4000-8000-000000000001", revision: "stale" }).success).toBe(false);
  });
});
