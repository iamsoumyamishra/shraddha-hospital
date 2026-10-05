import type { Rating } from "@/modules/scoring";

export const HOSPITAL = {
  name: "Shraddha Hospital",
  slug: "shraddha-hospital",
  timezone: "Asia/Kolkata",
} as const;

export const BRANCHES = [
  { name: "Shraddha Hospital - Kothrud", code: "KTH" },
  { name: "Shraddha Hospital - Baner", code: "BNR" },
] as const;

export const DEPARTMENTS = [
  { branchCode: "KTH", name: "Outpatient", code: "OPD-KTH" },
  { branchCode: "KTH", name: "Pharmacy", code: "PHR-KTH" },
  { branchCode: "KTH", name: "Diagnostics", code: "DGN-KTH" },
  { branchCode: "BNR", name: "Outpatient", code: "OPD-BNR" },
  { branchCode: "BNR", name: "Pharmacy", code: "PHR-BNR" },
  { branchCode: "BNR", name: "Diagnostics", code: "DGN-BNR" },
] as const;

export const SURVEY = {
  slug: "outpatient-experience",
  version: 1,
  title: "Outpatient experience survey",
  description:
    "Tell us about your recent visit. Your answers help us improve the services you use.",
  visitTypes: ["outpatient", "diagnostic", "pharmacy"],
} as const;

export const VISIT_TYPES = SURVEY.visitTypes;

/**
 * Services offered as the segmentation question. This records which parts of
 * the hospital a respondent actually experienced. It does not hide any question:
 * every one of the 15 questions is asked of every respondent.
 */
export const SERVICES_USED = [
  { key: "reception", label: "Reception and registration" },
  { key: "waiting", label: "Waiting area" },
  { key: "consultation", label: "Doctor consultation" },
  { key: "pharmacy", label: "Pharmacy" },
  { key: "laboratory", label: "Laboratory and diagnostics" },
  { key: "billing", label: "Billing and counter" },
] as const;

/**
 * The 15 scored questions, grouped into the categories they contribute to.
 * Weights are equal across categories, never across questions, so a category
 * with three questions does not outweigh a category with one.
 */
export const CATEGORY_DEFINITIONS = [
  { key: "reception", sortOrder: 1, label: "Reception" },
  { key: "waiting_experience", sortOrder: 2, label: "Waiting" },
  { key: "doctor_communication", sortOrder: 3, label: "Doctor communication" },
  { key: "staff_behaviour", sortOrder: 4, label: "Staff behaviour" },
  { key: "cleanliness", sortOrder: 5, label: "Cleanliness" },
  { key: "billing_clarity", sortOrder: 6, label: "Billing" },
  { key: "pharmacy", sortOrder: 7, label: "Pharmacy" },
  { key: "laboratory", sortOrder: 8, label: "Laboratory" },
  { key: "accessibility", sortOrder: 9, label: "Accessibility" },
] as const;

export type CategoryKey = (typeof CATEGORY_DEFINITIONS)[number]["key"];

export const SERVICE_CATEGORY_KEYS: Record<string, CategoryKey> = {
  reception: "reception",
  waiting: "waiting_experience",
  consultation: "doctor_communication",
  pharmacy: "pharmacy",
  laboratory: "laboratory",
  billing: "billing_clarity",
};

export interface SeedQuestion {
  key: string;
  categoryKey: CategoryKey;
  sortOrder: number;
  prompt: string;
}

/** Exactly 15 scored questions. */
export const QUESTIONS: readonly SeedQuestion[] = [
  {
    key: "reception_greeting",
    categoryKey: "reception",
    sortOrder: 1,
    prompt: "The staff at reception greeted me politely.",
  },
  {
    key: "reception_wait_time",
    categoryKey: "reception",
    sortOrder: 2,
    prompt: "It took a reasonable amount of time to complete registration at reception.",
  },
  {
    key: "waiting_cleanliness",
    categoryKey: "waiting_experience",
    sortOrder: 3,
    prompt: "The waiting area was clean.",
  },
  {
    key: "waiting_comfort",
    categoryKey: "waiting_experience",
    sortOrder: 4,
    prompt: "The waiting area was comfortable enough for my visit.",
  },
  {
    key: "doctor_listens",
    categoryKey: "doctor_communication",
    sortOrder: 5,
    prompt: "The doctor listened to my concerns.",
  },
  {
    key: "doctor_explains",
    categoryKey: "doctor_communication",
    sortOrder: 6,
    prompt: "The doctor explained things in a way I could understand.",
  },
  {
    key: "doctor_time",
    categoryKey: "doctor_communication",
    sortOrder: 7,
    prompt: "The doctor spent enough time with me during the consultation.",
  },
  {
    key: "staff_respect",
    categoryKey: "staff_behaviour",
    sortOrder: 8,
    prompt: "Hospital staff treated me with respect.",
  },
  {
    key: "staff_helpfulness",
    categoryKey: "staff_behaviour",
    sortOrder: 9,
    prompt: "Staff were helpful when I asked for assistance.",
  },
  {
    key: "cleanliness_rooms",
    categoryKey: "cleanliness",
    sortOrder: 10,
    prompt: "The rooms and consultation areas were clean.",
  },
  {
    key: "cleanliness_bathrooms",
    categoryKey: "cleanliness",
    sortOrder: 11,
    prompt: "The bathrooms were clean and usable.",
  },
  {
    key: "billing_explained",
    categoryKey: "billing_clarity",
    sortOrder: 12,
    prompt: "The charges were explained to me clearly.",
  },
  {
    key: "pharmacy_service",
    categoryKey: "pharmacy",
    sortOrder: 13,
    prompt: "The pharmacy counter served me promptly.",
  },
  {
    key: "laboratory_service",
    categoryKey: "laboratory",
    sortOrder: 14,
    prompt: "The laboratory staff handled my sample efficiently.",
  },
  {
    key: "accessibility",
    categoryKey: "accessibility",
    sortOrder: 15,
    prompt: "I could move around the hospital easily, including for someone with a disability.",
  },
] as const;

/**
 * Synthetic rating bias per category key, used to give the seeded dashboards a
 * realistic shape instead of flat noise. Values are mean ratings on the 1-5 scale.
 */
export const CATEGORY_BIAS: Record<CategoryKey, number> = {
  reception: 3.1,
  waiting_experience: 2.9,
  doctor_communication: 4.3,
  staff_behaviour: 3.6,
  cleanliness: 3.4,
  billing_clarity: 2.6,
  pharmacy: 2.8,
  laboratory: 3.2,
  accessibility: 3.0,
};

export const BRANCH_BIAS: Record<string, number> = {
  KTH: -0.2,
  BNR: 0.15,
};

export function clampRating(value: number): Rating {
  const rounded = Math.round(value);
  if (rounded < 1) return 1;
  if (rounded > 5) return 5;
  return rounded as Rating;
}