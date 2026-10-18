import { ObjectId, type Collection, type Filter, type WithId } from "mongodb";
import { listCategories, type CategoryDocument } from "./categoryStore.js";
import { getDatabase } from "./database.js";
import { findActiveDiscount, calculateOfferDiscount } from "./marketingStore.js";

export type ProductDocument = {
  id: string;
  name: string;
  description: string;
  price: number;
  compareAt: number | null;
  image: string;
  productType?: string;
  stock: number;
  sizes: string[];
  colors: string[];
  status: "Active" | "Draft";
  newArrival?: boolean;
  bestSelling?: boolean;
  discountOfferId?: string;
  discountedPrice?: number;
  basePrice?: number;
  mainCategoryId: string;
  subcategoryId: string;
  mainCategory: string;
  subcategory: string;
  createdAt: string;
  updatedAt: string;
};

type ProductInput = Omit<ProductDocument, "id" | "mainCategory" | "subcategory" | "createdAt" | "updatedAt" | "discountedPrice" | "basePrice"> & { discountOfferId?: string | null };

const productTypes = ["round-neck", "oversized", "acid-oversized", "hoodie"] as const;

async function getCollection(): Promise<Collection<ProductDocument>> {
  const db = await getDatabase();
  const collection = db.collection<ProductDocument>("products");
  await collection.createIndex({ id: 1 }, { unique: true });
  await collection.createIndex({ mainCategoryId: 1, subcategoryId: 1, createdAt: -1 });
  return collection;
}

function slugify(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function resolveCategory(categories: CategoryDocument[], mainCategoryId: string, subcategoryId: string) {
  const main = categories.find((category) => slugify(category.value) === slugify(mainCategoryId) || slugify(category.label) === slugify(mainCategoryId));
  if (!main) throw new Error("Main category not found");
  const subcategory = (main.subcategories || []).find((item) => slugify(item.value) === slugify(subcategoryId) || slugify(item.label) === slugify(subcategoryId));
  if (!subcategory) throw new Error("Subcategory not found for main category");
  return { main, subcategory };
}

function productFilter(id: string): Filter<ProductDocument> {
  return ObjectId.isValid(id) ? { $or: [{ id }, { _id: new ObjectId(id) }] } : { id };
}

function validateProductId(id: string) {
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(id)) throw new Error("Product ID is invalid");
}

export function validateInventoryAdjustment(adjustment: unknown): asserts adjustment is number {
  if (typeof adjustment !== "number" || !Number.isSafeInteger(adjustment) || adjustment === 0) {
    throw new Error("Inventory adjustment must be a non-zero whole number");
  }
}

export class InsufficientInventoryError extends Error {
  constructor() {
    super("Inventory adjustment would make stock negative");
    this.name = "InsufficientInventoryError";
  }
}

async function normalizeProduct(product: WithId<ProductDocument>, applyDiscount = false): Promise<ProductDocument> {
  const { _id, ...fields } = product;
  const id = fields.id || _id.toString();
  const discount = applyDiscount && fields.discountOfferId ? await findActiveDiscount(fields.discountOfferId) : null;
  const discountedPrice = discount ? fields.price - calculateOfferDiscount(discount, fields.price) : fields.price;
  return { ...fields, id, price: discountedPrice, ...(applyDiscount ? { discountedPrice, basePrice: fields.price } : {}), newArrival: fields.newArrival === true, bestSelling: fields.bestSelling === true };
}

