import { apiFetch } from "./api";

export type FeatureImageType = "customize" | "corporate";
export type FeatureImages = Record<FeatureImageType, string | null>;
export const featureImagesUpdatedEvent = "tribull-feature-images-updated";
const FEATURE_IMAGES_UPDATED_STORAGE_KEY = "tribull-feature-images-updated";

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await apiFetch(url, init);
  if (!response.ok) {
    const details = await response.json().catch(() => undefined) as { error?: string } | undefined;
    throw new Error(details?.error || "Homepage image request failed");
  }
  return await response.json() as T;
}

export function loadFeatureImages() {
  return request<FeatureImages>(`/api/storefront/feature-images?refresh=${Date.now()}`, { cache: "no-store" });
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
