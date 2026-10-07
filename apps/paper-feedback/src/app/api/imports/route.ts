import { getStaff } from "@/lib/staff";
import { savePaperImport } from "@/modules/imports";
import { ImportError } from "@/modules/contracts";
import { NotAuthorisedError } from "@hospital/identity/scope";
export const runtime = "nodejs";
export async function POST(request: Request) {
  const origin = process.env.BETTER_AUTH_URL;
  if (!origin || request.headers.get("origin") !== new URL(origin).origin) return Response.json({ error: "Invalid request origin." }, { status: 403 });
  const staff = await getStaff();
  if (!staff) return Response.json({ error: "Sign in before importing feedback." }, { status: 401 });
  if (!request.headers.get("content-type")?.startsWith("application/json")) return Response.json({ error: "JSON required." }, { status: 415 });
  if (Number(request.headers.get("content-length")) > 32768) return Response.json({ error: "Request too large." }, { status: 413 });
  // Bound streaming bodies too; Content-Length can be absent or incorrect.
  const reader = request.body?.getReader();
  if (!reader) return Response.json({ error: "Missing response." }, { status: 400 });
  let size = 0; const chunks: Uint8Array[] = [];
  for (;;) { const part = await reader.read(); if (part.done) break; size += part.value.byteLength; if (size > 32768) { await reader.cancel(); return Response.json({ error: "Request too large." }, { status: 413 }); } chunks.push(part.value); }
  try {
    const bytes = new Uint8Array(size); let offset = 0; for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
    return Response.json(await savePaperImport(staff, JSON.parse(new TextDecoder().decode(bytes))), { status: 201 });
  } catch (error) {
    if (error instanceof ImportError) return Response.json({ error: error.message }, { status: error.status });
    if (error instanceof NotAuthorisedError) return Response.json({ error: "You cannot import this survey." }, { status: 403 });
    if (error instanceof SyntaxError) return Response.json({ error: "Invalid JSON." }, { status: 400 });
    return Response.json({ error: "Could not save the response. Retry with the same photos." }, { status: 500 });
  }
}
