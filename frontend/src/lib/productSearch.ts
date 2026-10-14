import { defaultProducts, type Product } from "../../../shared/products";

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

export function getProductSearchCategory(product: Product): "oversized" | "hoodie" | null {
  const category = normalizeCategory(product.category);
  if (category.includes("oversized") || category.includes("acidwash")) return "oversized";
  if (category.includes("hoodie")) return "hoodie";
  return null;
}

export function getSearchableProducts(catalogProducts: Product[]) {
  const products = catalogProducts.filter((product) => getProductSearchCategory(product) !== null);
  const hoodieCount = products.filter((product) => getProductSearchCategory(product) === "hoodie").length;
  if (hoodieCount >= 8) return products;

  const productIds = new Set(products.map((product) => product.id));
  const supplementalHoodies = defaultProducts.filter(
    (product) => getProductSearchCategory(product) === "hoodie" && !productIds.has(product.id),
  );
  return [...products, ...supplementalHoodies.slice(0, 8 - hoodieCount)];
}

export function matchesProductSearch(product: Product, query: string) {
  const category = product.category.toLowerCase();
  const searchableCategory = getProductSearchCategory(product);
  const categoryTerms = [
    category,
    categoryLabels[category] || "",
    category === "acid-oversized" ? "acid wash acidwash washed" : "",
    searchableCategory === "oversized" || category === "round-neck"
      ? "tshirt t shirt tee"
      : "",
    searchableCategory === "oversized" ? "oversized acid wash acidwash" : "",
    searchableCategory === "hoodie" ? "hoodie" : "",
  ].join(" ");

  return normalizeSearchText(`${product.name} ${categoryTerms}`)
    .includes(normalizeSearchText(query));
}
