import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  close: vi.fn(),
  connect: vi.fn(),
  db: vi.fn(),
  findAdminTestByEmail: vi.fn(),
  findUserCredentialByEmail: vi.fn(),
  hashPassword: vi.fn(),
  MongoClient: vi.fn(),
  upsertAdminTestAccount: vi.fn(),
}));

vi.mock("mongodb", async (importOriginal) => ({
  ...(await importOriginal<typeof import("mongodb")>()),
  MongoClient: mocks.MongoClient,
}));
vi.mock("../backend/authService.js", () => ({ hashPassword: mocks.hashPassword }));
vi.mock("../backend/adminTestStore.js", () => ({ upsertAdminTestAccount: mocks.upsertAdminTestAccount }));

import {
  loadAdminSetupEnvironmentFiles,
  parseAdminTestAccountConfirmation,
  readAdminTestSetupConfig,
  setupAdminTestAccount,
} from "./setup-admin-test-account.js";

const environment: NodeJS.ProcessEnv = {
  MONGODB_URI: "mongodb+srv://cluster0.example.mongodb.net",
  MONGODB_DB: "tribull",
  ADMIN_TEST_EMAIL: "test-admin@example.test",
  ADMIN_LOGIN_EMAIL: "regular-admin@example.test",
  ADMIN_TEST_PASSWORD: "unique-test-password",
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.hashPassword.mockResolvedValue("$2b$12$secure-password-hash");
  mocks.connect.mockResolvedValue(undefined);
  mocks.findAdminTestByEmail.mockResolvedValue(null);
  mocks.findUserCredentialByEmail.mockResolvedValue(null);
  mocks.db.mockReturnValue({
    collection: vi.fn((name: string) => ({
      findOne: name === "user-credentials" ? mocks.findUserCredentialByEmail : mocks.findAdminTestByEmail,
    })),
  });
  mocks.close.mockResolvedValue(undefined);
  mocks.MongoClient.mockImplementation(() => ({
    connect: mocks.connect,
    db: mocks.db,
    close: mocks.close,
  }));
  mocks.upsertAdminTestAccount.mockResolvedValue({ created: true });
});

