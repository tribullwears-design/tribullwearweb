import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getDatabase: vi.fn(), collection: vi.fn(), findOne: vi.fn(), updateOne: vi.fn() }));
vi.mock("./database.js", () => ({ getDatabase: mocks.getDatabase }));

import { getFeatureImage, listFeatureImages, saveFeatureImage } from "./featureImageStore.js";

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
      Promise.resolve(collection === "customize-image" ? { _id: "current", updatedAt: "2026-01-02T03:04:05.000Z" } : null));

    await expect(listFeatureImages()).resolves.toEqual({
      customize: "/api/storefront/feature-images/customize?v=2026-01-02T03%3A04%3A05.000Z",
      corporate: null,
    });
    expect(mocks.findOne).toHaveBeenCalledWith("customize-image", { _id: "current" }, { projection: { _id: 1, updatedAt: 1 } });
    expect(mocks.findOne).toHaveBeenCalledWith("corporate-image", { _id: "current" }, { projection: { _id: 1, updatedAt: 1 } });
  });

  it("reads image bytes separately from the listing response", async () => {
    mocks.findOne.mockResolvedValue({ image: "data:image/png;base64,aGVsbG8=" });

    await expect(getFeatureImage("customize")).resolves.toEqual({
      mimeType: "image/png",
      data: Buffer.from("hello"),
    });
    expect(mocks.findOne).toHaveBeenCalledWith(
      "customize-image",
      { _id: "current" },
      { projection: { image: 1 } },
    );
  });

  it("upserts each supported image into its matching collection", async () => {
    const image = `data:image/png;base64,${"a".repeat(32)}`;

    await expect(saveFeatureImage("corporate", image)).resolves.toEqual(expect.objectContaining({
      type: "corporate",
      image: expect.stringMatching(/^\/api\/storefront\/feature-images\/corporate\?v=/),
    }));
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
