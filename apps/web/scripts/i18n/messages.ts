import "dotenv/config";
import { readFile, writeFile } from "node:fs/promises";
import { candidateLocales } from "../../src/i18n/catalog";
import { changedKeys, contentHash, flattenMessages, isReviewed, nestMessages, sourceHashes, translationIssues, type FlatMessages, type TranslationReview } from "../../src/i18n/translation-workflow";
import { feedbackMessages } from "../../src/i18n/feedback-messages";

const command = process.argv[2] ?? "check";
const option = (key: string) => { const index = process.argv.indexOf(`--${key}`); return index < 0 ? undefined : process.argv[index + 1]; };
const read = async (path: string) => JSON.parse(await readFile(path, "utf8"));
const write = async (path: string, value: unknown) => writeFile(path, `${JSON.stringify(value, null, 2)}\n`);

async function main() {
  const fullSource = flattenMessages(await read("messages/en.json"));
  const source = feedbackMessages(await read("messages/en.json"));
  const reviews = await read("messages/reviews.json") as Partial<Record<string, TranslationReview>>;
  const hashes = await read("messages/source-hashes.json") as Record<string, FlatMessages>;
  const chosen = option("locale");
  const targets = chosen ? [chosen] : candidateLocales.filter((locale) => locale !== "en");
  if (targets.some((locale) => locale !== "hi" && locale !== "mr")) throw new Error("Choose --locale hi or --locale mr");
  if (!["check", "sync", "review"].includes(command)) throw new Error("Use check, sync or review");
  for (const locale of targets as Array<"hi" | "mr">) {
    const fullTarget = flattenMessages(await read(`messages/${locale}.json`));
    const target = feedbackMessages(await read(`messages/${locale}.json`));
    if (command === "check") {
      const published = isReviewed(source, target, reviews[locale]);
      console.log(`${locale}: ${published ? "reviewed" : "draft/unavailable"}; ${translationIssues(source, target).length} content issues; ${changedKeys(source, target, hashes[locale] ?? {}).length} changed source keys`);
      // Unpublished drafts are allowed; stale published content fails the release check.
      if (reviews[locale] && !published) process.exitCode = 1;
    } else if (command === "review") {
      if (!chosen || !option("reviewer")?.trim()) throw new Error("Review requires --locale and --reviewer (name of the human who reviewed the complete feedback journey)");
      const issues = translationIssues(source, target);
      if (issues.length) { console.error(issues.join("\n")); throw new Error("Cannot publish incomplete catalog"); }
      reviews[locale] = { sourceHash: contentHash(source), translationHash: contentHash(target), reviewedBy: option("reviewer")!.trim(), reviewedAt: new Date().toISOString() };
      hashes[locale] = sourceHashes(source);
      await write("messages/reviews.json", reviews);
      await write("messages/source-hashes.json", hashes);
      console.log(`${locale}: recorded human review; rebuild the application to release.`);
    } else {
      const keys = changedKeys(source, target, hashes[locale] ?? {});
      console.log(`${locale}: ${keys.length} source strings need translation`);
      if (process.argv.includes("--dry-run") || !keys.length) continue;
      // Changed wording becomes an empty manual translation draft. No API calls.
      const merged = Object.fromEntries(Object.keys(fullSource).map((key) => [key,
        keys.includes(key) ? "" : fullTarget[key] ?? "",
      ]));
      await write(`messages/${locale}.json`, nestMessages(merged));
      hashes[locale] = sourceHashes(source);
      delete reviews[locale]; // A source change always requires a new human review.
      await write("messages/source-hashes.json", hashes);
      await write("messages/reviews.json", reviews);
      console.log(`${locale}: saved drafts; patient language remains unavailable until reviewed.`);
    }
  }
}
main().catch(() => { console.error("Localization command failed. Check the command arguments, missing translations and manual catalog content. No external translation service is used."); process.exitCode = 1; });
