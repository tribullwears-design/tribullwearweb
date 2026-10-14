import { describe, expect, it } from "vitest";
import { defaultProducts } from "../../../shared/products";
import { getProductSearchCategory, getSearchableProducts, matchesProductSearch } from "./productSearch";

describe("product search", () => {
  it("matches supported product and category terms independent of spaces or punctuation", () => {
    const product = (id: string) => defaultProducts.find((item) => item.id === id)!;

    expect(matchesProductSearch(product("daily-oversized"), "oversized")).toBe(true);
    expect(matchesProductSearch(product("acid-shadow"), "acidwash")).toBe(true);
    expect(matchesProductSearch(product("classic-hoodie"), "hoodie")).toBe(true);
    expect(matchesProductSearch(product("mass"), "round neck")).toBe(true);
    expect(matchesProductSearch(product("daily-oversized"), "tshirt")).toBe(true);
    expect(matchesProductSearch(product("classic-hoodie"), "tshirt")).toBe(false);
  });

  it("provides 8 Oversized and 8 Hoodie products for search", () => {
    const searchableProducts = getSearchableProducts(defaultProducts);

    expect(searchableProducts).toHaveLength(16);
    expect(searchableProducts.filter((product) => getProductSearchCategory(product) === "oversized")).toHaveLength(8);
    expect(searchableProducts.filter((product) => getProductSearchCategory(product) === "hoodie")).toHaveLength(8);
  });

  it("normalizes category casing and naming before selecting product image groups", () => {
    const baseProduct = defaultProducts[0];

    expect(getProductSearchCategory({ ...baseProduct, category: "Oversized Tee" })).toBe("oversized");
    expect(getProductSearchCategory({ ...baseProduct, category: "Acid Wash Oversized" })).toBe("oversized");
    expect(getProductSearchCategory({ ...baseProduct, category: "Hoodie" })).toBe("hoodie");
  });

  it("keeps category searches limited to products in that category", () => {
    const searchableProducts = getSearchableProducts(defaultProducts);
    const oversizedProducts = searchableProducts.filter((product) => matchesProductSearch(product, "oversized"));
    const hoodieProducts = searchableProducts.filter((product) => matchesProductSearch(product, "hoodie"));

    expect(oversizedProducts).toHaveLength(8);
    expect(oversizedProducts.every((product) => getProductSearchCategory(product) === "oversized")).toBe(true);
    expect(hoodieProducts).toHaveLength(8);
    expect(hoodieProducts.every((product) => getProductSearchCategory(product) === "hoodie")).toBe(true);
  });

  it("fills existing catalogs with missing default hoodie products up to eight", () => {
    const existingProducts = defaultProducts.filter((product) => getProductSearchCategory(product) === "hoodie").slice(0, 4);
    const searchProducts = getSearchableProducts(existingProducts);

    expect(searchProducts.filter((product) => getProductSearchCategory(product) === "hoodie")).toHaveLength(8);
  });
});
