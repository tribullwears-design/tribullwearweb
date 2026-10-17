import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  adminFindOne: vi.fn(),
  close: vi.fn(),
  connect: vi.fn(),
  customerFindOne: vi.fn(),
  db: vi.fn(),
  hashPassword: vi.fn(),
  MongoClient: vi.fn(),
  updateOne: vi.fn(),
}));

vi.mock("mongodb", async (importOriginal) => ({
  ...(await importOriginal<typeof import("mongodb")>()),
  MongoClient: mocks.MongoClient,
}));
vi.mock("../backend/authService.js", () => ({ hashPassword: mocks.hashPassword }));

import { rotateAdminTestPassword } from "./rotate-admin-test-password.js";

const environment: NodeJS.ProcessEnv = {
  MONGODB_URI: "mongodb+srv://cluster0.example.mongodb.net",
  MONGODB_DB: "tribull",
  ADMIN_TEST_EMAIL: "new-test-admin@example.test",
  ADMIN_TEST_PASSWORD: "fresh-unique-password",
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.connect.mockResolvedValue(undefined);
  mocks.close.mockResolvedValue(undefined);
  mocks.customerFindOne.mockResolvedValue(null);
  mocks.adminFindOne.mockResolvedValue({
    _id: "test-admin-id",
    adminRole: "admin",
    adminTitle: "Super Admin",
    adminStatus: "Active",
  });
  mocks.updateOne.mockResolvedValue({ matchedCount: 1 });
  mocks.hashPassword.mockResolvedValue("$2b$12$hashed-fresh-password");
  mocks.db.mockReturnValue({
    collection: (name: string) => name === "user-credentials"
      ? { findOne: mocks.customerFindOne }
      : { findOne: mocks.adminFindOne, updateOne: mocks.updateOne },
  });
  mocks.MongoClient.mockImplementation(() => ({
    connect: mocks.connect,
    close: mocks.close,
    db: mocks.db,
  }));
});

describe("explicit admin-datas test password rotation", () => {
  it("requires matching email confirmation before connecting", async () => {
    await expect(rotateAdminTestPassword(environment, "different@example.test"))
      .rejects.toThrow(/confirmation email/);
    expect(mocks.MongoClient).not.toHaveBeenCalled();
    expect(mocks.hashPassword).not.toHaveBeenCalled();
  });

  it("updates only the existing test admin and invalidates its sessions", async () => {
    await expect(rotateAdminTestPassword(environment, " NEW-TEST-ADMIN@example.test "))
      .resolves.toEqual({ rotated: true });

    expect(mocks.customerFindOne).toHaveBeenCalledWith(
      { email: "new-test-admin@example.test" },
      expect.objectContaining({ collation: { locale: "en", strength: 2 } }),
    );
    expect(mocks.adminFindOne).toHaveBeenCalledWith(
      { email: "new-test-admin@example.test" },
      expect.objectContaining({ collation: { locale: "en", strength: 2 } }),
    );
    expect(mocks.hashPassword).toHaveBeenCalledWith(environment.ADMIN_TEST_PASSWORD);
    expect(mocks.updateOne).toHaveBeenCalledWith(
      {
        _id: "test-admin-id",
        email: "new-test-admin@example.test",
        adminRole: "admin",
        adminTitle: "Super Admin",
        adminStatus: "Active",
      },
      {
        $set: { passwordHash: "$2b$12$hashed-fresh-password", updatedAt: expect.any(Date) },
        $inc: { tokenVersion: 1, adminTokenVersion: 1 },
      },
      { collation: { locale: "en", strength: 2 } },
    );
    expect(mocks.close).toHaveBeenCalledOnce();
  });

  it("refuses duplicate customer email matches without hashing or updating", async () => {
    mocks.customerFindOne.mockResolvedValueOnce({ _id: "customer-id" });
    await expect(rotateAdminTestPassword(environment, environment.ADMIN_TEST_EMAIL!))
      .rejects.toThrow(/also exists in user-credentials/);
    expect(mocks.hashPassword).not.toHaveBeenCalled();
    expect(mocks.updateOne).not.toHaveBeenCalled();
    expect(mocks.close).toHaveBeenCalledOnce();
  });

  it("refuses to create a test account when the configured email is absent", async () => {
    mocks.adminFindOne.mockResolvedValueOnce(null);
    await expect(rotateAdminTestPassword(environment, environment.ADMIN_TEST_EMAIL!))
      .rejects.toThrow(/cannot create accounts/);
    expect(mocks.hashPassword).not.toHaveBeenCalled();
    expect(mocks.updateOne).not.toHaveBeenCalled();
  });

  it("refuses to rotate a non-Super-Admin or inactive account", async () => {
    mocks.adminFindOne.mockResolvedValueOnce({
      _id: "test-admin-id",
      adminRole: "admin",
      adminTitle: "Admin",
      adminStatus: "Active",
    });
    await expect(rotateAdminTestPassword(environment, environment.ADMIN_TEST_EMAIL!))
      .rejects.toThrow(/not an active Super Admin/);
    expect(mocks.hashPassword).not.toHaveBeenCalled();
    expect(mocks.updateOne).not.toHaveBeenCalled();
  });

  it("closes the connection when rotation fails", async () => {
    mocks.updateOne.mockRejectedValueOnce(new Error("database update failure"));
    await expect(rotateAdminTestPassword(environment, environment.ADMIN_TEST_EMAIL!))
      .rejects.toThrow("database update failure");
    expect(mocks.close).toHaveBeenCalledOnce();
  });
});
