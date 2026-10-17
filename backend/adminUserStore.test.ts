import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  countDocuments: vi.fn(),
  find: vi.fn(),
  findTest: vi.fn(),
  findOne: vi.fn(),
  findOneAndUpdate: vi.fn(),
  getDatabase: vi.fn(),
}));

vi.mock("./database.js", () => ({ getDatabase: mocks.getDatabase }));

import {
  AdminUserConflictError,
  AdminUserValidationError,
  createAdminUser,
  listAdminUserRecords,
  listAdminUsers,
  updateAdminUser,
  validateAdminPermissions,
} from "./adminUserStore.js";
import { adminPermissionSections, fullAdminPermissions, getEffectiveAdminPermissions } from "./adminPermissions.js";
import type { AdminUserActor } from "./adminUserStore.js";

const id = "507f1f77bcf86cd799439011";
const superAdmin: AdminUserActor = { role: "Super Admin", permissions: fullAdminPermissions };
const customer = {
  _id: { toString: () => id },
  name: "Existing Customer",
  email: "customer@example.com",
  mobile: "9876543210",
  adminTitle: "Manager" as const,
  adminStatus: "Active" as const,
  adminPermissions: fullAdminPermissions,
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getDatabase.mockResolvedValue({
    collection: vi.fn((name: string) => ({
      countDocuments: mocks.countDocuments,
      find: name === "admin-datas" ? mocks.findTest : mocks.find,
      findOne: mocks.findOne,
      findOneAndUpdate: mocks.findOneAndUpdate,
    })),
  });
  mocks.find.mockReturnValue({ sort: vi.fn().mockReturnValue({ toArray: vi.fn().mockResolvedValue([customer]) }) });
  mocks.findTest.mockReturnValue({ sort: vi.fn().mockReturnValue({ toArray: vi.fn().mockResolvedValue([]) }) });
});

describe("validateAdminPermissions", () => {
  it("requires boolean view and edit grants for every section", () => {
    expect(validateAdminPermissions(fullAdminPermissions)).toEqual(fullAdminPermissions);
    expect(() => validateAdminPermissions({ ...fullAdminPermissions, orders: { view: false, edit: "yes" } }))
      .toThrow(AdminUserValidationError);
    expect(() => validateAdminPermissions({ ...fullAdminPermissions, extra: { view: true, edit: true } }))
      .toThrow(AdminUserValidationError);
  });

  it("makes edit access imply view access", () => {
    const permissions = Object.fromEntries(adminPermissionSections.map((section) => [
      section,
      { view: false, edit: section === "orders" },
    ]));
    expect(validateAdminPermissions(permissions).orders).toEqual({ view: true, edit: true });
  });
});

describe("listAdminUsers", () => {
  it("returns only safe fields and treats legacy provisioned admins as fully authorized", async () => {
    mocks.find.mockReturnValue({
      sort: vi.fn().mockReturnValue({ toArray: vi.fn().mockResolvedValue([{ ...customer, passwordHash: "secret" }]) }),
    });
    const users = await listAdminUsers();
    expect(users[0]).toMatchObject({
      id,
      name: "Existing Customer",
      email: "customer@example.com",
      role: "Manager",
      status: "Active",
      permissions: getEffectiveAdminPermissions("Manager", fullAdminPermissions),
    });
    expect(users[0]).not.toHaveProperty("passwordHash");
    expect(mocks.find).toHaveBeenCalledWith(
      { adminRole: "admin" },
      { projection: { _id: 1, name: 1, email: 1, mobile: 1, adminTitle: 1, adminStatus: 1, adminPermissions: 1 } },
    );
  });
});

describe("listAdminUserRecords", () => {
  it("returns only safe fields and groups case-insensitive cross-collection email matches", async () => {
    mocks.find.mockReturnValue({
      sort: vi.fn().mockReturnValue({ toArray: vi.fn().mockResolvedValue([{
        ...customer,
        email: "Admin@example.com",
        passwordHash: "never-return-this",
        resetOtpHash: "never-return-this-either",
      }]) }),
    });
    mocks.findTest.mockReturnValue({
      sort: vi.fn().mockReturnValue({ toArray: vi.fn().mockResolvedValue([{
        ...customer,
        _id: { toString: () => "507f1f77bcf86cd799439012" },
        name: "Testing Super Admin",
        email: "admin@EXAMPLE.com",
        adminTitle: "Super Admin",
        passwordHash: "secret-hash",
        adminTokenVersion: 4,
      }]) }),
    });

    const groups = await listAdminUserRecords();

    expect(groups).toHaveLength(1);
    expect(groups[0]?.email).toBe("admin@example.com");
    expect(groups[0]?.records).toEqual([
      expect.objectContaining({
        id,
        source: "user-credentials",
        role: "Manager",
        status: "Active",
      }),
      expect.objectContaining({
        id: "507f1f77bcf86cd799439012",
        source: "admin-datas",
        name: "Testing Super Admin",
        role: "Super Admin",
        status: "Active",
        permissions: fullAdminPermissions,
      }),
    ]);
    expect(JSON.stringify(groups)).not.toContain("never-return-this");
    expect(JSON.stringify(groups)).not.toContain("secret-hash");
    expect(mocks.find).toHaveBeenCalledWith(
      { adminRole: "admin", email: { $type: "string" } },
      { projection: { _id: 1, name: 1, email: 1, adminTitle: 1, adminStatus: 1, adminPermissions: 1 } },
    );
    expect(mocks.findTest).toHaveBeenCalledWith(
      { adminRole: "admin", email: { $type: "string" } },
      { projection: { _id: 1, name: 1, email: 1, adminTitle: 1, adminStatus: 1, adminPermissions: 1 } },
    );
  });
});

