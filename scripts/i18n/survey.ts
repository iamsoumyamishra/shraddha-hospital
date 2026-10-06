import "dotenv/config";
import { randomUUID } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { z } from "zod";
import { prisma } from "../../src/lib/db";
import { presentationSchema, surveySourceMessages } from "../../src/modules/survey/localization";
import { scoringPolicyRulesSchema } from "../../src/modules/scoring/policy";
import { changedKeys, contentHash, isReviewed, sourceHashes, translationIssues, type FlatMessages, type TranslationReview } from "../../src/i18n/translation-workflow";

const bundleSchema = z.object({ surveyVersionId: z.string().uuid(), locale: z.enum(["hi", "mr"]),
  sourceHash: z.string(), sourceHashes: z.record(z.string(), z.string()),
  content: z.record(z.string(), z.string()), review: z.object({ sourceHash: z.string(), translationHash: z.string(), reviewedBy: z.string(), reviewedAt: z.string() }).nullable() });
const option = (key: string) => { const index = process.argv.indexOf(`--${key}`); return index < 0 ? undefined : process.argv[index + 1]; };
const save = (file: string, value: unknown, exclusive = false) => writeFile(file, `${JSON.stringify(value, null, 2)}\n`, { flag: exclusive ? "wx" : "w" });

async function getSource(id: string) {
  const survey = await prisma.surveyVersion.findUniqueOrThrow({ where: { id }, include: {
    scoringPolicyVersion: true, questions: { orderBy: { sortOrder: "asc" }, include: { translations: { where: { locale: { in: ["en", "hi", "mr"] } } } } },
  } });
  if (survey.status !== "PUBLISHED") throw new Error("Only a published English survey can be translated");
  const content = surveySourceMessages({ title: survey.title, description: survey.description, visitTypes: survey.visitTypes,
    presentation: presentationSchema.parse(survey.patientPresentation),
    ratingLabels: scoringPolicyRulesSchema.parse(survey.scoringPolicyVersion.rules).scale.labels,
    questions: survey.questions.map((question) => {
      const english = question.translations.find((translation) => translation.locale === "en" && translation.status === "PUBLISHED");
      if (!english) throw new Error("Published English question translation missing");
      return { key: question.key, prompt: english.prompt };
    }) });
  return { survey, content };
}

async function main() {
  const command = process.argv[2];
  const file = option("file");
  if (!file || !["export", "sync", "review", "publish"].includes(command ?? "")) throw new Error("Use export/sync/review/publish --file <path>");
  if (command === "export") {
    const id = z.string().uuid().parse(option("id"));
    const locale = z.enum(["hi", "mr"]).parse(option("locale"));
    const { survey, content } = await getSource(id);
    let draftContent = Object.fromEntries(Object.keys(content).map((key) => [key, key.startsWith("questions.")
      ? survey.questions.find((question) => `questions.${question.key}` === key)?.translations.find((translation) => translation.locale === locale)?.prompt ?? "" : ""]));
    let hashes: FlatMessages = sourceHashes(content);
    const templateFile = option("template");
    if (templateFile) {
      const template = z.object({ slug: z.string(), version: z.number(), locale: z.string(), sourceHash: z.string(), content: z.record(z.string(), z.string()) })
        .parse(JSON.parse(await readFile(templateFile, "utf8")));
      if (template.slug !== survey.slug || template.version !== survey.version || template.locale !== locale || template.sourceHash !== contentHash(content) || translationIssues(content, template.content).length) {
        throw new Error("Starter template does not match this English survey revision");
      }
      draftContent = template.content;
      hashes = sourceHashes(content);
    }
    await save(file, { surveyVersionId: id, locale, sourceHash: contentHash(content), sourceHashes: hashes, content: draftContent, review: null }, true);
    console.log("Exported public survey wording as an unpublished translation template.");
    return;
  }
  const bundle = bundleSchema.parse(JSON.parse(await readFile(file, "utf8")));
  const { survey, content: source } = await getSource(bundle.surveyVersionId);
  if (command === "sync") {
    const keys = changedKeys(source, bundle.content, bundle.sourceHashes);
    if (!keys.length) { console.log("No changed survey wording."); return; }
    bundle.content = Object.fromEntries(Object.keys(source).map((key) => [key, keys.includes(key) ? "" : bundle.content[key] ?? ""]));
    bundle.sourceHash = contentHash(source);
    bundle.sourceHashes = sourceHashes(source);
    bundle.review = null;
    await save(file, bundle);
    console.log(`Saved ${keys.length} manual survey draft fields. Human review is required.`);
    return;
  }
  if (bundle.sourceHash !== contentHash(source)) throw new Error("Stale English revision; export/sync again");
  const issues = translationIssues(source, bundle.content);
  if (issues.length) { console.error(issues.join("\n")); throw new Error("Incomplete translation"); }
  if (command === "review") {
    const reviewer = option("reviewer")?.trim();
    if (!reviewer) throw new Error("Supply the name of the human reviewer with --reviewer");
    bundle.review = { sourceHash: bundle.sourceHash, translationHash: contentHash(bundle.content), reviewedBy: reviewer, reviewedAt: new Date().toISOString() };
    bundle.sourceHashes = sourceHashes(source);
    await save(file, bundle);
    console.log("Recorded human review. Publishing is a separate command.");
    return;
  }
  if (!isReviewed(source, bundle.content, bundle.review ?? undefined)) throw new Error("Missing/stale human review");
  const review = bundle.review as TranslationReview;
  await prisma.$transaction(async (tx) => {
    const existing = await tx.surveyTranslation.findUnique({ where: { surveyVersionId_locale: { surveyVersionId: survey.id, locale: bundle.locale } } });
    if (existing?.status === "PUBLISHED") throw new Error("Published translations are immutable; create a new survey version");
    const data = { content: bundle.content, sourceHash: review.sourceHash, translationHash: review.translationHash, status: "PUBLISHED" as const,
      reviewedBy: review.reviewedBy, reviewedAt: new Date(review.reviewedAt) };
    await tx.surveyTranslation.upsert({ where: { surveyVersionId_locale: { surveyVersionId: survey.id, locale: bundle.locale } },
      create: { id: randomUUID(), surveyVersionId: survey.id, locale: bundle.locale, ...data }, update: data });
    for (const question of survey.questions) {
      const old = await tx.questionTranslation.findUnique({ where: { questionId_locale: { questionId: question.id, locale: bundle.locale } } });
      if (old?.status === "PUBLISHED" && old.prompt !== bundle.content[`questions.${question.key}`]) throw new Error("Published question translations cannot be overwritten");
      if (!old || old.status !== "PUBLISHED") await tx.questionTranslation.upsert({ where: { questionId_locale: { questionId: question.id, locale: bundle.locale } },
        create: { questionId: question.id, locale: bundle.locale, prompt: bundle.content[`questions.${question.key}`]!, status: "PUBLISHED", reviewedAt: new Date(review.reviewedAt) },
        update: { prompt: bundle.content[`questions.${question.key}`]!, status: "PUBLISHED", reviewedAt: new Date(review.reviewedAt) } });
    }
  });
  console.log("Published reviewed wording for this survey version. UI review and hospital enabled locales still gate patient availability.");
}
main().catch(() => { console.error("Survey localization failed. Check arguments, review state and database configuration. Published wording cannot be replaced."); process.exitCode = 1; }).finally(() => prisma.$disconnect());
