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

function cacheHierarchy(hierarchy: CategoryHierarchy) {
  window.localStorage.setItem(CATEGORY_HIERARCHY_KEY, JSON.stringify(hierarchy));
  window.dispatchEvent(new Event("tribull-category-hierarchy-updated"));
}

export function readCategoryHierarchy(fallback: CategoryHierarchy): CategoryHierarchy {
  try {
    const saved = window.localStorage.getItem(CATEGORY_HIERARCHY_KEY);
    if (!saved) return fallback;
    const parsed = JSON.parse(saved) as Partial<CategoryHierarchy>;
    const savedMain = Array.isArray(parsed.main) ? parsed.main : [];
    const fallbackMain = new Map(fallback.main.map((category) => [category.value, category]));
    const main = savedMain.map((category) => ({ ...fallbackMain.get(category.value), ...category }));
    const subcategories = Object.fromEntries(Object.entries(fallback.subcategories).map(([parent, fallbackItems]) => {
      const savedItems = parsed.subcategories?.[parent] || [];
      const fallbackByValue = new Map(fallbackItems.map((item) => [item.value, item]));
      return [parent, savedItems.map((item) => ({ ...fallbackByValue.get(item.value), ...item }))];
    }));
    Object.entries(parsed.subcategories || {}).forEach(([parent, items]) => {
      if (!(parent in subcategories)) subcategories[parent] = items;
    });
    return { main, subcategories };
  } catch {
    return fallback;
  }
}

export function saveCategoryHierarchy(hierarchy: CategoryHierarchy) {
  cacheHierarchy(hierarchy);
  void fetch("/api/categories", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(toApiDocuments(hierarchy)) })
    .then((response) => response.ok ? response.json() : Promise.reject(new Error("Category save failed")))
    .then((documents) => cacheHierarchy(fromApiDocuments(documents)))
    .catch(() => undefined);
}

export async function fetchCategoryHierarchy(fallback: CategoryHierarchy) {
  try {
    const response = await fetch("/api/categories", { cache: "no-store" });
    if (!response.ok) throw new Error("Category request failed");
    const hierarchy = fromApiDocuments(await response.json() as CategoryChoice[]);
    cacheHierarchy(hierarchy);
    return hierarchy;
  } catch {
    return readCategoryHierarchy(fallback);
  }
}

export function useCategoryHierarchy(fallback: CategoryHierarchy) {
  const [hierarchy, setHierarchy] = useState<CategoryHierarchy>(() => readCategoryHierarchy(fallback));

  useEffect(() => {
    const syncHierarchy = () => setHierarchy(readCategoryHierarchy(fallback));
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