import { beforeEach, describe, expect, it, vi } from "vitest";
import { CollectionConflictError, CollectionValidationError, createStoreCollection, updateStoreCollection, validateStoreCollection } from "./collectionStore.js";

const mocks = vi.hoisted(() => ({
  createIndex: vi.fn(),
  find: vi.fn(),
  findOne: vi.fn(),
  findOneAndUpdate: vi.fn(),
  insertOne: vi.fn(),
  getDatabase: vi.fn(),
  getProduct: vi.fn(),
}));

vi.mock("./database.js", () => ({ getDatabase: mocks.getDatabase }));
vi.mock("./productStore.js", () => ({ getProduct: mocks.getProduct }));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getDatabase.mockResolvedValue({
    collection: () => ({
      createIndex: mocks.createIndex,
      find: mocks.find,
      findOne: mocks.findOne,
      findOneAndUpdate: mocks.findOneAndUpdate,
      insertOne: mocks.insertOne,
    }),
  });

  mocks.findOne.mockResolvedValue(null);
  mocks.getProduct.mockResolvedValue({ status: "Active" });
});

const validInput = { name: "Summer drop", description: "New season", productIds: ["shirt-1"], isVisible: true };

describe("updateStoreCollection", () => {
  it("persists collection edits and returns the saved document", async () => {
    const existing = { id: "collection-1", ...validInput, nameKey: "summer drop" };
    const updated = { ...existing, name: "Winter drop", nameKey: "winter drop", updatedAt: "2026-01-02T00:00:00.000Z" };
    mocks.findOne.mockImplementation((filter: Record<string, unknown>) =>
      Promise.resolve(filter.id === "collection-1" ? existing : null));
    mocks.findOneAndUpdate.mockResolvedValue(updated);

    await expect(updateStoreCollection("collection-1", { ...validInput, name: "Winter drop" }))
      .resolves.toEqual(updated);

    expect(mocks.findOneAndUpdate).toHaveBeenCalledWith(
      { id: "collection-1" },
      { $set: expect.objectContaining({ name: "Winter drop", nameKey: "winter drop", updatedAt: expect.any(String) }) },
      { returnDocument: "after", projection: { _id: 0 } },
    );
  });
});

describe("validateStoreCollection", () => {
  it("accepts valid collection data", () => {
    expect(validateStoreCollection(validInput)).toEqual(validInput);
  });

  it("rejects duplicate product references, unsupported fields, and invalid names", () => {
    expect(() => validateStoreCollection({ ...validInput, productIds: ["same", "same"] })).toThrow(CollectionValidationError);
    expect(() => validateStoreCollection({ ...validInput, internal: true })).toThrow("unsupported fields");
    expect(() => validateStoreCollection({ ...validInput, name: " " })).toThrow("Collection name");
  });
});

describe("createStoreCollection", () => {
  it("writes a new persistent collection after validating its product references", async () => {
    const result = await createStoreCollection(validInput);

    expect(result).toMatchObject(validInput);
    expect(result.id).toBeTruthy();
    expect(mocks.insertOne).toHaveBeenCalledWith(expect.objectContaining({
      ...validInput,
      nameKey: "summer drop",
      id: result.id,
      createdAt: expect.any(String),
      updatedAt: expect.any(String),
    }));
  });

  it("rejects duplicate names and inactive products without inserting", async () => {
    mocks.findOne.mockResolvedValueOnce({ _id: "existing" });
    await expect(createStoreCollection(validInput)).rejects.toBeInstanceOf(CollectionConflictError);
    expect(mocks.insertOne).not.toHaveBeenCalled();

    mocks.findOne.mockResolvedValue(null);
    mocks.getProduct.mockResolvedValue({ status: "Draft" });
    await expect(createStoreCollection(validInput)).rejects.toThrow("missing or inactive");
    expect(mocks.insertOne).not.toHaveBeenCalled();
  });
});
