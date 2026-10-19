import { apiFetch } from "./api";

export type CategoryBanner = {
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

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await apiFetch(url, init);
  if (!response.ok) {
    const details = await response.json().catch(() => undefined) as { error?: string } | undefined;
    throw new Error(details?.error || "Banner request failed");
  }
  return await response.json() as T;
}

export function loadBanners() {
  return request<CategoryBanner[]>("/api/banners");
}

export function loadCategoryBanner(categoryId: string) {
  return request<CategoryBanner | null>(`/api/banners/${encodeURIComponent(categoryId)}`);
}

export function saveBanner(categoryId: string, image: string, fields: { title?: string; subtitle?: string; link?: string } = {}) {
  return request<CategoryBanner>("/api/banners", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ categoryId, image, ...fields }),
  });
}

export function updateBanner(id: string, categoryId: string, image: string, fields: { title?: string; subtitle?: string; link?: string } = {}) {
  return request<CategoryBanner>(`/api/banners/${encodeURIComponent(id)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ categoryId, image, ...fields }),
  });
}

export function deleteBanner(id: string) {
  return request<{ deleted: boolean }>(`/api/banners/${encodeURIComponent(id)}`, { method: "DELETE" });
}
