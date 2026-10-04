import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Liveness probe. Reports whether the database is reachable, nothing more. */
export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ status: "ok" });
  } catch {
    return NextResponse.json({ status: "degraded" }, { status: 503 });
  }
}