function validateProduct(input: ProductInput, requireImage = true, allowUncategorized = false) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("Product update is required");
  const validCategories = typeof input.mainCategoryId === "string" && typeof input.subcategoryId === "string"
    && (allowUncategorized && !input.mainCategoryId && !input.subcategoryId
      || Boolean(input.mainCategoryId.trim() && input.subcategoryId.trim()));
  if (typeof input.name !== "string" || !input.name.trim() || typeof input.description !== "string" || typeof input.image !== "string" || (requireImage && !input.image) || !validCategories) {
    throw new Error(requireImage
      ? "Product name, image, main category, and subcategory are required"
      : "Product name, main category, and subcategory are required");
  }
  if (input.productType !== undefined && !productTypes.includes(input.productType as typeof productTypes[number])) throw new Error("Invalid product type");
  if ((input.newArrival !== undefined && typeof input.newArrival !== "boolean")
    || (input.bestSelling !== undefined && typeof input.bestSelling !== "boolean")) {
    throw new Error("New Arrival and Best Selling must be boolean values");
  }
  if (!Number.isFinite(input.price) || input.price < 0 || !Number.isFinite(input.stock) || input.stock < 0) {
    throw new Error("Product price and stock must be valid non-negative numbers");
  }
  if (!["Active", "Draft"].includes(input.status)) throw new Error("Invalid product status");
  if (input.compareAt !== null && (!Number.isFinite(input.compareAt) || input.compareAt < 0)) throw new Error("Compare-at price must be a valid non-negative number");
  if (!Array.isArray(input.sizes) || !input.sizes.every((size) => typeof size === "string") || !Array.isArray(input.colors) || !input.colors.every((color) => typeof color === "string")) {
    throw new Error("Product sizes and colors must be lists of text values");
  }
}

function isProductInput(value: unknown): value is Partial<ProductInput> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const supportedFields = new Set([
    "name",
    "description",
    "price",
    "compareAt",
    "image",
    "productType",
    "stock",
    "sizes",
    "colors",
    "status",
    "newArrival",
    "bestSelling",
    "discountOfferId",
    "mainCategoryId",
    "subcategoryId",
  ]);
  const entries = Object.entries(value);
  return entries.length > 0 && entries.every(([key]) => supportedFields.has(key));
}

export async function listProducts(mainCategoryId?: string, subcategoryId?: string, productType?: string, includeDrafts = false) {
  const collection = await getCollection();
  let filter: Filter<ProductDocument> = includeDrafts ? {} : { status: "Active" };
  if (mainCategoryId !== undefined && subcategoryId !== undefined) {
    const categories = await listCategories();
    const { main, subcategory } = resolveCategory(categories, mainCategoryId, subcategoryId);
    filter = { mainCategoryId: main.value, subcategoryId: subcategory.value, status: "Active" };
  } else if (mainCategoryId !== undefined || subcategoryId !== undefined) {
    throw new Error("Both main category and subcategory are required for product filtering");
  }
  if (productType !== undefined) {
    if (!productTypes.includes(productType as typeof productTypes[number])) throw new Error("Invalid product type");
    filter = { ...filter, productType, status: "Active" };
  }
  const products = await collection.find(filter).sort({ createdAt: -1 }).toArray();
  return Promise.all(products.map((product) => normalizeProduct(product, !includeDrafts)));
}

export async function getProduct(id: string, includeDrafts = false) {
  validateProductId(id);
  const product = await (await getCollection()).findOne({
    ...productFilter(id),
    ...(!includeDrafts ? { status: "Active" as const } : {}),
  });
  return product ? normalizeProduct(product, !includeDrafts) : null;
}

export async function adjustProductInventory(id: string, adjustment: unknown) {
  validateProductId(id);
  validateInventoryAdjustment(adjustment);
  const collection = await getCollection();
  const filter: Filter<ProductDocument> = adjustment < 0
    ? { ...productFilter(id), stock: { $gte: -adjustment } }
    : productFilter(id);
  const updated = await collection.findOneAndUpdate(
    filter,
    { $inc: { stock: adjustment }, $set: { updatedAt: new Date().toISOString() } },
    { returnDocument: "after", projection: { _id: 0 } },
  );
  if (updated) return normalizeProduct(updated, false);
  if (!await collection.findOne(productFilter(id), { projection: { _id: 1 } })) return null;
  throw new InsufficientInventoryError();
}

