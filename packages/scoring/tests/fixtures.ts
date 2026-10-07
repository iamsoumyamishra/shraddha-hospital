import type { WeightStrategy } from "@hospital/scoring";

export const EQUAL: WeightStrategy = {
  mode: "EQUAL_CATEGORY",
  renormaliseOverAnswered: true,
};