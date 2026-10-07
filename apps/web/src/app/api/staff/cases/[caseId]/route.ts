import { NextResponse } from "next/server";
import { z } from "zod";
import {
  NotAuthenticatedError,
  NotAuthorisedError,
  requireStaffContext,
} from "@/lib/authorization";
import { caseStatusSchema, updateCase } from "@/modules/analytics/cases";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const updateBodySchema = z.object({
  status: caseStatusSchema,
  resolutionNote: z.string().max(4000).optional(),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ caseId: string }> },
) {
  try {
    const staff = await requireStaffContext();

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "invalid_request" }, { status: 400 });
    }

    const parsed = updateBodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "invalid_request" }, { status: 422 });
    }

    const { caseId } = await params;
    await updateCase(staff, caseId, parsed.data);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof NotAuthenticatedError) {
      return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
    }
    if (error instanceof NotAuthorisedError) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 422 });
    }
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}