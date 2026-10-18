import { describe, expect, it } from "vitest";
import type { Product } from "../../../shared/products";
import type { CategoryHierarchy } from "./categoryHierarchy";
import { getBestSellingProducts, getNewArrivals } from "./homeProducts";
import type { StorefrontProduct } from "./products";

const hierarchy: CategoryHierarchy = {
  loaded: true,
  main: [
    { value: "cinema", label: "Cinema" },
    { value: "hidden", label: "Hidden", isVisible: false },
  ],
  subcategories: {
    cinema: [
      { value: "visible", label: "Visible" },
      { value: "hidden", label: "Hidden", isVisible: false },
    ],
    hidden: [{ value: "visible", label: "Visible" }],
  },
};

function product(id: string, created: number, sold = 0, category = "cinema", subcategory = "visible"): StorefrontProduct {
  const base: Product = {
    id,
    name: id,
    category: "hoodie",
    price: 1000,
    image: `/${id}.jpg`,
    created,
    sold,
  };
  return { ...base, mainCategoryId: category, subcategoryId: subcategory };
}

describe("home product sections", () => {
  const products = [
    { ...product("oldest", 1, 1), newArrival: true, bestSelling: true },
    { ...product("newest", 5, 2), newArrival: true, bestSelling: true },
    { ...product("new", 4, 4), newArrival: true, bestSelling: true },
    { ...product("middle", 3, 3), newArrival: true, bestSelling: true },
    { ...product("older", 2, 5), newArrival: true, bestSelling: true },
    product("hidden-category", 6, 100, "hidden"),
    product("hidden-subcategory", 7, 100, "cinema", "hidden"),
    product("newest", 5, 2),
  ];

  it("returns every distinct eligible arrival newest-first", () => {
    expect(getNewArrivals(products, hierarchy).map(({ id }) => id))
      .toEqual(["newest", "new", "middle", "older", "oldest"]);
  });

  it("uses sales ordering for flagged best-selling products", () => {
    expect(getBestSellingProducts(products, hierarchy).map(({ id }) => id))
      .toEqual(["older", "new", "middle", "newest", "oldest"]);
    expect(getBestSellingProducts(products.map((item) => ({ ...item, sold: 0 })), hierarchy).map(({ id }) => id))
      .toEqual(["newest", "new", "middle", "older", "oldest"]);
  });

  it("keeps unflagged products out of both homepage sections", () => {
    expect(getNewArrivals([product("unflagged", 9)], hierarchy)).toEqual([]);
    expect(getBestSellingProducts([product("unflagged", 9, 10)], hierarchy)).toEqual([]);
  });
});
