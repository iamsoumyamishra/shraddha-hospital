import type { WeightStrategy } from "@/modules/scoring";

export const EQUAL: WeightStrategy = {
  mode: "EQUAL_CATEGORY",
  renormaliseOverAnswered: true,
};