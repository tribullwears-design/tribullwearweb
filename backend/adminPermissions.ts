export const adminPermissionSections = [
  "dashboard",
  "products",
  "orders",
  "customers",
  "marketing",
  "content",
  "analytics",
  "settings",
] as const;

export type AdminPermissionSection = typeof adminPermissionSections[number];
export type AdminPermissionAction = "view" | "edit";
export type AdminPermissions = Record<AdminPermissionSection, { view: boolean; edit: boolean }>;

export const fullAdminPermissions: AdminPermissions = Object.fromEntries(
  adminPermissionSections.map((section) => [section, { view: true, edit: true }]),
) as AdminPermissions;

export function hasAdminPermission(
  permissions: AdminPermissions | undefined,
  section: AdminPermissionSection,
  action: AdminPermissionAction,
) {
  if (!permissions) return true;
  return permissions[section]?.[action] === true;
}
