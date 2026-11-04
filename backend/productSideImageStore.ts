import type { Collection } from "mongodb";
import { randomUUID } from "node:crypto";
import { getDatabase } from "./database.js";

export const MAX_PRODUCT_SIDE_IMAGES = 6;
export const MAX_PRODUCT_SIDE_IMAGE_BYTES = 6 * 1024 * 1024;
const allowedImageTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

type ProductSideImageDocument = {
  productId: string;
  index: number;
  image: string;
  updatedAt: string;
  version: string;
};

export class ProductSideImageValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProductSideImageValidationError";
  }
}

export function validateProductSideImage(index: unknown, image: unknown): asserts image is string {
  if (typeof index !== "number" || !Number.isInteger(index) || index < 0 || index >= MAX_PRODUCT_SIDE_IMAGES) {
    throw new ProductSideImageValidationError(`Image index must be between 0 and ${MAX_PRODUCT_SIDE_IMAGES - 1}.`);
  }
  if (typeof image !== "string") {
    throw new ProductSideImageValidationError("A product side image is required.");
  }
  const match = image.match(/^data:(image\/[a-z0-9.+-]+);base64,([A-Za-z0-9+/]+={0,2})$/i);
  if (!match || !allowedImageTypes.has(match[1].toLowerCase())) {
    throw new ProductSideImageValidationError("Product side images must be JPG, PNG, or WEBP data URLs.");
  }
  const bytes = Buffer.from(match[2], "base64");
  if (bytes.length > MAX_PRODUCT_SIDE_IMAGE_BYTES) {
    throw new ProductSideImageValidationError("Each product side image must be 6 MB or smaller.");
  }
  if (!bytes.length || bytes.toString("base64") !== match[2]) {
    throw new ProductSideImageValidationError("Product side image data is invalid.");
  }
}

async function getCollection(): Promise<Collection<ProductSideImageDocument>> {
  const collection = (await getDatabase()).collection<ProductSideImageDocument>("product_side_images");
  await collection.createIndex({ productId: 1, index: 1 }, { unique: true });
  return collection;
}

export async function listProductSideImages(productId: string): Promise<Array<ProductSideImageDocument | null>> {
  const documents = await (await getCollection())
    .find({ productId })
    .sort({ index: 1 })
    .toArray();
  const images: Array<ProductSideImageDocument | null> = Array.from({ length: MAX_PRODUCT_SIDE_IMAGES }, () => null);
  for (const document of documents) images[document.index] = document;
  return images;
}

export async function getProductSideImage(productId: string, index: number): Promise<ProductSideImageDocument | null> {
  return (await getCollection()).findOne({ productId, index });
}

export async function saveProductSideImage(productId: string, index: number, image: unknown): Promise<ProductSideImageDocument> {
  validateProductSideImage(index, image);
  const updatedAt = new Date().toISOString();
  const document = { productId, index, image, updatedAt, version: randomUUID() };
  await (await getCollection()).updateOne(
    { productId, index },
    { $set: document },
    { upsert: true },
  );
  return document;
}

export async function deleteProductSideImage(productId: string, index: number): Promise<boolean> {
  if (!Number.isInteger(index) || index < 0 || index >= MAX_PRODUCT_SIDE_IMAGES) {
    throw new ProductSideImageValidationError(`Image index must be between 0 and ${MAX_PRODUCT_SIDE_IMAGES - 1}.`);
  }
  const result = await (await getCollection()).deleteOne({ productId, index });
  return result.deletedCount > 0;
}

export async function deleteProductSideImages(productId: string): Promise<void> {
  await (await getCollection()).deleteMany({ productId });
}
