import { createHash } from "node:crypto";

export type FlatMessages = Record<string, string>;
export interface TranslationReview {
  sourceHash: string;
  translationHash: string;
  reviewedBy: string;
  reviewedAt: string;
}

export function flattenMessages(value: unknown, prefix = ""): FlatMessages {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Expected a message object");
  const result: FlatMessages = {};
  for (const [key, child] of Object.entries(value)) {
    if (["__proto__", "constructor", "prototype"].includes(key) || key.includes(".")) throw new Error("Invalid message key");
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof child === "string") result[path] = child;
    else Object.assign(result, flattenMessages(child, path));
  }
  return result;
}

export function nestMessages(flat: FlatMessages): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [path, value] of Object.entries(flat)) {
    const keys = path.split(".");
    let node = result;
    for (const key of keys.slice(0, -1)) {
      if (["__proto__", "constructor", "prototype"].includes(key)) throw new Error("Invalid message key");
      node[key] ??= {};
      node = node[key] as Record<string, unknown>;
    }
    const key = keys.at(-1)!;
    if (["__proto__", "constructor", "prototype"].includes(key)) throw new Error("Invalid message key");
    node[key] = value;
  }
  return result;
}

export function contentHash(flat: FlatMessages): string {
  return createHash("sha256").update(JSON.stringify(Object.entries(flat).sort(([a], [b]) => a.localeCompare(b)))).digest("hex");
}

export function sourceHashes(flat: FlatMessages): FlatMessages {
  return Object.fromEntries(Object.entries(flat).map(([key, text]) => [key, contentHash({ text })]));
}

// Current catalog uses simple ICU arguments. Fail closed on unsupported ICU
// syntax rather than accepting a translation whose plural/select branches differ.
function argumentsIn(text: string): string[] {
  if (/\{[^{}]*,/.test(text)) throw new Error("Plural/select ICU messages require an explicit reviewed parser upgrade");
  const args = [...text.matchAll(/\{([\w]+)\}/g)].map((match) => match[1]!);
  if (/[{}]/.test(text.replace(/\{[\w]+\}/g, ""))) throw new Error("Malformed ICU argument");
  return args.sort();
}

export function translationIssues(source: FlatMessages, target: FlatMessages): string[] {
  const issues: string[] = [];
  for (const [key, text] of Object.entries(source)) {
    if (!target[key]?.trim() && text.trim()) { issues.push(`${key}: missing translation`); continue; }
    if (!text.trim() && target[key]?.trim()) { issues.push(`${key}: empty source has translated wording`); continue; }
    try {
      if (JSON.stringify(argumentsIn(text)) !== JSON.stringify(argumentsIn(target[key] ?? ""))) issues.push(`${key}: arguments differ`);
    } catch { issues.push(`${key}: unsupported or malformed ICU`); }
  }
  for (const key of Object.keys(target)) if (!(key in source)) issues.push(`${key}: obsolete key`);
  return issues;
}

export function isReviewed(source: FlatMessages, target: FlatMessages, review?: TranslationReview): boolean {
  return Boolean(typeof review?.reviewedBy === "string" && review.reviewedBy.trim() && Number.isFinite(Date.parse(review.reviewedAt)) &&
    review.sourceHash === contentHash(source) && review.translationHash === contentHash(target) &&
    translationIssues(source, target).length === 0);
}

export function changedKeys(source: FlatMessages, target: FlatMessages, hashes: FlatMessages): string[] {
  const current = sourceHashes(source);
  return Object.keys(source).filter((key) => hashes[key] !== current[key] || !(key in target) || (!target[key]?.trim() && Boolean(source[key]?.trim())));
}
