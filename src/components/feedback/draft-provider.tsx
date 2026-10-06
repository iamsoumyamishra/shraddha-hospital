"use client";
import { createContext, useContext, useState, type Dispatch, type SetStateAction } from "react";

import type { Locale } from "@/i18n/catalog";
import { createFeedbackIdempotencyKey } from "./idempotency-key";

export interface FeedbackDraft {
  languageChoice: Locale | null;
  step: number;
  privacyAck: boolean;
  visitType: string;
  servicesUsed: string[];
  answers: Record<string, number | "na" | null>;
  overallRating: number | null;
  comment: string;
  contactConsent: boolean;
  contact: { displayName: string; phone: string; email: string };
  error: string | null;
  submitting: boolean;
  acknowledgement: { publicId: string; status: "COMPLETE" | "INCOMPLETE"; patientIndex: number | null; displayDecimals: number } | null;
  idempotencyKey: string;
}
type Store = Record<string, FeedbackDraft>;
const Drafts = createContext<{ store: Store; setStore: Dispatch<SetStateAction<Store>> } | null>(null);

/** Volatile memory only: comments/contact never enter localStorage, URLs or logs. */
export function FeedbackDraftProvider({ children }: { children: React.ReactNode }) {
  const [store, setStore] = useState<Store>({});
  return <Drafts.Provider value={{ store, setStore }}>{children}</Drafts.Provider>;
}
export function useFeedbackDraft(versionId: string, firstVisitType: string) {
  const context = useContext(Drafts);
  const [initial] = useState<FeedbackDraft>(() => ({ languageChoice: null, step: 0, privacyAck: false, visitType: firstVisitType,
    servicesUsed: [], answers: {}, overallRating: null, comment: "", contactConsent: false,
    contact: { displayName: "", phone: "", email: "" }, error: null, submitting: false,
    acknowledgement: null, idempotencyKey: createFeedbackIdempotencyKey() }));
  if (!context) throw new Error("FeedbackDraftProvider missing");
  const { store, setStore } = context;
  const draft = store[versionId] ?? initial;
  function setter<K extends keyof FeedbackDraft>(key: K): Dispatch<SetStateAction<FeedbackDraft[K]>> {
    return (value) => setStore((current) => {
      const previous = current[versionId] ?? initial;
      const next = typeof value === "function" ? (value as (old: FeedbackDraft[K]) => FeedbackDraft[K])(previous[key]) : value;
      return { ...current, [versionId]: { ...previous, [key]: next } };
    });
  }
  return { draft, setter };
}
