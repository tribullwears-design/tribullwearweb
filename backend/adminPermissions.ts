import {
  adminPermissionSections,
  defaultRolePermissions,
  fullAdminPermissions,
  getEffectiveAdminPermissions,
  hasAdminPermission,
  type AdminPermissionAction,
  type AdminPermissionSection,
  type AdminPermissions,
  type AdminRoleTitle,
} from "../shared/adminPermissions.js";

export {
  adminPermissionSections,
  defaultRolePermissions,
  fullAdminPermissions,
  getEffectiveAdminPermissions,
  hasAdminPermission,
};
export type { AdminPermissionAction, AdminPermissionSection, AdminPermissions, AdminRoleTitle };

export function canManageAdminUsers(
  actor: { id?: string; role: AdminRoleTitle; permissions: AdminPermissions },
  target: { id?: string; role?: AdminRoleTitle },
  proposedRole: AdminRoleTitle,
  proposedPermissions: AdminPermissions,
) {
  if (actor.role === "Super Admin") return true;
  if (!hasAdminPermission(actor.permissions, "settings", "edit")
    || !hasAdminPermission(actor.permissions, "adminUsers", "edit")) return false;
  if (proposedRole === "Super Admin" || target.role === "Super Admin") return false;
  if (actor.id && actor.id === target.id) return false;
  return adminPermissionSections.every((section) =>
    (!proposedPermissions[section].view || actor.permissions[section].view)
    && (!proposedPermissions[section].edit || actor.permissions[section].edit));
}
