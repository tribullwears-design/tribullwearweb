import { ObjectId, type Collection, type Filter, type WithId } from "mongodb";
import { listCategories, type CategoryDocument } from "./categoryStore.js";
import { getDatabase } from "./database.js";

export type ProductDocument = {
  id: string;
  name: string;
  description: string;
  price: number;
  compareAt: number | null;
  image: string;
  stock: number;
  sizes: string[];
  colors: string[];
  status: "Active" | "Draft";
  mainCategoryId: string;
  subcategoryId: string;
  mainCategory: string;
  subcategory: string;
  createdAt: string;
  updatedAt: string;
};

type ProductInput = Omit<ProductDocument, "id" | "mainCategory" | "subcategory" | "createdAt" | "updatedAt">;

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

function normalizeProduct(product: WithId<ProductDocument>): ProductDocument {
  const { _id, ...fields } = product;
  const id = fields.id || _id.toString();
  return { ...fields, id };
}

function validateProduct(input: ProductInput, requireImage = true) {
  if (!input || typeof input !== "object" || typeof input.name !== "string" || !input.name.trim() || typeof input.description !== "string" || typeof input.image !== "string" || (requireImage && !input.image) || typeof input.mainCategoryId !== "string" || !input.mainCategoryId.trim() || typeof input.subcategoryId !== "string" || !input.subcategoryId.trim()) {
    throw new Error(requireImage
      ? "Product name, image, main category, and subcategory are required"
      : "Product name, main category, and subcategory are required");
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

export async function listProducts(mainCategoryId?: string, subcategoryId?: string) {
  const collection = await getCollection();
  let filter: Filter<ProductDocument> = {};
  if (mainCategoryId !== undefined && subcategoryId !== undefined) {
    const categories = await listCategories();
    const { main, subcategory } = resolveCategory(categories, mainCategoryId, subcategoryId);
    filter = { mainCategoryId: main.value, subcategoryId: subcategory.value, status: "Active" };
  } else if (mainCategoryId !== undefined || subcategoryId !== undefined) {
    throw new Error("Both main category and subcategory are required for product filtering");
  }
  const products = await collection.find(filter).sort({ createdAt: -1 }).toArray();
  return products.map(normalizeProduct);
}

export async function getProduct(id: string) {
  const product = await (await getCollection()).findOne(productFilter(id));
  return product ? normalizeProduct(product) : null;
}

export async function createProduct(input: ProductInput) {
  validateProduct(input);
  const categories = await listCategories();
  const { main, subcategory } = resolveCategory(categories, input.mainCategoryId, input.subcategoryId);
  const now = new Date().toISOString();
  const product: ProductDocument = {
    ...input,
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
  if (!input || typeof input !== "object") throw new Error("Product update is required");
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
    stock: input.stock === undefined ? existing.stock : input.stock,
    sizes: input.sizes === undefined ? existing.sizes : input.sizes,
    colors: input.colors === undefined ? existing.colors : input.colors,
    status: input.status === undefined ? existing.status : input.status,
    mainCategoryId: input.mainCategoryId === undefined ? existing.mainCategoryId : input.mainCategoryId,
    subcategoryId: input.subcategoryId === undefined ? existing.subcategoryId : input.subcategoryId,
  };
  validateProduct(updatedFields, false);
  const categories = await listCategories();
  const { main, subcategory } = resolveCategory(categories, updatedFields.mainCategoryId, updatedFields.subcategoryId);
  const updated = await collection.findOneAndUpdate(
    filter,
    { $set: { ...updatedFields, mainCategoryId: main.value, subcategoryId: subcategory.value, mainCategory: main.label, subcategory: subcategory.label, updatedAt: new Date().toISOString() } },
    { returnDocument: "after" },
  );
  return updated ? normalizeProduct(updated) : null;
}
