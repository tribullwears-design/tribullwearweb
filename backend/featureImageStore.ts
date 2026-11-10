import { getDatabase } from "./database.js";
import sharp from "sharp";

export const featureImageTypes = ["customize", "corporate"] as const;
export type FeatureImageType = typeof featureImageTypes[number];
export type FeatureImages = Record<FeatureImageType, string | null>;

export class FeatureImageValidationError extends Error {}

const collections: Record<FeatureImageType, string> = {
  customize: "customize-image",
  corporate: "corporate-image",
};
const featureImageCache = new Map<FeatureImageType, { mimeType: string; data: Buffer }>();

async function optimizeFeatureImage(value: string) {
  const match = value.match(/^data:image\/(png|jpeg|webp);base64,([a-z0-9+/]+=*)$/i);
  if (!match?.[2]) throw new FeatureImageValidationError("Upload a valid JPG, PNG, or WEBP image");

  const data = await sharp(Buffer.from(match[2], "base64"), { limitInputPixels: 40_000_000 })
    .rotate()
    .resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true })
    .webp({ quality: 78, effort: 3 })
    .toBuffer();
  return { image: `data:image/webp;base64,${data.toString("base64")}`, mimeType: "image/webp", data };
}

function cacheFeatureImage(type: FeatureImageType, value: string) {
  if (typeof value !== "string") {
    featureImageCache.delete(type);
    return;
  }
  const match = value.match(/^data:image\/(png|jpeg|webp);base64,([a-z0-9+/]+=*)$/i);
  if (!match?.[1] || !match[2]) {
    featureImageCache.delete(type);
    return;
  }
  featureImageCache.set(type, {
    mimeType: `image/${match[1].toLowerCase()}`,
    data: Buffer.from(match[2], "base64"),
  });
}

export function isFeatureImageType(value: string): value is FeatureImageType {
  return featureImageTypes.some((type) => type === value);
}

function normalizeImage(value: unknown) {
  if (typeof value !== "string" || value.length > 8_500_000) {
    throw new FeatureImageValidationError("Image must be smaller than 6 MB");
  }
  const image = value.trim();
  if (!/^data:image\/(png|jpeg|webp);base64,[a-z0-9+/]+=*$/i.test(image)) {
    throw new FeatureImageValidationError("Upload a JPG, PNG, or WEBP image");
  }
  return image;
}

export async function listFeatureImages(): Promise<FeatureImages> {
  const db = await getDatabase();
  const entries = await Promise.all(featureImageTypes.map(async (type) => {
    const collection = db.collection<{ _id: string; image?: string; imageOptimized?: boolean; updatedAt?: string }>(collections[type]);
    const document = await collection.findOne(
      { _id: "current" },
      { projection: { _id: 1, imageOptimized: 1, updatedAt: 1 } },
    );
    if (!document) return [type, null] as const;

    let updatedAt = document.updatedAt || "initial";
    if (!document.imageOptimized) {
      const legacyImage = await collection.findOne({ _id: "current" }, { projection: { image: 1 } });
      if (legacyImage?.image) {
        const optimized = await optimizeFeatureImage(legacyImage.image);
        updatedAt = new Date().toISOString();
        await collection.updateOne(
          { _id: "current" },
          { $set: { image: optimized.image, imageOptimized: true, updatedAt } },
        );
        featureImageCache.set(type, { mimeType: optimized.mimeType, data: optimized.data });
      }
    }

    const imageUrl = `/api/storefront/feature-images/${type}?v=${encodeURIComponent(updatedAt)}`;
    return [type, imageUrl] as const;
  }));
  return Object.fromEntries(entries) as FeatureImages;
}

export async function getFeatureImage(type: FeatureImageType) {
  const cached = featureImageCache.get(type);
  if (cached) return cached;
  const db = await getDatabase();
  const document = await db.collection<{ _id: string; image: string }>(collections[type]).findOne(
    { _id: "current" },
    { projection: { image: 1 } },
  );
  if (!document) return null;

  cacheFeatureImage(type, document.image);
  return featureImageCache.get(type) || null;
}

export async function saveFeatureImage(type: FeatureImageType, value: unknown) {
  const normalized = normalizeImage(value);
  const optimized = await optimizeFeatureImage(normalized);
  const db = await getDatabase();
  const now = new Date().toISOString();
  await db.collection<{ _id: string; image: string; imageOptimized: boolean; updatedAt: string }>(collections[type]).updateOne(
    { _id: "current" },
    { $set: { image: optimized.image, imageOptimized: true, updatedAt: now } },
    { upsert: true },
  );
  featureImageCache.set(type, { mimeType: optimized.mimeType, data: optimized.data });
  return { type, image: `/api/storefront/feature-images/${type}?v=${encodeURIComponent(now)}` };
}
