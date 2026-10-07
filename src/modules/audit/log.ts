import "server-only";
import { prisma } from "@/lib/db";

export type AuditAction =
  | "AUTH_SIGN_IN"
  | "AUTH_SIGN_OUT"
  | "READ_CONTACT_DETAILS"
  | "CREATE_CASE"
  | "UPDATE_CASE"
  | "CREATE_SURVEY_DRAFT"
  | "UPDATE_SURVEY_DRAFT"
  | "PUBLISH_SURVEY"
  | "RESET_SURVEY_DEFAULTS"
  | "EXPORT";

export interface AuditEntry {
  hospitalId: string | null;
  actorStaffId?: string;
  action: AuditAction;
  entityType: string;
  entityId?: string;
  /** Never place comments, contact values or tokens in here. */
  metadata?: Record<string, string | number | boolean | null>;
}

/**
 * Record access to sensitive data. Failures are logged to stderr but never
 * bubble up into the caller's response: an audit write problem must not break a
 * page, but it also must not be silently swallowed.
 */
export async function writeAuditLog(entry: AuditEntry): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        hospitalId: entry.hospitalId,
        actorStaffId: entry.actorStaffId ?? null,
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId ?? null,
        metadata: entry.metadata ?? undefined,
      },
    });
  } catch (error) {
    console.error("[audit] failed to write audit log", {
      action: entry.action,
      entityId: entry.entityId ?? null,
      reason: error instanceof Error ? error.message : "unknown error",
    });
  }
}
