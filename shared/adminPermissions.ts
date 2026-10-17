export const adminPermissionSections = [
  "dashboard",
  "products",
  "orders",
  "customers",
  "marketing",
  "content",
  "analytics",
  "settings",
  "adminUsers",
] as const;

export type AdminPermissionSection = typeof adminPermissionSections[number];
export type AdminPermissionAction = "view" | "edit";
export type AdminPermissions = Record<AdminPermissionSection, { view: boolean; edit: boolean }>;
export const adminRoleTitles = ["Super Admin", "Admin", "Manager", "Staff"] as const;
export type AdminRoleTitle = typeof adminRoleTitles[number];

const makePermissions = (view: (section: AdminPermissionSection) => boolean, edit: (section: AdminPermissionSection) => boolean): AdminPermissions =>
  Object.fromEntries(adminPermissionSections.map((section) => [section, { view: view(section), edit: edit(section) }])) as AdminPermissions;

export const fullAdminPermissions = makePermissions(() => true, () => true);

/** Default grants for new users. Persisted grants may narrow these; role ceilings always apply. */
export const defaultRolePermissions: Record<AdminRoleTitle, AdminPermissions> = {
  "Super Admin": fullAdminPermissions,
  Admin: makePermissions(() => true, () => true),
  Manager: makePermissions((section) => ["dashboard", "products", "orders", "marketing", "content", "analytics"].includes(section), () => false),
  Staff: makePermissions((section) => ["dashboard", "products"].includes(section), () => false),
};
defaultRolePermissions.Admin.adminUsers = { view: false, edit: false };
defaultRolePermissions.Manager.adminUsers = { view: false, edit: false };
defaultRolePermissions.Staff.adminUsers = { view: false, edit: false };

/** The role ceiling prevents stored custom grants from elevating Manager or Staff. */
export function getEffectiveAdminPermissions(role: AdminRoleTitle, persisted?: AdminPermissions): AdminPermissions {
  if (role === "Super Admin") return fullAdminPermissions;
  const defaults = defaultRolePermissions[role];
  const effective = {} as AdminPermissions;
  for (const section of adminPermissionSections) {
    const grant = persisted?.[section] ?? defaults[section];
    const canEdit = role === "Admin" ? grant.edit : defaults[section].edit && grant.edit;
    effective[section] = {
      view: canEdit || (defaults[section].view && grant.view),
      edit: canEdit,
    };
  }
  return effective;
}

export function hasAdminPermission(
  permissions: AdminPermissions | undefined,
  section: AdminPermissionSection,
  action: AdminPermissionAction,
) {
  return permissions?.[section]?.[action] === true;
}
