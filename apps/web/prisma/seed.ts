import "dotenv/config";
import { randomUUID } from "node:crypto";
import { hashPassword } from "better-auth/crypto";
import { PrismaPg } from "@prisma/adapter-pg";
import { Prisma, PrismaClient } from "@hospital/database/client";
import { computeSubmissionScores } from "@hospital/scoring";
import { POLICY_V1 } from "@hospital/scoring/policy";
import {
  BRANCHES,
  BRANCH_BIAS,
  CATEGORY_BIAS,
  CATEGORY_DEFINITIONS,
  DEPARTMENTS,
  HOSPITAL,
  QUESTIONS,
  SERVICES_USED,
  SURVEY,
  VISIT_TYPES,
  clampRating,
} from "./seed-data";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is not set");
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

const LOCALE = "en";
const DAYS_OF_HISTORY = 90;
const TARGET_SUBMISSIONS = 220;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Deterministic PRNG so repeated seeds produce a comparable dataset. */
function makeRandom(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1_664_525 + 1_013_904_223) % 4_294_967_296;
    return state / 4_294_967_296;
  };
}

/**
 * Hospital-wide memberships have null branch and department, which Prisma will
 * not accept in a compound unique selector. Look the row up explicitly instead.
 */
async function ensureMembershipId(staffUserId: string, hospitalId: string): Promise<string> {
  const existing = await prisma.membership.findFirst({
    where: { staffUserId, hospitalId, scopeType: "HOSPITAL", branchId: null, departmentId: null },
    select: { id: true },
  });
  if (existing) {
    return existing.id;
  }
  const created = await prisma.membership.create({
    data: { staffUserId, hospitalId, role: "HOSPITAL_ADMIN", scopeType: "HOSPITAL" },
    select: { id: true },
  });
  return created.id;
}

const random = makeRandom(20_260_401);

function pick<T>(items: readonly T[]): T {
  const item = items[Math.floor(random() * items.length)];
  if (item === undefined) {
    throw new Error("Cannot pick from an empty list");
  }
  return item;
}

/**
 * Approximately normal rating noise, roughly in [-2, 2].
 *
 * Sum of three uniform samples minus 1.5, scaled. Narrow noise produced a
 * distribution piled up on 3 with almost no 1s or 5s, which made the histogram
 * on the dashboard look broken rather than realistic.
 */
function noise(): number {
  return (random() + random() + random() - 1.5) * 1.5;
}

