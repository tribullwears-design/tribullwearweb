import { MongoClient, type Collection, type Db, type Filter } from "mongodb";
import fs from "node:fs";
import path from "node:path";
import { listCategories, type CategoryDocument } from "./categoryStore.js";

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

let clientPromise: Promise<MongoClient> | undefined;

function readMongoUri() {
  if (process.env.MONGODB_URI) return process.env.MONGODB_URI;
  try {
    const envPath = path.resolve(process.cwd(), "backend", ".env.production");
    const line = fs.readFileSync(envPath, "utf8").split(/\r?\n/).find((entry) => entry.startsWith("MONGODB_URI="));
    return line?.slice("MONGODB_URI=".length).trim();
  } catch {
    return undefined;
  }
}

async function getCollection(): Promise<Collection<ProductDocument>> {
  const uri = readMongoUri();
  if (!uri) throw new Error("MONGODB_URI is not configured");
  clientPromise ||= new MongoClient(uri).connect();
  const client = await clientPromise;
  const db: Db = client.db(process.env.MONGODB_DB || "tribull");
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

function validateProduct(input: ProductInput) {
  if (!input || typeof input !== "object" || !input.name?.trim() || typeof input.image !== "string" || !input.image || !input.mainCategoryId?.trim() || !input.subcategoryId?.trim()) {
    throw new Error("Product name, image, main category, and subcategory are required");
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
  return collection.find(filter, { projection: { _id: 0 } }).sort({ createdAt: -1 }).toArray();
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

export async function updateProduct(id: string, input: Pick<ProductInput, "mainCategoryId" | "subcategoryId">) {
  if (!input || !input.mainCategoryId?.trim() || !input.subcategoryId?.trim()) {
    throw new Error("Main category and subcategory are required");
  }
  const categories = await listCategories();
  const { main, subcategory } = resolveCategory(categories, input.mainCategoryId, input.subcategoryId);
  const collection = await getCollection();
  return collection.findOneAndUpdate(
    { id },
    { $set: { mainCategoryId: main.value, subcategoryId: subcategory.value, mainCategory: main.label, subcategory: subcategory.label, updatedAt: new Date().toISOString() } },
    { returnDocument: "after", projection: { _id: 0 } },
  );
}
