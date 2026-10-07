import "server-only";
import { headers } from "next/headers";
import { auth } from "./auth";
import { resolveStaffContext } from "@hospital/identity/staff";
export async function getStaff() { const session = await auth.api.getSession({ headers: await headers() }); return session ? resolveStaffContext(session.user.id) : null; }
