import { beforeEach, describe, expect, it, vi } from "vitest";
import bcrypt from "bcryptjs";
import { ObjectId } from "mongodb";

const mocks = vi.hoisted(() => ({
  findOne: vi.fn(),
  findOneAndUpdate: vi.fn(),
  hashPassword: vi.fn(),
  getDatabase: vi.fn(),
  collection: vi.fn(),
}));

vi.mock("./database.js", () => ({ getDatabase: mocks.getDatabase }));
vi.mock("./authService.js", () => ({ hashPassword: mocks.hashPassword }));

import { AdminAccountSettingsError, updateOwnAdminAccountSettings } from "./adminAccountStore.js";

const id = "507f1f77bcf86cd799439011";
const actor = { id, source: "admin-datas" as const };

beforeEach(() => {
  vi.clearAllMocks();
  mocks.collection.mockReturnValue({ findOne: mocks.findOne, findOneAndUpdate: mocks.findOneAndUpdate });
  mocks.getDatabase.mockResolvedValue({ collection: mocks.collection });
  mocks.findOneAndUpdate.mockImplementation(async (_filter: unknown, update: { $set: Record<string, unknown> }) => ({
    _id: new ObjectId(id),
    name: update.$set.name,
    email: "admin@example.test",
    adminRole: "admin",
    adminStatus: "Active",
    ...update.$set,
  }));
  mocks.hashPassword.mockImplementation((password: string) => bcrypt.hash(password, 12));
});

describe("updateOwnAdminAccountSettings", () => {
  it("updates only the authenticated admin name in the account's source collection", async () => {
    mocks.findOne.mockResolvedValue({ passwordHash: "$2b$12$existing" });
    const result = await updateOwnAdminAccountSettings(actor, { name: "  Updated Admin  " });

    expect(mocks.collection).toHaveBeenCalledWith("admin-datas");
    expect(result).toMatchObject({ passwordChanged: false, account: { name: "Updated Admin" } });
    expect(mocks.findOneAndUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ _id: new ObjectId(id), adminRole: "admin" }),
      expect.objectContaining({ $set: expect.objectContaining({ name: "Updated Admin" }) }),
      { returnDocument: "after" },
    );
  });

  it("updates a regular admin only in user-credentials", async () => {
    mocks.findOne.mockResolvedValue({ passwordHash: "$2b$12$existing" });
    const result = await updateOwnAdminAccountSettings(
      { id, source: "user-credentials" },
      { name: "Regular Admin" },
    );

    expect(mocks.collection).toHaveBeenCalledWith("user-credentials");
    expect(result).toMatchObject({ source: "user-credentials", account: { name: "Regular Admin" } });
  });

  it("verifies the current password, hashes the new password, and advances the admin session version", async () => {
    const currentHash = await bcrypt.hash("CurrentPass123", 4);
    mocks.findOne.mockResolvedValue({ passwordHash: currentHash });
    const result = await updateOwnAdminAccountSettings(actor, {
      name: "Updated Admin",
      currentPassword: "CurrentPass123",
      newPassword: "NewSecurePass456",
      confirmNewPassword: "NewSecurePass456",
    });

    expect(result.passwordChanged).toBe(true);
    expect(mocks.collection).toHaveBeenCalledWith("admin-datas");
    const [filter, update] = mocks.findOneAndUpdate.mock.calls[0] as [
      Record<string, unknown>,
      { $set: Record<string, unknown>; $inc: Record<string, number>; $addToSet: Record<string, string> },
    ];
    expect(filter).toMatchObject({ _id: new ObjectId(id), passwordHash: currentHash });
    expect(update.$inc).toEqual({ adminTokenVersion: 1 });
    expect(update.$addToSet).toEqual({ authProviders: "password" });
    expect(await bcrypt.compare("NewSecurePass456", update.$set.passwordHash as string)).toBe(true);
    expect(await bcrypt.compare("NewSecurePass456", currentHash)).toBe(false);
  });

  it("rejects a wrong current password without writing", async () => {
    mocks.findOne.mockResolvedValue({ passwordHash: await bcrypt.hash("CurrentPass123", 4) });
    await expect(updateOwnAdminAccountSettings(actor, {
      name: "Updated Admin",
      currentPassword: "wrong-password",
      newPassword: "NewSecurePass456",
      confirmNewPassword: "NewSecurePass456",
    })).rejects.toMatchObject({ message: "Current password is incorrect.", status: 400 });
    expect(mocks.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it.each([
    [{ name: "A" }, "Name must be between 2 and 80 characters."],
    [{ name: "Admin", currentPassword: "old", newPassword: "weakpass", confirmNewPassword: "weakpass" }, "New password must be 8–72 bytes and include a letter and a number."],
    [{ name: "Admin", currentPassword: "old", newPassword: "SecurePass123", confirmNewPassword: "different" }, "New password and confirmation do not match."],
  ])("rejects invalid input before writing", async (input, message) => {
    await expect(updateOwnAdminAccountSettings(actor, input)).rejects.toMatchObject({ message, status: 400 });
    expect(mocks.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it("rejects missing or inactive admin records and never accepts a browser-selected source", async () => {
    await expect(updateOwnAdminAccountSettings({ id, source: undefined }, { name: "Updated Admin" }))
      .rejects.toBeInstanceOf(AdminAccountSettingsError);
    expect(mocks.collection).not.toHaveBeenCalled();

    mocks.findOne.mockResolvedValue(null);
    await expect(updateOwnAdminAccountSettings({ id, source: "user-credentials" }, {
      name: "Updated Admin",
      source: "admin-datas",
      id: "507f1f77bcf86cd799439012",
    })).rejects.toMatchObject({ status: 403 });
    expect(mocks.collection).toHaveBeenCalledWith("user-credentials");
    expect(mocks.findOneAndUpdate).not.toHaveBeenCalled();
  });
});
