import type { ProfileRow } from "@/contexts/AdminDataContext";
import type { EmployeeStatus } from "@/lib/status";

/**
 * Central rule: statuses that grant full portal access (tasks, appointments, SMS, earnings).
 */
export const FULL_ACCESS_STATUSES: EmployeeStatus[] = ["angenommen"];

/**
 * Central rule: statuses that allow assignment of tasks, appointments, SMS.
 */
const ASSIGNABLE_STATUSES: EmployeeStatus[] = FULL_ACCESS_STATUSES;

/**
 * Check if an employee has full portal access.
 */
export function hasFullAccess(status: EmployeeStatus | null | undefined): boolean {
  return !!status && FULL_ACCESS_STATUSES.includes(status);
}

/**
 * Returns employees that can be assigned tasks, appointments, or SMS numbers.
 * Filters by assignable status and excludes admin accounts.
 */
export function getAssignableEmployees(
  profiles: ProfileRow[],
  adminUserIds: Set<string>,
): ProfileRow[] {
  return profiles
    .filter(
      (p) =>
        ASSIGNABLE_STATUSES.includes(p.status) &&
        !adminUserIds.has(p.user_id),
    )
    .sort((a, b) => a.full_name.localeCompare(b.full_name));
}

/**
 * Returns all non-admin employee profiles (for display/overview lists).
 */
export function getAllEmployees(
  profiles: ProfileRow[],
  adminUserIds: Set<string>,
): ProfileRow[] {
  return profiles
    .filter((p) => !adminUserIds.has(p.user_id))
    .sort((a, b) => a.full_name.localeCompare(b.full_name));
}
