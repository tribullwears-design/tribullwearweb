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
  getCustomerWishlist,
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
