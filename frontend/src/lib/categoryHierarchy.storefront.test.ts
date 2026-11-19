import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ apiFetch: vi.fn() }));
vi.mock("./api", () => ({ apiFetch: mocks.apiFetch }));

import { fromApiDocuments, getStorefrontCategoryHierarchy, getStorefrontHomeCategories, getStorefrontMainCategories, loadCategoryHierarchy } from "./categoryHierarchy";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("storefront main categories", () => {
  it("fetches category records and retains visible IDs, images, and subcategory relationships", async () => {
    mocks.apiFetch.mockResolvedValue(new Response(JSON.stringify([
      {
        value: "cinema",
        label: "Cinema",
        image: "/stored/cinema.png",
        subcategories: [{ value: "kollywood", label: "Kollywood" }],
      },
      {
        value: "sports",
        label: "Sports",
        image: "/stored/sports.png",
        isVisible: false,
        subcategories: [{ value: "cricket", label: "Cricket" }],
      },
      {
        value: "games",
        label: "Games",
        image: "/stored/games.png",
        isVisible: true,
        subcategories: [{ value: "pc-games", label: "PC Games" }],
      },
      {
        value: "motorsports",
        label: "MotoSports",
        image: "/stored/motorsports.png",
        subcategories: [{ value: "bike", label: "Bike" }],
      },
    ]), { status: 200, headers: { "content-type": "application/json" } }));

    const fetched = await loadCategoryHierarchy();
    const storefront = getStorefrontCategoryHierarchy(fetched);
    const cards = getStorefrontMainCategories(storefront);

    expect(mocks.apiFetch).toHaveBeenCalledWith("/api/categories", { cache: "no-store" });
    expect(cards.map(({ value, label, image, href }) => ({ value, label, image, href }))).toEqual([
      { value: "cinema", label: "Cinema", image: "/stored/cinema.png", href: "/category/cinema" },
      { value: "games", label: "Games", image: "/stored/games.png", href: "/category/games" },
      { value: "motorsports", label: "MotoSports", image: "/stored/motorsports.png", href: "/category/motorsports" },
    ]);
    expect(storefront.subcategories.cinema).toEqual([{ value: "kollywood", label: "Kollywood", isVisible: true }]);
    expect(storefront.subcategories.motorsports).toEqual([{ value: "bike", label: "Bike", isVisible: true }]);
  });

  it("treats absent visibility as visible but filters an explicit hidden flag", () => {
    const hierarchy = fromApiDocuments([
      { value: "games", label: "Games", image: "/games.png" },
      { value: "sports", label: "Sports", isVisible: false },
    ]);

    expect(getStorefrontCategoryHierarchy(hierarchy).main.map(({ value }) => value)).toEqual(["games"]);
  });

  it("maps cinema language artwork to the correct category for storefront display", () => {
    const hierarchy = fromApiDocuments([{
      value: "cinema",
      label: "Cinema",
      subcategories: [
        { value: "hollywood", label: "Hollywood", image: "data:image/webp;base64,tamil" },
        { value: "bollywood", label: "Bollywood", image: "data:image/webp;base64,malayalam" },
        { value: "kollywood", label: "Kollywood", image: "data:image/webp;base64,telugu" },
        { value: "tollywood", label: "Tollywood", image: "data:image/webp;base64,kannada" },
        { value: "mollywood", label: "Mollywood", image: "data:image/webp;base64,hindi" },
        { value: "sandalwood", label: "Sandalwood", image: "data:image/webp;base64,english" },
      ],
    }]);

    const storefront = getStorefrontCategoryHierarchy(hierarchy);

    expect(storefront.subcategories.cinema?.map(({ value, image }) => ({ value, image }))).toEqual([
      { value: "hollywood", image: "data:image/webp;base64,english" },
      { value: "bollywood", image: "data:image/webp;base64,hindi" },
      { value: "kollywood", image: "data:image/webp;base64,tamil" },
      { value: "tollywood", image: "data:image/webp;base64,telugu" },
      { value: "mollywood", image: "data:image/webp;base64,malayalam" },
      { value: "sandalwood", image: "data:image/webp;base64,kannada" },
    ]);
    expect(hierarchy.subcategories.cinema?.[0].image).toBe("data:image/webp;base64,tamil");
  });

  it("surfaces API failures to the caller for the homepage error state", async () => {
    mocks.apiFetch.mockResolvedValue(new Response("unavailable", { status: 503 }));

    await expect(loadCategoryHierarchy()).rejects.toThrow("Category request failed");
  });

  it("replaces the homepage Cinema card with stored Cinema subcategories", () => {
    const hierarchy = getStorefrontCategoryHierarchy(fromApiDocuments([
      {
        value: "cinema",
        label: "Cinema",
        subcategories: [
          { value: "hollywood", label: "Hollywood", image: "/stored/hollywood.png" },
          { value: "bollywood", label: "Bollywood" },
        ],
      },
      { value: "sports", label: "Sports", image: "/stored/sports.png" },
    ]));

    expect(getStorefrontHomeCategories(hierarchy)).toEqual([
      {
        value: "hollywood",
        label: "Hollywood",
        image: "/stored/hollywood.png",
        isVisible: true,
        href: "/category/cinema/hollywood",
      },
      {
        value: "bollywood",
        label: "Bollywood",
        image: "/products/front-white.png",
        isVisible: true,
        href: "/category/cinema/bollywood",
      },
      {
        value: "sports",
        label: "Sports",
        image: "/stored/sports.png",
        isVisible: true,
        href: "/category/sports",
      },
    ]);
  });
});
