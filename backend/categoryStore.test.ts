import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ find: vi.fn(), getDatabase: vi.fn() }));
vi.mock("./database.js", () => ({ getDatabase: mocks.getDatabase }));

import { getRemovedCategoryAssignments, listCategories, type CategoryDocument } from "./categoryStore.js";

const cinema: CategoryDocument = {
  value: "cinema",
  label: "Cinema",
  position: 0,
  subcategories: [
    { value: "hollywood", label: "Hollywood" },
    { value: "bollywood", label: "Bollywood" },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.find.mockReturnValue({
    sort: vi.fn().mockReturnValue({
      toArray: vi.fn().mockResolvedValue([]),
    }),
  });
  mocks.getDatabase.mockResolvedValue({
    collection: vi.fn(() => ({ find: mocks.find })),
  });
});

describe("listCategories", () => {
  it("reads existing records, treats missing visibility as visible, and never seeds or rewrites them", async () => {
    const stored = [
      { ...cinema, image: "/stored/cinema.png" },
      {
        value: "sports",
        label: "Sports",
        image: "/stored/sports.png",
        position: 1,
        subcategories: [{ value: "cricket", label: "Cricket" }],
      },
      {
        value: "games",
        label: "Games",
        image: "/stored/games.png",
        isVisible: false,
        position: 2,
        subcategories: [],
      },
    ];
    mocks.find.mockReturnValue({
      sort: vi.fn().mockReturnValue({ toArray: vi.fn().mockResolvedValue(stored) }),
    });
    const collection = {
      find: mocks.find,
      countDocuments: vi.fn(),
      insertMany: vi.fn(),
      updateMany: vi.fn(),
    };
    mocks.getDatabase.mockResolvedValue({ collection: vi.fn(() => collection) });

    await expect(listCategories()).resolves.toEqual([
      { ...stored[0], isVisible: true, subcategories: stored[0]!.subcategories.map((item) => ({ ...item, isVisible: true })) },
      { ...stored[1], isVisible: true, subcategories: [{ value: "cricket", label: "Cricket", isVisible: true }] },
      { ...stored[2], subcategories: [] },
    ]);
    expect(mocks.find).toHaveBeenCalledWith({}, { projection: { _id: 0 } });
    expect(collection.countDocuments).not.toHaveBeenCalled();
    expect(collection.insertMany).not.toHaveBeenCalled();
    expect(collection.updateMany).not.toHaveBeenCalled();
  });
});

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
