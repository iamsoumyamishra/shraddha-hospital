/**
 * Create an isolated build with synthetic review records, using only the test
 * database. Never writes approvals to the application checkout/development DB.
 * Run with: pnpm exec tsx tests/e2e/localization-fixture.ts
 */
import "dotenv/config";
import { randomBytes } from "node:crypto";
import { cp, mkdir, mkdtemp, readFile, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { contentHash, translationIssues } from "../../src/i18n/translation-workflow";
import { feedbackMessages } from "../../src/i18n/feedback-messages";
import { presentationSchema, surveySourceMessages } from "../../src/modules/survey/localization";
import { scoringPolicyRulesSchema } from "../../src/modules/scoring/policy";

async function main() {
  const testUrl = process.env.TEST_DATABASE_URL;
  if (!testUrl || testUrl === process.env.DATABASE_URL) throw new Error("A separate TEST_DATABASE_URL is required");
  process.env.DATABASE_URL = testUrl;
  const { prisma } = await import("../../src/lib/db");
  try {
    const survey = await prisma.surveyVersion.findFirstOrThrow({ where: { slug: "outpatient-experience", status: "PUBLISHED" }, orderBy: { version: "desc" }, include: {
      scoringPolicyVersion: true, questions: { include: { translations: { where: { locale: "en", status: "PUBLISHED" } } } },
    } });
    const source = surveySourceMessages({ title: survey.title, description: survey.description, visitTypes: survey.visitTypes,
      presentation: presentationSchema.parse(survey.patientPresentation), ratingLabels: scoringPolicyRulesSchema.parse(survey.scoringPolicyVersion.rules).scale.labels,
      questions: survey.questions.map((question) => ({ key: question.key, prompt: question.translations[0]!.prompt })) });
    for (const locale of ["hi", "mr"] as const) {
      const template = JSON.parse(await readFile(`translations/surveys/outpatient-experience-v1.${locale}.json`, "utf8"));
      if (template.sourceHash !== contentHash(source) || translationIssues(source, template.content).length) throw new Error("Test seed does not match starter translation template");
      const previous = await prisma.surveyTranslation.findUnique({ where: { surveyVersionId_locale: { surveyVersionId: survey.id, locale } } });
      if (!previous) await prisma.surveyTranslation.create({ data: { surveyVersionId: survey.id, locale, content: template.content,
        sourceHash: contentHash(source), translationHash: contentHash(template.content), status: "PUBLISHED", reviewedBy: "Synthetic E2E fixture ONLY", reviewedAt: new Date() } });
    }
    const directory = await mkdtemp(join(tmpdir(), "hospital-localization-e2e-"));
    for (const path of ["src", "messages", "public", "prisma", "translations", "scripts", "package.json", "pnpm-lock.yaml", "next.config.ts", "postcss.config.mjs", "tsconfig.json", "prisma.config.ts", "next-env.d.ts"]) {
      await cp(path, join(directory, path), { recursive: true });
    }
    await symlink(join(process.cwd(), "node_modules"), join(directory, "node_modules"));
    await mkdir(join(directory, ".next"));
    const english = feedbackMessages(JSON.parse(await readFile("messages/en.json", "utf8")));
    const reviews = Object.fromEntries(await Promise.all(["hi", "mr"].map(async (locale) => [locale, {
      sourceHash: contentHash(english), translationHash: contentHash(feedbackMessages(JSON.parse(await readFile(`messages/${locale}.json`, "utf8")))),
      reviewedBy: "Synthetic E2E fixture ONLY", reviewedAt: new Date().toISOString(),
    }])));
    await writeFile(join(directory, "messages/reviews.json"), `${JSON.stringify(reviews, null, 2)}\n`);
    // Only the temporary build receives these test credentials. Never log them.
    await writeFile(join(directory, ".env"), `DATABASE_URL=${JSON.stringify(testUrl)}\nBETTER_AUTH_SECRET=${JSON.stringify(randomBytes(32).toString("hex"))}\nBETTER_AUTH_URL="http://localhost:3111"\nNEXT_PUBLIC_APP_URL="http://localhost:3111"\nPUBLIC_FEEDBACK_MODE="qr"\nHOSPITAL_ENABLED_LOCALES="en,hi,mr"\nHOSPITAL_DEFAULT_LOCALE="en"\n`, { mode: 0o600 });
    console.log(directory);
  } finally { await prisma.$disconnect(); }
}
main().catch(() => { console.error("Isolated locale fixture failed. Verify the separate test database has seeded v1 and matching templates."); process.exitCode = 1; });