export async function createProduct(input: ProductInput) {
  validateProduct(input);
  if (input.discountOfferId !== undefined && input.discountOfferId !== null) {
    if (typeof input.discountOfferId !== "string" || !await findActiveDiscount(input.discountOfferId)) throw new Error("Selected discount is not active or does not exist");
  }
  const categories = await listCategories();
  const { main, subcategory } = resolveCategory(categories, input.mainCategoryId, input.subcategoryId);
  const now = new Date().toISOString();
  const product: ProductDocument = {
    ...input,
    newArrival: input.newArrival ?? false,
    bestSelling: input.bestSelling ?? false,
    id: crypto.randomUUID(),
    name: input.name.trim(),
    mainCategoryId: main.value,
    subcategoryId: subcategory.value,
    mainCategory: main.label,
    subcategory: subcategory.label,
    createdAt: now,
    updatedAt: now,
  };
  await (await getCollection()).insertOne(product);
  return product;
}

export async function updateProduct(id: string, input: Partial<ProductInput>) {
  validateProductId(id);
  if (!isProductInput(input)) throw new Error("Product update is required or contains unsupported fields");
  const collection = await getCollection();
  const filter = productFilter(id);
  const existing = await collection.findOne(filter);
  if (!existing) return null;
  const updatedFields: ProductInput = {
    name: input.name === undefined ? existing.name : input.name,
    description: input.description === undefined ? existing.description : input.description,
    price: input.price === undefined ? existing.price : input.price,
    compareAt: input.compareAt === undefined ? existing.compareAt : input.compareAt,
    image: input.image === undefined ? existing.image : input.image,
    productType: input.productType === undefined ? existing.productType : input.productType,
    stock: input.stock === undefined ? existing.stock : input.stock,
    sizes: input.sizes === undefined ? existing.sizes : input.sizes,
    colors: input.colors === undefined ? existing.colors : input.colors,
    status: input.status === undefined ? existing.status : input.status,
    newArrival: input.newArrival === undefined ? existing.newArrival ?? false : input.newArrival,
    bestSelling: input.bestSelling === undefined ? existing.bestSelling ?? false : input.bestSelling,
    discountOfferId: input.discountOfferId === null ? undefined : input.discountOfferId === undefined ? existing.discountOfferId : input.discountOfferId,
    mainCategoryId: input.mainCategoryId === undefined ? existing.mainCategoryId : input.mainCategoryId,
    subcategoryId: input.subcategoryId === undefined ? existing.subcategoryId : input.subcategoryId,
  };
  if (updatedFields.discountOfferId !== undefined && (!updatedFields.discountOfferId || !await findActiveDiscount(updatedFields.discountOfferId))) throw new Error("Selected discount is not active or does not exist");
  validateProduct(updatedFields, false, !existing.mainCategoryId && !existing.subcategoryId);
  const category = updatedFields.mainCategoryId && updatedFields.subcategoryId
    ? resolveCategory(await listCategories(), updatedFields.mainCategoryId, updatedFields.subcategoryId)
    : null;
  const { discountOfferId, ...fieldsToSet } = updatedFields;
  const updated = await collection.findOneAndUpdate(
    filter,
    { $set: {
      ...fieldsToSet,
      ...(discountOfferId !== undefined ? { discountOfferId } : {}),
      ...(category ? {
        mainCategoryId: category.main.value,
        subcategoryId: category.subcategory.value,
        mainCategory: category.main.label,
        subcategory: category.subcategory.label,
      } : {}),
      updatedAt: new Date().toISOString(),
    }, ...(input.discountOfferId === null ? { $unset: { discountOfferId: "" } } : {}) },
    { returnDocument: "after" },
  );
  return updated ? normalizeProduct(updated, false) : null;
}

export async function deleteProduct(id: string) {
  validateProductId(id);
  const result = await (await getCollection()).deleteOne(productFilter(id));
  return result.deletedCount > 0;
}
