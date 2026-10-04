import "server-only";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { writeAuditLog } from "@/modules/audit/log";
import type { StaffContext } from "@/lib/authorization";
import {
  assertCanAccessSubmission,
  canManageCases,
  hasAtLeastRole,
  NotAuthorisedError,
} from "@/lib/authorization";

export interface CaseListItem {
  id: string;
  status: "OPEN" | "IN_PROGRESS" | "RESOLVED";
  createdAt: Date;
  resolutionNote: string | null;
  submissionId: string;
  submissionPublicId: string;
  submittedAt: Date;
  patientIndex: number | null;
  branchName: string | null;
  comment: string | null;
  assigneeName: string | null;
}

export const caseStatusSchema = z.enum(["OPEN", "IN_PROGRESS", "RESOLVED"]);

/**
 * Cases carry a denormalised hospitalId and branchId, so the listing is scoped
 * in SQL on the same columns the submission scope check uses. The extra
 * in-memory membership check below is a second gate, not the only one.
 */
function caseScope(staff: StaffContext) {
  const hospitalWide = staff.memberships.some((m) => m.scopeType === "HOSPITAL");
  const branchIds = staff.memberships
    .filter((m) => m.scopeType === "BRANCH" || m.scopeType === "DEPARTMENT")
    .map((m) => m.branchId)
    .filter((id): id is string => id !== null);

  return hospitalWide
    ? {}
    : { OR: [{ branchId: { in: branchIds } }, { branchId: null }] };
}

export async function listCases(staff: StaffContext): Promise<CaseListItem[]> {
  const rows = await prisma.feedbackCase.findMany({
    where: {
      submission: {
        hospitalId: { in: [...new Set(staff.memberships.map((m) => m.hospitalId))] },
      },
      ...caseScope(staff),
    },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    select: {
      id: true,
      status: true,
      createdAt: true,
      resolutionNote: true,
      submissionId: true,
      assignedTo: { select: { displayName: true } },
      submission: {
        select: {
          publicId: true,
          submittedAt: true,
          patientIndex: true,
          comment: true,
          branch: { select: { name: true } },
        },
      },
    },
  });

  return rows.map((row) => ({
    id: row.id,
    status: row.status,
    createdAt: row.createdAt,
    resolutionNote: row.resolutionNote,
    submissionId: row.submissionId,
    submissionPublicId: row.submission.publicId,
    submittedAt: row.submission.submittedAt,
    patientIndex: row.submission.patientIndex?.toNumber() ?? null,
    branchName: row.submission.branch?.name ?? null,
    comment: row.submission.comment,
    assigneeName: row.assignedTo?.displayName ?? null,
  }));
}

export async function createCase(staff: StaffContext, submissionId: string): Promise<string> {
  if (!canManageCases(staff)) {
    throw new NotAuthorisedError("This role cannot open follow-up cases");
  }

  const submission = await prisma.feedbackSubmission.findUnique({
    where: { id: submissionId },
    select: { id: true, hospitalId: true, branchId: true, departmentId: true },
  });
  if (!submission) {
    throw new NotAuthorisedError("Submission not found");
  }
  assertCanAccessSubmission(staff, submission);

  const existing = await prisma.feedbackCase.findUnique({
    where: { submissionId },
    select: { id: true },
  });
  if (existing) {
    return existing.id;
  }

  const created = await prisma.feedbackCase.create({
    data: {
      submissionId,
      hospitalId: submission.hospitalId,
      branchId: submission.branchId,
      status: "OPEN",
      assignedToId: staff.staffUserId,
    },
    select: { id: true },
  });

  await writeAuditLog({
    hospitalId: submission.hospitalId,
    actorStaffId: staff.staffUserId,
    action: "CREATE_CASE",
    entityType: "FeedbackCase",
    entityId: created.id,
  });

  return created.id;
}

export async function updateCase(
  staff: StaffContext,
  caseId: string,
  input: { status: "OPEN" | "IN_PROGRESS" | "RESOLVED"; resolutionNote?: string },
): Promise<void> {
  if (!canManageCases(staff)) {
    throw new NotAuthorisedError("This role cannot update follow-up cases");
  }

  const record = await prisma.feedbackCase.findUnique({
    where: { id: caseId },
    select: {
      hospitalId: true,
      submission: { select: { hospitalId: true, branchId: true, departmentId: true } },
    },
  });
  if (!record) {
    throw new NotAuthorisedError("Case not found");
  }
  assertCanAccessSubmission(staff, record.submission);

  const note = input.resolutionNote?.trim() || null;
  if (input.status === "RESOLVED" && !note) {
    throw new Error("A resolution note is required to mark a case resolved");
  }

  await prisma.feedbackCase.update({
    where: { id: caseId },
    data: {
      status: input.status,
      resolutionNote: note,
      resolvedAt: input.status === "RESOLVED" ? new Date() : null,
    },
  });

  await writeAuditLog({
    hospitalId: record.hospitalId,
    actorStaffId: staff.staffUserId,
    action: "UPDATE_CASE",
    entityType: "FeedbackCase",
    entityId: caseId,
    metadata: {
      status: input.status,
      hadResolutionNote: note !== null,
      role: staff.memberships
        .filter((membership) => hasAtLeastRole(membership.role, "DEPARTMENT_HEAD"))
        .map((membership) => membership.role)
        .join(",") || null,
    },
  });
}