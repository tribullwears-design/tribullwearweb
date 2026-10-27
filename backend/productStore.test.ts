import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createIndex: vi.fn(),
  find: vi.fn(),
  findOneAndUpdate: vi.fn(),
  findOne: vi.fn(),
  getDatabase: vi.fn(),
  collection: vi.fn(),
}));

vi.mock("./database.js", () => ({ getDatabase: mocks.getDatabase }));

import { adjustProductInventory, createProduct, getProduct, getProductImage, InsufficientInventoryError, listProducts, validateInventoryAdjustment } from "./productStore.js";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getDatabase.mockResolvedValue({
    collection: mocks.collection.mockImplementation(() => ({
      createIndex: mocks.createIndex,
      find: mocks.find,
      findOneAndUpdate: mocks.findOneAndUpdate,
      findOne: mocks.findOne,
    })),
  });
});

describe("public product reads", () => {
  it("reads admin listings from the products collection without filtering stored fields or drafts", async () => {
    const storedProduct = {
      _id: "mongo-id",
      id: "saved-product-id",
      name: "Saved product",
      description: "Preserved description",
      price: 1299,
      compareAt: 1499,
      image: "https://cdn.example/image.jpg",
      stock: 7,
      sizes: ["S", "M"],
      colors: ["Black"],
      status: "Draft",
      mainCategoryId: "hoodies",
      subcategoryId: "classic",
      mainCategory: "Hoodies",
      subcategory: "Classic",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-02T00:00:00.000Z",
    };
    const toArray = vi.fn().mockResolvedValue([storedProduct]);
    const sort = vi.fn().mockReturnValue({ toArray });
    mocks.find.mockReturnValue({ sort });

    await expect(listProducts(undefined, undefined, undefined, true)).resolves.toEqual([{
      id: "saved-product-id",
      name: storedProduct.name,
      description: storedProduct.description,
      price: storedProduct.price,
      compareAt: storedProduct.compareAt,
      image: storedProduct.image,
      stock: storedProduct.stock,
      sizes: storedProduct.sizes,
      colors: storedProduct.colors,
      status: storedProduct.status,
      newArrival: false,
      bestSelling: false,
      mainCategoryId: storedProduct.mainCategoryId,
      subcategoryId: storedProduct.subcategoryId,
      mainCategory: storedProduct.mainCategory,
      subcategory: storedProduct.subcategory,
      createdAt: storedProduct.createdAt,
      updatedAt: storedProduct.updatedAt,
    }]);
    expect(mocks.collection).toHaveBeenCalledWith("products");
    expect(mocks.find).toHaveBeenCalledWith({});
  });

  it("limits storefront listings to active products while admin listings may include drafts", async () => {
    const toArray = vi.fn().mockResolvedValue([]);
    const sort = vi.fn().mockReturnValue({ toArray });
    mocks.find.mockReturnValue({ sort });

    await listProducts();
    expect(mocks.find).toHaveBeenLastCalledWith(
      { status: "Active" },
      { projection: expect.objectContaining({ id: 1, name: 1, price: 1, stock: 1, updatedAt: 1 }) },
    );

    await listProducts(undefined, undefined, undefined, true);
    expect(mocks.find).toHaveBeenLastCalledWith({});
  });

  it("loads a shared active discount once when several products use it", async () => {
    const product = (id: string) => ({
      _id: id,
      id,
      name: `Product ${id}`,
      description: "Description",
      price: 2000,
      compareAt: null,
      image: "/product.jpg",
      stock: 5,
      sizes: ["M"],
      colors: ["Black"],
      status: "Active",
      discountOfferId: "shared-discount",
      mainCategoryId: "category",
      subcategoryId: "subcategory",
      mainCategory: "Category",
      subcategory: "Subcategory",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-02T00:00:00.000Z",
    });
    mocks.find.mockReturnValue({ sort: vi.fn().mockReturnValue({ toArray: vi.fn().mockResolvedValue([product("one"), product("two")]) }) });
    mocks.findOne.mockResolvedValue({
      id: "shared-discount",
      kind: "discount",
      isActive: true,
      discountType: "percentage",
      value: 10,
      startsAt: null,
      endsAt: null,
    });

    const products = await listProducts();

    expect(products.map(({ price }) => price)).toEqual([1800, 1800]);
    expect(mocks.findOne).toHaveBeenCalledTimes(1);
  });

  it("does not expose draft products through the public product detail API", async () => {
    mocks.findOne.mockResolvedValue(null);
    await expect(getProduct("draft-product")).resolves.toBeNull();
    expect(mocks.findOne).toHaveBeenCalledWith({ id: "draft-product", status: "Active" });
  });

  it("loads storefront image bytes separately using an active product projection", async () => {
    const storedImage = { image: "data:image/webp;base64,AA==", updatedAt: "2026-01-02T00:00:00.000Z" };
    mocks.findOne.mockResolvedValue(storedImage);

    await expect(getProductImage("product-1")).resolves.toEqual(storedImage);
    expect(mocks.findOne).toHaveBeenLastCalledWith(
      { id: "product-1", status: "Active" },
      { projection: { _id: 0, image: 1, images: 1, updatedAt: 1 } },
    );
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

describe("createProduct", () => {
  const validProduct = {
    name: "Test T-shirt",
    description: "",
    price: 1000,
    compareAt: null,
    image: "/test-shirt.jpg",
    stock: 1,
    sizes: ["M"],
    colors: [],
    status: "Active" as const,
    mainCategoryId: "shirts",
    subcategoryId: "classic",
  };

  it.each([{ sizes: [] }, { sizes: ["", "  "] }])("requires at least one non-empty size", async ({ sizes }) => {
    await expect(createProduct({ ...validProduct, sizes })).rejects.toThrow("At least one product size is required");
    expect(mocks.getDatabase).not.toHaveBeenCalled();
  });
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
