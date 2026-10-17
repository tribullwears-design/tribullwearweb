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

  it("filters hidden categories and subcategories without deleting their data", () => {
    const hierarchy = getStorefrontCategoryHierarchy({
      main: [
        { value: "cinema", label: "Cinema" },
        { value: "sports", label: "Sports", isVisible: false },
      ],
      subcategories: {
        cinema: [
          { value: "kollywood", label: "Kollywood" },
          { value: "tollywood", label: "Tollywood", isVisible: false },
        ],
        sports: [{ value: "cricket", label: "Cricket" }],
      },
    });

    expect(hierarchy.main.map((category) => category.value)).toEqual(["cinema"]);
    expect(hierarchy.subcategories).toEqual({
      cinema: [{ value: "kollywood", label: "Kollywood" }],
    });
  });

  it("treats visibility fields missing from legacy records as visible", () => {
    const hierarchy = getStorefrontCategoryHierarchy({
      main: [{ value: "sports", label: "Sports" }],
      subcategories: {
        sports: [{ value: "cricket", label: "Cricket" }],
      },
    });

    expect(hierarchy.main.map((category) => category.value)).toEqual(["sports"]);
    expect(hierarchy.subcategories.sports).toEqual([{ value: "cricket", label: "Cricket" }]);
  });

  it("uses the stored category icon and stable category value for storefront links", async () => {
    const { getStorefrontMainCategories } = await import("./categoryHierarchy");
    const categories = getStorefrontMainCategories({
      main: [
        { value: "cinema", label: "Cinema", image: "/stored/cinema.webp" },
        { value: "sports", label: "Sports", isVisible: false },
        { value: "motorsports", label: "MotoSports", image: "/stored/moto.png" },
      ],
      subcategories: {},
    });

    expect(categories).toEqual([
      { value: "cinema", label: "Cinema", image: "/stored/cinema.webp", href: "/category/cinema" },
      { value: "motorsports", label: "MotoSports", image: "/stored/moto.png", href: "/category/motorsports" },
    ]);
  });
});
