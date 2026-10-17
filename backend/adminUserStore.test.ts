import { beforeEach, describe, expect, it, vi } from "vitest";
import bcrypt from "bcryptjs";

const mocks = vi.hoisted(() => ({
  countDocuments: vi.fn(),
  find: vi.fn(),
  findTest: vi.fn(),
  findOne: vi.fn(),
  findOneDedicated: vi.fn(),
  findOneAndUpdate: vi.fn(),
  updateOne: vi.fn(),
  deleteOne: vi.fn(),
  deleteOneDedicated: vi.fn(),
  insertOne: vi.fn(),
  hashPassword: vi.fn(),
  getDatabase: vi.fn(),
}));

vi.mock("./database.js", () => ({ getDatabase: mocks.getDatabase }));
vi.mock("./authService.js", () => ({ hashPassword: mocks.hashPassword }));

import {
  AdminUserConflictError,
  AdminUserValidationError,
  createAdminUser,
  createDedicatedAdminAccount,
  deactivateDedicatedAdminAccount,
  deleteAdminAccount,
  listDedicatedAdminAccounts,
  listAdminUserRecords,
  listAdminUsers,
  updateDedicatedAdminAccount,
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
      findOne: name === "admin-datas" ? mocks.findOneDedicated : mocks.findOne,
      findOneAndUpdate: mocks.findOneAndUpdate,
      updateOne: name === "admin-datas" ? vi.fn() : mocks.updateOne,
      deleteOne: name === "admin-datas" ? mocks.deleteOneDedicated : mocks.deleteOne,
      createIndex: vi.fn(),
      insertOne: mocks.insertOne,
    })),
  });
  mocks.findOne.mockResolvedValue(null);
  mocks.findOneDedicated.mockResolvedValue(null);
  mocks.updateOne.mockResolvedValue({ modifiedCount: 1 });
  mocks.deleteOne.mockResolvedValue({ deletedCount: 1 });
  mocks.deleteOneDedicated.mockResolvedValue({ deletedCount: 1 });
  mocks.insertOne.mockResolvedValue({ acknowledged: true });
  mocks.hashPassword.mockImplementation(async (password: string) => bcrypt.hash(password, 12));
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

    describe("listDedicatedAdminAccounts", () => {
      it("returns actual admin-datas admins without credential fields", async () => {
        mocks.findTest.mockReturnValue({
          sort: vi.fn().mockReturnValue({ toArray: vi.fn().mockResolvedValue([{
            ...customer,
            passwordHash: "secret",
            adminTokenVersion: 9,
          }]) }),
        });

        await expect(listDedicatedAdminAccounts()).resolves.toMatchObject([{
          id,
          name: "Existing Customer",
          email: "customer@example.com",
          role: "Manager",
          status: "Active",
        }]);
        expect(mocks.findTest).toHaveBeenCalledWith(
          { adminRole: "admin" },
          { projection: { _id: 1, name: 1, email: 1, mobile: 1, adminTitle: 1, adminStatus: 1, adminPermissions: 1 } },
        );
      });
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
    await expect(createAdminUser({ ...input, role: "Staff" }, superAdmin)).rejects.toThrow("exceed the selected role");
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

describe("createDedicatedAdminAccount", () => {
  const input = {
    name: "New Admin",
    email: " New.Admin@Example.com ",
    password: "a-secure-test-password",
    role: "Manager",
    status: "Active",
    permissions: getEffectiveAdminPermissions("Manager"),
  };

  it("hashes the password and stores a dedicated account in admin-datas with safe response fields", async () => {
    const result = await createDedicatedAdminAccount(input, superAdmin);
    const stored = mocks.insertOne.mock.calls[0]?.[0] as Record<string, unknown>;

    expect(result).toMatchObject({
      name: "New Admin",
      email: "new.admin@example.com",
      role: "Manager",
      status: "Active",
      permissions: getEffectiveAdminPermissions("Manager"),
    });
    expect(result).not.toHaveProperty("passwordHash");
    expect(stored).toMatchObject({
      name: "New Admin",
      email: "new.admin@example.com",
      adminRole: "admin",
      adminTitle: "Manager",
      adminStatus: "Active",
      adminAccountType: "dedicated",
      authProviders: ["password"],
      isProfileComplete: true,
      tokenVersion: 0,
      adminTokenVersion: 0,
    });
    expect(stored.passwordHash).not.toBe(input.password);
    expect(await bcrypt.compare(input.password, stored.passwordHash as string)).toBe(true);
  });

  it.each(["user-credentials", "admin-datas"] as const)("rejects case-insensitive collisions in %s", async (collection) => {
    if (collection === "user-credentials") mocks.findOne.mockResolvedValue({ _id: customer._id });
    else mocks.findOneDedicated.mockResolvedValue({ _id: customer._id });

    await expect(createDedicatedAdminAccount(input, superAdmin)).rejects.toBeInstanceOf(AdminUserConflictError);
    expect(mocks.insertOne).not.toHaveBeenCalled();
  });

  it("rejects invalid roles and permission grants above the role ceiling", async () => {
    await expect(createDedicatedAdminAccount({ ...input, role: "Owner" }, superAdmin))
      .rejects.toBeInstanceOf(AdminUserValidationError);
    await expect(createDedicatedAdminAccount({
      ...input,
      role: "Staff",
      permissions: fullAdminPermissions,
    }, superAdmin)).rejects.toThrow("exceed the selected role");
    expect(mocks.insertOne).not.toHaveBeenCalled();
  });

  it("requires Super Admin permissions to match its effective full-access role", async () => {
    const restrictedPermissions = { ...fullAdminPermissions, products: { view: true, edit: false } };
    await expect(createDedicatedAdminAccount({
      ...input,
      role: "Super Admin",
      permissions: restrictedPermissions,
    }, superAdmin)).rejects.toThrow("Super Admin accounts must have all permissions");
    expect(mocks.insertOne).not.toHaveBeenCalled();
  });

  it("requires a Super Admin and valid passwords before checking or writing accounts", async () => {
    const manager: AdminUserActor = { role: "Manager", permissions: getEffectiveAdminPermissions("Manager") };
    await expect(createDedicatedAdminAccount(input, manager)).rejects.toThrow("Only a Super Admin");
    await expect(createDedicatedAdminAccount({ ...input, password: "short" }, superAdmin))
      .rejects.toThrow("12 and 72 UTF-8 bytes");
    expect(mocks.findOne).not.toHaveBeenCalled();
    expect(mocks.insertOne).not.toHaveBeenCalled();
  });
});

describe("updateAdminUser", () => {
  it("persists role, status, and validated permissions for an existing admin", async () => {
    const permissions = getEffectiveAdminPermissions("Manager");
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

  describe("updateDedicatedAdminAccount", () => {
    const input = {
      name: "Updated Admin",
      email: "updated@example.com",
      role: "Manager",
      status: "Active",
      permissions: getEffectiveAdminPermissions("Manager"),
    };
    const dedicatedAdmin = {
      ...customer,
      email: "existing-admin@example.com",
      adminAccountType: "dedicated" as const,
      adminTitle: "Manager" as const,
    };

    it("updates only admin-datas and invalidates sessions after auth changes", async () => {
      mocks.findOneDedicated.mockResolvedValueOnce(dedicatedAdmin).mockResolvedValueOnce(null);
      mocks.findOneAndUpdate.mockResolvedValue({
        ...dedicatedAdmin,
        ...input,
        adminTitle: input.role,
        adminStatus: input.status,
        adminPermissions: input.permissions,
      });

      await expect(updateDedicatedAdminAccount(id, input, superAdmin)).resolves.toMatchObject({
        name: "Updated Admin",
        email: "updated@example.com",
        role: "Manager",
      });
      expect(mocks.findOneAndUpdate).toHaveBeenCalledWith(
        { _id: expect.any(Object), adminRole: "admin" },
        {
          $set: {
            name: "Updated Admin",
            email: "updated@example.com",
            adminTitle: "Manager",
            adminStatus: "Active",
            adminPermissions: input.permissions,
            updatedAt: expect.any(Date),
          },
          $inc: { adminTokenVersion: 1 },
        },
        expect.objectContaining({ returnDocument: "after" }),
      );
      expect(mocks.findOne).toHaveBeenCalledWith(
        { email: "updated@example.com" },
        expect.objectContaining({ collation: { locale: "en", strength: 2 } }),
      );
    });

    it("hashes a replacement password and invalidates existing sessions", async () => {
      const password = "another-secure-password";
      mocks.findOneDedicated.mockResolvedValue(dedicatedAdmin);
      mocks.findOneAndUpdate.mockResolvedValue(dedicatedAdmin);

      await updateDedicatedAdminAccount(id, { ...input, email: dedicatedAdmin.email, password }, superAdmin);

      const update = mocks.findOneAndUpdate.mock.calls[0]?.[1] as {
        $set: Record<string, unknown>;
        $inc: { adminTokenVersion: number };
      };
      expect(update.$set.passwordHash).toEqual(expect.any(String));
      expect(await bcrypt.compare(password, update.$set.passwordHash as string)).toBe(true);
      expect(update.$inc).toEqual({ adminTokenVersion: 1 });
    });

    it("rejects an invalid replacement password without changing the account", async () => {
      mocks.findOneDedicated.mockResolvedValue(dedicatedAdmin);
      await expect(updateDedicatedAdminAccount(id, { ...input, password: "short" }, superAdmin))
        .rejects.toThrow("12 and 72 UTF-8 bytes");
      expect(mocks.findOneAndUpdate).not.toHaveBeenCalled();
    });

    it("rejects customer and dedicated email collisions", async () => {
      mocks.findOneDedicated.mockResolvedValue(dedicatedAdmin);
      mocks.findOne.mockResolvedValue({ _id: customer._id });
      await expect(updateDedicatedAdminAccount(id, input, superAdmin)).rejects.toBeInstanceOf(AdminUserConflictError);
      expect(mocks.findOneAndUpdate).not.toHaveBeenCalled();

      mocks.findOne.mockResolvedValue(null);
      mocks.findOneDedicated.mockResolvedValueOnce(dedicatedAdmin).mockResolvedValueOnce({ _id: customer._id });
      await expect(updateDedicatedAdminAccount(id, input, superAdmin)).rejects.toBeInstanceOf(AdminUserConflictError);
      expect(mocks.findOneAndUpdate).not.toHaveBeenCalled();
    });

    it("rejects unauthorized and self role, status, or permission changes", async () => {
      mocks.findOneDedicated.mockResolvedValue(dedicatedAdmin);
      const manager: AdminUserActor = { role: "Manager", permissions: getEffectiveAdminPermissions("Manager") };
      await expect(updateDedicatedAdminAccount(id, input, manager)).rejects.toThrow("Only a Super Admin");
      await expect(updateDedicatedAdminAccount(id, { ...input, status: "Inactive" }, { ...superAdmin, id }))
        .rejects.toThrow("own role, status, or permissions");
      expect(mocks.findOneAndUpdate).not.toHaveBeenCalled();
    });

    it("protects the last active Super Admin from demotion or deactivation", async () => {
      mocks.findOneDedicated.mockResolvedValue({ ...dedicatedAdmin, adminTitle: "Super Admin" });
      mocks.countDocuments.mockResolvedValue(0);
      await expect(updateDedicatedAdminAccount(id, {
        ...input,
        role: "Admin",
        permissions: getEffectiveAdminPermissions("Admin"),
      }, superAdmin)).rejects.toBeInstanceOf(AdminUserConflictError);
      expect(mocks.findOneAndUpdate).not.toHaveBeenCalled();
    });
  });

  describe("deactivateDedicatedAdminAccount", () => {
    it("rejects self-deactivation and unauthorized callers", async () => {
      const manager: AdminUserActor = { role: "Manager", permissions: getEffectiveAdminPermissions("Manager") };
      await expect(deactivateDedicatedAdminAccount(id, manager)).rejects.toThrow("Only a Super Admin");
      await expect(deactivateDedicatedAdminAccount(id, { ...superAdmin, id })).rejects.toThrow("own admin account");
      expect(mocks.findOneDedicated).not.toHaveBeenCalled();
    });

    it("refuses to deactivate the last active Super Admin", async () => {
      mocks.findOneDedicated.mockResolvedValue({ ...customer, adminTitle: "Super Admin", adminStatus: "Active" });
      mocks.countDocuments.mockResolvedValue(0);
      await expect(deactivateDedicatedAdminAccount(id, superAdmin)).rejects.toBeInstanceOf(AdminUserConflictError);
      expect(mocks.findOneAndUpdate).not.toHaveBeenCalled();
    });

    it("deactivates the selected record and invalidates its admin sessions", async () => {
      mocks.findOneDedicated.mockResolvedValue({ ...customer, adminTitle: "Manager", adminStatus: "Active" });
      mocks.findOneAndUpdate.mockResolvedValue({ ...customer, adminTitle: "Manager", adminStatus: "Inactive" });

      await expect(deactivateDedicatedAdminAccount(id, superAdmin)).resolves.toMatchObject({ id, status: "Inactive" });
      expect(mocks.findOneAndUpdate).toHaveBeenCalledWith(
        { _id: expect.any(Object), adminRole: "admin", adminStatus: { $ne: "Inactive" } },
        { $set: { adminStatus: "Inactive", updatedAt: expect.any(Date) }, $inc: { adminTokenVersion: 1 } },
        expect.objectContaining({ returnDocument: "after" }),
      );
    });
  });

  describe("deleteAdminAccount", () => {
    it.each(["Admin", "Manager", "Staff"] as const)("deletes a dedicated %s account by its collection ID", async (role) => {
      const target = { ...customer, adminRole: "admin", adminTitle: role };
      mocks.findOneDedicated.mockResolvedValue(target);

      await expect(deleteAdminAccount("admin-datas", id, superAdmin)).resolves.toMatchObject({
        id,
        name: target.name,
        email: target.email,
        role,
        source: "admin-datas",
      });
      expect(mocks.deleteOneDedicated).toHaveBeenCalledWith({
        _id: expect.any(Object),
        adminRole: "admin",
        adminTitle: { $ne: "Super Admin" },
      });
      expect(mocks.deleteOne).not.toHaveBeenCalled();
    });

    it.each(["Admin", "Manager", "Staff"] as const)("removes only %s grants from customer credentials and invalidates admin sessions", async (role) => {
      mocks.findOne.mockResolvedValue({ ...customer, adminRole: "admin", adminTitle: role });

      await expect(deleteAdminAccount("user-credentials", id, superAdmin)).resolves.toMatchObject({
        id,
        role,
        source: "user-credentials",
      });
      expect(mocks.updateOne).toHaveBeenCalledWith(
        { _id: expect.any(Object), adminRole: "admin", adminTitle: { $ne: "Super Admin" } },
        {
          $unset: {
            adminRole: "",
            adminTitle: "",
            adminStatus: "",
            adminPermissions: "",
            adminAccountSource: "",
            adminAccountType: "",
          },
          $inc: { adminTokenVersion: 1 },
          $set: { updatedAt: expect.any(Date) },
        },
      );
      expect(mocks.deleteOne).not.toHaveBeenCalled();
    });

    it("never deletes Super Admin accounts or permits self-deletion", async () => {
      mocks.findOneDedicated.mockResolvedValue({ ...customer, adminRole: "admin", adminTitle: "Super Admin" });
      await expect(deleteAdminAccount("admin-datas", id, superAdmin)).rejects.toThrow("Super Admin accounts cannot be deleted");
      await expect(deleteAdminAccount("admin-datas", id, { ...superAdmin, id, source: "admin-datas" }))
        .rejects.toThrow("You cannot delete your own admin account");
      expect(mocks.deleteOneDedicated).not.toHaveBeenCalled();
      expect(mocks.updateOne).not.toHaveBeenCalled();
    });

    it("rejects non-Super Admin callers and does not touch the database", async () => {
      const manager: AdminUserActor = { role: "Manager", permissions: getEffectiveAdminPermissions("Manager") };
      await expect(deleteAdminAccount("admin-datas", id, manager)).rejects.toThrow("Only a Super Admin");
      expect(mocks.getDatabase).not.toHaveBeenCalled();
    });

    it("returns not found for unknown IDs and customer accounts without an admin grant", async () => {
      mocks.findOne.mockResolvedValue(null);
      await expect(deleteAdminAccount("user-credentials", "507f1f77bcf86cd799439012", superAdmin)).resolves.toBeNull();

      mocks.findOne.mockResolvedValue({ ...customer, adminRole: undefined });
      await expect(deleteAdminAccount("user-credentials", id, superAdmin)).resolves.toBeNull();
      expect(mocks.updateOne).not.toHaveBeenCalled();
    });

    it("targets the selected record ID even when the email is duplicated across collections", async () => {
      mocks.findOne.mockResolvedValue({ ...customer, adminRole: "admin", adminTitle: "Staff" });
      mocks.findOneDedicated.mockResolvedValue({ ...customer, _id: { toString: () => "507f1f77bcf86cd799439012" }, adminRole: "admin" });

      await deleteAdminAccount("user-credentials", id, superAdmin);

      expect(mocks.updateOne).toHaveBeenCalledWith(
        { _id: expect.any(Object), adminRole: "admin", adminTitle: { $ne: "Super Admin" } },
        expect.objectContaining({ $inc: { adminTokenVersion: 1 } }),
      );
      expect(mocks.deleteOneDedicated).not.toHaveBeenCalled();
      expect(mocks.findOneDedicated).not.toHaveBeenCalled();
    });
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

  it("does not let a Super Admin change their own role or permissions", async () => {
    mocks.findOne.mockResolvedValue({ adminStatus: "Active", adminTitle: "Super Admin" });
    await expect(updateAdminUser(id, {
      role: "Admin",
      status: "Active",
      permissions: getEffectiveAdminPermissions("Admin"),
    }, { ...superAdmin, id })).rejects.toThrow("not authorized");
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
