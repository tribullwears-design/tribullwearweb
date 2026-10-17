import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ findOneAndUpdate: vi.fn(), getDatabase: vi.fn() }));
vi.mock("./database.js", () => ({ getDatabase: mocks.getDatabase }));

import { setCategoryVisibility, setSubcategoryVisibility } from "./categoryStore.js";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getDatabase.mockResolvedValue({ collection: () => ({ findOneAndUpdate: mocks.findOneAndUpdate }) });
  mocks.findOneAndUpdate.mockResolvedValue({ value: "sports", isVisible: false });
});

describe("category visibility persistence", () => {
  it("persists visibility changes for a main category", async () => {
    await setCategoryVisibility("sports", false);
    expect(mocks.findOneAndUpdate).toHaveBeenCalledWith(
      { value: "sports" },
      { $set: { isVisible: false } },
      expect.objectContaining({ returnDocument: "after" }),
    );
  });

  it("persists visibility changes for a subcategory", async () => {
    await setSubcategoryVisibility("sports", "cricket", false);
    expect(mocks.findOneAndUpdate).toHaveBeenCalledWith(
      { value: "sports", "subcategories.value": "cricket" },
      { $set: { "subcategories.$.isVisible": false } },
      expect.objectContaining({ returnDocument: "after" }),
    );
  });
});
