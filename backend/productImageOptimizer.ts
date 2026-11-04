import sharp from "sharp";

const allowedWidths = new Set([480, 640, 960]);
const STOREFRONT_IMAGE_CACHE_LIMIT_BYTES = 24 * 1024 * 1024;
type CachedStorefrontImage = { image: Buffer; immutable: boolean };
const storefrontImageCache = new Map<string, CachedStorefrontImage>();
const storefrontImageRequests = new Map<string, Promise<CachedStorefrontImage>>();
let storefrontImageCacheBytes = 0;

export async function optimizeProductImageForStorefront(image: string, width: number) {
  if (!allowedWidths.has(width)) throw new Error("Product image width is invalid");
  const match = image.match(/^data:image\/[a-z0-9.+-]+;base64,([\s\S]+)$/i);
  if (!match) throw new Error("Product image format is not supported");

  const bytes = Buffer.from(match[1], "base64");
  return sharp(bytes, { limitInputPixels: 40_000_000 })
    .rotate()
    .resize({
      width,
      height: width,
      fit: "inside",
      withoutEnlargement: true,
    })
    .webp({ quality: 76, effort: 3 })
    .toBuffer();
}

export async function getCachedStorefrontProductImage(
  cacheKey: string,
  image: string,
  width: number,
  immutable: boolean,
) {
  if (!allowedWidths.has(width)) throw new Error("Product image width is invalid");
  const cached = getCachedStorefrontProductImageByKey(cacheKey);
  if (cached) return cached;

  const pendingRequest = storefrontImageRequests.get(cacheKey);
  if (pendingRequest) return pendingRequest;

  const optimizationRequest = optimizeProductImageForStorefront(image, width)
    .then((optimized) => {
      if (optimized.byteLength <= STOREFRONT_IMAGE_CACHE_LIMIT_BYTES) {
        while (storefrontImageCacheBytes + optimized.byteLength > STOREFRONT_IMAGE_CACHE_LIMIT_BYTES) {
          const oldest = storefrontImageCache.keys().next().value;
          if (!oldest) break;
          const removed = storefrontImageCache.get(oldest);
          storefrontImageCache.delete(oldest);
          storefrontImageCacheBytes -= removed?.image.byteLength || 0;
        }
        storefrontImageCache.set(cacheKey, { image: optimized, immutable });
        storefrontImageCacheBytes += optimized.byteLength;
      }
      return { image: optimized, immutable };
    })
    .finally(() => {
      storefrontImageRequests.delete(cacheKey);
    });
  storefrontImageRequests.set(cacheKey, optimizationRequest);
  return optimizationRequest;
}

export function getCachedStorefrontProductImageByKey(cacheKey: string) {
  const cached = storefrontImageCache.get(cacheKey);
  if (!cached) return undefined;
  storefrontImageCache.delete(cacheKey);
  storefrontImageCache.set(cacheKey, cached);
  return cached;
}
