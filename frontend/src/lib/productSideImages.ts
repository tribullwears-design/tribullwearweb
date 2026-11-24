import { apiFetch } from "./api";
import { MAX_PRODUCT_GALLERY_IMAGES } from "../../../shared/products";

export const MAX_PRODUCT_SIDE_IMAGES = 6;
export const MAX_PRODUCT_COLOR_IMAGES = MAX_PRODUCT_GALLERY_IMAGES;

async function fetchImageList(endpoint: string, expectedCount: number, errorMessage: string): Promise<Array<string | null>> {
  const response = await apiFetch(endpoint, { cache: "no-store" });
  if (!response.ok) {
    const details = await response.json().catch(() => undefined) as { error?: string } | undefined;
    throw new Error(details?.error || errorMessage);
  }
  const payload = await response.json() as { images?: unknown };
  if (!Array.isArray(payload.images) || payload.images.length !== expectedCount
    || payload.images.some((image) => image !== null && typeof image !== "string")) {
    throw new Error("The server returned an invalid product image list.");
  }
  return payload.images as Array<string | null>;
}

export function fetchProductSideImages(productId: string): Promise<Array<string | null>> {
  return fetchImageList(`/api/products/${encodeURIComponent(productId)}/side-images`, MAX_PRODUCT_SIDE_IMAGES, "Product side images could not be loaded.");
}

export function fetchAdminProductSideImages(productId: string): Promise<Array<string | null>> {
  return fetchImageList(`/api/admin/products/${encodeURIComponent(productId)}/side-images`, MAX_PRODUCT_SIDE_IMAGES, "Product side images could not be loaded.");
}

function colorImagesEndpoint(productId: string, color: string, admin: boolean) {
  const prefix = admin ? "/api/admin/products" : "/api/products";
  return `${prefix}/${encodeURIComponent(productId)}/color-images/${encodeURIComponent(color.trim().toLowerCase())}`;
}

export function fetchProductColorImages(productId: string, color: string): Promise<Array<string | null>> {
  return fetchImageList(colorImagesEndpoint(productId, color, false), MAX_PRODUCT_COLOR_IMAGES, "Product color images could not be loaded.");
}

export function fetchAdminProductColorImages(productId: string, color: string): Promise<Array<string | null>> {
  return fetchImageList(colorImagesEndpoint(productId, color, true), MAX_PRODUCT_COLOR_IMAGES, "Product color images could not be loaded.");
}

async function saveProductImage(endpoint: string, image: string, errorMessage: string): Promise<string> {
  const response = await apiFetch(endpoint, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ image }),
  });
  if (!response.ok) {
    const details = await response.json().catch(() => undefined) as { error?: string } | undefined;
    throw new Error(details?.error || errorMessage);
  }
  const payload = await response.json() as { imageUrl?: unknown };
  if (typeof payload.imageUrl !== "string") throw new Error("The server returned an invalid product side image response.");
  return payload.imageUrl;
}

export function saveProductSideImage(productId: string, index: number, image: string): Promise<string> {
  return saveProductImage(`/api/admin/products/${encodeURIComponent(productId)}/side-images/${index}`, image, "Product side image could not be saved.");
}

export function saveProductColorImage(productId: string, color: string, index: number, image: string): Promise<string> {
  const endpoint = `${colorImagesEndpoint(productId, color, true)}/${index}`;
  return saveProductImage(endpoint, image, "Product color image could not be saved.");
}

async function deleteProductImage(endpoint: string, errorMessage: string): Promise<void> {
  const response = await apiFetch(endpoint, { method: "DELETE" });
  if (!response.ok) {
    const details = await response.json().catch(() => undefined) as { error?: string } | undefined;
    throw new Error(details?.error || errorMessage);
  }
}

export function deleteProductSideImage(productId: string, index: number): Promise<void> {
  return deleteProductImage(`/api/admin/products/${encodeURIComponent(productId)}/side-images/${index}`, "Product side image could not be deleted.");
}

export function deleteProductColorImage(productId: string, color: string, index: number): Promise<void> {
  return deleteProductImage(`${colorImagesEndpoint(productId, color, true)}/${index}`, "Product color image could not be deleted.");
}
