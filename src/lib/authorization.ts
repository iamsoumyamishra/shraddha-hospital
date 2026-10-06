import "server-only";
import { headers } from "next/headers";
import { getLocale } from "next-intl/server";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export type StaffRole = "HOSPITAL_ADMIN" | "BRANCH_MANAGER" | "DEPARTMENT_HEAD" | "ANALYST";
export type ScopeType = "HOSPITAL" | "BRANCH" | "DEPARTMENT";

export interface MembershipScope {
  id: string;
  hospitalId: string;
  role: StaffRole;
  scopeType: ScopeType;
  branchId: string | null;
  departmentId: string | null;
}

export interface StaffContext {
  staffUserId: string;
  email: string;
  displayName: string;
  memberships: MembershipScope[];
}

export class NotAuthenticatedError extends Error {
  constructor() {
    super("No authenticated staff session");
    this.name = "NotAuthenticatedError";
  }
}

export class NotAuthorisedError extends Error {
  constructor(message = "Staff user does not have access to this resource") {
    super(message);
    this.name = "NotAuthorisedError";
  }
}

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

  const staffUser = await prisma.staffUser.findUnique({
    where: { authUserId: session.user.id },
    select: {
      id: true,
      email: true,
      displayName: true,
      isActive: true,
      memberships: {
        select: {
          id: true,
          hospitalId: true,
          role: true,
          scopeType: true,
          branchId: true,
          departmentId: true,
        },
      },
    },
  });

  if (!staffUser || !staffUser.isActive) {
    return null;
  }

  return {
    staffUserId: staffUser.id,
    email: staffUser.email,
    displayName: staffUser.displayName,
    memberships: staffUser.memberships,
  };
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

const ROLE_RANK: Record<StaffRole, number> = {
  ANALYST: 1,
  DEPARTMENT_HEAD: 2,
  BRANCH_MANAGER: 3,
  HOSPITAL_ADMIN: 4,
};

export function hasAtLeastRole(role: StaffRole, minimum: StaffRole): boolean {
  return ROLE_RANK[role] >= ROLE_RANK[minimum];
}

export interface ResolvedScope {
  hospitalId: string;
  /** Null means the whole hospital. */
  branchId: string | null;
  departmentId: string | null;
}

/**
 * The widest scope a staff user may read. A hospital-wide membership sees the
 * whole hospital; otherwise the widest branch membership applies.
 *
 * Returning the ceiling rather than trusting a scope chosen in the URL is what
 * stops a query parameter from widening access.
 */
export function resolveReadableScope(staff: StaffContext): ResolvedScope | null {
  if (staff.memberships.length === 0) {
    return null;
  }

  const hospitalWide = staff.memberships.find(
    (membership) => membership.scopeType === "HOSPITAL",
  );
  if (hospitalWide) {
    return {
      hospitalId: hospitalWide.hospitalId,
      branchId: null,
      departmentId: null,
    };
  }

  const departmentScope = staff.memberships.find(
    (membership) => membership.scopeType === "DEPARTMENT",
  );
  if (departmentScope) {
    return {
      hospitalId: departmentScope.hospitalId,
      branchId: departmentScope.branchId,
      departmentId: departmentScope.departmentId,
    };
  }

  const branchScope = staff.memberships.find((membership) => membership.scopeType === "BRANCH");
  if (branchScope) {
    return {
      hospitalId: branchScope.hospitalId,
      branchId: branchScope.branchId,
      departmentId: null,
    };
  }

  return null;
}

/** True when the staff user may read the given submission. */
export function canAccessSubmission(staff: StaffContext, submission: {
  hospitalId: string;
  branchId: string | null;
  departmentId: string | null;
}): boolean {
  return staff.memberships.some((membership) => {
    if (membership.hospitalId !== submission.hospitalId) {
      return false;
    }
    if (membership.scopeType === "HOSPITAL") {
      return true;
    }
    if (membership.scopeType === "BRANCH") {
      return submission.branchId === membership.branchId;
    }
    return (
      submission.branchId === membership.branchId &&
      submission.departmentId === membership.departmentId
    );
  });
}

export function assertCanAccessSubmission(
  staff: StaffContext,
  submission: { hospitalId: string; branchId: string | null; departmentId: string | null },
): void {
  if (!canAccessSubmission(staff, submission)) {
    throw new NotAuthorisedError();
  }
}

/** Only these roles may change a case or read contact details. */
export function canManageCases(staff: StaffContext): boolean {
  return staff.memberships.some(
    (membership) =>
      membership.role === "HOSPITAL_ADMIN" ||
      membership.role === "BRANCH_MANAGER" ||
      membership.role === "DEPARTMENT_HEAD",
  );
}

export function canRevealContact(staff: StaffContext): boolean {
  return canManageCases(staff);
}