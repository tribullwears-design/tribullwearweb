import { beforeEach, describe, expect, it, vi } from "vitest";
import bcrypt from "bcryptjs";

const mocks = vi.hoisted(() => ({
  createIndex: vi.fn(),
  find: vi.fn(),
  findOneAndUpdate: vi.fn(),
  getDatabase: vi.fn(),
  updateOne: vi.fn(),
}));

vi.mock("./database.js", () => ({ getDatabase: mocks.getDatabase }));

import { consumePasswordReset } from "./authStore.js";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.find.mockReturnValue({ toArray: vi.fn().mockResolvedValue([]) });
  mocks.createIndex.mockResolvedValue(undefined);
  mocks.findOneAndUpdate.mockResolvedValue(null);
  mocks.getDatabase.mockResolvedValue({
    collection: vi.fn(() => ({
      createIndex: mocks.createIndex,
      find: mocks.find,
      findOneAndUpdate: mocks.findOneAndUpdate,
      updateOne: mocks.updateOne,
    })),
  });
});

describe("admin token version invalidation", () => {
  it("increments the test account token version in admin-datas, not user-credentials", async () => {
    const id = "507f1f77bcf86cd799439011";
    const collection = vi.fn(() => ({ updateOne: mocks.updateOne }));
    mocks.getDatabase.mockResolvedValue({ collection });

    const { incrementAdminTokenVersion } = await import("./authStore.js");
    await incrementAdminTokenVersion(id, "admin-datas");

    expect(collection).toHaveBeenCalledWith("admin-datas");
    expect(mocks.updateOne).toHaveBeenCalledWith(
      { _id: expect.anything() },
      { $inc: { adminTokenVersion: 1 }, $set: { updatedAt: expect.any(Date) } },
    );
  });
});

describe("consumePasswordReset", () => {
  it("stores only a bcrypt hash and enables password auth for the existing account", async () => {
    const password = "unit-test-password-for-reset";
    const passwordHash = await bcrypt.hash(password, 12);
    const now = new Date("2026-10-17T12:00:00.000Z");

    await consumePasswordReset("one-time-authorization-digest", passwordHash, now);

    expect(mocks.findOneAndUpdate).toHaveBeenCalledWith(
      { resetAuthorizationHash: "one-time-authorization-digest", resetAuthorizationExpiresAt: { $gt: now } },
      expect.objectContaining({
        $set: { passwordHash, updatedAt: now },
        $addToSet: { authProviders: "password" },
        $inc: { tokenVersion: 1 },
        $unset: expect.objectContaining({ resetAuthorizationHash: "", resetAuthorizationExpiresAt: "" }),
      }),
      { returnDocument: "after" },
    );
    expect(passwordHash).toMatch(/^\$2[aby]\$12\$/);
    expect(passwordHash).not.toContain(password);
  });
});