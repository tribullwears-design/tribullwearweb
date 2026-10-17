import { describe, expect, it } from "vitest";
import {
  canManageAdminUsers,
  defaultRolePermissions,
  fullAdminPermissions,
  getEffectiveAdminPermissions,
} from "../backend/adminPermissions.js";

describe("admin role permissions", () => {
  it("gives Super Admin full access and keeps Admin user management explicitly gated", () => {
    expect(getEffectiveAdminPermissions("Super Admin")).toEqual(fullAdminPermissions);
    expect(defaultRolePermissions.Admin.products.edit).toBe(true);
    expect(defaultRolePermissions.Admin.settings.view).toBe(true);
    expect(defaultRolePermissions.Admin.settings.edit).toBe(true);
    expect(defaultRolePermissions.Admin.adminUsers.edit).toBe(false);
    expect(getEffectiveAdminPermissions("Admin", {
      ...defaultRolePermissions.Admin,
      adminUsers: { view: true, edit: true },
    }).adminUsers.edit).toBe(true);
  });

  it("keeps Manager and Staff read-only and limits Staff from customer and order PII sections", () => {
    const permissive = fullAdminPermissions;
    const manager = getEffectiveAdminPermissions("Manager", permissive);
    const staff = getEffectiveAdminPermissions("Staff", permissive);
    expect(manager.products.view).toBe(true);
    expect(manager.products.edit).toBe(false);
    expect(manager.customers.view).toBe(false);
    expect(staff.products.view).toBe(true);
    expect(staff.orders.view).toBe(false);
    expect(staff.customers.view).toBe(false);
    expect(Object.values(staff).some((permission) => permission.edit)).toBe(false);
  });

  it("allows explicit settings editors to manage bounded roles but never grant Super Admin or self-escalate", () => {
    const editor = {
      id: "operator",
      role: "Admin" as const,
      permissions: { ...defaultRolePermissions.Admin, adminUsers: { view: true, edit: true } },
    };
    expect(canManageAdminUsers(editor, {}, "Manager", defaultRolePermissions.Manager)).toBe(true);
    expect(canManageAdminUsers(editor, {}, "Super Admin", fullAdminPermissions)).toBe(false);
    expect(canManageAdminUsers(editor, { id: "operator", role: "Admin" }, "Admin", editor.permissions)).toBe(false);
    expect(canManageAdminUsers({ ...editor, role: "Manager", permissions: defaultRolePermissions.Manager }, {}, "Staff", defaultRolePermissions.Staff)).toBe(false);
  });
});
