import { useEffect, useState } from "react";
import { apiFetch } from "./api";

export type CategoryChoice = { value: string; label: string; image?: string };
export type CategoryHierarchy = { main: CategoryChoice[]; subcategories: Record<string, CategoryChoice[]> };

export const defaultCategoryHierarchy: CategoryHierarchy = {
  main: [
    { value: "cinema", label: "Cinema", image: "/products/cinema.png" },
    { value: "sports", label: "Sports", image: "/products/sports.png" },
    { value: "games", label: "Games", image: "/products/games.png" },
    { value: "motorsports", label: "MotoSports", image: "/products/motosports.jpg" },
  ],
  subcategories: {
    cinema: [
      { value: "hollywood", label: "Hollywood", image: "/products/hollywood.jpg" },
      { value: "bollywood", label: "Bollywood", image: "/products/bollywood.jpg" },
      { value: "kollywood", label: "Kollywood", image: "/products/kollywood.jpg" },
      { value: "tollywood", label: "Tollywood", image: "/products/tollywood.jpg" },
      { value: "mollywood", label: "Mollywood", image: "/products/mollywood.jpg" },
      { value: "sandalwood", label: "Sandalwood", image: "/products/sandalwood.jpg" },
    ],
    sports: [
      { value: "cricket", label: "Cricket", image: "/products/cricket.jpg" },
      { value: "football", label: "Football", image: "/products/football.jpg" },
      { value: "gym", label: "Gym", image: "/products/gym.jpg" },
    ],
    games: [
      { value: "pc-games", label: "PC Games", image: "/products/pc games.jpg" },
      { value: "mobile-games", label: "Mobile Games", image: "/products/mobilegames.jpg" },
    ],
    motorsports: [
      { value: "car", label: "Car", image: "/products/car.jpg" },
      { value: "bike", label: "Bike", image: "/products/bike.jpg" },
    ],
  },
};

export const CATEGORY_HIERARCHY_KEY = "tribull-admin-category-hierarchy";

type ApiCategory = CategoryChoice & { subcategories?: CategoryChoice[] };
type ApiCategoryResponse = ApiCategory[] | { categories?: ApiCategory[]; data?: ApiCategory[] | { categories?: ApiCategory[] }; mainCategories?: ApiCategory[]; subcategories?: (CategoryChoice & { parent?: string; parentId?: string; parentCategoryId?: string; mainCategoryId?: string })[] };

function fromApiDocuments(responseBody: ApiCategoryResponse): CategoryHierarchy {
  let documents: ApiCategory[];
  if (Array.isArray(responseBody)) {
    documents = responseBody;
  } else if (Array.isArray(responseBody.categories)) {
    documents = responseBody.categories;
  } else if (Array.isArray(responseBody.data)) {
    documents = responseBody.data;
  } else if (responseBody.data && !Array.isArray(responseBody.data) && Array.isArray(responseBody.data.categories)) {
    documents = responseBody.data.categories;
  } else if (Array.isArray(responseBody.mainCategories)) {
    const separateSubcategories = responseBody.subcategories || [];
    documents = responseBody.mainCategories.map((category) => ({
      ...category,
      subcategories: category.subcategories || separateSubcategories.filter((subcategory) => {
        const parent = subcategory.parentCategoryId || subcategory.mainCategoryId || subcategory.parentId || subcategory.parent;
        return parent === category.value || parent === category.label;
      }),
    }));
  } else {
    throw new Error("Category API response has an unsupported shape");
  }

  return {
    main: documents.map(({ value, label, image }) => ({ value, label, image })),
    subcategories: Object.fromEntries(documents.map((category) => [category.value, category.subcategories || []])),
  } satisfies CategoryHierarchy;
}

function toApiDocuments(hierarchy: CategoryHierarchy) {
  return hierarchy.main.map((category) => ({ ...category, subcategories: hierarchy.subcategories[category.value] || [] }));
}

async function requestCategory(path: string, method: "POST" | "PATCH" | "DELETE", body?: unknown) {
  invalidatePendingCategoryRequest();
  const response = await apiFetch(path, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!response.ok) {
    const details = await response.json().catch(() => undefined) as { error?: string } | undefined;
    throw new Error(details?.error || "Category request failed");
  }
  return response.json();
}

