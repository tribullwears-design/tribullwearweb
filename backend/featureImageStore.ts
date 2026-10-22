import { getDatabase } from "./database.js";

export const featureImageTypes = ["customize", "corporate"] as const;
export type FeatureImageType = typeof featureImageTypes[number];
export type FeatureImages = Record<FeatureImageType, string | null>;

export class FeatureImageValidationError extends Error {}

const collections: Record<FeatureImageType, string> = {
  customize: "customize-image",
  corporate: "corporate-image",
};

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
    const document = await db.collection<{ _id: string; image: string }>(collections[type]).findOne({ _id: "current" });
    return [type, document?.image ?? null] as const;
  }));
  return Object.fromEntries(entries) as FeatureImages;
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
  return { type, image };
}
