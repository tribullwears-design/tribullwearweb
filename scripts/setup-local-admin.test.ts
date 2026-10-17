import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  collection: {
    createIndex: vi.fn(),
    updateOne: vi.fn(),
  },
  client: {
    connect: vi.fn(),
    db: vi.fn(),
    close: vi.fn(),
  },
  hashPassword: vi.fn(),
  MongoClient: vi.fn(),
}));

vi.mock("mongodb", async (importOriginal) => {
  const actual = await importOriginal<typeof import("mongodb")>();
  return { ...actual, MongoClient: mocks.MongoClient };
});
vi.mock("../backend/authService.js", () => ({ hashPassword: mocks.hashPassword }));

import { fullAdminPermissions } from "../backend/adminPermissions.js";
import { readLocalAdminSetupConfig, setupLocalAdminAccount } from "./setup-local-admin.js";

const localEnvironment: NodeJS.ProcessEnv = {
  NODE_ENV: "development",
  MONGODB_URI: "mongodb://127.0.0.1:27017",
  MONGODB_DB: "tribull_local",
  ADMIN_LOGIN_EMAIL: "local-admin@example.test",
  ADMIN_TEST_EMAIL: "local-admin@example.test",
  ADMIN_TEST_PASSWORD: "local-only-test-password",
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.collection.createIndex.mockResolvedValue("customer_email_unique");
  mocks.collection.updateOne.mockResolvedValue({ upsertedCount: 1 });
  mocks.client.connect.mockResolvedValue(undefined);
  mocks.client.db.mockReturnValue({ collection: vi.fn(() => mocks.collection) });
  mocks.client.close.mockResolvedValue(undefined);
  mocks.MongoClient.mockImplementation(() => mocks.client);
  mocks.hashPassword.mockResolvedValue("bcrypt-hash-for-test-only");
});

describe("local Super Admin setup", () => {
  it("refuses production before hashing or constructing a database client", async () => {
    await expect(setupLocalAdminAccount({ ...localEnvironment, NODE_ENV: "production" }))
      .rejects.toThrow("Refusing local admin setup when NODE_ENV=production");
    expect(mocks.hashPassword).not.toHaveBeenCalled();
    expect(mocks.MongoClient).not.toHaveBeenCalled();
  });

  it("rejects every non-development environment", () => {
    for (const nodeEnvironment of [undefined, "test", "staging", ""]) {
      expect(() => readLocalAdminSetupConfig({ ...localEnvironment, NODE_ENV: nodeEnvironment }))
        .toThrow(/NODE_ENV must be set to development/);
    }
  });

  it("rejects remote MongoDB hosts, SRV URIs, and database paths other than tribull_local", () => {
    for (const mongoUri of [
      "mongodb+srv://example.invalid",
      "mongodb://example.invalid:27017",
      "mongodb://localhost:27017",
      "mongodb://127.0.0.1:27017/tribull",
      "mongodb://[::1]:27017/production",
    ]) {
      expect(() => readLocalAdminSetupConfig({ ...localEnvironment, MONGODB_URI: mongoUri }))
        .toThrow(/loopback address|must not select a database/);
    }
    expect(() => readLocalAdminSetupConfig({ ...localEnvironment, MONGODB_DB: "tribull" }))
      .toThrow(/tribull_local/);
  });

  it("requires a valid test email and a matching login allowlist", () => {
    expect(() => readLocalAdminSetupConfig({ ...localEnvironment, ADMIN_TEST_EMAIL: "" }))
      .toThrow(/ADMIN_TEST_EMAIL must be a valid email/);
    expect(() => readLocalAdminSetupConfig({ ...localEnvironment, ADMIN_LOGIN_EMAIL: "" }))
      .toThrow(/ADMIN_LOGIN_EMAIL must match/);
    expect(() => readLocalAdminSetupConfig({ ...localEnvironment, ADMIN_LOGIN_EMAIL: "other@example.test" }))
      .toThrow(/ADMIN_LOGIN_EMAIL must match/);
  });

  it("rejects missing, short, or overlong passwords before database access", () => {
    for (const password of ["", "short", "a".repeat(73)]) {
      expect(() => readLocalAdminSetupConfig({ ...localEnvironment, ADMIN_TEST_PASSWORD: password }))
        .toThrow(/ADMIN_TEST_PASSWORD must be between 8 and 72 UTF-8 bytes/);
    }
    expect(mocks.hashPassword).not.toHaveBeenCalled();
    expect(mocks.MongoClient).not.toHaveBeenCalled();
  });

  it("hashes the environment password and upserts only a full-permission Super Admin", async () => {
    const environment = { ...localEnvironment };
    const result = await setupLocalAdminAccount(environment);

    expect(result).toEqual({ created: true });
    expect(mocks.hashPassword).toHaveBeenCalledWith(environment.ADMIN_TEST_PASSWORD);
    expect(mocks.MongoClient).toHaveBeenCalledWith(environment.MONGODB_URI, { serverSelectionTimeoutMS: 8000 });
    expect(mocks.client.db).toHaveBeenCalledWith("tribull_local");
    expect(mocks.collection.updateOne).toHaveBeenCalledWith(
      { email: "local-admin@example.test" },
      expect.objectContaining({
        $set: expect.objectContaining({
          passwordHash: "bcrypt-hash-for-test-only",
          adminRole: "admin",
          adminTitle: "Super Admin",
          adminStatus: "Active",
          adminPermissions: fullAdminPermissions,
          isProfileComplete: true,
        }),
        $addToSet: { authProviders: "password" },
        $inc: { tokenVersion: 1, adminTokenVersion: 1 },
      }),
      expect.objectContaining({ upsert: true, collation: { locale: "en", strength: 2 } }),
    );
    expect(mocks.collection.updateOne.mock.calls[0][0]).toEqual({ email: environment.ADMIN_TEST_EMAIL });
    expect(JSON.stringify(mocks.collection.updateOne.mock.calls)).not.toContain(environment.ADMIN_TEST_PASSWORD);
    expect(mocks.client.close).toHaveBeenCalledOnce();
  });

  it("closes the local database connection when account setup fails", async () => {
    mocks.collection.updateOne.mockRejectedValueOnce(new Error("local write failed"));

    await expect(setupLocalAdminAccount({ ...localEnvironment }))
      .rejects.toThrow("local write failed");
    expect(mocks.client.db).toHaveBeenCalledWith("tribull_local");
    expect(mocks.client.close).toHaveBeenCalledOnce();
  });

  it("closes the client when connecting to local MongoDB fails", async () => {
    mocks.client.connect.mockRejectedValueOnce(new Error("local MongoDB unavailable"));

    await expect(setupLocalAdminAccount({ ...localEnvironment }))
      .rejects.toThrow("local MongoDB unavailable");
    expect(mocks.client.db).not.toHaveBeenCalled();
    expect(mocks.client.close).toHaveBeenCalledOnce();
  });
});