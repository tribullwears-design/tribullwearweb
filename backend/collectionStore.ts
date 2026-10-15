import { randomUUID } from "node:crypto";
import type { Collection } from "mongodb";
import { getDatabase } from "./database.js";
import { getProduct } from "./productStore.js";

export type StoreCollection = {
  id: string;
  name: string;
  nameKey: string;
  description: string;
  productIds: string[];
  isVisible: boolean;
  createdAt: string;
  updatedAt: string;
};

export type StoreCollectionInput = {
  name: string;
  description: string;
  productIds: string[];
  isVisible: boolean;
};

export class CollectionValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CollectionValidationError";
  }
}

export class CollectionConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CollectionConflictError";
  }
}

async function getCollection(): Promise<Collection<StoreCollection>> {
  const collection = (await getDatabase()).collection<StoreCollection>("store-collections");
  await collection.createIndex({ id: 1 }, { unique: true });
  await collection.createIndex({ nameKey: 1 }, { unique: true });
  return collection;
}

export function validateStoreCollection(value: unknown): StoreCollectionInput {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new CollectionValidationError("Collection details are required");
  const input = value as Record<string, unknown>;
  const allowed = ["name", "description", "productIds", "isVisible"];
  if (Object.keys(input).some((key) => !allowed.includes(key))) throw new CollectionValidationError("Collection contains unsupported fields");
  const name = typeof input.name === "string" ? input.name.trim() : "";
  const description = typeof input.description === "string" ? input.description.trim() : "";
  const productIds = input.productIds;
  if (!name || name.length > 80) throw new CollectionValidationError("Collection name must be between 1 and 80 characters");
  if (description.length > 500) throw new CollectionValidationError("Collection description must be 500 characters or fewer");
  if (!Array.isArray(productIds) || productIds.length > 24 || !productIds.every((id) => typeof id === "string" && /^[A-Za-z0-9_-]{1,128}$/.test(id))) {
    throw new CollectionValidationError("Select up to 24 valid product IDs");
  }
  if (new Set(productIds).size !== productIds.length) throw new CollectionValidationError("Collection product IDs must be unique");
  if (typeof input.isVisible !== "boolean") throw new CollectionValidationError("Collection visibility must be specified");
  return { name, description, productIds, isVisible: input.isVisible };
}

async function validateProducts(productIds: string[]) {
  for (const id of productIds) {
    const product = await getProduct(id);
    if (!product || product.status !== "Active") throw new CollectionValidationError(`Collection product ${id} is missing or inactive`);
  }
}

export async function listStoreCollections() {
  return (await getCollection()).find({}, { projection: { _id: 0 } }).sort({ createdAt: -1 }).toArray();
}

export async function createStoreCollection(value: unknown) {
  const input = validateStoreCollection(value);
  const collection = await getCollection();
  const nameKey = input.name.toLowerCase();
  if (await collection.findOne({ nameKey }, { projection: { _id: 1 } })) throw new CollectionConflictError("A collection with this name already exists");
  await validateProducts(input.productIds);
  const now = new Date().toISOString();
  const document: StoreCollection = { id: randomUUID(), ...input, nameKey, createdAt: now, updatedAt: now };
  await collection.insertOne(document);
  return document;
}

export async function updateStoreCollection(id: string, value: unknown) {
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(id)) throw new CollectionValidationError("Collection ID is invalid");
  const input = validateStoreCollection(value);
  const collection = await getCollection();
  const existing = await collection.findOne({ id });
  if (!existing) return null;
  const nameKey = input.name.toLowerCase();
  if (await collection.findOne({ id: { $ne: id }, nameKey }, { projection: { _id: 1 } })) throw new CollectionConflictError("A collection with this name already exists");
  await validateProducts(input.productIds);
  const updated = await collection.findOneAndUpdate(
    { id },
    { $set: { ...input, nameKey, updatedAt: new Date().toISOString() } },
    { returnDocument: "after", projection: { _id: 0 } },
  );
  return updated;
}

export async function deleteStoreCollection(id: string) {
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(id)) throw new CollectionValidationError("Collection ID is invalid");
  const result = await (await getCollection()).deleteOne({ id });
  return result.deletedCount > 0;
}