async function main(): Promise<void> {
  console.log("Seeding", HOSPITAL.name);

  const hospital = await prisma.hospital.upsert({
    where: { slug: HOSPITAL.slug },
    update: { name: HOSPITAL.name, timezone: HOSPITAL.timezone },
    create: {
      name: HOSPITAL.name,
      slug: HOSPITAL.slug,
      timezone: HOSPITAL.timezone,
    },
  });

  const branchByCode = new Map<string, string>();
  for (const branch of BRANCHES) {
    const row = await prisma.branch.upsert({
      where: { hospitalId_code: { hospitalId: hospital.id, code: branch.code } },
      update: { name: branch.name },
      create: { hospitalId: hospital.id, name: branch.name, code: branch.code },
    });
    branchByCode.set(branch.code, row.id);
  }

  const departmentByKey = new Map<string, string>();
  for (const department of DEPARTMENTS) {
    const branchId = branchByCode.get(department.branchCode);
    if (!branchId) {
      throw new Error(`Unknown branch code ${department.branchCode}`);
    }
    const row = await prisma.department.upsert({
      where: { hospitalId_code: { hospitalId: hospital.id, code: department.code } },
      update: { name: department.name },
      create: {
        hospitalId: hospital.id,
        branchId,
        name: department.name,
        code: department.code,
      },
    });
    departmentByKey.set(department.code, row.id);
  }

  const scoringPolicy = await prisma.scoringPolicyVersion.upsert({
    where: { hospitalId_version: { hospitalId: hospital.id, version: 1 } },
    // Persisted here as well as on create so that an existing development
    // database converges onto the authored policy instead of silently keeping
    // a stale one. In production a published policy is immutable and a change
    // would create version 2 with a new survey version pointing at it.
    update: { rules: POLICY_V1 },
    create: {
      hospitalId: hospital.id,
      version: 1,
      name: "Equal category weights, four-category completion threshold",
      isActive: true,
      rules: POLICY_V1,
    },
  });

  const surveyVersion = await prisma.surveyVersion.upsert({
    where: {
      hospitalId_slug_version: {
        hospitalId: hospital.id,
        slug: SURVEY.slug,
        version: SURVEY.version,
      },
    },
    // The seed is the authoring path for this version in development. In
    // production a published version is immutable and changes create v2.
    update: {
      patientPresentation: {
        services: SERVICES_USED.map((service) => ({ key: service.key, label: service.label })),
        categoryLabels: Object.fromEntries(
          CATEGORY_DEFINITIONS.map((category) => [category.key, category.label]),
        ),
      },
    },
    create: {
      hospitalId: hospital.id,
      slug: SURVEY.slug,
      version: SURVEY.version,
      title: SURVEY.title,
      description: SURVEY.description,
      visitTypes: [...SURVEY.visitTypes],
      patientPresentation: {
        services: SERVICES_USED.map((service) => ({ key: service.key, label: service.label })),
        categoryLabels: Object.fromEntries(
          CATEGORY_DEFINITIONS.map((category) => [category.key, category.label]),
        ),
      },
      status: "PUBLISHED",
      scoringPolicyVersionId: scoringPolicy.id,
      publishedAt: new Date(),
    },
  });

  const categoryByKey = new Map<string, string>();
  for (const category of CATEGORY_DEFINITIONS) {
    const row = await prisma.category.upsert({
      where: {
        surveyVersionId_key: {
          surveyVersionId: surveyVersion.id,
          key: category.key,
        },
      },
      update: { sortOrder: category.sortOrder },
      create: {
        surveyVersionId: surveyVersion.id,
        key: category.key,
        // Equal weights across categories, never across questions.
        weight: 1,
        sortOrder: category.sortOrder,
        isCore: true,
      },
    });
    categoryByKey.set(category.key, row.id);
  }

  const questionByKey = new Map<string, { id: string; categoryId: string }>();
  for (const question of QUESTIONS) {
    const categoryId = categoryByKey.get(question.categoryKey);
    if (!categoryId) {
      throw new Error(`Unknown category ${question.categoryKey}`);
    }
    const row = await prisma.question.upsert({
      where: {
        surveyVersionId_key: {
          surveyVersionId: surveyVersion.id,
          key: question.key,
        },
      },
      update: { sortOrder: question.sortOrder },
      create: {
        surveyVersionId: surveyVersion.id,
        categoryId,
        key: question.key,
        type: "RATING",
        isRequired: true,
        sortOrder: question.sortOrder,
        // Every v1 question is asked of every respondent, so no applicability
        // rule is set. Omitted rather than null: Prisma treats a JSON null as a
        // SQL NULL, not as the JSON value null.
        appliesWhen: Prisma.DbNull,
      },
    });

    await prisma.questionTranslation.upsert({
      where: { questionId_locale: { questionId: row.id, locale: LOCALE } },
      update: {},
      create: {
        questionId: row.id,
        locale: LOCALE,
        prompt: question.prompt,
        status: "PUBLISHED",
        reviewedAt: new Date(),
      },
    });

    questionByKey.set(question.key, { id: row.id, categoryId });
  }

  const staffEmail = process.env.SEED_STAFF_EMAIL ?? "admin@shraddha.example";
  const staffPassword = process.env.SEED_STAFF_PASSWORD;

  const authUser = await prisma.user.upsert({
    where: { email: staffEmail },
    update: {},
    create: { name: "Demo Administrator", email: staffEmail, emailVerified: true },
  });

  const staffUser = await prisma.staffUser.upsert({
    where: { authUserId: authUser.id },
    update: {},
    create: {
      authUserId: authUser.id,
      email: staffEmail,
      displayName: "Demo Administrator",
    },
  });

  await prisma.membership.upsert({
    where: { id: await ensureMembershipId(staffUser.id, hospital.id) },
    update: {},
    create: {
      staffUserId: staffUser.id,
      hospitalId: hospital.id,
      role: "HOSPITAL_ADMIN",
      scopeType: "HOSPITAL",
    },
  });

  // A credential row is only created when a password is supplied, so a normal
  // seed cannot silently leave a known password on a real account. Set
  // SEED_STAFF_PASSWORD to get a sign-in-able demo user.
  if (staffPassword) {
    const existingCredential = await prisma.account.findFirst({
      where: { userId: authUser.id, providerId: "credential" },
      select: { id: true },
    });
    const hashed = await hashPassword(staffPassword);
    if (existingCredential) {
      await prisma.account.update({
        where: { id: existingCredential.id },
        data: { password: hashed },
      });
    } else {
      await prisma.account.create({
        data: {
          accountId: authUser.id,
          providerId: "credential",
          userId: authUser.id,
          password: hashed,
        },
      });
    }
  }

  // Synthetic submissions. Existing ones are left alone so re-seeding is safe.
  const existingCount = await prisma.feedbackSubmission.count();
  if (existingCount > 0) {
    console.log(`Skipping submissions: ${existingCount} already present`);
  } else {
    await seedSubmissions();
  }

  console.log("Seed complete.");
  console.log(`  survey: /en/feedback/${SURVEY.slug}`);
  console.log(
    staffPassword
      ? `  staff:  ${staffEmail} (password from SEED_STAFF_PASSWORD)`
      : `  staff:  ${staffEmail} (no password set; re-run with SEED_STAFF_PASSWORD to sign in)`,
  );
}

