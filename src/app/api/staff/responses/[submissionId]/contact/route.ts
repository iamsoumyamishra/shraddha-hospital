import { NextResponse } from "next/server";
import {
  NotAuthenticatedError,
  NotAuthorisedError,
  assertCanAccessSubmission,
  canRevealContact,
  requireStaffContext,
} from "@/lib/authorization";
import { prisma } from "@/lib/db";
import { writeAuditLog } from "@/modules/audit/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Return follow-up contact details for one submission.
 *
 * Every read re-checks the session, the membership scope and the role, then
 * writes an audit row before returning. Nothing is cached: the response is a
 * one-off reveal of data the caller was not sent by default.
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ submissionId: string }> },
) {
  try {
    const staff = await requireStaffContext();
    if (!canRevealContact(staff)) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    const { submissionId } = await params;
    const submission = await prisma.feedbackSubmission.findUnique({
      where: { id: submissionId },
      select: {
        hospitalId: true,
        branchId: true,
        departmentId: true,
        followUpContact: {
          select: {
            consentGiven: true,
            displayName: true,
            phone: true,
            email: true,
            privacyNoticeVersion: true,
          },
        },
      },
    });

    if (!submission) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    try {
      assertCanAccessSubmission(staff, submission);
    } catch {
      // Do not distinguish "exists but not yours" from "does not exist": a
      // different status code would confirm the presence of another tenant's row.
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    if (submission.followUpContact?.consentGiven !== true) {
      return NextResponse.json({ error: "no_consent" }, { status: 409 });
    }

    await writeAuditLog({
      hospitalId: submission.hospitalId,
      actorStaffId: staff.staffUserId,
      action: "READ_CONTACT_DETAILS",
      entityType: "FeedbackSubmission",
      entityId: submissionId,
      metadata: { noticeVersion: submission.followUpContact.privacyNoticeVersion },
    });

    return NextResponse.json(
      {
        displayName: submission.followUpContact.displayName,
        phone: submission.followUpContact.phone,
        email: submission.followUpContact.email,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    if (error instanceof NotAuthenticatedError) {
      return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
    }
    if (error instanceof NotAuthorisedError) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
    console.error("[staff] contact reveal failed", {
      reason: error instanceof Error ? error.message : "unknown error",
    });
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}