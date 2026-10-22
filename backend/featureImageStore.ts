import { getDatabase } from "./database.js";

export const featureImageTypes = ["customize", "corporate"] as const;
export type FeatureImageType = typeof featureImageTypes[number];
export type FeatureImages = Record<FeatureImageType, string | null>;

export class FeatureImageValidationError extends Error {}

const collections: Record<FeatureImageType, string> = {
  customize: "customize-image",
  corporate: "corporate-image",
};

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
    const document = await db.collection<{ _id: string; updatedAt?: string }>(collections[type]).findOne(
      { _id: "current" },
      { projection: { _id: 1, updatedAt: 1 } },
    );
    const imageUrl = document
      ? `/api/storefront/feature-images/${type}?v=${encodeURIComponent(document.updatedAt || "initial")}`
      : null;
    return [type, imageUrl] as const;
  }));
  return Object.fromEntries(entries) as FeatureImages;
}

export async function getFeatureImage(type: FeatureImageType) {
  const db = await getDatabase();
  const document = await db.collection<{ _id: string; image: string }>(collections[type]).findOne(
    { _id: "current" },
    { projection: { image: 1 } },
  );
  if (!document) return null;

  const match = document.image.match(/^data:image\/(png|jpeg|webp);base64,([a-z0-9+/]+=*)$/i);
  if (!match?.[1] || !match[2]) throw new Error(`Stored ${type} image is invalid`);
  return { mimeType: `image/${match[1].toLowerCase()}`, data: Buffer.from(match[2], "base64") };
}

export async function saveFeatureImage(type: FeatureImageType, value: unknown) {
  const image = normalizeImage(value);
  const db = await getDatabase();
  const now = new Date().toISOString();
  await db.collection<{ _id: string; image: string; updatedAt: string }>(collections[type]).updateOne(
    { _id: "current" },
    { $set: { image, updatedAt: now } },
    { upsert: true },
  );
  return { type, image: `/api/storefront/feature-images/${type}?v=${encodeURIComponent(now)}` };
}
