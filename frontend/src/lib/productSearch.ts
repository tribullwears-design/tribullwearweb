import type { Product } from "../../../shared/products";

const categoryLabels: Record<string, string> = {
  "round-neck": "Round Neck",
  oversized: "Oversized",
  "acid-oversized": "Acid Wash",
  hoodie: "Hoodie",
};

function normalizeSearchText(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function normalizeCategory(value: string) {
  return normalizeSearchText(value);
}

export function getProductSearchCategory(product: Product): string {
  const category = normalizeCategory(product.category);
  if (category.includes("roundneck")) return "round-neck";
  if (category.includes("oversized") || category.includes("acidwash")) return "oversized";
  if (category.includes("hoodie")) return "hoodie";
  return product.category;
}

export function getSearchableProducts(catalogProducts: Product[]) {
  return catalogProducts;
}

export function matchesProductSearch(product: Product, query: string) {
  const category = product.category.toLowerCase();
  const searchableCategory = getProductSearchCategory(product);
  const categoryTerms = [
    category,
    categoryLabels[category] || "",
    category === "acid-oversized" ? "acid wash acidwash washed" : "",
    searchableCategory === "oversized" || searchableCategory === "round-neck"
      ? "tshirt t shirt tee"
      : "",
    searchableCategory === "oversized" ? "oversized acid wash acidwash" : "",
    searchableCategory === "hoodie" ? "hoodie" : "",
  ].join(" ");

  return normalizeSearchText(`${product.name} ${categoryTerms}`)
    .includes(normalizeSearchText(query));
}
