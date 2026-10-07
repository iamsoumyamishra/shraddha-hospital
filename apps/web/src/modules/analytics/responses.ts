import "server-only";
import { prisma } from "@/lib/db";
import type { ReportFilter, ReportScope } from "./overview";
import type { Prisma } from "@hospital/database/client";

export interface ResponseListItem {
  id: string;
  publicId: string;
  source: "PAPER_IMPORT" | "ONLINE";
  submittedAt: Date;
  status: "COMPLETE" | "INCOMPLETE";
  patientIndex: number | null;
  visitType: string;
  locale: string;
  branchName: string | null;
  servicesUsed: string[];
  comment: string | null;
  consentGiven: boolean;
  openCase: boolean;
}

export interface ResponseList {
  items: ResponseListItem[];
  total: number;
  page: number;
  pageSize: number;
}

function where(
  scope: ReportScope,
  filter: ReportFilter,
  status: "COMPLETE" | "INCOMPLETE" | undefined,
): Prisma.FeedbackSubmissionWhereInput {
  return {
    hospitalId: scope.hospitalId,
    ...(scope.branchId ? { branchId: scope.branchId } : {}),
    ...(scope.departmentId ? { departmentId: scope.departmentId } : {}),
    submittedAt: { gte: filter.from, lt: filter.to },
    ...(status ? { status } : {}),
    ...(filter.surveyVersionId ? { surveyVersionId: filter.surveyVersionId } : {}),
    ...(filter.scoringPolicyVersionId
      ? { scoringPolicyVersionId: filter.scoringPolicyVersionId }
      : {}),
    ...(filter.visitType ? { visitType: filter.visitType } : {}),
    ...(filter.locale ? { locale: filter.locale } : {}),
    ...(filter.branchId ? { branchId: filter.branchId } : {}),
  };
}

export async function listResponses(
  scope: ReportScope,
  filter: ReportFilter,
  options: { page: number; pageSize: number; status?: "COMPLETE" | "INCOMPLETE" },
): Promise<ResponseList> {
  const clause = where(scope, filter, options.status);

  const [rows, total] = await Promise.all([
    prisma.feedbackSubmission.findMany({
      where: clause,
      orderBy: { submittedAt: "desc" },
      skip: (options.page - 1) * options.pageSize,
      take: options.pageSize,
      select: {
        id: true,
        publicId: true,
        paperImport: { select: { id: true } },
        submittedAt: true,
        status: true,
        patientIndex: true,
        visitType: true,
        locale: true,
        servicesUsed: true,
        comment: true,
        branch: { select: { name: true } },
        followUpContact: { select: { consentGiven: true } },
        case: { select: { id: true, status: true } },
      },
    }),
    prisma.feedbackSubmission.count({ where: clause }),
  ]);

  return {
    items: rows.map((row) => ({
      id: row.id,
      publicId: row.publicId,
      source: row.paperImport ? "PAPER_IMPORT" : "ONLINE",
      submittedAt: row.submittedAt,
      status: row.status,
      patientIndex: row.patientIndex?.toNumber() ?? null,
      visitType: row.visitType,
      locale: row.locale,
      branchName: row.branch?.name ?? null,
      servicesUsed: row.servicesUsed,
      comment: row.comment,
      consentGiven: row.followUpContact?.consentGiven ?? false,
      openCase: row.case !== null && row.case.status !== "RESOLVED",
    })),
    total,
    page: options.page,
    pageSize: options.pageSize,
  };
}

export interface ResponseDetail {
  id: string;
  publicId: string;
  source: "PAPER_IMPORT" | "ONLINE";
  submittedAt: Date;
  status: "COMPLETE" | "INCOMPLETE";
  patientIndex: number | null;
  visitType: string;
  locale: string;
  respondentRole: "PATIENT" | "CAREGIVER";
  surveyVersion: number;
  scoringPolicyVersion: number;
  branchName: string | null;
  hospitalId: string;
  branchId: string | null;
  departmentId: string | null;
  servicesUsed: string[];
  comment: string | null;
  consentGiven: boolean;
  openCase: boolean;
  categories: Array<{ key: string; score: number | null; answeredCount: number }>;
  answers: Array<{ questionKey: string; prompt: string; rating: number | null; state: string }>;
  contact: {
    displayName: string | null;
    phone: string | null;
    email: string | null;
    privacyNoticeVersion: string;
  } | null;
}

