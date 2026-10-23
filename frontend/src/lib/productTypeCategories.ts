import { useEffect, useState } from "react";
import {
  defaultProductTypeCategories,
  type ProductTypeCategory,
} from "../../../shared/productTypeCategories";
import { apiFetch } from "./api";

export { defaultProductTypeCategories };
export type { ProductTypeCategory };

export const productTypeCategoriesUpdatedEvent = "tribull-product-type-categories-updated";

let cachedProductTypeCategories = defaultProductTypeCategories;
let pendingProductTypeRequest: Promise<ProductTypeCategory[]> | undefined;

async function readResponse(response: Response): Promise<ProductTypeCategory[]> {
  if (!response.ok) {
    const details = await response.json().catch(() => undefined) as { error?: string } | undefined;
    throw new Error(details?.error || `Product type categories request failed (${response.status})`);
  }
  return response.json() as Promise<ProductTypeCategory[]>;
}

export function fetchProductTypeCategories() {
  if (!pendingProductTypeRequest) {
    pendingProductTypeRequest = apiFetch("/api/storefront/product-type-categories", { cache: "no-store" })
      .then(readResponse)
      .then((categories) => {
        cachedProductTypeCategories = categories;
        return categories;
      })
      .finally(() => {
        pendingProductTypeRequest = undefined;
      });
  }
  return pendingProductTypeRequest;
}

export function saveProductTypeCategories(categories: ProductTypeCategory[]) {
  return apiFetch("/api/admin/product-type-categories", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(categories),
  })
    .then(readResponse)
    .then((savedCategories) => {
      cachedProductTypeCategories = savedCategories;
      window.dispatchEvent(new Event(productTypeCategoriesUpdatedEvent));
      return savedCategories;
    });
}

export function useProductTypeCategories() {
  const [categories, setCategories] = useState<ProductTypeCategory[]>(cachedProductTypeCategories);

  useEffect(() => {
    let active = true;
    const syncCategories = () => {
      setCategories(cachedProductTypeCategories);
      void fetchProductTypeCategories()
        .then((next) => {
          if (active) setCategories(next);
        })
        .catch((error: unknown) => {
          console.error("Could not load product type categories.", error);
        });
    };
    const onUpdated = () => setCategories(cachedProductTypeCategories);
    window.addEventListener(productTypeCategoriesUpdatedEvent, onUpdated);
    window.addEventListener("focus", syncCategories);
    syncCategories();

    return () => {
      active = false;
      window.removeEventListener(productTypeCategoriesUpdatedEvent, onUpdated);
      window.removeEventListener("focus", syncCategories);
    };
  }, []);

  return categories;
}
