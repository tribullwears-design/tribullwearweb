import type { Collection } from "mongodb";
import { randomUUID } from "node:crypto";
import { defaultProducts, type Product } from "../shared/products.js";
import { getDatabase } from "./mongo.js";

type StoredProduct = Omit<Product, "price"> & { sellingPrice?: number; price?: number };
export type ProductInput = Omit<Product, "price" | "id" | "created" | "sold"> & { id?: string; sellingPrice: number; created?: number; sold?: number; originalPrice?: number | null };
export type ProductApiRecord = Omit<Product, "price"> & { sellingPrice: number };

async function getCollection(): Promise<Collection<StoredProduct>> {
  const collection = (await getDatabase()).collection<StoredProduct>("products");
  await collection.createIndex({ id: 1 }, { unique: true });
  return collection;
}

function normalizeProduct(product: StoredProduct): Product {
  const price = product.sellingPrice ?? product.price;
  if (typeof price !== "number" || !Number.isFinite(price) || price < 0) {
    throw new Error(`Product ${product.id} has an invalid selling price`);
  }
  const { sellingPrice: _sellingPrice, price: _legacyPrice, ...fields } = product;
  return { ...fields, price };
}

export function toProductApiRecord(product: Product): ProductApiRecord {
  const { price, ...fields } = product;
  return { ...fields, sellingPrice: price };
}

function validateProduct(input: ProductInput) {
  if (!input.name?.trim() || !input.category || !input.image) throw new Error("Product name, category, and image are required");
  if (!Number.isFinite(input.sellingPrice) || input.sellingPrice < 0) throw new Error("Selling price must be a valid non-negative amount");
  if (input.originalPrice != null && (!Number.isFinite(input.originalPrice) || input.originalPrice < 0)) {
    throw new Error("Original price must be a valid non-negative amount");
  }
}

export async function listProducts(): Promise<Product[]> {
  const collection = await getCollection();
  if (await collection.countDocuments() === 0) {
    await collection.insertMany(defaultProducts.map(({ price, ...product }) => ({ ...product, sellingPrice: price })));
  }
  const documents = await collection.find({}, { projection: { _id: 0 } }).toArray();
  return documents.map(normalizeProduct);
}

export async function createProduct(input: ProductInput): Promise<Product> {
  validateProduct(input);
  const collection = await getCollection();
  const id = input.id?.trim() || randomUUID();
  if (await collection.findOne({ id })) throw new Error("Duplicate product id");
  const { sellingPrice, originalPrice, ...fields } = input;
  const document: StoredProduct = {
    ...fields,
    ...(originalPrice == null ? {} : { originalPrice }),
    id,
    sellingPrice,
    created: input.created ?? Date.now(),
    sold: input.sold ?? 0,
  };
  await collection.insertOne(document);
  return normalizeProduct(document);
}

export async function updateProduct(id: string, changes: Partial<Omit<ProductInput, "id">>): Promise<Product | undefined> {
  const collection = await getCollection();
  const current = await collection.findOne({ id }, { projection: { _id: 0 } });
  if (!current) return undefined;
  const normalized = normalizeProduct(current);
  const next = { ...normalized, ...changes, sellingPrice: changes.sellingPrice ?? normalized.price, id };
  validateProduct(next);
  const { sellingPrice, originalPrice, ...fields } = changes;
  const setFields: Partial<StoredProduct> = { ...fields };
  setFields.sellingPrice = sellingPrice ?? normalized.price;
  if (originalPrice !== undefined && originalPrice !== null) setFields.originalPrice = originalPrice;
  const unsetFields: { price: ""; originalPrice?: "" } = { price: "" };
  if (originalPrice === null) unsetFields.originalPrice = "";
  const result = await collection.findOneAndUpdate(
    { id },
    { $set: setFields, $unset: unsetFields },
    { returnDocument: "after", projection: { _id: 0 } },
  );
  return result ? normalizeProduct(result) : undefined;
}
