import type { Collection } from "mongodb";
import { randomUUID } from "node:crypto";
import { getDatabase } from "./database.js";
import { MAX_PRODUCT_GALLERY_IMAGES } from "../shared/products.js";

export const MAX_PRODUCT_SIDE_IMAGES = 6;
export const MAX_PRODUCT_COLOR_IMAGES = MAX_PRODUCT_GALLERY_IMAGES;
export const MAX_PRODUCT_SIDE_IMAGE_BYTES = 6 * 1024 * 1024;
const allowedImageTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
let colorImagesIndexPromise: Promise<void> | undefined;

type ProductSideImageDocument = {
  productId: string;
  index: number;
  image: string;
  updatedAt: string;
  version: string;
};

type ProductColorImageDocument = ProductSideImageDocument & {
  color: string;
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
  validateImageData(image);
}

export function validateProductColorImage(color: unknown, index: unknown, image: unknown): asserts image is string {
  if (typeof color !== "string" || !color.trim() || color !== color.trim().toLowerCase() || color.length > 64) {
    throw new ProductSideImageValidationError("Product color is invalid.");
  }
  if (typeof index !== "number" || !Number.isInteger(index) || index < 0 || index >= MAX_PRODUCT_COLOR_IMAGES) {
    throw new ProductSideImageValidationError(`Color image index must be between 0 and ${MAX_PRODUCT_COLOR_IMAGES - 1}.`);
  }
  validateImageData(image);
}

function validateImageData(image: unknown): asserts image is string {
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

async function getColorCollection(): Promise<Collection<ProductColorImageDocument>> {
  const collection = (await getDatabase()).collection<ProductColorImageDocument>("product_color_images");
  colorImagesIndexPromise ||= collection.createIndex({ productId: 1, color: 1, index: 1 }, { unique: true })
    .then(() => undefined)
    .catch((error: unknown) => {
      colorImagesIndexPromise = undefined;
      throw error;
    });
  await colorImagesIndexPromise;
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

export async function listProductColorImages(productId: string, color: string): Promise<Array<ProductColorImageDocument | null>> {
  const documents = await (await getColorCollection())
    .find({ productId, color })
    .sort({ index: 1 })
    .toArray();
  const images: Array<ProductColorImageDocument | null> = Array.from({ length: MAX_PRODUCT_COLOR_IMAGES }, () => null);
  for (const document of documents) images[document.index] = document;
  return images;
}

export async function getProductColorImage(productId: string, color: string, index: number): Promise<ProductColorImageDocument | null> {
  return (await getColorCollection()).findOne({ productId, color, index });
}

export async function saveProductColorImage(productId: string, color: string, index: number, image: unknown): Promise<ProductColorImageDocument> {
  validateProductColorImage(color, index, image);
  const updatedAt = new Date().toISOString();
  const document = { productId, color, index, image, updatedAt, version: randomUUID() };
  await (await getColorCollection()).updateOne(
    { productId, color, index },
    { $set: document },
    { upsert: true },
  );
  return document;
}

export async function deleteProductColorImage(productId: string, color: string, index: number): Promise<boolean> {
  if (typeof color !== "string" || !color.trim() || color !== color.trim().toLowerCase() || color.length > 64) {
    throw new ProductSideImageValidationError("Product color is invalid.");
  }
  if (!Number.isInteger(index) || index < 0 || index >= MAX_PRODUCT_COLOR_IMAGES) {
    throw new ProductSideImageValidationError(`Color image index must be between 0 and ${MAX_PRODUCT_COLOR_IMAGES - 1}.`);
  }
  const result = await (await getColorCollection()).deleteOne({ productId, color, index });
  return result.deletedCount > 0;
}

export async function deleteProductColorImages(productId: string): Promise<void> {
  await (await getColorCollection()).deleteMany({ productId });
}
