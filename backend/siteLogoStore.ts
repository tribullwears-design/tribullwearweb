import { getDatabase } from "./database.js";

const collectionName = "store-branding";
const documentId = "logo";

export class SiteLogoValidationError extends Error {}

function normalizeImage(value: unknown) {
  if (typeof value !== "string" || value.length > 8_500_000) {
    throw new SiteLogoValidationError("Logo image must be smaller than 6 MB");
  }
  const image = value.trim();
  if (!/^data:image\/(png|jpeg|webp);base64,[a-z0-9+/]+=*$/i.test(image)) {
    throw new SiteLogoValidationError("Upload a JPG, PNG, or WEBP logo");
  }
  return image;
}

async function getStoredLogo() {
  const db = await getDatabase();
  return db.collection<{ _id: string; image: string; updatedAt: string }>(collectionName).findOne(
    { _id: documentId },
  );
}

export async function getSiteLogoUrl() {
  const logo = await getStoredLogo();
  return logo ? `/api/storefront/logo/image?v=${encodeURIComponent(logo.updatedAt)}` : null;
}

export async function getSiteLogoImage() {
  const logo = await getStoredLogo();
  if (!logo) return null;
  const match = logo.image.match(/^data:image\/(png|jpeg|webp);base64,([a-z0-9+/]+=*)$/i);
  if (!match?.[1] || !match[2]) throw new Error("Stored site logo is invalid");
  return { mimeType: `image/${match[1].toLowerCase()}`, data: Buffer.from(match[2], "base64") };
}

export async function saveSiteLogo(value: unknown) {
  const image = normalizeImage(value);
  const db = await getDatabase();
  const updatedAt = new Date().toISOString();
  await db.collection<{ _id: string; image: string; updatedAt: string }>(collectionName).updateOne(
    { _id: documentId },
    { $set: { image, updatedAt } },
    { upsert: true },
  );
  return { image: `/api/storefront/logo/image?v=${encodeURIComponent(updatedAt)}` };
}
