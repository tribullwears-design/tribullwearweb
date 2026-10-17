import { beforeEach, describe, expect, it, vi } from "vitest";
import { fullAdminPermissions } from "./adminPermissions.js";

const mocks = vi.hoisted(() => ({
  collection: {
    createIndex: vi.fn(),
    findOne: vi.fn(),
    updateOne: vi.fn(),
  },
  getDatabase: vi.fn(),
}));

vi.mock("./database.js", () => ({ getDatabase: mocks.getDatabase }));

import {
  findAdminTestAccountByEmail,
  findAdminTestAccountById,
  upsertAdminTestAccount,
} from "./adminTestStore.js";

const account = {
  email: "test-admin@example.test",
  name: "Testing Super Admin",
  passwordHash: `$2b$12$${"a".repeat(53)}`,
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.collection.createIndex.mockResolvedValue("admin_datas_email_unique");
  mocks.collection.updateOne.mockResolvedValue({ upsertedCount: 1 });
  mocks.collection.findOne.mockResolvedValue(null);
  mocks.getDatabase.mockResolvedValue({ collection: vi.fn(() => mocks.collection) });
});

describe("admin-datas test accounts", () => {
  it("creates or updates only the normalized target with a unique case-insensitive index", async () => {
    const database = { collection: vi.fn(() => mocks.collection) } as never;
    await expect(upsertAdminTestAccount(database, { ...account, email: " Test-Admin@Example.Test " }))
      .resolves.toEqual({ created: true });

    expect(mocks.collection.createIndex).toHaveBeenCalledWith(
      { email: 1 },
      { unique: true, collation: { locale: "en", strength: 2 }, name: "admin_datas_email_unique" },
    );
    expect(mocks.collection.updateOne).toHaveBeenCalledWith(
      { email: "test-admin@example.test" },
      expect.objectContaining({
        $setOnInsert: expect.objectContaining({
          email: "test-admin@example.test",
          createdAt: expect.any(Date),
        }),
        $set: expect.objectContaining({
          passwordHash: account.passwordHash,
          adminRole: "admin",
          adminTitle: "Super Admin",
          adminStatus: "Active",
          adminPermissions: fullAdminPermissions,
        }),
        $addToSet: { authProviders: "password" },
        $inc: { tokenVersion: 1, adminTokenVersion: 1 },
      }),
      { upsert: true, collation: { locale: "en", strength: 2 } },
    );
    expect(JSON.stringify(mocks.collection.updateOne.mock.calls)).not.toContain("not-stored-password");
  });

  it("reports an existing case-insensitive account as updated", async () => {
    mocks.collection.updateOne.mockResolvedValueOnce({ upsertedCount: 0 });
    const database = { collection: vi.fn(() => mocks.collection) } as never;
    await expect(upsertAdminTestAccount(database, account)).resolves.toEqual({ created: false });
    expect(mocks.collection.updateOne).toHaveBeenCalledWith(
      { email: account.email },
      expect.any(Object),
      expect.objectContaining({ upsert: true, collation: { locale: "en", strength: 2 } }),
    );
  });

  it("normalizes case-insensitive email lookups and reads by object ID", async () => {
    await findAdminTestAccountByEmail(" TEST-ADMIN@example.test ");
    expect(mocks.collection.findOne).toHaveBeenCalledWith(
      { email: "test-admin@example.test" },
      { collation: { locale: "en", strength: 2 } },
    );

    mocks.collection.findOne.mockClear();
    await findAdminTestAccountById("not-an-object-id");
    expect(mocks.collection.findOne).not.toHaveBeenCalled();
  });

  it("rejects invalid emails and password hashes without writing", async () => {
    const database = { collection: vi.fn(() => mocks.collection) } as never;
    await expect(upsertAdminTestAccount(database, { ...account, email: "invalid" })).rejects.toThrow(/valid email/);
    await expect(upsertAdminTestAccount(database, { ...account, passwordHash: "plaintext-not-a-hash" }))
      .rejects.toThrow(/bcrypt password hash/);
    expect(mocks.collection.updateOne).not.toHaveBeenCalled();
  });
});
