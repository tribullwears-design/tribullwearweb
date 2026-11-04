import { apiFetch } from "./api";

export const MAX_PRODUCT_SIDE_IMAGES = 6;

async function fetchSideImages(productId: string, admin: boolean): Promise<Array<string | null>> {
  const endpoint = admin
    ? `/api/admin/products/${encodeURIComponent(productId)}/side-images`
    : `/api/products/${encodeURIComponent(productId)}/side-images`;
  const response = await apiFetch(endpoint, { cache: "no-store" });
  if (!response.ok) {
    const details = await response.json().catch(() => undefined) as { error?: string } | undefined;
    throw new Error(details?.error || "Product side images could not be loaded.");
  }
  const payload = await response.json() as { images?: unknown };
  if (!Array.isArray(payload.images) || payload.images.length !== MAX_PRODUCT_SIDE_IMAGES
    || payload.images.some((image) => image !== null && typeof image !== "string")) {
    throw new Error("The server returned an invalid product side image list.");
  }
  return payload.images as Array<string | null>;
}

export function fetchProductSideImages(productId: string): Promise<Array<string | null>> {
  return fetchSideImages(productId, false);
}

export function fetchAdminProductSideImages(productId: string): Promise<Array<string | null>> {
  return fetchSideImages(productId, true);
}

export async function saveProductSideImage(productId: string, index: number, image: string): Promise<string> {
  const response = await apiFetch(`/api/admin/products/${encodeURIComponent(productId)}/side-images/${index}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ image }),
  });
  if (!response.ok) {
    const details = await response.json().catch(() => undefined) as { error?: string } | undefined;
    throw new Error(details?.error || "Product side image could not be saved.");
  }
  const payload = await response.json() as { imageUrl?: unknown };
  if (typeof payload.imageUrl !== "string") throw new Error("The server returned an invalid product side image response.");
  return payload.imageUrl;
}

export async function deleteProductSideImage(productId: string, index: number): Promise<void> {
  const response = await apiFetch(`/api/admin/products/${encodeURIComponent(productId)}/side-images/${index}`, {
    method: "DELETE",
  });
  if (!response.ok) {
    const details = await response.json().catch(() => undefined) as { error?: string } | undefined;
    throw new Error(details?.error || "Product side image could not be deleted.");
  }
}
