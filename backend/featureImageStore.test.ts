import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getDatabase: vi.fn(), collection: vi.fn(), findOne: vi.fn(), updateOne: vi.fn() }));
vi.mock("./database.js", () => ({ getDatabase: mocks.getDatabase }));

import { listFeatureImages, saveFeatureImage } from "./featureImageStore.js";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.collection.mockImplementation((name: string) => ({
    findOne: (...args: unknown[]) => mocks.findOne(name, ...args),
    updateOne: (...args: unknown[]) => mocks.updateOne(name, ...args),
  }));
  mocks.getDatabase.mockResolvedValue({ collection: mocks.collection });
});

describe("feature image storage", () => {
  it("reads the images from their separate named collections", async () => {
    mocks.findOne.mockImplementation((collection: string) =>
      Promise.resolve(collection === "customize-image" ? { image: "custom-image" } : null));

    await expect(listFeatureImages()).resolves.toEqual({ customize: "custom-image", corporate: null });
    expect(mocks.findOne).toHaveBeenCalledWith("customize-image", { _id: "current" });
    expect(mocks.findOne).toHaveBeenCalledWith("corporate-image", { _id: "current" });
  });

  it("upserts each supported image into its matching collection", async () => {
    const image = `data:image/png;base64,${"a".repeat(32)}`;

    await expect(saveFeatureImage("corporate", image)).resolves.toEqual({ type: "corporate", image });
    expect(mocks.updateOne).toHaveBeenCalledWith(
      "corporate-image",
      { _id: "current" },
      { $set: { image, updatedAt: expect.any(String) } },
      { upsert: true },
    );
  });

  it("rejects non-image values before accessing MongoDB", async () => {
    await expect(saveFeatureImage("customize", "https://example.com/image.png")).rejects.toThrow("Upload a JPG, PNG, or WEBP image");
    expect(mocks.getDatabase).not.toHaveBeenCalled();
  });
});
