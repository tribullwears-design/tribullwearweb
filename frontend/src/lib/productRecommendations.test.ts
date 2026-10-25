import { describe, expect, it } from "vitest";
import { getFrequentlyBoughtTogether } from "./productRecommendations";

const products = [
  { id: "1", name: "Current" },
  { id: "2", name: "Second" },
  { id: "3", name: "Third" },
  { id: "4", name: "Fourth" },
];

describe("getFrequentlyBoughtTogether", () => {
  it("includes four products, including the current product, when the catalog has four", () => {
    expect(getFrequentlyBoughtTogether(products, "1").map((product) => product.id)).toEqual(["1", "2", "3", "4"]);
  });

  it("returns four different products when the current product is not in the first four", () => {
    const catalog = [...products.slice(1), { id: "5", name: "Fifth" }, products[0]];
    expect(getFrequentlyBoughtTogether(catalog, "1").map((product) => product.id)).toEqual(["1", "2", "3", "4"]);
  });

  it("returns all available products when fewer than four exist", () => {
    expect(getFrequentlyBoughtTogether(products.slice(0, 3), "1")).toHaveLength(3);
  });
});
