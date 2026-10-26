import { apiFetch } from "./api";

export type FeatureImageType = "customize" | "corporate";
export type FeatureImages = Record<FeatureImageType, string | null>;
export const featureImagesUpdatedEvent = "tribull-feature-images-updated";
const FEATURE_IMAGES_UPDATED_STORAGE_KEY = "tribull-feature-images-updated";
const FEATURE_IMAGES_CACHE_KEY = "tribull-feature-images-cache";

function isFeatureImages(value: unknown): value is FeatureImages {
  if (!value || typeof value !== "object") return false;
  const images = value as Record<string, unknown>;
  return ["customize", "corporate"].every((type) => images[type] === null || typeof images[type] === "string");
}

export function getCachedFeatureImages(): FeatureImages {
  try {
    const cached = window.sessionStorage.getItem(FEATURE_IMAGES_CACHE_KEY);
    if (!cached) return { customize: null, corporate: null };
    const images: unknown = JSON.parse(cached);
    return isFeatureImages(images) ? images : { customize: null, corporate: null };
  } catch {
    return { customize: null, corporate: null };
  }
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await apiFetch(url, init);
  if (!response.ok) {
    const details = await response.json().catch(() => undefined) as { error?: string } | undefined;
    throw new Error(details?.error || "Homepage image request failed");
  }
  return await response.json() as T;
}

export async function loadFeatureImages(refresh = false) {
  const url = refresh
    ? `/api/storefront/feature-images?refresh=${Date.now()}`
    : "/api/storefront/feature-images";
  const images = await request<FeatureImages>(url, { cache: "no-store" });
  try {
    window.sessionStorage.setItem(FEATURE_IMAGES_CACHE_KEY, JSON.stringify(images));
  } catch {
    // Keep the freshly loaded images available even when browser storage is unavailable.
  }
  return images;
}

export async function saveFeatureImage(type: FeatureImageType, image: string) {
  const saved = await request<{ type: FeatureImageType; image: string }>(`/api/admin/feature-images/${type}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ image }),
  });
  window.dispatchEvent(new Event(featureImagesUpdatedEvent));
  try {
    window.localStorage.setItem(FEATURE_IMAGES_UPDATED_STORAGE_KEY, String(Date.now()));
  } catch (error) {
    console.error("Could not notify other tabs about the updated homepage image.", error);
  }
  return saved;
}