describe("explicit admin test account setup", () => {
  it("parses the confirmation after pnpm's forwarded argument separator", () => {
    expect(parseAdminTestAccountConfirmation([
      "--",
      "--confirm-atlas-account-email",
      "test-admin@example.test",
    ])).toBe("test-admin@example.test");
    expect(parseAdminTestAccountConfirmation([
      "--confirm-atlas-account-email",
      "test-admin@example.test",
    ])).toBe("test-admin@example.test");
    expect(parseAdminTestAccountConfirmation([
      "--",
      "--confirm-atlas-account-email",
      "test-admin@example.test",
      "unexpected",
    ])).toBeNull();
  });

  it("does not connect or write when imported without explicit CLI execution", () => {
    expect(mocks.MongoClient).not.toHaveBeenCalled();
    expect(mocks.upsertAdminTestAccount).not.toHaveBeenCalled();
  });

  it("loads only the local environment file, never the production environment file", () => {
    const loadEnvFile = vi.spyOn(process, "loadEnvFile").mockImplementation(() => undefined);
    loadAdminSetupEnvironmentFiles();
    expect(loadEnvFile).toHaveBeenCalledTimes(1);
    expect(loadEnvFile.mock.calls[0][0]).toMatch(/[\\/]backend[\\/]\.env\.local$/);
    expect(loadEnvFile.mock.calls[0][0]).not.toMatch(/\.env\.production$/);
    loadEnvFile.mockRestore();
  });

  it("requires matching confirmation before connecting or hashing", async () => {
    await expect(setupAdminTestAccount(environment, "other@example.test"))
      .rejects.toThrow(/confirmation email/);
    expect(mocks.MongoClient).not.toHaveBeenCalled();
    expect(mocks.hashPassword).not.toHaveBeenCalled();
  });

  it("checks both collections before hashing and creating only the configured target", async () => {
    await expect(setupAdminTestAccount(environment, " TEST-ADMIN@example.test "))
      .resolves.toEqual({ created: true });
    expect(mocks.hashPassword).toHaveBeenCalledWith(environment.ADMIN_TEST_PASSWORD);
    expect(mocks.MongoClient).toHaveBeenCalledWith(environment.MONGODB_URI, { serverSelectionTimeoutMS: 8000 });
    expect(mocks.db).toHaveBeenCalledWith("tribull");
    expect(mocks.findUserCredentialByEmail).toHaveBeenCalledWith(
      { email: "test-admin@example.test" },
      { collation: { locale: "en", strength: 2 }, projection: { _id: 1 } },
    );
    expect(mocks.findAdminTestByEmail).toHaveBeenCalledWith(
      { email: "test-admin@example.test" },
      { collation: { locale: "en", strength: 2 }, projection: { _id: 1 } },
    );
    expect(mocks.upsertAdminTestAccount).toHaveBeenCalledWith(mocks.db.mock.results[0].value, {
      email: "test-admin@example.test",
      name: "Testing Super Admin",
      passwordHash: "$2b$12$secure-password-hash",
    });
    expect(JSON.stringify(mocks.upsertAdminTestAccount.mock.calls)).not.toContain(environment.ADMIN_TEST_PASSWORD);
    expect(mocks.close).toHaveBeenCalledOnce();
  });

  it("refuses to provision an email already present in user-credentials", async () => {
    mocks.findUserCredentialByEmail.mockResolvedValueOnce({ _id: "existing-customer-id" });
    await expect(setupAdminTestAccount(environment, environment.ADMIN_TEST_EMAIL!))
      .rejects.toThrow(/already exists in an account collection/);
    expect(mocks.findAdminTestByEmail).toHaveBeenCalledOnce();
    expect(mocks.hashPassword).not.toHaveBeenCalled();
    expect(mocks.upsertAdminTestAccount).not.toHaveBeenCalled();
    expect(mocks.close).toHaveBeenCalledOnce();
  });

  it("refuses to update an email already present in admin-datas", async () => {
    mocks.findAdminTestByEmail.mockResolvedValueOnce({ _id: "existing-test-admin-id" });
    await expect(setupAdminTestAccount(environment, environment.ADMIN_TEST_EMAIL!))
      .rejects.toThrow(/already exists in an account collection/);
    expect(mocks.findUserCredentialByEmail).toHaveBeenCalledOnce();
    expect(mocks.hashPassword).not.toHaveBeenCalled();
    expect(mocks.upsertAdminTestAccount).not.toHaveBeenCalled();
    expect(mocks.close).toHaveBeenCalledOnce();
  });

  it("rejects missing or mismatched email settings and invalid passwords", () => {
    expect(() => readAdminTestSetupConfig({ ...environment, MONGODB_URI: "" })).toThrow(/MONGODB_URI/);
    expect(() => readAdminTestSetupConfig({ ...environment, MONGODB_DB: "" })).toThrow(/MONGODB_DB/);
    expect(() => readAdminTestSetupConfig({ ...environment, ADMIN_TEST_EMAIL: "" })).toThrow(/ADMIN_TEST_EMAIL/);
    expect(readAdminTestSetupConfig({
      ...environment,
      ADMIN_TEST_EMAIL: "testing-admin@example.test",
      ADMIN_LOGIN_EMAIL: "existing-regular-admin@example.test",
    }).email).toBe("testing-admin@example.test");
    for (const password of ["short", "x".repeat(73)]) {
      expect(() => readAdminTestSetupConfig({ ...environment, ADMIN_TEST_PASSWORD: password })).toThrow(/12 and 72/);
    }
  });

  it("rejects unsupported protocols and database path mismatches", () => {
    expect(() => readAdminTestSetupConfig({ ...environment, MONGODB_URI: "https://example.invalid" })).toThrow(/mongodb/);
    expect(() => readAdminTestSetupConfig({ ...environment, MONGODB_URI: "mongodb+srv://remote.example.invalid" })).toThrow(/Atlas/);
    expect(() => readAdminTestSetupConfig({ ...environment, MONGODB_URI: "mongodb://127.0.0.1:27017" })).toThrow(/Atlas/);
    expect(() => readAdminTestSetupConfig({ ...environment, MONGODB_DB: "other" })).toThrow(/must be tribull/);
    expect(() => readAdminTestSetupConfig({
      ...environment,
      MONGODB_URI: "mongodb+srv://cluster0.example.mongodb.net/other",
    })).toThrow(/must match/);
  });

  it("accepts an Atlas SRV URI with no database path, encoded credentials, and query parameters", () => {
    expect(() => readAdminTestSetupConfig({
      ...environment,
      MONGODB_URI: "mongodb+srv://user%40example:encoded%3Apassword@cluster0.example.mongodb.net/?retryWrites=true&w=majority",
    })).not.toThrow();
  });

  it("accepts the explicitly configured database when its path is percent-encoded", () => {
    expect(() => readAdminTestSetupConfig({
      ...environment,
      MONGODB_URI: "mongodb+srv://cluster0.example.mongodb.net/%74ribull/?retryWrites=true",
    })).not.toThrow();
  });

  it("rejects an explicitly different database path even when query parameters are present", () => {
    expect(() => readAdminTestSetupConfig({
      ...environment,
      MONGODB_URI: "mongodb+srv://cluster0.example.mongodb.net/other?retryWrites=true",
    })).toThrow(/must match/);
  });

  it("closes the connection after a failed write", async () => {
    mocks.upsertAdminTestAccount.mockRejectedValueOnce(new Error("database write failed"));
    await expect(setupAdminTestAccount(environment, environment.ADMIN_TEST_EMAIL!))
      .rejects.toThrow("database write failed");
    expect(mocks.close).toHaveBeenCalledOnce();
  });

  it("closes the client when the Atlas connection fails", async () => {
    mocks.connect.mockRejectedValueOnce(new Error("Atlas connection unavailable"));
    await expect(setupAdminTestAccount(environment, environment.ADMIN_TEST_EMAIL!))
      .rejects.toThrow("Atlas connection unavailable");
    expect(mocks.db).not.toHaveBeenCalled();
    expect(mocks.close).toHaveBeenCalledOnce();
  });
});
