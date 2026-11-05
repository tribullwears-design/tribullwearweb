import { ObjectId, type Collection } from "mongodb";
import sharp from "sharp";
import { listCategories } from "./categoryStore.js";
import { getDatabase } from "./database.js";

export type BannerDocument = {
  id: string;
  categoryId: string;
  categoryName: string;
  image: string;
  imageUrl: string;
  createdAt: string;
  updatedAt: string;
  title?: string;
  subtitle?: string;
  link?: string;
};

type StoredBanner = Omit<BannerDocument, "id">;
type CachedBannerImage = { mimeType: string; data: Buffer; updatedAt: string };

const existingHeroBanners: Record<string, string> = {
  cinema: "/products/hero.png",
  sports: "/products/sportsbanner.png",
  games: "/products/game banner.png",
  motorsports: "/products/motosportsbanner.png",
};

let indexPromise: Promise<string> | undefined;
let seedPromise: Promise<void> | undefined;
const bannerImageCache = new Map<string, CachedBannerImage>();
const bannerImageOptimizationRequests = new Map<string, { source: CachedBannerImage; promise: Promise<CachedBannerImage> }>();

function clearBannerCache(categoryId: string) {
  bannerImageCache.delete(categoryId);
  bannerImageOptimizationRequests.delete(categoryId);
}

function cacheBannerImage(categoryId: string, value: string, updatedAt: string) {
  bannerImageOptimizationRequests.delete(categoryId);
  const match = value.match(/^data:image\/(png|jpeg|webp);base64,([a-z0-9+/]+=*)$/i);
  if (!match?.[1] || !match[2]) {
    bannerImageCache.delete(categoryId);
    return;
  }
  bannerImageCache.delete(categoryId);
  bannerImageCache.set(categoryId, {
    mimeType: `image/${match[1].toLowerCase()}`,
    data: Buffer.from(match[2], "base64"),
    updatedAt,
  });
  if (bannerImageCache.size > 4) {
    const oldestCategoryId = bannerImageCache.keys().next().value;
    if (oldestCategoryId) {
      bannerImageCache.delete(oldestCategoryId);
      bannerImageOptimizationRequests.delete(oldestCategoryId);
    }
  }
}

function optimizeBannerImage(categoryId: string, image: CachedBannerImage) {
  if (image.mimeType === "image/webp") return Promise.resolve(image);
  const pending = bannerImageOptimizationRequests.get(categoryId);
  if (pending?.source === image) return pending.promise;

  const promise = sharp(image.data, { limitInputPixels: 40_000_000 })
    .rotate()
    .resize({ width: 1920, height: 1920, fit: "inside", withoutEnlargement: true })
    .webp({ quality: 82, effort: 3 })
    .toBuffer()
    .then((data) => {
      const optimized = { mimeType: "image/webp", data, updatedAt: image.updatedAt };
      if (bannerImageCache.get(categoryId) === image) bannerImageCache.set(categoryId, optimized);
      return optimized;
    })
    .finally(() => {
      if (bannerImageOptimizationRequests.get(categoryId)?.promise === promise) {
        bannerImageOptimizationRequests.delete(categoryId);
      }
    });
  bannerImageOptimizationRequests.set(categoryId, { source: image, promise });
  return promise;
}

async function getCollection(): Promise<Collection<StoredBanner>> {
  const db = await getDatabase();
  const collection = db.collection<StoredBanner>("banners");
  indexPromise ||= collection.createIndex({ categoryId: 1 }, { unique: true }).catch((error: unknown) => {
    indexPromise = undefined;
    throw error;
  });
  await indexPromise;
  return collection;
}

function seedExistingHeroBanners(collection: Collection<StoredBanner>) {
  if (!seedPromise) {
    const operation = (async () => {
      const migrations = collection.db.collection<{ _id: string }>("schema_migrations");
      const migrationId = "seed-category-hero-banners-v1";
      if (await migrations.findOne({ _id: migrationId })) return;

      const categories = await listCategories();
      for (const category of categories) {
        const image = existingHeroBanners[category.value];
        if (!image) continue;
        const now = new Date().toISOString();
        await collection.updateOne(
          { categoryId: category.value },
          {
            $set: { categoryName: category.label },
            $setOnInsert: { image, imageUrl: image, createdAt: now, updatedAt: now },
          },
          { upsert: true },
        );
      }
      await migrations.updateOne({ _id: migrationId }, { $setOnInsert: { _id: migrationId } }, { upsert: true });
    })();
    seedPromise = operation.catch((error: unknown) => {
      seedPromise = undefined;
      throw error;
    });
  }
  return seedPromise;
}

function toBanner(document: StoredBanner & { _id: ObjectId }): BannerDocument {
  const { _id, ...banner } = document;
  return { ...banner, id: _id.toString() };
}

function normalizeImage(value: unknown) {
  if (typeof value !== "string" || !value.trim()) throw new Error("Banner image is required");
  const image = value.trim();
  if (image.length > 8_500_000) throw new Error("Banner image must be smaller than 6 MB");
  if (/^\/products\/[a-z0-9 _./-]+\.(png|jpe?g|webp|gif)$/i.test(image)) return image;
  if (/^data:image\/(png|jpeg|webp);base64,[a-z0-9+/]+=*$/i.test(image) && image.length > "data:image/png;base64,".length) return image;
  throw new Error("Banner image must be a supported image upload");
}

