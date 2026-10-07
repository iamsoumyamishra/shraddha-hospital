import "server-only";
import { headers } from "next/headers";
import { getLocale } from "next-intl/server";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { resolveStaffContext } from "@hospital/identity/staff";
import { NotAuthenticatedError, type StaffContext } from "@hospital/identity/scope";
export * from "@hospital/identity/scope";

/**
 * Load the authenticated staff user together with every membership they hold.
 *
 * This is the single place a staff identity is resolved. Pages, route handlers,
 * aggregate queries and exports all go through here or through the helpers below,
 * so a permission rule is never re-implemented per screen.
 */
export async function getStaffContext(): Promise<StaffContext | null> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return null;
  }

  return resolveStaffContext(session.user.id);
}

export async function requireStaffContext(): Promise<StaffContext> {
  const context = await getStaffContext();
  if (!context) {
    throw new NotAuthenticatedError();
  }
  return context;
}

/** Redirect to the sign-in page when there is no staff session. */
export async function requireStaffPage(): Promise<StaffContext> {
  const context = await getStaffContext();
  if (!context) {
    redirect(`/${await getLocale()}/login`);
  }
  return context;
}