describe("createAdminUser", () => {
  const input = { email: " Customer@Example.com ", role: "Admin", status: "Active", permissions: fullAdminPermissions };

  it("grants an existing customer access without creating a new customer or returning credentials", async () => {
    mocks.findOne.mockResolvedValue({ ...customer, adminRole: undefined });
    mocks.findOneAndUpdate.mockResolvedValue(customer);

    await expect(createAdminUser(input, superAdmin)).resolves.toMatchObject({ id, email: "customer@example.com" });
    expect(mocks.findOne).toHaveBeenCalledWith(
      { email: "customer@example.com" },
      expect.objectContaining({ collation: { locale: "en", strength: 2 } }),
    );
    expect(mocks.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: customer._id, adminRole: { $ne: "admin" } },
      { $set: { adminRole: "admin", adminTitle: "Admin", adminStatus: "Active", adminPermissions: fullAdminPermissions, updatedAt: expect.any(Date) } },
      expect.objectContaining({ projection: expect.not.objectContaining({ passwordHash: 1 }) }),
    );
  });

  it("refuses unknown customer accounts and duplicate admin grants", async () => {
    mocks.findOne.mockResolvedValue(null);
    await expect(createAdminUser(input, superAdmin)).rejects.toThrow("No customer account exists");

    mocks.findOne.mockResolvedValue({ ...customer, adminRole: "admin" });
    await expect(createAdminUser(input, superAdmin)).rejects.toBeInstanceOf(AdminUserConflictError);
    expect(mocks.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it("rejects an invalid role before database changes", async () => {
    await expect(createAdminUser({ ...input, role: "Owner" }, superAdmin)).rejects.toBeInstanceOf(AdminUserValidationError);
    expect(mocks.findOne).not.toHaveBeenCalled();
  });

  it("rejects an operator without settings edit before customer lookup", async () => {
    const manager: AdminUserActor = { role: "Manager", permissions: getEffectiveAdminPermissions("Manager") };
    await expect(createAdminUser(input, manager)).rejects.toThrow("not authorized");
    expect(mocks.findOne).not.toHaveBeenCalled();
  });

  it("does not let an Admin grant Super Admin, even with broad stored permissions", async () => {
    const admin: AdminUserActor = { role: "Admin", permissions: fullAdminPermissions };
    await expect(createAdminUser({ ...input, role: "Super Admin" }, admin)).rejects.toThrow("not authorized");
    expect(mocks.findOne).not.toHaveBeenCalled();
  });
});

describe("updateAdminUser", () => {
  it("persists role, status, and validated permissions for an existing admin", async () => {
    const permissions = {
      ...fullAdminPermissions,
      products: { view: true, edit: false },
    };
    mocks.findOne.mockResolvedValue({ adminStatus: "Active", adminTitle: "Manager" });
    mocks.findOneAndUpdate.mockResolvedValue({ ...customer, adminTitle: "Manager", adminPermissions: permissions });

    await expect(updateAdminUser(id, {
      role: "Manager",
      status: "Active",
      permissions,
    }, superAdmin)).resolves.toMatchObject({ role: "Manager", status: "Active", permissions: getEffectiveAdminPermissions("Manager", permissions) });
    expect(mocks.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: expect.any(Object), adminRole: "admin" },
      { $set: { adminTitle: "Manager", adminStatus: "Active", adminPermissions: permissions, updatedAt: expect.any(Date) } },
      expect.objectContaining({ returnDocument: "after" }),
    );
  });

  it("does not deactivate the only active administrator", async () => {
    mocks.findOne.mockResolvedValue({ adminStatus: "Active" });
    mocks.countDocuments.mockResolvedValue(1);

    await expect(updateAdminUser(id, {
      role: "Admin",
      status: "Inactive",
      permissions: getEffectiveAdminPermissions("Manager"),
    }, superAdmin)).rejects.toBeInstanceOf(AdminUserConflictError);
    expect(mocks.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it("protects the last active Super Admin from deactivation and demotion", async () => {
    mocks.findOne.mockResolvedValue({ adminStatus: "Active", adminTitle: "Super Admin" });
    mocks.countDocuments.mockResolvedValue(1);
    await expect(updateAdminUser(id, {
      role: "Admin",
      status: "Active",
      permissions: getEffectiveAdminPermissions("Manager", fullAdminPermissions),
    }, superAdmin)).rejects.toThrow("At least one active Super Admin");
    expect(mocks.countDocuments).toHaveBeenCalledWith({ adminRole: "admin", adminTitle: "Super Admin", adminStatus: { $ne: "Inactive" } });
    expect(mocks.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it("does not let an Admin promote an existing user to Super Admin", async () => {
    const admin: AdminUserActor = { role: "Admin", permissions: fullAdminPermissions };
    mocks.findOne.mockResolvedValue({ adminStatus: "Active", adminTitle: "Manager" });
    await expect(updateAdminUser(id, {
      role: "Super Admin",
      status: "Active",
      permissions: fullAdminPermissions,
    }, admin)).rejects.toThrow("not authorized");
    expect(mocks.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it("returns null for invalid IDs", async () => {
    await expect(updateAdminUser("invalid", {
      role: "Admin",
      status: "Active",
      permissions: fullAdminPermissions,
    }, superAdmin)).resolves.toBeNull();
    expect(mocks.getDatabase).not.toHaveBeenCalled();
  });
});
