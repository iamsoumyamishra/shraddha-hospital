import "server-only";
import { prisma } from "@hospital/database";
import type { StaffContext } from "./scope";

export async function resolveStaffContext(authUserId: string): Promise<StaffContext | null> {
  const staffUser = await prisma.staffUser.findUnique({
    where: { authUserId: authUserId },
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
