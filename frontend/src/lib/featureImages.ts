import { apiFetch } from "./api";

export type FeatureImageType = "customize" | "corporate";
export type FeatureImages = Record<FeatureImageType, string | null>;

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await apiFetch(url, init);
  if (!response.ok) {
    const details = await response.json().catch(() => undefined) as { error?: string } | undefined;
    throw new Error(details?.error || "Homepage image request failed");
  }
  return await response.json() as T;
}

export function loadFeatureImages() {
  return request<FeatureImages>("/api/storefront/feature-images");
}

export function saveFeatureImage(type: FeatureImageType, image: string) {
  return request<{ type: FeatureImageType; image: string }>(`/api/admin/feature-images/${type}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ image }),
  });
}
