import { describe, expect, it } from "vitest";
import { getRemovedCategoryAssignments, type CategoryDocument } from "./categoryStore.js";

const cinema: CategoryDocument = {
  value: "cinema",
  label: "Cinema",
  position: 0,
  subcategories: [
    { value: "hollywood", label: "Hollywood" },
    { value: "bollywood", label: "Bollywood" },
  ],
};

describe("getRemovedCategoryAssignments", () => {
  it("identifies removed main categories and all their product assignments", () => {
    expect(getRemovedCategoryAssignments([cinema], [])).toEqual([{ mainCategoryId: "cinema" }]);
  });

  it("identifies removed subcategories without treating retained categories as removed", () => {
    const next = { ...cinema, subcategories: [cinema.subcategories[0]] };
    expect(getRemovedCategoryAssignments([cinema], [next])).toEqual([
      { mainCategoryId: "cinema", subcategoryId: "bollywood" },
    ]);
  });

  it("does not treat label, image, or visibility changes as removed assignments", () => {
    const next = {
      ...cinema,
      label: "Film",
      image: "/products/film.png",
      subcategories: cinema.subcategories.map((subcategory) => ({ ...subcategory, isVisible: false })),
    };
    expect(getRemovedCategoryAssignments([cinema], [next])).toEqual([]);
  });
});
