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

const CATEGORY_BANNER_CACHE_PREFIX = "tribull-storefront-banner:";

export function getCachedCategoryBanner(categoryId: string): CategoryBanner | null {
  try {
    const cached = window.sessionStorage.getItem(`${CATEGORY_BANNER_CACHE_PREFIX}${categoryId}`);
    if (!cached) return null;
    const banner: unknown = JSON.parse(cached);
    if (!banner || typeof banner !== "object" || typeof (banner as CategoryBanner).image !== "string") return null;
    return banner as CategoryBanner;
  } catch {
    return null;
  }
}

function cacheCategoryBanner(categoryId: string, banner: CategoryBanner | null) {
  try {
    const key = `${CATEGORY_BANNER_CACHE_PREFIX}${categoryId}`;
    if (banner) window.sessionStorage.setItem(key, JSON.stringify(banner));
    else window.sessionStorage.removeItem(key);
  } catch {
    // Keep banner updates functional when browser storage is unavailable.
  }
}

function clearCachedCategoryBanners() {
  try {
    for (let index = window.sessionStorage.length - 1; index >= 0; index--) {
      const key = window.sessionStorage.key(index);
      if (key?.startsWith(CATEGORY_BANNER_CACHE_PREFIX)) window.sessionStorage.removeItem(key);
    }
  } catch {
    // Keep banner updates functional when browser storage is unavailable.
  }
}

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
  return request<CategoryBanner | null>(`/api/banners/${encodeURIComponent(categoryId)}`, { cache: "no-store" })
    .then((banner) => {
      cacheCategoryBanner(categoryId, banner);
      return banner;
    });
}

export function saveBanner(categoryId: string, image: string, fields: { title?: string; subtitle?: string; link?: string } = {}) {
  return request<CategoryBanner>("/api/banners", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ categoryId, image, ...fields }),
  }).then((banner) => {
    clearCachedCategoryBanners();
    return banner;
  });
}

export function updateBanner(id: string, categoryId: string, image: string, fields: { title?: string; subtitle?: string; link?: string } = {}) {
  return request<CategoryBanner>(`/api/banners/${encodeURIComponent(id)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ categoryId, image, ...fields }),
  }).then((banner) => {
    clearCachedCategoryBanners();
    return banner;
  });
}

export function deleteBanner(id: string) {
  return request<{ deleted: boolean }>(`/api/banners/${encodeURIComponent(id)}`, { method: "DELETE" })
    .then((result) => {
      clearCachedCategoryBanners();
      return result;
    });
}
