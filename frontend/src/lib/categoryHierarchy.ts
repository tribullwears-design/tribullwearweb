import { useEffect, useState } from "react";

export type CategoryChoice = { value: string; label: string; image?: string };
export type CategoryHierarchy = { main: CategoryChoice[]; subcategories: Record<string, CategoryChoice[]> };

export const CATEGORY_HIERARCHY_KEY = "tribull-admin-category-hierarchy";

function fromApiDocuments(documents: CategoryChoice[]) {
  return {
    main: documents.map(({ value, label, image }) => ({ value, label, image })),
    subcategories: Object.fromEntries(documents.map((category) => [category.value, ((category as CategoryChoice & { subcategories?: CategoryChoice[] }).subcategories || [])])),
  } satisfies CategoryHierarchy;
}

function toApiDocuments(hierarchy: CategoryHierarchy) {
  return hierarchy.main.map((category) => ({ ...category, subcategories: hierarchy.subcategories[category.value] || [] }));
}

async function requestCategory(path: string, method: "POST" | "PATCH" | "DELETE", body?: unknown) {
  const response = await fetch(path, {
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
  try {
    const response = await fetch("/api/categories", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(toApiDocuments(hierarchy)) });
    if (!response.ok) return false;
    cacheHierarchy(fromApiDocuments(await response.json()));
    return true;
  } catch {
    return false;
  }
}

export async function fetchCategoryHierarchy(fallback: CategoryHierarchy) {
  try {
    const response = await fetch("/api/categories", { cache: "no-store" });
    if (!response.ok) throw new Error("Category request failed");
    const hierarchy = fromApiDocuments(await response.json() as CategoryChoice[]);
    cacheHierarchy(hierarchy, false);
    return hierarchy;
  } catch {
    return fallback;
  }
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