async function resolveCategory(categoryId: unknown) {
  if (typeof categoryId !== "string" || !categoryId.trim()) throw new Error("Main category is required");
  if (categoryId.trim().toLowerCase() === "home") return { value: "home", label: "Home Page" };
  const categories = await listCategories();
  const slugify = (value: string) => value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const requestedId = slugify(categoryId);
  const category = categories.find((item) => slugify(item.value) === requestedId || slugify(item.label) === requestedId);
  if (!category) throw new Error("Main category not found");
  return category;
}

export async function listBanners() {
  const collection = await getCollection();
  await seedExistingHeroBanners(collection);
  const [documents, categories] = await Promise.all([
    collection.find({}).sort({ categoryName: 1 }).toArray(),
    listCategories(),
  ]);
  const labelsById = new Map(categories.map((category) => [category.value, category.label]));
  return documents.map((document) => ({
    ...toBanner(document),
    categoryName: labelsById.get(document.categoryId) || document.categoryName,
  }));
}

export async function getBanner(categoryId: string) {
  const category = await resolveCategory(categoryId);
  const collection = await getCollection();
  await seedExistingHeroBanners(collection);
  const document = await collection.findOne({ categoryId: category.value });
  if (!document) return null;
  return { ...toBanner(document), categoryName: category.label };
}

export async function getStorefrontBanner(categoryId: string) {
  const banner = await getBanner(categoryId);
  if (!banner || !banner.image.startsWith("data:image/")) return banner;
  const imageUrl = `/api/banners/${encodeURIComponent(banner.categoryId)}/image?v=${encodeURIComponent(banner.updatedAt)}&format=webp`;
  return { ...banner, image: imageUrl, imageUrl };
}

export async function getBannerImage(categoryId: string) {
  const category = await resolveCategory(categoryId);
  const collection = await getCollection();
  await seedExistingHeroBanners(collection);
  const document = await collection.findOne({ categoryId: category.value });
  if (!document) return null;

  let image = bannerImageCache.get(category.value);
  if (image?.updatedAt !== document.updatedAt) {
    cacheBannerImage(category.value, document.image, document.updatedAt);
    image = bannerImageCache.get(category.value);
  }
  return image ? optimizeBannerImage(category.value, image) : null;
}

function normalizeBannerFields(value: unknown) {
  const input = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const text = (name: string, max: number) => input[name] === undefined ? undefined : typeof input[name] === "string" ? input[name].trim().slice(0, max) : (() => { throw new Error(`${name} must be text`); })();
  const link = text("link", 500);
  if (link && !/^\/(?!\/)|^https:\/\//i.test(link)) throw new Error("Banner link must be a relative path or HTTPS URL");
  return { ...(text("title", 120) !== undefined ? { title: text("title", 120) } : {}), ...(text("subtitle", 240) !== undefined ? { subtitle: text("subtitle", 240) } : {}), ...(link !== undefined ? { link } : {}) };
}

export async function saveBanner(categoryId: string, imageInput: unknown, fields?: unknown) {
  const category = await resolveCategory(categoryId);
  const image = normalizeImage(imageInput);
  const collection = await getCollection();
  const now = new Date().toISOString();
  const document = await collection.findOneAndUpdate(
    { categoryId: category.value },
    {
      $set: { categoryName: category.label, image, imageUrl: image, updatedAt: now, ...normalizeBannerFields(fields) },
      $setOnInsert: { createdAt: now },
    },
    { upsert: true, returnDocument: "after" },
  );
  if (!document) throw new Error("Banner could not be saved");
  clearBannerCache(category.value);
  cacheBannerImage(category.value, image, document.updatedAt);
  return toBanner(document);
}

export async function updateBanner(id: string, categoryId: string, imageInput: unknown, fields?: unknown) {
  if (!ObjectId.isValid(id)) throw new Error("Banner not found");
  const category = await resolveCategory(categoryId);
  const image = normalizeImage(imageInput);
  const collection = await getCollection();
  const bannerId = new ObjectId(id);
  const existing = await collection.findOne({ _id: bannerId });
  if (!existing) throw new Error("Banner not found");

  const now = new Date().toISOString();
  if (existing.categoryId !== category.value) {
    const categoryBanner = await collection.findOne({ categoryId: category.value });
    if (categoryBanner && !categoryBanner._id.equals(bannerId)) {
      const updated = await collection.findOneAndUpdate(
        { _id: categoryBanner._id },
        { $set: { categoryName: category.label, image, imageUrl: image, updatedAt: now, ...normalizeBannerFields(fields) } },
        { returnDocument: "after" },
      );
      await collection.deleteOne({ _id: bannerId });
      if (!updated) throw new Error("Banner could not be updated");
      clearBannerCache(existing.categoryId);
      clearBannerCache(category.value);
      cacheBannerImage(category.value, image, updated.updatedAt);
      return toBanner(updated);
    }
  }

  const updated = await collection.findOneAndUpdate(
    { _id: bannerId },
    { $set: { categoryId: category.value, categoryName: category.label, image, imageUrl: image, updatedAt: now, ...normalizeBannerFields(fields) } },
    { returnDocument: "after" },
  );
  if (!updated) throw new Error("Banner not found");
  if (existing.categoryId !== category.value) clearBannerCache(existing.categoryId);
  clearBannerCache(category.value);
  cacheBannerImage(category.value, image, updated.updatedAt);
  return toBanner(updated);
}

export async function deleteBanner(id: string) {
  if (!ObjectId.isValid(id)) throw new Error("Banner not found");
  const collection = await getCollection();
  const banner = await collection.findOne({ _id: new ObjectId(id) });
  if (!banner) return false;
  const deleted = (await collection.deleteOne({ _id: new ObjectId(id) })).deletedCount > 0;
  if (deleted) clearBannerCache(banner.categoryId);
  return deleted;
}
