import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createIndex: vi.fn(),
  updateOne: vi.fn(),
  findOne: vi.fn(),
  findOneAndUpdate: vi.fn(),
  collection: vi.fn(),
}));

vi.mock("./database.js", () => ({
  getDatabase: async () => ({ collection: mocks.collection }),
}));

import {
  addCustomerAddress,
  addCustomerWishlistItem,
  deleteCustomerAddress,
  getCustomerProfile,
  getCustomerWishlist,
  updateCustomerProfile,
  updateCustomerAddress,
} from "./customerDataStore.js";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.collection.mockReturnValue({
    createIndex: mocks.createIndex.mockResolvedValue(undefined),
    updateOne: mocks.updateOne.mockResolvedValue({ matchedCount: 1, upsertedCount: 0 }),
    findOne: mocks.findOne,
    findOneAndUpdate: mocks.findOneAndUpdate,
  });
});

describe("customer data store", () => {
  it("initializes a profile document once per authenticated user and reads persisted fields", async () => {
    const profile = {
      userId: "customer-a",
      name: "Customer A",
      email: "customer-a@example.com",
      phone: "9876543210",
      photo: "https://example.com/profile.png",
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-02T00:00:00.000Z"),
    };
    mocks.findOne.mockResolvedValue(profile);

    await expect(getCustomerProfile("customer-a", {
      name: "Customer A",
      email: "customer-a@example.com",
      phone: "9876543210",
    })).resolves.toEqual(profile);

    expect(mocks.updateOne).toHaveBeenCalledWith(
      { userId: "customer-a" },
      {
        $setOnInsert: {
          userId: "customer-a",
          name: "Customer A",
          email: "customer-a@example.com",
          phone: "9876543210",
          createdAt: expect.any(Date),
          updatedAt: expect.any(Date),
        },
      },
      { upsert: true },
    );
    expect(mocks.findOne).toHaveBeenCalledWith(
      { userId: "customer-a" },
      { projection: { _id: 0, userId: 1, name: 1, email: 1, phone: 1, photo: 1, createdAt: 1, updatedAt: 1 } },
    );
  });

  it("updates only the authenticated profile document and retains the verified account email", async () => {
    mocks.findOne.mockResolvedValue({
      userId: "customer-a",
      name: "Updated Name",
      email: "customer-a@example.com",
      phone: "9876543211",
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-02T00:00:00.000Z"),
    });

    const profile = await updateCustomerProfile("customer-a", "customer-a@example.com", {
      name: "Updated Name",
      phone: "9876543211",
      photo: null,
    });

    expect(profile).toMatchObject({ userId: "customer-a", email: "customer-a@example.com", name: "Updated Name" });
    expect(mocks.updateOne).toHaveBeenLastCalledWith(
      { userId: "customer-a" },
      {
        $set: {
          name: "Updated Name",
          email: "customer-a@example.com",
          phone: "9876543211",
          updatedAt: expect.any(Date),
        },
        $unset: { photo: "" },
      },
    );
  });

  it("reads back the complete saved profile image representation without truncation", async () => {
    const imageBytes = Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      Buffer.alloc(3_999_992, 0x5a),
    ]);
    const photo = `data:image/png;base64,${imageBytes.toString("base64")}`;
    mocks.findOne.mockResolvedValue({
      userId: "customer-a",
      name: "Customer A",
      email: "customer-a@example.com",
      phone: "9876543210",
      photo,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-02T00:00:00.000Z"),
    });

    const profile = await updateCustomerProfile("customer-a", "customer-a@example.com", {
      name: "Customer A",
      phone: "9876543210",
      photo,
    });

    expect(profile?.photo).toBe(photo);
    expect(mocks.updateOne).toHaveBeenLastCalledWith(
      { userId: "customer-a" },
      {
        $set: {
          name: "Customer A",
          email: "customer-a@example.com",
          phone: "9876543210",
          updatedAt: expect.any(Date),
          photo,
        },
      },
    );
  });

  it("returns an existing address on retries with the same id instead of adding a duplicate", async () => {
    const address = {
      id: "idempotent-address-key-001",
      fullName: "Test Customer",
      phone: "9876543210",
      address: "10 Test Road",
      city: "Chennai",
      state: "Tamil Nadu",
      pinCode: "600001",
      isDefault: true,
      createdAt: "2026-10-17T10:00:00.000Z",
      updatedAt: "2026-10-17T10:00:00.000Z",
    };
    mocks.findOne.mockResolvedValue({ addresses: [address] });

    await expect(addCustomerAddress("customer-a", address)).resolves.toEqual(address);
    expect(mocks.updateOne).toHaveBeenCalledTimes(1);
    expect(mocks.findOne).toHaveBeenCalledWith(
      { userId: "customer-a", "addresses.id": address.id },
      { projection: { _id: 0, addresses: 1 } },
    );
  });

  it("returns the persisted address after updating its MongoDB fields", async () => {
    const updatedAddress = {
      id: "address-one",
      fullName: "Test Customer",
      phone: "9876543210",
      address: "10 Test Road",
      city: "Pune",
      state: "Maharashtra",
      pinCode: "411001",
      isDefault: false,
      createdAt: "2026-10-17T10:00:00.000Z",
      updatedAt: "2026-10-17T11:00:00.000Z",
    };
    mocks.findOneAndUpdate.mockResolvedValue({ addresses: [updatedAddress] });

    await expect(updateCustomerAddress("customer-a", "address-one", {
      fullName: "Test Customer",
      phone: "9876543210",
      address: "10 Test Road",
      apartment: "",
      city: "Pune",
      state: "Maharashtra",
      pinCode: "411001",
      isDefault: false,
    })).resolves.toEqual(updatedAddress);
    expect(mocks.findOneAndUpdate).toHaveBeenCalledWith(
      { userId: "customer-a", "addresses.id": "address-one" },
      expect.objectContaining({
        $set: expect.objectContaining({
          "addresses.$.city": "Pune",
          "addresses.$.state": "Maharashtra",
          "addresses.$.pinCode": "411001",
        }),
      }),
      { returnDocument: "after", projection: { _id: 0, addresses: 1 } },
    );
  });

  it("uses MongoDB set semantics and scopes wishlist writes to the authenticated customer", async () => {
    mocks.findOne.mockResolvedValue({ wishlist: ["shirt-1"] });

    await expect(addCustomerWishlistItem("customer-a", "shirt-1")).resolves.toEqual(["shirt-1"]);
    expect(mocks.updateOne).toHaveBeenLastCalledWith(
      { userId: "customer-a" },
      { $addToSet: { wishlist: "shirt-1" }, $set: { updatedAt: expect.any(Date) } },
    );
    await expect(getCustomerWishlist("customer-b")).resolves.toEqual(["shirt-1"]);
    expect(mocks.findOne).toHaveBeenLastCalledWith(
      { userId: "customer-b" },
      { projection: { _id: 0, wishlist: 1 } },
    );
  });

  it("deletes addresses only through a customer-scoped query", async () => {
    mocks.findOneAndUpdate.mockResolvedValue({ addresses: [{ id: "remaining", isDefault: true }] });

    await expect(deleteCustomerAddress("customer-a", "address-1")).resolves.toBe(true);
    expect(mocks.findOneAndUpdate).toHaveBeenCalledWith(
      { userId: "customer-a", "addresses.id": "address-1" },
      { $pull: { addresses: { id: "address-1" } }, $set: { updatedAt: expect.any(Date) } },
      { returnDocument: "after", projection: { _id: 0, addresses: 1 } },
    );
  });
});
