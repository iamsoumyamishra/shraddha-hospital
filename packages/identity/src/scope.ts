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
export function hospitalAdminIds(staff: StaffContext): string[] {
  return [...new Set(staff.memberships.filter((membership) => membership.role === "HOSPITAL_ADMIN" && membership.scopeType === "HOSPITAL").map((membership) => membership.hospitalId))];
}
