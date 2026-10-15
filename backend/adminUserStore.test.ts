import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  countDocuments: vi.fn(),
  find: vi.fn(),
  findOne: vi.fn(),
  findOneAndUpdate: vi.fn(),
  getDatabase: vi.fn(),
}));

vi.mock("./database.js", () => ({ getDatabase: mocks.getDatabase }));

import {
  AdminUserConflictError,
  AdminUserValidationError,
  createAdminUser,
  listAdminUsers,
  updateAdminUser,
  validateAdminPermissions,
} from "./adminUserStore.js";
import { adminPermissionSections, fullAdminPermissions } from "./adminPermissions.js";

const id = "507f1f77bcf86cd799439011";
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
    collection: vi.fn(() => ({
      countDocuments: mocks.countDocuments,
      find: mocks.find,
      findOne: mocks.findOne,
      findOneAndUpdate: mocks.findOneAndUpdate,
    })),
  });
  mocks.find.mockReturnValue({ sort: vi.fn().mockReturnValue({ toArray: vi.fn().mockResolvedValue([customer]) }) });
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
      permissions: fullAdminPermissions,
    });
    expect(users[0]).not.toHaveProperty("passwordHash");
    expect(mocks.find).toHaveBeenCalledWith(
      { adminRole: "admin" },
      { projection: { _id: 1, name: 1, email: 1, mobile: 1, adminTitle: 1, adminStatus: 1, adminPermissions: 1 } },
    );
  });
});

describe("createAdminUser", () => {
  const input = { email: " Customer@Example.com ", role: "Admin", status: "Active", permissions: fullAdminPermissions };

  it("grants an existing customer access without creating a new customer or returning credentials", async () => {
    mocks.findOne.mockResolvedValue({ ...customer, adminRole: undefined });
    mocks.findOneAndUpdate.mockResolvedValue(customer);

    await expect(createAdminUser(input)).resolves.toMatchObject({ id, email: "customer@example.com" });
    expect(mocks.findOne).toHaveBeenCalledWith(
      { email: "customer@example.com" },
      expect.objectContaining({ collation: { locale: "en", strength: 2 } }),
    );
    expect(mocks.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: customer._id, adminRole: { $ne: "admin" } },
      { $set: { adminRole: "admin", adminTitle: "Admin", adminStatus: "Active", adminPermissions: fullAdminPermissions } },
      expect.objectContaining({ projection: expect.not.objectContaining({ passwordHash: 1 }) }),
    );
  });

  it("refuses unknown customer accounts and duplicate admin grants", async () => {
    mocks.findOne.mockResolvedValue(null);
    await expect(createAdminUser(input)).rejects.toThrow("No customer account exists");

    mocks.findOne.mockResolvedValue({ ...customer, adminRole: "admin" });
    await expect(createAdminUser(input)).rejects.toBeInstanceOf(AdminUserConflictError);
    expect(mocks.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it("rejects an invalid role before database changes", async () => {
    await expect(createAdminUser({ ...input, role: "Owner" })).rejects.toBeInstanceOf(AdminUserValidationError);
    expect(mocks.findOne).not.toHaveBeenCalled();
  });
});

describe("updateAdminUser", () => {
  it("persists role, status, and validated permissions for an existing admin", async () => {
    const permissions = {
      ...fullAdminPermissions,
      products: { view: true, edit: false },
    };
    mocks.findOneAndUpdate.mockResolvedValue({ ...customer, adminTitle: "Manager", adminPermissions: permissions });

    await expect(updateAdminUser(id, {
      role: "Manager",
      status: "Active",
      permissions,
    })).resolves.toMatchObject({ role: "Manager", status: "Active", permissions });
    expect(mocks.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: expect.any(Object), adminRole: "admin" },
      { $set: { adminTitle: "Manager", adminStatus: "Active", adminPermissions: permissions } },
      expect.objectContaining({ returnDocument: "after" }),
    );
  });

  it("does not deactivate the only active administrator", async () => {
    mocks.findOne.mockResolvedValue({ adminStatus: "Active" });
    mocks.countDocuments.mockResolvedValue(1);

    await expect(updateAdminUser(id, {
      role: "Admin",
      status: "Inactive",
      permissions: fullAdminPermissions,
    })).rejects.toBeInstanceOf(AdminUserConflictError);
    expect(mocks.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it("returns null for invalid IDs", async () => {
    await expect(updateAdminUser("invalid", {
      role: "Admin",
      status: "Active",
      permissions: fullAdminPermissions,
    })).resolves.toBeNull();
    expect(mocks.getDatabase).not.toHaveBeenCalled();
  });
});
