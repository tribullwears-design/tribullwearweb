import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createIndex: vi.fn(),
  find: vi.fn(),
  findOneAndUpdate: vi.fn(),
  findOne: vi.fn(),
  getDatabase: vi.fn(),
}));

vi.mock("./database.js", () => ({ getDatabase: mocks.getDatabase }));

import { adjustProductInventory, getProduct, InsufficientInventoryError, listProducts, validateInventoryAdjustment } from "./productStore.js";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getDatabase.mockResolvedValue({
    collection: () => ({
      createIndex: mocks.createIndex,
      find: mocks.find,
      findOneAndUpdate: mocks.findOneAndUpdate,
      findOne: mocks.findOne,
    }),
  });
});

describe("public product reads", () => {
  it("limits storefront listings to active products while admin listings may include drafts", async () => {
    const toArray = vi.fn().mockResolvedValue([]);
    const sort = vi.fn().mockReturnValue({ toArray });
    mocks.find.mockReturnValue({ sort });

    await listProducts();
    expect(mocks.find).toHaveBeenLastCalledWith({ status: "Active" });

    await listProducts(undefined, undefined, undefined, true);
    expect(mocks.find).toHaveBeenLastCalledWith({});
  });

  it("does not expose draft products through the public product detail API", async () => {
    mocks.findOne.mockResolvedValue(null);
    await expect(getProduct("draft-product")).resolves.toBeNull();
    expect(mocks.findOne).toHaveBeenCalledWith({ id: "draft-product", status: "Active" });
  });
});

describe("validateInventoryAdjustment", () => {
  it("accepts positive and negative whole-unit changes", () => {
    expect(() => validateInventoryAdjustment(5)).not.toThrow();
    expect(() => validateInventoryAdjustment(-3)).not.toThrow();
  });

  it.each([0, 1.5, Number.NaN, Number.POSITIVE_INFINITY, Number.MAX_SAFE_INTEGER + 1, "2", null])(
    "rejects invalid adjustment %s",
    (adjustment) => {
      expect(() => validateInventoryAdjustment(adjustment)).toThrow("Inventory adjustment must be a non-zero whole number");
    },
  );
});

describe("adjustProductInventory", () => {
  it("atomically increments stock with a lower-bound condition for decrements", async () => {
    const product = { id: "product-1", stock: 3, updatedAt: "2026-01-01T00:00:00.000Z" };
    mocks.findOneAndUpdate.mockResolvedValue(product);

    await expect(adjustProductInventory("product-1", -2)).resolves.toMatchObject(product);

    expect(mocks.findOneAndUpdate).toHaveBeenCalledWith(
      { id: "product-1", stock: { $gte: 2 } },
      { $inc: { stock: -2 }, $set: { updatedAt: expect.any(String) } },
      { returnDocument: "after", projection: { _id: 0 } },
    );
  });

  it("reports insufficient stock without writing a negative quantity", async () => {
    mocks.findOneAndUpdate.mockResolvedValue(null);
    mocks.findOne.mockResolvedValue({ _id: "product-1" });

    await expect(adjustProductInventory("product-1", -5)).rejects.toBeInstanceOf(InsufficientInventoryError);
    expect(mocks.findOneAndUpdate).toHaveBeenCalledOnce();
    expect(mocks.findOne).toHaveBeenCalledWith({ id: "product-1" }, { projection: { _id: 1 } });
  });

  it("returns null if the product does not exist", async () => {
    mocks.findOneAndUpdate.mockResolvedValue(null);
    mocks.findOne.mockResolvedValue(null);

    await expect(adjustProductInventory("missing-product", 2)).resolves.toBeNull();
  });
});