async function seedSubmissions(): Promise<void> {
  const surveyVersion = await prisma.surveyVersion.findFirstOrThrow({
    where: { slug: SURVEY.slug, status: "PUBLISHED" },
    include: { categories: true },
  });
  const questions = await prisma.question.findMany({
    where: { surveyVersionId: surveyVersion.id },
    orderBy: { sortOrder: "asc" },
  });
  const branches = await prisma.branch.findMany();
  const departments = await prisma.department.findMany();

  const categories = surveyVersion.categories.map((category) => ({
    categoryId: category.id,
    categoryKey: category.key,
    weight: Number(category.weight),
  }));

  const now = Date.now();
  let created = 0;

  for (let index = 0; index < TARGET_SUBMISSIONS; index += 1) {
    const daysAgo = Math.floor(random() * DAYS_OF_HISTORY);
    const submittedAt = new Date(now - daysAgo * DAY_MS - Math.floor(random() * DAY_MS));

    const branch = pick(branches);
    const branchDepartments = departments.filter(
      (department) => department.branchId === branch.id,
    );
    const department = branchDepartments.length > 0 ? pick(branchDepartments) : null;

    const branchBias = BRANCH_BIAS[branch.code] ?? 0;
    const visitType = pick(VISIT_TYPES);

    const servicesUsed = SERVICES_USED.map((service) => service.key).filter(
      () => random() > 0.25,
    );

    const answers = questions.map((question) => {
      const category = surveyVersion.categories.find(
        (entry) => entry.id === question.categoryId,
      );
      const bias = category ? (CATEGORY_BIAS[category.key as keyof typeof CATEGORY_BIAS] ?? 3.2) : 3.2;
      const rating = clampRating(bias + branchBias + noise());
      return { questionId: question.id, categoryId: question.categoryId, rating };
    });

    const scores = computeSubmissionScores({
      categories,
      answers,
      requiredQuestionIds: questions.map((question) => question.id),
      answeredQuestionIds: answers.map((answer) => answer.questionId),
      rules: POLICY_V1,
    });

    const isIncomplete = random() < 0.07;

    const commentPool = [
      "The doctor explained everything clearly and did not rush me.",
      "Long wait at the pharmacy counter. Please add more staff in the evening.",
      "Reception asked me to fill the same form twice.",
      "Billing charges were not explained. I did not know what I was paying for.",
      "Waiting area was crowded and the chairs were not clean.",
      "Staff were respectful and the lab reports came the same day.",
      null,
      null,
      null,
    ];

    const wantsContact = random() < 0.15;

    await prisma.feedbackSubmission.create({
      data: {
        publicId: randomUUID().replace(/-/g, ""),
        surveyVersionId: surveyVersion.id,
        scoringPolicyVersionId: surveyVersion.scoringPolicyVersionId,
        hospitalId: surveyVersion.hospitalId,
        branchId: branch.id,
        departmentId: department?.id ?? null,
        status: isIncomplete ? "INCOMPLETE" : scores.status,
        patientIndex: isIncomplete
          ? null
          : scores.patientIndex === null
            ? null
            : scores.patientIndex.toFixed(4),
        respondentRole: random() < 0.2 ? "CAREGIVER" : "PATIENT",
        locale: LOCALE,
        visitType,
        servicesUsed,
        overallRating: pick([2, 3, 4, 4, 5, 5]),
        comment: pick(commentPool),
        idempotencyKey: randomUUID(),
        submittedAt,
        answers: {
          create: answers.map((answer) => ({
            questionId: answer.questionId,
            state: "ANSWERED",
            value: answer.rating,
          })),
        },
        categoryScores: {
          create: scores.categories.map((category) => ({
            categoryId: category.categoryId,
            scoringPolicyVersionId: surveyVersion.scoringPolicyVersionId,
            score: category.score === null ? null : category.score.toFixed(4),
            answeredCount: category.answeredCount,
          })),
        },
        ...(wantsContact
          ? {
              followUpContact: {
                create: {
                  displayName: "Synthetic Respondent",
                  phone: "+91 90000 00000",
                  email: "respondent@example.invalid",
                  consentGiven: true,
                  privacyNoticeVersion: "2026-01",
                },
              },
            }
          : {}),
      },
    });

    created += 1;
  }

  // A handful of open cases so the case workflow has something to show.
  const withComments = await prisma.feedbackSubmission.findMany({
    where: { comment: { not: null } },
    take: 6,
    orderBy: { submittedAt: "desc" },
  });

  for (const [index, submission] of withComments.entries()) {
    await prisma.feedbackCase.upsert({
      where: { submissionId: submission.id },
      update: {},
      create: {
        submissionId: submission.id,
        hospitalId: submission.hospitalId,
        branchId: submission.branchId,
        status: index < 2 ? "IN_PROGRESS" : "OPEN",
      },
    });
  }

  console.log(`Created ${created} synthetic submissions and ${withComments.length} cases`);
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => {
    void prisma.$disconnect();
  });