function cacheHierarchy(hierarchy: CategoryHierarchy, notify = true) {
  window.localStorage.setItem(CATEGORY_HIERARCHY_KEY, JSON.stringify(hierarchy));
  if (notify) window.dispatchEvent(new Event("tribull-category-hierarchy-updated"));
}

export function readCategoryHierarchy(fallback: CategoryHierarchy): CategoryHierarchy {
  return fallback;
}

function readCachedHierarchy(fallback: CategoryHierarchy): CategoryHierarchy {
  try {
    const saved = window.localStorage.getItem(CATEGORY_HIERARCHY_KEY);
    return saved ? JSON.parse(saved) as CategoryHierarchy : fallback;
  } catch {
    return fallback;
  }
}

export async function saveCategoryHierarchy(hierarchy: CategoryHierarchy) {
  invalidatePendingCategoryRequest();
  try {
    const response = await apiFetch("/api/categories", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(toApiDocuments(hierarchy)) });
    if (!response.ok) return false;
    cacheHierarchy(fromApiDocuments(await response.json()));
    return true;
  } catch {
    return false;
  }
}

export async function fetchCategoryHierarchy(fallback: CategoryHierarchy) {
  try {
    const hierarchy = await loadCategoryHierarchy();
    cacheHierarchy(hierarchy, false);
    return hierarchy;
  } catch {
    return fallback;
  }
}

let categoryHierarchyRequest: Promise<CategoryHierarchy> | undefined;

function invalidatePendingCategoryRequest() {
  categoryHierarchyRequest = undefined;
}

async function requestCategoryHierarchy() {
  const url = "/api/categories";
  let response: Response;
  try {
    response = await apiFetch(url, { cache: "no-store" });
  } catch (error) {
    console.error("CATEGORY API ERROR", {
      status: "unavailable",
      url,
      response: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
  if (!response.ok) {
    const body = await response.text();
    console.error("CATEGORY API ERROR", {
      status: response.status,
      url: response.url || url,
      response: body,
    });
    let details: { error?: string } | undefined;
    try {
      details = JSON.parse(body) as { error?: string };
    } catch {
      details = undefined;
    }
    throw new Error(details?.error || "Category request failed");
  }
  const hierarchy = fromApiDocuments(await response.json() as ApiCategoryResponse);
  cacheHierarchy(hierarchy, false);
  return hierarchy;
}

export function loadCategoryHierarchy() {
  if (categoryHierarchyRequest) return categoryHierarchyRequest;

  const request = requestCategoryHierarchy();
  const sharedRequest = request.finally(() => {
    if (categoryHierarchyRequest === sharedRequest) categoryHierarchyRequest = undefined;
  });
  categoryHierarchyRequest = sharedRequest;
  return sharedRequest;
}

export function createCategory(category: CategoryChoice) {
  return requestCategory("/api/categories", "POST", category);
}

export function updateCategory(value: string, changes: Partial<CategoryChoice>) {
  return requestCategory(`/api/categories/${encodeURIComponent(value)}`, "PATCH", changes);
}

export function deleteCategory(value: string) {
  return requestCategory(`/api/categories/${encodeURIComponent(value)}`, "DELETE");
}

export function createSubcategory(parent: string, subcategory: CategoryChoice) {
  return requestCategory(`/api/categories/${encodeURIComponent(parent)}/subcategories`, "POST", subcategory);
}

export function updateSubcategory(parent: string, value: string, changes: Partial<CategoryChoice>) {
  return requestCategory(`/api/categories/${encodeURIComponent(parent)}/subcategories/${encodeURIComponent(value)}`, "PATCH", changes);
}

export function deleteSubcategory(parent: string, value: string) {
  return requestCategory(`/api/categories/${encodeURIComponent(parent)}/subcategories/${encodeURIComponent(value)}`, "DELETE");
}

export function useCategoryHierarchy(fallback: CategoryHierarchy) {
  const [hierarchy, setHierarchy] = useState<CategoryHierarchy>(() => fallback);

  useEffect(() => {
    const syncHierarchy = () => setHierarchy(readCachedHierarchy(fallback));
    void fetchCategoryHierarchy(fallback).then(setHierarchy);
    window.addEventListener("tribull-category-hierarchy-updated", syncHierarchy);
    window.addEventListener("storage", syncHierarchy);
    return () => {
      window.removeEventListener("tribull-category-hierarchy-updated", syncHierarchy);
      window.removeEventListener("storage", syncHierarchy);
    };
  }, []);

  return hierarchy;
}
