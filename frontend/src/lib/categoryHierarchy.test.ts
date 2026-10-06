import { describe, expect, it } from "vitest";
import { defaultCategoryHierarchy, getStorefrontCategoryHierarchy } from "./categoryHierarchy";

describe("defaultCategoryHierarchy", () => {
  it("keeps Cinema as the only default storefront category", () => {
    expect(defaultCategoryHierarchy.main.map((category) => category.value)).toEqual(["cinema"]);
    expect(defaultCategoryHierarchy.main.every((category) => Boolean(category.image))).toBe(true);
    expect(defaultCategoryHierarchy.subcategories.sports).toHaveLength(3);
    expect(defaultCategoryHierarchy.subcategories.games).toHaveLength(2);
    expect(defaultCategoryHierarchy.subcategories.motorsports).toHaveLength(2);
  });

  it("hides non-Cinema categories from storefront hierarchies without deleting their data", () => {
    const hierarchy = getStorefrontCategoryHierarchy({
      main: [
        { value: "cinema", label: "Cinema" },
        { value: "sports", label: "Sports" },
      ],
      subcategories: {
        cinema: [{ value: "kollywood", label: "Kollywood" }],
        sports: [{ value: "cricket", label: "Cricket" }],
      },
    });

    expect(hierarchy.main.map((category) => category.value)).toEqual(["cinema"]);
    expect(hierarchy.subcategories).toEqual({
      cinema: [{ value: "kollywood", label: "Kollywood" }],
    });
  });
});