export async function getResponseDetail(submissionId: string): Promise<ResponseDetail | null> {
  const row = await prisma.feedbackSubmission.findUnique({
    where: { id: submissionId },
    select: {
      id: true,
      publicId: true,
      paperImport: { select: { id: true } },
      submittedAt: true,
      status: true,
      patientIndex: true,
      visitType: true,
      locale: true,
      respondentRole: true,
      servicesUsed: true,
      comment: true,
      hospitalId: true,
      branchId: true,
      departmentId: true,
      branch: { select: { name: true } },
      surveyVersion: { select: { version: true } },
      scoringPolicyVersion: { select: { version: true } },
      followUpContact: {
        select: {
          consentGiven: true,
          displayName: true,
          phone: true,
          email: true,
          privacyNoticeVersion: true,
        },
      },
      case: { select: { id: true, status: true } },
      categoryScores: {
        select: {
          score: true,
          answeredCount: true,
          category: { select: { key: true, sortOrder: true } },
        },
      },
      answers: {
        select: {
          value: true,
          state: true,
          question: {
            select: {
              key: true,
              sortOrder: true,
              translations: {
                where: { status: "PUBLISHED", locale: "en" },
                take: 1,
                select: { prompt: true },
              },
            },
          },
        },
      },
    },
  });

  if (!row) {
    return null;
  }

  return {
    id: row.id,
    publicId: row.publicId,
    source: row.paperImport ? "PAPER_IMPORT" : "ONLINE",
    submittedAt: row.submittedAt,
    status: row.status,
    patientIndex: row.patientIndex?.toNumber() ?? null,
    visitType: row.visitType,
    locale: row.locale,
    respondentRole: row.respondentRole,
    surveyVersion: row.surveyVersion.version,
    scoringPolicyVersion: row.scoringPolicyVersion.version,
    branchName: row.branch?.name ?? null,
    hospitalId: row.hospitalId,
    branchId: row.branchId,
    departmentId: row.departmentId,
    servicesUsed: row.servicesUsed,
    comment: row.comment,
    consentGiven: row.followUpContact?.consentGiven ?? false,
    openCase: row.case !== null && row.case.status !== "RESOLVED",
    categories: row.categoryScores
      .map((categoryScore) => ({
        key: categoryScore.category.key,
        score: categoryScore.score?.toNumber() ?? null,
        answeredCount: categoryScore.answeredCount,
      }))
      .sort((a, b) => a.key.localeCompare(b.key)),
    answers: row.answers
      .map((answer) => ({
        questionKey: answer.question.key,
        prompt: answer.question.translations[0]?.prompt ?? answer.question.key,
        rating: answer.state === "ANSWERED" ? answer.value : null,
        state: answer.state,
      }))
      .sort((a, b) => a.questionKey.localeCompare(b.questionKey)),
    contact:
      row.followUpContact?.consentGiven === true
        ? {
            displayName: row.followUpContact.displayName,
            phone: row.followUpContact.phone,
            email: row.followUpContact.email,
            privacyNoticeVersion: row.followUpContact.privacyNoticeVersion,
          }
        : null,
  };
}

export async function listRecentComments(
  scope: ReportScope,
  filter: ReportFilter,
  limit = 6,
): Promise<Array<{ id: string; submittedAt: Date; comment: string; locale: string }>> {
  const rows = await prisma.feedbackSubmission.findMany({
    where: {
      hospitalId: scope.hospitalId,
      ...(scope.branchId ? { branchId: scope.branchId } : {}),
      ...(scope.departmentId ? { departmentId: scope.departmentId } : {}),
      submittedAt: { gte: filter.from, lt: filter.to },
      comment: { not: null },
    },
    orderBy: { submittedAt: "desc" },
    take: limit,
    select: { id: true, submittedAt: true, comment: true, locale: true },
  });
  return rows.map((row) => ({
    id: row.id,
    submittedAt: row.submittedAt,
    comment: row.comment ?? "",
    locale: row.locale,
  }));
}